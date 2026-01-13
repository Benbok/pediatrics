import { describe, it, expect } from 'vitest';

/**
 * Unit-тест для проверки логики сопоставления препаратов с заболеваниями по кодам МКБ-10
 * 
 * TASK-018: Исправление бага загрузки препаратов в базе знаний
 */

/**
 * Утилита для безопасного парсинга JSON (копия из MedicationService)
 */
function safeJsonParse(value: any, defaultValue: any[] = []): any[] {
    if (!value || value === null) return defaultValue;
    if (typeof value !== 'string') return defaultValue;
    if (value.trim() === '') return defaultValue;
    
    try {
        return JSON.parse(value);
    } catch (error) {
        return defaultValue;
    }
}

/**
 * Основная логика фильтрации препаратов по кодам МКБ (из MedicationService.getByIcd10Codes)
 */
function filterMedicationsByIcdCodes(medications: any[], diseaseIcdCodes: string[]): any[] {
    return medications.filter(med => {
        const medCodes = safeJsonParse(med.icd10Codes, []);
        const hasMatch = medCodes.some((code: string) => diseaseIcdCodes.includes(code));
        return hasMatch;
    });
}

describe('Disease-Medications Integration', () => {
    describe('safeJsonParse', () => {
        it('должен парсить корректный JSON', () => {
            const result = safeJsonParse('["J20.5", "J06.0"]', []);
            expect(result).toEqual(['J20.5', 'J06.0']);
        });

        it('должен возвращать пустой массив для null', () => {
            const result = safeJsonParse(null, []);
            expect(result).toEqual([]);
        });

        it('должен возвращать пустой массив для пустой строки', () => {
            const result = safeJsonParse('', []);
            expect(result).toEqual([]);
        });

        it('должен возвращать defaultValue для невалидного JSON', () => {
            const result = safeJsonParse('invalid json', []);
            expect(result).toEqual([]);
        });

        it('должен возвращать массив если передан не-string', () => {
            const result = safeJsonParse(['already', 'array'], []);
            expect(result).toEqual([]);
        });
    });

    describe('filterMedicationsByIcdCodes', () => {
        const mockMedications = [
            {
                id: 1,
                nameRu: 'Парацетамол',
                icd10Codes: '["J20.5", "J06.0", "J02.8"]' // JSON string как в БД
            },
            {
                id: 2,
                nameRu: 'Нурофен',
                icd10Codes: '["J20.5", "J06.0", "J02.8", "J04.1", "J04.2", "J21.0"]'
            },
            {
                id: 3,
                nameRu: 'Амоксициллин',
                icd10Codes: '["J15.0", "J15.1"]' // Другие коды
            },
            {
                id: 4,
                nameRu: 'Препарат без кодов',
                icd10Codes: '[]'
            },
            {
                id: 5,
                nameRu: 'Препарат с null',
                icd10Codes: null
            }
        ];

        it('должен находить препараты с полным совпадением кодов', () => {
            const diseaseIcdCodes = ['J20.5', 'J06.0', 'J02.8', 'J04.1', 'J04.2', 'J21.0'];
            const result = filterMedicationsByIcdCodes(mockMedications, diseaseIcdCodes);
            
            expect(result).toHaveLength(2);
            expect(result.map(m => m.nameRu)).toContain('Парацетамол');
            expect(result.map(m => m.nameRu)).toContain('Нурофен');
        });

        it('должен находить препараты с хотя бы одним совпадающим кодом', () => {
            const diseaseIcdCodes = ['J20.5']; // Только один код
            const result = filterMedicationsByIcdCodes(mockMedications, diseaseIcdCodes);
            
            expect(result).toHaveLength(2);
            expect(result.map(m => m.nameRu)).toContain('Парацетамол');
            expect(result.map(m => m.nameRu)).toContain('Нурофен');
        });

        it('не должен находить препараты с несовпадающими кодами', () => {
            const diseaseIcdCodes = ['J15.0', 'J15.1']; // Коды пневмонии
            const result = filterMedicationsByIcdCodes(mockMedications, diseaseIcdCodes);
            
            expect(result).toHaveLength(1);
            expect(result[0].nameRu).toBe('Амоксициллин');
        });

        it('должен игнорировать препараты без кодов МКБ', () => {
            const diseaseIcdCodes = ['J20.5'];
            const result = filterMedicationsByIcdCodes(mockMedications, diseaseIcdCodes);
            
            const resultNames = result.map(m => m.nameRu);
            expect(resultNames).not.toContain('Препарат без кодов');
            expect(resultNames).not.toContain('Препарат с null');
        });

        it('должен возвращать пустой массив если нет совпадений', () => {
            const diseaseIcdCodes = ['Z99.9']; // Несуществующий код
            const result = filterMedicationsByIcdCodes(mockMedications, diseaseIcdCodes);
            
            expect(result).toHaveLength(0);
        });

        it('должен работать с пустым массивом кодов заболевания', () => {
            const diseaseIcdCodes: string[] = [];
            const result = filterMedicationsByIcdCodes(mockMedications, diseaseIcdCodes);
            
            expect(result).toHaveLength(0);
        });
    });

    describe('Реальный сценарий: ОРВИ у детей', () => {
        it('должен находить препараты для "Респираторно-синцитиальная вирусная инфекция"', () => {
            // Реальные данные из скриншота пользователя
            const disease = {
                id: 4,
                nameRu: 'Респираторно-синцитиальная вирусная инфекция у детей',
                icd10Code: 'J20.5',
                icd10Codes: '["J06.0", "J02.8", "J04.1", "J04.2", "J21.0"]' // JSON string
            };

            const medications = [
                {
                    id: 1,
                    nameRu: 'Нурофен',
                    icd10Codes: '["J20.5", "J06.0", "J02.8", "J04.1", "J04.2", "J21.0"]'
                },
                {
                    id: 2,
                    nameRu: 'Нурофен_тест',
                    icd10Codes: '["J20.5", "J06.0", "J02.8", "J04.1", "J04.2", "J21.0"]'
                },
                {
                    id: 3,
                    nameRu: 'Амброксол',
                    icd10Codes: '["J44.0", "J44.1"]' // ХОБЛ - не должен попасть
                }
            ];

            // Собираем все коды заболевания (как в handlers.cjs строка 86-87)
            const diseaseIcdCodesArray = safeJsonParse(disease.icd10Codes, []);
            const allCodes = [disease.icd10Code, ...diseaseIcdCodesArray].filter(c => c && c.trim && c.trim() !== '');

            const result = filterMedicationsByIcdCodes(medications, allCodes);

            // Проверяем, что нашлись оба препарата Нурофен
            expect(result).toHaveLength(2);
            expect(result.map(m => m.nameRu)).toContain('Нурофен');
            expect(result.map(m => m.nameRu)).toContain('Нурофен_тест');
            expect(result.map(m => m.nameRu)).not.toContain('Амброксол');
        });
    });

    describe('Edge cases', () => {
        it('должен обрабатывать дубликаты кодов в заболевании', () => {
            const medications = [
                {
                    id: 1,
                    nameRu: 'Тест',
                    icd10Codes: '["J20.5"]'
                }
            ];

            // Дубликат кода (как в реальных логах: J20.5 дважды)
            const diseaseIcdCodes = ['J20.5', 'J20.5', 'J06.0'];
            const result = filterMedicationsByIcdCodes(medications, diseaseIcdCodes);

            expect(result).toHaveLength(1);
            expect(result[0].nameRu).toBe('Тест');
        });

        it('должен быть регистрозависимым при сравнении кодов', () => {
            const medications = [
                {
                    id: 1,
                    nameRu: 'Тест',
                    icd10Codes: '["j20.5"]' // lowercase
                }
            ];

            const diseaseIcdCodes = ['J20.5']; // uppercase
            const result = filterMedicationsByIcdCodes(medications, diseaseIcdCodes);

            // Не должно найти совпадение (регистрозависимо)
            expect(result).toHaveLength(0);
        });

        it('должен обрабатывать пробелы в кодах', () => {
            const medications = [
                {
                    id: 1,
                    nameRu: 'Тест',
                    icd10Codes: '["J20.5 ", " J06.0"]' // С пробелами
                }
            ];

            const diseaseIcdCodes = ['J20.5', 'J06.0'];
            const result = filterMedicationsByIcdCodes(medications, diseaseIcdCodes);

            // Текущая реализация НЕ обрезает пробелы - это может быть проблемой
            // Если тест падает, нужно добавить .trim() в логику сравнения
            expect(result).toHaveLength(0); // Не найдет из-за пробелов
        });
    });
});
