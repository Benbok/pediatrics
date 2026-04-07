/**
 * API Key Manager Service
 * 
 * Управляет пулом API ключей Gemini с автоматической ротацией при ошибках.
 * Ключи загружаются из .env файла (GEMINI_API_KEYS), статусы сохраняются в JSON.
 */

const { logger } = require('../logger.cjs');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

// Путь к файлу статусов
const STATUS_FILE_PATH = path.join(app.getPath('userData'), 'api-keys-status.json');

// Внутреннее состояние
let keys = []; // Массив ключей
let keyMetadata = new Map(); // Map<index, {status, errorCount, lastUsed, lastError, failedAt}>
let currentKeyIndex = 0;
let isInitialized = false;
let rotationMutex = false; // Mutex для предотвращения concurrent ротаций

/**
 * Валидация API ключа
 */
function validateApiKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (key.length < 30) return false;
    if (!key.startsWith('AIza')) return false;
    return /^AIza[A-Za-z0-9_-]+$/.test(key);
}

/**
 * Загрузка ключей из переменных окружения
 */
function loadKeysFromEnv() {
    const keysString = process.env.GEMINI_API_KEYS;
    
    if (keysString) {
        // Новый формат: массив через запятую
        const rawKeys = keysString.split(',').map(k => k.trim()).filter(k => k);
        const validKeys = rawKeys.filter((key, idx) => {
            const isValid = validateApiKey(key);
            if (!isValid) {
                logger.warn(`[ApiKeyManager] Invalid key at index ${idx}, skipping`);
            }
            return isValid;
        });
        
        logger.info(`[ApiKeyManager] Loaded ${validKeys.length} keys from GEMINI_API_KEYS`);
        return validKeys;
    }
    
    // Fallback на старый формат
    const singleKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (singleKey) {
        if (validateApiKey(singleKey)) {
            logger.warn('[ApiKeyManager] Using single key (legacy mode)');
            return [singleKey];
        } else {
            logger.warn('[ApiKeyManager] Single key found but invalid, skipping');
        }
    }
    
    logger.error('[ApiKeyManager] No valid API keys found in environment');
    return [];
}

/**
 * Загрузка статусов из JSON файла
 */
async function loadStatusFromFile() {
    try {
        const data = await fs.readFile(STATUS_FILE_PATH, 'utf8');
        const status = JSON.parse(data);
        
        // Восстанавливаем Map из массива
        keyMetadata.clear();
        if (status.keys && Array.isArray(status.keys)) {
            status.keys.forEach(keyStatus => {
                keyMetadata.set(keyStatus.index, {
                    status: keyStatus.status || 'active',
                    errorCount: keyStatus.errorCount || 0,
                    lastUsed: keyStatus.lastUsed ? new Date(keyStatus.lastUsed) : null,
                    lastError: keyStatus.lastError || null,
                    failedAt: keyStatus.failedAt ? new Date(keyStatus.failedAt) : null
                });
            });
        }
        
        currentKeyIndex = status.currentKeyIndex || 0;
        
        logger.info(`[ApiKeyManager] Loaded status for ${keyMetadata.size} keys from file`);
        return status;
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.info('[ApiKeyManager] Status file not found, will create new one');
            return null;
        }
        logger.error('[ApiKeyManager] Failed to load status file:', error);
        return null;
    }
}

/**
 * Сохранение статусов в JSON файл
 */
async function saveStatusToFile() {
    try {
        // Преобразуем Map в массив для JSON
        const keysArray = Array.from(keyMetadata.entries()).map(([index, metadata]) => ({
            index,
            status: metadata.status,
            errorCount: metadata.errorCount,
            lastUsed: metadata.lastUsed ? metadata.lastUsed.toISOString() : null,
            lastError: metadata.lastError,
            failedAt: metadata.failedAt ? metadata.failedAt.toISOString() : null
        }));
        
        const status = {
            keys: keysArray,
            currentKeyIndex,
            lastRotation: new Date().toISOString(),
            totalRotations: keysArray.filter(k => k.status === 'failed').length,
            updatedAt: new Date().toISOString()
        };
        
        // Убеждаемся, что директория существует
        const dir = path.dirname(STATUS_FILE_PATH);
        await fs.mkdir(dir, { recursive: true });
        
        await fs.writeFile(STATUS_FILE_PATH, JSON.stringify(status, null, 2), 'utf8');
        logger.debug('[ApiKeyManager] Status saved to file');
    } catch (error) {
        logger.error('[ApiKeyManager] Failed to save status file:', error);
    }
}

/**
 * Инициализация менеджера ключей
 */
async function initialize() {
    if (isInitialized) {
        logger.warn('[ApiKeyManager] Already initialized');
        return;
    }
    
    // Загружаем ключи из .env
    keys = loadKeysFromEnv();
    
    if (keys.length === 0) {
        logger.error('[ApiKeyManager] No keys available, API features will be disabled');
        isInitialized = true;
        return;
    }
    
    // Загружаем статусы из файла
    const savedStatus = await loadStatusFromFile();
    
    // Инициализируем метаданные для всех ключей
    keys.forEach((key, index) => {
        if (!keyMetadata.has(index)) {
            // Если нет сохраненного статуса, создаем новый
            const saved = savedStatus?.keys?.find(k => k.index === index);
            keyMetadata.set(index, {
                status: saved?.status || 'active',
                errorCount: saved?.errorCount || 0,
                lastUsed: saved?.lastUsed ? new Date(saved.lastUsed) : null,
                lastError: saved?.lastError || null,
                failedAt: saved?.failedAt ? new Date(saved.failedAt) : null
            });
        }
    });
    
    // Восстанавливаем текущий индекс, если был сохранен
    if (savedStatus?.currentKeyIndex !== undefined) {
        currentKeyIndex = savedStatus.currentKeyIndex;
    }
    
    // Проверяем, что текущий ключ активен
    const currentMetadata = keyMetadata.get(currentKeyIndex);
    if (!currentMetadata || currentMetadata.status !== 'active') {
        // Ищем первый активный ключ
        const activeIndex = keys.findIndex((_, idx) => {
            const meta = keyMetadata.get(idx);
            return meta && meta.status === 'active';
        });
        
        if (activeIndex >= 0) {
            currentKeyIndex = activeIndex;
            logger.info(`[ApiKeyManager] Switched to active key at index ${currentKeyIndex}`);
        } else {
            logger.warn('[ApiKeyManager] No active keys found, using first key');
            currentKeyIndex = 0;
        }
    }
    
    // Сохраняем начальное состояние
    await saveStatusToFile();
    
    isInitialized = true;
    logger.info(`[ApiKeyManager] Initialized with ${keys.length} keys, current: ${currentKeyIndex}`);
}

/**
 * Получить текущий активный ключ
 */
function getActiveKey() {
    if (!isInitialized) {
        throw new Error('ApiKeyManager not initialized. Call initialize() first.');
    }
    
    if (keys.length === 0) {
        throw new Error('No API keys available');
    }
    
    const key = keys[currentKeyIndex];
    if (!key) {
        throw new Error(`Key at index ${currentKeyIndex} not found`);
    }
    
    return key;
}

/**
 * Определение: ошибка rate-limit (временная, не помечать ключ как failed)
 */
function isRateLimitError(error) {
    const errorMsg = (error?.message || String(error) || '').toLowerCase();
    return errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('resource_exhausted');
}

/**
 * Определение, нужно ли ротировать ключ при ошибке
 */
function shouldRotateKey(error) {
    const errorMsg = (error?.message || String(error) || '').toLowerCase();

    // Rate limit / quota (429): каждый ключ имеет свой независимый лимит — ротация оправдана.
    if (isRateLimitError(error)) {
        return true;
    }

    // Location / policy restrictions: also not a key problem.
    if (errorMsg.includes('location is not supported') || errorMsg.includes('failed_precondition')) {
        return false;
    }
    
    // Auth errors (401, 403)
    if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('api key')) {
        return true;
    }
    
    // Invalid key
    if (errorMsg.includes('invalid') && errorMsg.includes('key')) {
        return true;
    }
    
    return false;
}

/**
 * Отметить ключ как failed
 */
async function markKeyAsFailed(keyIndex, errorMessage) {
    const metadata = keyMetadata.get(keyIndex);
    if (!metadata) {
        // Создаем метаданные, если их нет
        keyMetadata.set(keyIndex, {
            status: 'active',
            errorCount: 0,
            lastUsed: null,
            lastError: null,
            failedAt: null
        });
    }
    
    const meta = keyMetadata.get(keyIndex);
    meta.errorCount++;
    meta.lastError = errorMessage;
    
    // Mark as failed after 3 consecutive errors
    if (meta.errorCount >= 3) {
        meta.status = 'failed';
        meta.failedAt = new Date();
        logger.warn(`[ApiKeyManager] Key ${keyIndex} marked as FAILED (${meta.errorCount} errors)`);
    }
    
    await saveStatusToFile();
}

/**
 * Ротация на следующий рабочий ключ
 */
async function rotateToNextKey() {
    // Mutex для предотвращения concurrent ротаций
    if (rotationMutex) {
        logger.warn('[ApiKeyManager] Rotation already in progress, skipping');
        return false;
    }
    
    rotationMutex = true;
    
    try {
        const startIndex = currentKeyIndex;
        let checkedKeys = 0;
        
        while (checkedKeys < keys.length) {
            currentKeyIndex = (currentKeyIndex + 1) % keys.length;
            checkedKeys++;
            
            const metadata = keyMetadata.get(currentKeyIndex);
            if (metadata && metadata.status === 'active') {
                logger.info(`[ApiKeyManager] Rotated to key ${currentKeyIndex}`);
                await saveStatusToFile();
                rotationMutex = false;
                return true;
            }
        }
        
        logger.error('[ApiKeyManager] No active keys available!');
        rotationMutex = false;
        return false;
    } catch (error) {
        rotationMutex = false;
        logger.error('[ApiKeyManager] Error during rotation:', error);
        throw error;
    }
}

/**
 * Retry с автоматической ротацией
 */
async function retryWithRotation(operation, maxAttempts = 5) {
    let attempts = 0;
    let lastError = null;
    
    while (attempts < maxAttempts) {
        const currentIndex = currentKeyIndex;
        const apiKey = keys[currentIndex];
        
        if (!apiKey) {
            throw new Error('No API keys available');
        }
        
        try {
            const result = await operation(apiKey);
            
            // Success - update metadata
            const metadata = keyMetadata.get(currentIndex);
            if (metadata) {
                metadata.lastUsed = new Date();
                metadata.errorCount = 0; // Reset error count on success
            } else {
                keyMetadata.set(currentIndex, {
                    status: 'active',
                    errorCount: 0,
                    lastUsed: new Date(),
                    lastError: null,
                    failedAt: null
                });
            }
            
            await saveStatusToFile();
            
            return result;
            
        } catch (error) {
            lastError = error;
            logger.error(`[ApiKeyManager] Key ${currentIndex} failed:`, error.message);
            
            if (shouldRotateKey(error)) {
                if (isRateLimitError(error)) {
                    // Rate-limit: временная ошибка — ротируем без пометки ключа как failed
                    logger.warn(`[ApiKeyManager] Key ${currentIndex} rate-limited, rotating without marking failed`);
                } else {
                    // Auth/invalid key: постоянная ошибка — помечаем как failed
                    await markKeyAsFailed(currentIndex, error.message);
                    // Check if need to notify
                    if (shouldNotifyUser()) {
                        sendLowKeysWarning();
                    }
                }
                
                // Rotate to next key
                const rotated = await rotateToNextKey();
                if (!rotated) {
                    throw new Error('All API keys exhausted');
                }
                
                attempts++;
                // Небольшая задержка перед следующей попыткой
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }
            
            // Non-recoverable error - don't rotate
            throw error;
        }
    }
    
    throw new Error(`All retry attempts exhausted. Last error: ${lastError?.message}`);
}

/**
 * Получить количество рабочих ключей
 */
function getWorkingKeysCount() {
    let count = 0;
    for (let i = 0; i < keys.length; i++) {
        const metadata = keyMetadata.get(i);
        if (metadata && metadata.status === 'active') {
            count++;
        }
    }
    return count;
}

/**
 * Проверка, нужно ли уведомить пользователя
 */
function shouldNotifyUser() {
    return getWorkingKeysCount() <= 2;
}

/**
 * Отправка предупреждения через IPC
 */
function sendLowKeysWarning() {
    try {
        const { BrowserWindow } = require('electron');
        const mainWindow = BrowserWindow.getAllWindows()[0];
        
        if (mainWindow) {
            const remaining = getWorkingKeysCount();
            mainWindow.webContents.send('api-keys:low-warning', {
                remaining,
                total: keys.length
            });
            logger.warn(`[ApiKeyManager] Sent low keys warning: ${remaining} remaining`);
        }
    } catch (error) {
        logger.error('[ApiKeyManager] Failed to send warning:', error);
    }
}

/**
 * Сброс статуса ключа
 */
async function resetKeyStatus(keyIndex) {
    const metadata = keyMetadata.get(keyIndex);
    if (metadata) {
        metadata.status = 'active';
        metadata.errorCount = 0;
        metadata.lastError = null;
        metadata.failedAt = null;
        await saveStatusToFile();
        logger.info(`[ApiKeyManager] Reset status for key ${keyIndex}`);
        return true;
    }
    return false;
}

/**
 * Сброс статусов всех ключей
 */
async function resetAllKeys() {
    keyMetadata.forEach((metadata, index) => {
        metadata.status = 'active';
        metadata.errorCount = 0;
        metadata.lastError = null;
        metadata.failedAt = null;
    });
    await saveStatusToFile();
    logger.info('[ApiKeyManager] Reset all keys status');
}

/**
 * Перезагрузка ключей из .env
 */
async function reloadFromEnv() {
    const newKeys = loadKeysFromEnv();
    
    if (newKeys.length === 0) {
        logger.error('[ApiKeyManager] No keys found in .env after reload');
        return { success: false, keysCount: 0 };
    }
    
    // Обновляем список ключей
    keys = newKeys;
    
    // Обновляем метаданные для новых ключей
    keys.forEach((key, index) => {
        if (!keyMetadata.has(index)) {
            keyMetadata.set(index, {
                status: 'active',
                errorCount: 0,
                lastUsed: null,
                lastError: null,
                failedAt: null
            });
        }
    });
    
    // Удаляем метаданные для ключей, которых больше нет
    const maxIndex = keys.length - 1;
    for (const [index] of keyMetadata.entries()) {
        if (index > maxIndex) {
            keyMetadata.delete(index);
        }
    }
    
    // Проверяем текущий индекс
    if (currentKeyIndex >= keys.length) {
        currentKeyIndex = 0;
    }
    
    await saveStatusToFile();
    logger.info(`[ApiKeyManager] Reloaded ${keys.length} keys from .env`);
    
    return { success: true, keysCount: keys.length };
}

/**
 * Получить статус пула
 */
function getPoolStatus() {
    const active = getWorkingKeysCount();
    const failed = keys.length - active;
    
    const keysArray = Array.from(keyMetadata.entries()).map(([index, metadata]) => ({
        index,
        status: metadata.status,
        errorCount: metadata.errorCount,
        lastUsed: metadata.lastUsed ? metadata.lastUsed.toISOString() : null,
        lastError: metadata.lastError
    }));
    
    return {
        total: keys.length,
        active,
        failed,
        currentKeyIndex,
        needsAttention: active <= 2,
        keys: keysArray
    };
}

// Создаем объект с методами для удобного использования
const apiKeyManager = {
    initialize,
    getActiveKey,
    retryWithRotation,
    markKeyAsFailed,
    rotateToNextKey,
    resetKeyStatus,
    resetAllKeys,
    reloadFromEnv,
    getPoolStatus,
    getWorkingKeysCount,
    shouldNotifyUser,
    shouldRotateKey
};

module.exports = { apiKeyManager };
