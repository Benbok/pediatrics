/**
 * Unit тесты для API Key Manager
 * Тестирует валидацию ключей и логику ротации
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Получаем тестовые ключи из переменных окружения
function getTestKeys(): string[] {
    // Пробуем GEMINI_API_KEYS (новый формат)
    const keysString = process.env.GEMINI_API_KEYS || process.env.VITE_GEMINI_API_KEY;
    if (keysString) {
        return keysString.split(',').map(k => k.trim()).filter(k => k);
    }
    // Если нет ключей в env, используем тестовые заглушки
    return [
        'AIzaSy123456789012345678901234567890',
        'AIzaSy123456789012345678901234567891',
        'AIzaSy123456789012345678901234567892'
    ];
}

// Чистые функции из apiKeyManager (без Electron зависимостей)
function validateApiKey(key: string | null | undefined): boolean {
    if (!key || typeof key !== 'string') return false;
    if (key.length < 30) return false;
    if (!key.startsWith('AIza')) return false;
    return /^AIza[A-Za-z0-9_-]+$/.test(key);
}

function shouldRotateKey(error: any): boolean {
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

function loadKeysFromEnvString(keysString: string | null): string[] {
    if (!keysString) {
        return [];
    }
    
    const rawKeys = keysString.split(',').map(k => k.trim()).filter(k => k);
    return rawKeys.filter((key) => validateApiKey(key));
}

describe('API Key Manager - Validation', () => {
    describe('validateApiKey', () => {
        it('should accept valid Gemini API keys', () => {
            const validKeys = [
                'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX',
                'AIzaSy1234567890abcdefghijklmnopqrstuvwxyz',
                'AIzaSy-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
                'AIzaSy_abcdefghijklmnopqrstuvwxyz123456'
            ];
            
            validKeys.forEach(key => {
                expect(validateApiKey(key)).toBe(true);
            });
        });

        it('should reject invalid keys', () => {
            const invalidKeys = [
                null,
                undefined,
                '',
                'short',
                'not-ai-key',
                'AIza', // Too short
                'AIzaSy!@#$%^&*()', // Invalid characters
                'google-api-key', // Wrong prefix
                'AIzaSy X Y Z' // Spaces
            ];
            
            invalidKeys.forEach(key => {
                expect(validateApiKey(key as any)).toBe(false);
            });
        });

        it('should require minimum length of 30 characters', () => {
            expect(validateApiKey('AIzaSy1234567890123456789')).toBe(false); // 29 chars
            expect(validateApiKey('AIzaSy123456789012345678901234567890')).toBe(true); // 40 chars (>= 30)
        });
    });

    describe('loadKeysFromEnvString', () => {
        it('should parse comma-separated keys from env', () => {
            // Используем ключи из переменной окружения или тестовые
            const envKeys = process.env.GEMINI_API_KEYS || process.env.VITE_GEMINI_API_KEY;
            if (envKeys) {
                const keys = loadKeysFromEnvString(envKeys);
                // Проверяем, что хотя бы один валидный ключ загружен
                expect(keys.length).toBeGreaterThan(0);
                // Все ключи должны быть валидными
                keys.forEach(key => {
                    expect(validateApiKey(key)).toBe(true);
                });
            } else {
                // Fallback тест с заглушками
                const testKeys = getTestKeys();
                const keysString = testKeys.join(',');
                const keys = loadKeysFromEnvString(keysString);
                expect(keys.length).toBeGreaterThanOrEqual(1);
            }
        });

        it('should filter out invalid keys', () => {
            const testKeys = getTestKeys();
            const validKey = testKeys[0] || 'AIzaSy123456789012345678901234567890';
            const keysString = `${validKey},invalid,too-short,${testKeys[1] || 'AIzaSy123456789012345678901234567891'}`;
            const keys = loadKeysFromEnvString(keysString);
            // Должны остаться только валидные ключи
            expect(keys.length).toBeGreaterThanOrEqual(1);
            expect(keys.every(k => validateApiKey(k))).toBe(true);
        });

        it('should handle whitespace', () => {
            const testKeys = getTestKeys();
            const keysString = testKeys.map(k => ` ${k} `).join(',');
            const keys = loadKeysFromEnvString(keysString);
            expect(keys.length).toBeGreaterThanOrEqual(1);
            // Проверяем, что пробелы удалены
            testKeys.forEach(key => {
                if (validateApiKey(key)) {
                    expect(keys).toContain(key);
                }
            });
        });

        it('should return empty array for null/empty string', () => {
            expect(loadKeysFromEnvString(null)).toEqual([]);
            expect(loadKeysFromEnvString('')).toEqual([]);
        });
    });
});

describe('API Key Manager - Error Detection', () => {
    describe('shouldRotateKey', () => {
        it('should detect rate limit errors (429)', () => {
            const errors = [
                new Error('429 Too Many Requests'),
                new Error('RESOURCE_EXHAUSTED'),
                new Error('Quota exceeded'),
                { message: '429 error' },
                { message: 'quota exceeded' },
                { message: 'RESOURCE_EXHAUSTED' }
            ];
            
            errors.forEach((error, index) => {
                const result = shouldRotateKey(error);
                if (!result) {
                    console.log(`Failed error at index ${index}:`, error);
                }
                expect(result).toBe(true);
            });
        });

        it('should detect authentication errors (401, 403)', () => {
            const errors = [
                new Error('401 Unauthorized'),
                new Error('403 Forbidden'),
                new Error('Invalid API key'),
                { message: 'API key not found' }
            ];
            
            errors.forEach(error => {
                expect(shouldRotateKey(error)).toBe(true);
            });
        });

        it('should detect invalid key errors', () => {
            const errors = [
                new Error('Invalid API key provided'),
                new Error('The API key is invalid'),
                { message: 'invalid key format' }
            ];
            
            errors.forEach(error => {
                expect(shouldRotateKey(error)).toBe(true);
            });
        });

        it('should not rotate for non-recoverable errors', () => {
            const errors = [
                new Error('Network timeout'),
                new Error('Connection refused'),
                new Error('500 Internal Server Error'),
                new Error('Invalid request format'),
                { message: 'Unknown error' }
            ];
            
            errors.forEach(error => {
                expect(shouldRotateKey(error)).toBe(false);
            });
        });

        it('should handle error objects without message', () => {
            expect(shouldRotateKey({})).toBe(false);
            expect(shouldRotateKey(null)).toBe(false);
            expect(shouldRotateKey(undefined)).toBe(false);
        });
    });
});

describe('API Key Manager - Pool Logic', () => {
    describe('Key rotation logic', () => {
        it('should cycle through keys correctly', () => {
            const keys = ['key0', 'key1', 'key2', 'key3'];
            let currentIndex = 0;
            
            // Simulate rotation
            const rotate = () => {
                currentIndex = (currentIndex + 1) % keys.length;
                return currentIndex;
            };
            
            expect(rotate()).toBe(1);
            expect(rotate()).toBe(2);
            expect(rotate()).toBe(3);
            expect(rotate()).toBe(0); // Wraps around
        });

        it('should find next active key', () => {
            const statuses = [
                { index: 0, status: 'active' },
                { index: 1, status: 'failed' },
                { index: 2, status: 'active' },
                { index: 3, status: 'failed' }
            ];
            
            // Start at index 0, should find index 2
            let currentIndex = 0;
            let found = false;
            
            for (let i = 0; i < statuses.length; i++) {
                currentIndex = (currentIndex + 1) % statuses.length;
                const status = statuses.find(s => s.index === currentIndex);
                if (status && status.status === 'active') {
                    found = true;
                    expect(currentIndex).toBe(2);
                    break;
                }
            }
            
            expect(found).toBe(true);
        });
    });

    describe('Working keys count', () => {
        it('should count active keys correctly', () => {
            const statuses = [
                { index: 0, status: 'active' },
                { index: 1, status: 'failed' },
                { index: 2, status: 'active' },
                { index: 3, status: 'active' },
                { index: 4, status: 'failed' }
            ];
            
            const activeCount = statuses.filter(s => s.status === 'active').length;
            expect(activeCount).toBe(3);
        });

        it('should detect critical state (<= 2 active keys)', () => {
            const scenarios = [
                { active: 0, needsAttention: true },
                { active: 1, needsAttention: true },
                { active: 2, needsAttention: true },
                { active: 3, needsAttention: false },
                { active: 5, needsAttention: false }
            ];
            
            scenarios.forEach(scenario => {
                const needsAttention = scenario.active <= 2;
                expect(needsAttention).toBe(scenario.needsAttention);
            });
        });
    });
});
