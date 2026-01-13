/**
 * Сервис для работы с Gemini Text Embeddings API
 * Используется для семантического поиска заболеваний по симптомам
 */

const { logger } = require('../logger.cjs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// LRU кэш для embeddings (простая реализация)
const embeddingCache = new Map();
const MAX_CACHE_SIZE = 1000;

// Кэш для результатов semantic search (TTL: 5 минут)
const searchCache = new Map();
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Lazy load apiKeyManager (will be initialized after app ready)
let apiKeyManager = null;
function getApiKeyManager() {
    if (!apiKeyManager) {
        try {
            const manager = require('./apiKeyManager.cjs');
            apiKeyManager = manager.apiKeyManager;
        } catch (error) {
            logger.warn('[EmbeddingService] ApiKeyManager not available, using fallback');
        }
    }
    return apiKeyManager;
}

/**
 * Получает API ключ Gemini (fallback для обратной совместимости)
 */
function getApiKey() {
    const manager = getApiKeyManager();
    if (manager) {
        try {
            return manager.getActiveKey();
        } catch (error) {
            logger.warn('[EmbeddingService] Failed to get key from manager, using env fallback');
        }
    }
    return process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
}

/**
 * Получает базовый URL для API (опционально)
 */
function getBaseUrl() {
    return process.env.GEMINI_BASE_URL || null;
}

/**
 * Внутренняя функция для выполнения запроса embedding с конкретным ключом
 */
function _generateEmbeddingWithKey(apiKey, text) {
    const baseUrl = getBaseUrl() || 'https://generativelanguage.googleapis.com';
    const model = 'text-embedding-004';
    
    // Формируем URL для embeddings API
    const urlPath = `/v1beta/models/${model}:embedContent?key=${apiKey}`;
    const url = new URL(urlPath, baseUrl);

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            content: {
                parts: [{ text: text }]
            }
        });

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const client = url.protocol === 'https:' ? https : http;

        const req = client.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        const error = JSON.parse(data);
                        logger.error('[EmbeddingService] API error:', error);
                        reject(new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`));
                        return;
                    }

                    const response = JSON.parse(data);
                    const embedding = response.embedding?.values;

                    if (!embedding || !Array.isArray(embedding)) {
                        reject(new Error('Invalid embedding response from Gemini API'));
                        return;
                    }

                    resolve(embedding);
                } catch (error) {
                    logger.error('[EmbeddingService] Failed to parse response:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            logger.error('[EmbeddingService] Request error:', error);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Генерирует embedding для текста через Gemini API
 * Использует модель text-embedding-004 (самая новая)
 * @param {string} text - Текст для генерации embedding
 * @returns {Promise<number[]>} Массив чисел (вектор embedding)
 */
async function generateEmbedding(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Текст для embedding не может быть пустым');
    }

    // Проверка кэша
    const cacheKey = text.trim().toLowerCase();
    if (embeddingCache.has(cacheKey)) {
        logger.debug('[EmbeddingService] Cache hit for:', cacheKey.substring(0, 50));
        return embeddingCache.get(cacheKey);
    }

    const manager = getApiKeyManager();
    let embedding;

    // Используем apiKeyManager с ротацией, если доступен
    if (manager) {
        try {
            embedding = await manager.retryWithRotation(async (apiKey) => {
                return await _generateEmbeddingWithKey(apiKey, text);
            });
        } catch (error) {
            logger.error('[EmbeddingService] Failed with key rotation:', error);
            throw error;
        }
    } else {
        // Fallback на старую логику
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('Gemini API key not found. Set VITE_GEMINI_API_KEY or GEMINI_API_KEY environment variable.');
        }
        embedding = await _generateEmbeddingWithKey(apiKey, text);
    }

    // Сохраняем в кэш
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
        // Удаляем самый старый элемент (FIFO)
        const firstKey = embeddingCache.keys().next().value;
        embeddingCache.delete(firstKey);
    }
    embeddingCache.set(cacheKey, embedding);

    logger.debug('[EmbeddingService] Generated embedding, dimension:', embedding.length);
    return embedding;
}

/**
 * Вычисляет cosine similarity между двумя векторами
 * @param {number[]} vec1 - Первый вектор
 * @param {number[]} vec2 - Второй вектор
 * @returns {number} Cosine similarity (от -1 до 1, где 1 = идентичные)
 */
function cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || !Array.isArray(vec1) || !Array.isArray(vec2)) {
        throw new Error('Векторы должны быть массивами чисел');
    }

    if (vec1.length !== vec2.length) {
        throw new Error('Векторы должны иметь одинаковую размерность');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) {
        return 0;
    }

    return dotProduct / denominator;
}

/**
 * Очищает кэш embeddings
 */
function clearCache() {
    embeddingCache.clear();
    logger.info('[EmbeddingService] Cache cleared');
}

/**
 * Получает статистику кэша
 */
function getCacheStats() {
    return {
        embeddingCache: {
            size: embeddingCache.size,
            maxSize: MAX_CACHE_SIZE
        },
        searchCache: {
            size: searchCache.size
        }
    };
}

/**
 * Очищает кэш поиска
 */
function clearSearchCache() {
    searchCache.clear();
    logger.info('[EmbeddingService] Search cache cleared');
}

/**
 * Получает результат из кэша поиска или null
 */
function getCachedSearch(queryText) {
    const cacheKey = queryText.trim().toLowerCase();
    const cached = searchCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < SEARCH_CACHE_TTL) {
        logger.debug('[EmbeddingService] Search cache hit');
        return cached.results;
    }
    
    if (cached) {
        searchCache.delete(cacheKey); // Удаляем устаревший результат
    }
    
    return null;
}

/**
 * Сохраняет результат поиска в кэш
 */
function cacheSearch(queryText, results) {
    const cacheKey = queryText.trim().toLowerCase();
    
    // Ограничиваем размер кэша поиска
    if (searchCache.size >= 100) {
        // Удаляем самый старый элемент
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
    }
    
    searchCache.set(cacheKey, {
        results,
        timestamp: Date.now()
    });
}

module.exports = {
    generateEmbedding,
    cosineSimilarity,
    clearCache,
    getCacheStats,
    clearSearchCache,
    getCachedSearch,
    cacheSearch
};
