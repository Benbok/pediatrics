/**
 * Централизованный сервис кеширования данных
 * Поддерживает namespace-based кеширование с TTL и автоматической инвалидацией
 */

const { logger } = require('../logger.cjs');

// Конфигурация namespace с TTL (в миллисекундах)
const NAMESPACE_CONFIG = {
    children: { ttl: 60000 },      // 1 минута - часто меняются
    dashboard: { ttl: 60000 },     // 1 минута - сводные dashboard-агрегаты
    diseases: { ttl: 300000 },     // 5 минут - редко меняются
    medications: { ttl: 300000 },  // 5 минут - редко меняются
    profiles: { ttl: 60000 },      // 1 минута - могут часто обновляться
    records: { ttl: 30000 },       // 30 секунд - часто меняются
    vaccineCatalog: { ttl: 300000 }, // 5 минут - глобальный каталог вакцин
    organization: { ttl: 300000 },   // 5 минут - профиль организации
    visits: { ttl: 300000 },       // 5 минут - агрегаты (diagnostic tests)
    nutrition: { ttl: 300000 },    // 5 минут - справочники норм, продуктов и шаблонов
};

// Максимальный размер кеша (приблизительно, в записях)
const MAX_CACHE_SIZE = 10000;

// Структура хранения кеша
// namespaces[namespace] = Map<key, { value: any, timestamp: number, ttl: number }>
const namespaces = {};

// Статистика использования кеша
const stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0
};

/**
 * Инициализация namespace при первом обращении
 */
function ensureNamespace(namespace) {
    if (!namespaces[namespace]) {
        if (!NAMESPACE_CONFIG[namespace]) {
            throw new Error(`Unknown namespace: ${namespace}`);
        }
        namespaces[namespace] = new Map();
        logger.debug(`[CacheService] Initialized namespace: ${namespace}`);
    }
}

/**
 * Получить значение из кеша
 * @param {string} namespace - Namespace (children, diseases, medications, etc.)
 * @param {string} key - Ключ для поиска
 * @returns {any|null} - Значение из кеша или null если не найдено/устарело
 */
function get(namespace, key) {
    try {
        ensureNamespace(namespace);
        
        const namespaceCache = namespaces[namespace];
        const cached = namespaceCache.get(key);
        
        if (!cached) {
            stats.misses++;
            return null;
        }
        
        // Проверяем TTL
        const now = Date.now();
        const age = now - cached.timestamp;
        
        if (age > cached.ttl) {
            // Кеш устарел - удаляем и возвращаем null
            namespaceCache.delete(key);
            stats.misses++;
            logger.debug(`[CacheService] Cache expired for ${namespace}:${key}`);
            return null;
        }
        
        stats.hits++;
        logger.debug(`[CacheService] Cache hit for ${namespace}:${key}`);
        return cached.value;
    } catch (error) {
        logger.error(`[CacheService] Error getting from cache:`, error);
        stats.misses++;
        return null;
    }
}

/**
 * Сохранить значение в кеш
 * @param {string} namespace - Namespace
 * @param {string} key - Ключ
 * @param {any} value - Значение для кеширования
 * @param {number|null} customTTL - Кастомный TTL (опционально, переопределяет namespace default)
 * @returns {boolean} - Успешно ли сохранено
 */
function set(namespace, key, value, customTTL = null) {
    try {
        ensureNamespace(namespace);
        
        const namespaceCache = namespaces[namespace];
        const defaultTTL = NAMESPACE_CONFIG[namespace].ttl;
        const ttl = customTTL !== null ? customTTL : defaultTTL;
        
        // Проверяем общий размер кеша
        const totalSize = Object.values(namespaces).reduce((sum, ns) => sum + ns.size, 0);
        if (totalSize >= MAX_CACHE_SIZE && !namespaceCache.has(key)) {
            // Кеш переполнен - удаляем самые старые записи из текущего namespace
            const entries = Array.from(namespaceCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = Math.floor(namespaceCache.size * 0.1); // Удаляем 10% старых
            for (let i = 0; i < toRemove; i++) {
                namespaceCache.delete(entries[i][0]);
            }
            logger.warn(`[CacheService] Cache full, removed ${toRemove} old entries from ${namespace}`);
        }
        
        namespaceCache.set(key, {
            value,
            timestamp: Date.now(),
            ttl
        });
        
        stats.sets++;
        logger.debug(`[CacheService] Cache set for ${namespace}:${key} (TTL: ${ttl}ms)`);
        return true;
    } catch (error) {
        logger.error(`[CacheService] Error setting cache:`, error);
        return false;
    }
}

/**
 * Инвалидировать запись или весь namespace
 * @param {string} namespace - Namespace
 * @param {string|null} key - Ключ для инвалидации, если null - инвалидируется весь namespace
 */
function invalidate(namespace, key = null) {
    try {
        if (!namespaces[namespace]) {
            return; // Namespace не существует - ничего не делаем
        }
        
        if (key === null) {
            // Инвалидируем весь namespace
            const size = namespaces[namespace].size;
            namespaces[namespace].clear();
            stats.invalidations += size;
            logger.info(`[CacheService] Invalidated namespace: ${namespace} (${size} entries)`);
        } else {
            // Инвалидируем конкретный ключ
            if (namespaces[namespace].delete(key)) {
                stats.invalidations++;
                logger.debug(`[CacheService] Invalidated ${namespace}:${key}`);
            }
        }
    } catch (error) {
        logger.error(`[CacheService] Error invalidating cache:`, error);
    }
}

/**
 * Инвалидировать весь кеш
 */
function invalidateAll() {
    try {
        let totalSize = 0;
        Object.keys(namespaces).forEach(namespace => {
            totalSize += namespaces[namespace].size;
            namespaces[namespace].clear();
        });
        
        stats.invalidations += totalSize;
        logger.info(`[CacheService] Invalidated all caches (${totalSize} entries)`);
    } catch (error) {
        logger.error(`[CacheService] Error invalidating all caches:`, error);
    }
}

/**
 * Очистка устаревших записей из всех namespace
 * @returns {number} - Количество удаленных записей
 */
function cleanup() {
    try {
        const now = Date.now();
        let removed = 0;
        
        Object.entries(namespaces).forEach(([namespace, cache]) => {
            const keysToRemove = [];
            
            cache.forEach((cached, key) => {
                const age = now - cached.timestamp;
                if (age > cached.ttl) {
                    keysToRemove.push(key);
                }
            });
            
            keysToRemove.forEach(key => {
                cache.delete(key);
                removed++;
            });
        });
        
        if (removed > 0) {
            logger.debug(`[CacheService] Cleanup removed ${removed} expired entries`);
        }
        
        return removed;
    } catch (error) {
        logger.error(`[CacheService] Error during cleanup:`, error);
        return 0;
    }
}

/**
 * Получить статистику кеша
 * @returns {object} - Статистика использования кеша
 */
function getStats() {
    const namespaceStats = {};
    let totalSize = 0;
    
    Object.entries(namespaces).forEach(([namespace, cache]) => {
        const size = cache.size;
        totalSize += size;
        
        // Подсчитываем устаревшие записи
        const now = Date.now();
        let expired = 0;
        cache.forEach(cached => {
            const age = now - cached.timestamp;
            if (age > cached.ttl) {
                expired++;
            }
        });
        
        namespaceStats[namespace] = {
            size,
            expired,
            ttl: NAMESPACE_CONFIG[namespace].ttl
        };
    });
    
    const totalRequests = stats.hits + stats.misses;
    const hitRate = totalRequests > 0 ? (stats.hits / totalRequests * 100).toFixed(2) : 0;
    
    return {
        namespaces: namespaceStats,
        totalSize,
        maxSize: MAX_CACHE_SIZE,
        stats: {
            hits: stats.hits,
            misses: stats.misses,
            sets: stats.sets,
            invalidations: stats.invalidations,
            hitRate: `${hitRate}%`
        }
    };
}

/**
 * Сброс статистики
 */
function resetStats() {
    stats.hits = 0;
    stats.misses = 0;
    stats.sets = 0;
    stats.invalidations = 0;
    logger.info('[CacheService] Statistics reset');
}

/**
 * Инициализация background cleanup (запускается каждые 60 секунд)
 */
function startCleanupInterval() {
    // Cleanup устаревших записей каждые 60 секунд
    setInterval(() => {
        cleanup();
    }, 60000);
    
    logger.info('[CacheService] Background cleanup started (interval: 60s)');
}

// Автоматический запуск cleanup при инициализации
startCleanupInterval();

const CacheService = {
    get,
    set,
    invalidate,
    invalidateAll,
    cleanup,
    getStats,
    resetStats
};

module.exports = { CacheService };
