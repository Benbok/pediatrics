/**
 * Standalone версия API Key Manager для тестов (без Electron)
 */

// Простой logger для тестов
const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    debug: (...args) => {} // Отключаем debug в тестах
};

// Внутреннее состояние
let keys = [];
let keyMetadata = new Map();
let currentKeyIndex = 0;
let isInitialized = false;

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
 * Инициализация менеджера ключей
 */
function initialize() {
    if (isInitialized) {
        logger.warn('[ApiKeyManager] Already initialized');
        return;
    }
    
    keys = loadKeysFromEnv();
    
    if (keys.length === 0) {
        logger.error('[ApiKeyManager] No keys available');
        isInitialized = true;
        return;
    }
    
    // Инициализируем метаданные для всех ключей
    keys.forEach((key, index) => {
        keyMetadata.set(index, {
            status: 'active',
            errorCount: 0,
            lastUsed: null,
            lastError: null,
            failedAt: null
        });
    });
    
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
 * Определение, нужно ли ротировать ключ при ошибке
 */
function shouldRotateKey(error) {
    const errorMsg = (error?.message || String(error) || '').toLowerCase();
    
    // Rate limit (429)
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('resource_exhausted')) {
        return true;
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
function markKeyAsFailed(keyIndex, errorMessage) {
    const metadata = keyMetadata.get(keyIndex);
    if (!metadata) {
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
}

/**
 * Ротация на следующий рабочий ключ
 */
function rotateToNextKey() {
    const startIndex = currentKeyIndex;
    let checkedKeys = 0;
    
    while (checkedKeys < keys.length) {
        currentKeyIndex = (currentKeyIndex + 1) % keys.length;
        checkedKeys++;
        
        const metadata = keyMetadata.get(currentKeyIndex);
        if (metadata && metadata.status === 'active') {
            logger.info(`[ApiKeyManager] Rotated to key ${currentKeyIndex}`);
            return true;
        }
    }
    
    logger.error('[ApiKeyManager] No active keys available!');
    return false;
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
                metadata.errorCount = 0;
            }
            
            return result;
            
        } catch (error) {
            lastError = error;
            logger.error(`[ApiKeyManager] Key ${currentIndex} failed:`, error.message);
            
            if (shouldRotateKey(error)) {
                markKeyAsFailed(currentIndex, error.message);
                
                const rotated = rotateToNextKey();
                if (!rotated) {
                    throw new Error('All API keys exhausted');
                }
                
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 1000));
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
 * Получить статус пула
 */
function getPoolStatus() {
    const active = getWorkingKeysCount();
    const failed = keys.length - active;
    
    return {
        total: keys.length,
        active,
        failed,
        currentKeyIndex
    };
}

const apiKeyManager = {
    initialize,
    getActiveKey,
    retryWithRotation,
    getPoolStatus,
    getWorkingKeysCount
};

module.exports = { apiKeyManager };
