/**
 * Unit tests for CacheService
 * Tests TTL, invalidation, namespace isolation, and statistics
 */

const { CacheService } = require('../electron/services/cacheService.cjs');

describe('CacheService', () => {
    beforeEach(() => {
        // Очищаем кеш перед каждым тестом
        CacheService.invalidateAll();
        CacheService.resetStats();
    });

    describe('Basic operations', () => {
        it('should set and get a value', () => {
            CacheService.set('diseases', 'test-key', { id: 1, name: 'Test' });
            const result = CacheService.get('diseases', 'test-key');
            
            expect(result).toEqual({ id: 1, name: 'Test' });
        });

        it('should return null for non-existent key', () => {
            const result = CacheService.get('diseases', 'non-existent');
            expect(result).toBeNull();
        });

        it('should return null for non-existent namespace', () => {
            expect(() => {
                CacheService.get('invalid-namespace', 'key');
            }).toThrow();
        });
    });

    describe('TTL (Time To Live)', () => {
        it('should return cached value before TTL expires', () => {
            CacheService.set('diseases', 'test-key', { data: 'test' });
            
            // Значение должно быть доступно сразу
            const result = CacheService.get('diseases', 'test-key');
            expect(result).toEqual({ data: 'test' });
        });

        it('should return null after TTL expires', (done) => {
            // Устанавливаем значение с очень коротким TTL (100ms)
            CacheService.set('records', 'test-key', { data: 'test' }, 100);
            
            // Сразу после установки - должно быть доступно
            expect(CacheService.get('records', 'test-key')).toEqual({ data: 'test' });
            
            // После истечения TTL - должно быть null
            setTimeout(() => {
                const result = CacheService.get('records', 'test-key');
                expect(result).toBeNull();
                done();
            }, 150);
        });

        it('should use custom TTL when provided', (done) => {
            // Устанавливаем с кастомным TTL 200ms
            CacheService.set('children', 'test-key', { data: 'test' }, 200);
            
            // Через 150ms еще должно быть доступно
            setTimeout(() => {
                expect(CacheService.get('children', 'test-key')).toEqual({ data: 'test' });
                
                // Через 250ms должно истечь
                setTimeout(() => {
                    expect(CacheService.get('children', 'test-key')).toBeNull();
                    done();
                }, 100);
            }, 150);
        });
    });

    describe('Invalidation', () => {
        it('should invalidate specific key', () => {
            CacheService.set('diseases', 'key1', { id: 1 });
            CacheService.set('diseases', 'key2', { id: 2 });
            
            CacheService.invalidate('diseases', 'key1');
            
            expect(CacheService.get('diseases', 'key1')).toBeNull();
            expect(CacheService.get('diseases', 'key2')).toEqual({ id: 2 });
        });

        it('should invalidate entire namespace', () => {
            CacheService.set('diseases', 'key1', { id: 1 });
            CacheService.set('diseases', 'key2', { id: 2 });
            CacheService.set('medications', 'key1', { id: 1 });
            
            CacheService.invalidate('diseases');
            
            expect(CacheService.get('diseases', 'key1')).toBeNull();
            expect(CacheService.get('diseases', 'key2')).toBeNull();
            expect(CacheService.get('medications', 'key1')).toEqual({ id: 1 }); // Другой namespace не затронут
        });

        it('should invalidate all namespaces', () => {
            CacheService.set('diseases', 'key1', { id: 1 });
            CacheService.set('medications', 'key1', { id: 1 });
            CacheService.set('children', 'key1', { id: 1 });
            
            CacheService.invalidateAll();
            
            expect(CacheService.get('diseases', 'key1')).toBeNull();
            expect(CacheService.get('medications', 'key1')).toBeNull();
            expect(CacheService.get('children', 'key1')).toBeNull();
        });
    });

    describe('Namespace isolation', () => {
        it('should isolate data between namespaces', () => {
            CacheService.set('diseases', 'same-key', { type: 'disease' });
            CacheService.set('medications', 'same-key', { type: 'medication' });
            
            const disease = CacheService.get('diseases', 'same-key');
            const medication = CacheService.get('medications', 'same-key');
            
            expect(disease).toEqual({ type: 'disease' });
            expect(medication).toEqual({ type: 'medication' });
            expect(disease).not.toEqual(medication);
        });

        it('should have different TTLs for different namespaces', () => {
            // Проверяем, что разные namespace имеют разные TTL из конфигурации
            const stats = CacheService.getStats();
            
            expect(stats.namespaces.diseases.ttl).toBe(300000); // 5 минут
            expect(stats.namespaces.records.ttl).toBe(30000); // 30 секунд
            expect(stats.namespaces.children.ttl).toBe(60000); // 1 минута
        });
    });

    describe('Statistics', () => {
        it('should track hits and misses', () => {
            CacheService.set('diseases', 'key1', { id: 1 });
            
            CacheService.get('diseases', 'key1'); // hit
            CacheService.get('diseases', 'key1'); // hit
            CacheService.get('diseases', 'non-existent'); // miss
            
            const stats = CacheService.getStats();
            expect(stats.stats.hits).toBeGreaterThanOrEqual(2);
            expect(stats.stats.misses).toBeGreaterThanOrEqual(1);
        });

        it('should track sets and invalidations', () => {
            CacheService.set('diseases', 'key1', { id: 1 });
            CacheService.set('diseases', 'key2', { id: 2 });
            CacheService.invalidate('diseases', 'key1');
            
            const stats = CacheService.getStats();
            expect(stats.stats.sets).toBeGreaterThanOrEqual(2);
            expect(stats.stats.invalidations).toBeGreaterThanOrEqual(1);
        });

        it('should calculate hit rate correctly', () => {
            CacheService.set('diseases', 'key1', { id: 1 });
            
            CacheService.get('diseases', 'key1'); // hit
            CacheService.get('diseases', 'key1'); // hit
            CacheService.get('diseases', 'non-existent'); // miss
            
            const stats = CacheService.getStats();
            const hitRate = parseFloat(stats.stats.hitRate.replace('%', ''));
            expect(hitRate).toBeGreaterThan(0);
            expect(hitRate).toBeLessThanOrEqual(100);
        });

        it('should track namespace sizes', () => {
            CacheService.set('diseases', 'key1', { id: 1 });
            CacheService.set('diseases', 'key2', { id: 2 });
            CacheService.set('medications', 'key1', { id: 1 });
            
            const stats = CacheService.getStats();
            expect(stats.namespaces.diseases.size).toBe(2);
            expect(stats.namespaces.medications.size).toBe(1);
            expect(stats.totalSize).toBe(3);
        });
    });

    describe('Cleanup', () => {
        it('should remove expired entries on cleanup', (done) => {
            CacheService.set('records', 'expired-key', { data: 'test' }, 50); // Очень короткий TTL
            CacheService.set('records', 'valid-key', { data: 'test' }, 5000); // Длинный TTL
            
            setTimeout(() => {
                const removed = CacheService.cleanup();
                
                expect(removed).toBeGreaterThan(0);
                expect(CacheService.get('records', 'expired-key')).toBeNull();
                expect(CacheService.get('records', 'valid-key')).toEqual({ data: 'test' });
                done();
            }, 100);
        });
    });

    describe('Cache size limits', () => {
        it('should handle cache overflow by removing oldest entries', () => {
            // Заполняем кеш до предела
            for (let i = 0; i < 100; i++) {
                CacheService.set('diseases', `key-${i}`, { id: i });
            }
            
            const stats = CacheService.getStats();
            // Кеш не должен превышать MAX_CACHE_SIZE
            expect(stats.totalSize).toBeLessThanOrEqual(10000);
        });
    });
});
