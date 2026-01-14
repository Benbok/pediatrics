/**
 * Тестовый скрипт для проверки парсера Видаль
 * 
 * Проверяет:
 * 1. Загрузку HTML со страницы Видаль
 * 2. Парсинг данных через AI
 * 3. Соответствие полученных данных структуре Medication (Zod схема)
 * 4. Валидацию данных через MedicationValidator
 */

// Загружаем переменные окружения
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

// Мок для Electron app (для logger) - ДО всех require
const path = require('path');
const os = require('os');
const Module = require('module');

const mockApp = {
    getPath: (name) => {
        if (name === 'userData') {
            return path.join(os.tmpdir(), 'pediassist-test');
        }
        return os.tmpdir();
    },
    isPackaged: false
};

// Перехватываем require для electron
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id === 'electron') {
        return { app: mockApp };
    }
    return originalRequire.apply(this, arguments);
};

// Теперь можно импортировать модули
const https = require('https');
const { parseVidalWithAI } = require('../electron/modules/medications/vidalParser.cjs');
const { MedicationValidator } = require('../electron/modules/medications/validator.cjs');
const { MedicationSchema } = require('../electron/modules/medications/service.cjs');

// Простой console logger для тестов
const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args)
};

// URL для тестирования
const TEST_URL = 'https://www.vidal.ru/drugs/paracetamol-5';

/**
 * Загрузить HTML со страницы
 */
function fetchHTML(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

/**
 * Проверить соответствие данных схеме Medication
 */
function validateAgainstSchema(data) {
    const errors = [];
    const warnings = [];
    
    try {
        // Попытка валидации через Zod схему
        const validated = MedicationSchema.parse(data);
        return {
            isValid: true,
            errors: [],
            warnings: [],
            validated
        };
    } catch (error) {
        if (error.name === 'ZodError') {
            error.errors.forEach(err => {
                const issue = {
                    field: err.path.join('.'),
                    message: err.message,
                    code: err.code
                };
                
                if (err.code === 'invalid_type' || err.code === 'required') {
                    errors.push(issue);
                } else {
                    warnings.push(issue);
                }
            });
        } else {
            errors.push({
                field: 'unknown',
                message: error.message
            });
        }
        
        return {
            isValid: false,
            errors,
            warnings,
            validated: null
        };
    }
}

/**
 * Сравнить структуру данных со схемой БД
 */
function compareWithSchema(parsedData) {
    const schemaFields = {
        // Обязательные поля
        required: ['nameRu', 'activeSubstance', 'contraindications'],
        // Опциональные поля
        optional: [
            'nameEn', 'atcCode', 'manufacturer', 'registrationNumber',
            'clinicalPharmGroup', 'pharmTherapyGroup', 'packageDescription',
            'vidalUrl', 'minInterval', 'maxDosesPerDay', 'maxDurationDays',
            'routeOfAdmin', 'isFavorite', 'userTags', 'usageCount', 'lastUsedAt'
        ],
        // JSON поля (массивы/объекты)
        jsonFields: ['icd10Codes', 'forms', 'pediatricDosing', 'adultDosing', 'indications']
    };
    
    const missing = [];
    const extra = [];
    const typeMismatches = [];
    
    // Проверка обязательных полей
    schemaFields.required.forEach(field => {
        if (!(field in parsedData) || parsedData[field] === null || parsedData[field] === undefined) {
            missing.push({ field, type: 'required' });
        }
    });
    
    // Проверка типов JSON полей
    schemaFields.jsonFields.forEach(field => {
        if (field in parsedData && parsedData[field] !== null && parsedData[field] !== undefined) {
            if (!Array.isArray(parsedData[field])) {
                typeMismatches.push({
                    field,
                    expected: 'array',
                    actual: typeof parsedData[field]
                });
            }
        }
    });
    
    // Проверка pediatricDosing структуры
    if (parsedData.pediatricDosing && Array.isArray(parsedData.pediatricDosing)) {
        parsedData.pediatricDosing.forEach((rule, idx) => {
            const requiredRuleFields = ['minAgeMonths', 'maxAgeMonths', 'dosing', 'routeOfAdmin'];
            requiredRuleFields.forEach(field => {
                if (!(field in rule)) {
                    missing.push({ field: `pediatricDosing[${idx}].${field}`, type: 'required_in_rule' });
                }
            });
            
            // Проверка структуры dosing
            if (rule.dosing) {
                if (!rule.dosing.type) {
                    missing.push({ field: `pediatricDosing[${idx}].dosing.type`, type: 'required' });
                }
                
                const validTypes = ['weight_based', 'bsa_based', 'fixed', 'age_based'];
                if (rule.dosing.type && !validTypes.includes(rule.dosing.type)) {
                    typeMismatches.push({
                        field: `pediatricDosing[${idx}].dosing.type`,
                        expected: validTypes.join(' | '),
                        actual: rule.dosing.type
                    });
                }
            }
        });
    }
    
    return {
        missing,
        extra,
        typeMismatches
    };
}

/**
 * Основная функция тестирования
 */
async function runTest() {
    console.log('🧪 Тестирование парсера Видаль\n');
    console.log(`📄 URL: ${TEST_URL}\n`);
    
    try {
        // Шаг 1: Загрузка HTML
        console.log('1️⃣ Загрузка HTML...');
        const html = await fetchHTML(TEST_URL);
        console.log(`   ✅ HTML загружен (${html.length} символов)\n`);
        
        // Шаг 2: Парсинг через AI
        console.log('2️⃣ Парсинг данных через AI...');
        const parsedData = await parseVidalWithAI(html);
        console.log(`   ✅ Данные распарсены`);
        console.log(`   📋 Название: ${parsedData.nameRu || 'НЕ НАЙДЕНО'}`);
        console.log(`   💊 Действующее вещество: ${parsedData.activeSubstance || 'НЕ НАЙДЕНО'}`);
        console.log(`   🏷️ Клинико-фарм. группа: ${parsedData.clinicalPharmGroup || 'НЕ НАЙДЕНО'}`);
        console.log(`   📊 Правил дозирования: ${parsedData.pediatricDosing?.length || 0}\n`);
        
        // Шаг 3: Сравнение со схемой БД
        console.log('3️⃣ Сравнение со схемой базы данных...');
        const schemaComparison = compareWithSchema(parsedData);
        
        if (schemaComparison.missing.length > 0) {
            console.log(`   ⚠️ Отсутствующие поля (${schemaComparison.missing.length}):`);
            schemaComparison.missing.forEach(({ field, type }) => {
                console.log(`      - ${field} (${type})`);
            });
        } else {
            console.log('   ✅ Все обязательные поля присутствуют');
        }
        
        if (schemaComparison.typeMismatches.length > 0) {
            console.log(`   ⚠️ Несоответствия типов (${schemaComparison.typeMismatches.length}):`);
            schemaComparison.typeMismatches.forEach(({ field, expected, actual }) => {
                console.log(`      - ${field}: ожидается ${expected}, получено ${actual}`);
            });
        } else {
            console.log('   ✅ Все типы данных соответствуют схеме');
        }
        console.log('');
        
        // Шаг 4: Валидация через MedicationValidator
        console.log('4️⃣ Валидация данных через MedicationValidator...');
        const validator = new MedicationValidator();
        const validation = validator.validate(parsedData);
        
        if (validation.errors.length > 0) {
            console.log(`   ❌ Критичные ошибки (${validation.errors.length}):`);
            validation.errors.forEach(err => {
                console.log(`      - ${err.field}: ${err.message}`);
            });
        } else {
            console.log('   ✅ Критичных ошибок не найдено');
        }
        
        if (validation.warnings.length > 0) {
            console.log(`   ⚠️ Предупреждения (${validation.warnings.length}):`);
            validation.warnings.slice(0, 5).forEach(warn => {
                console.log(`      - ${warn.field}: ${warn.message} [${warn.severity}]`);
            });
            if (validation.warnings.length > 5) {
                console.log(`      ... и еще ${validation.warnings.length - 5} предупреждений`);
            }
        } else {
            console.log('   ✅ Предупреждений не найдено');
        }
        console.log('');
        
        // Шаг 5: Валидация через Zod схему
        console.log('5️⃣ Валидация через Zod схему MedicationSchema...');
        const zodValidation = validateAgainstSchema(parsedData);
        
        if (zodValidation.isValid) {
            console.log('   ✅ Данные прошли валидацию Zod схемы');
        } else {
            console.log(`   ❌ Ошибки валидации Zod (${zodValidation.errors.length}):`);
            zodValidation.errors.forEach(err => {
                console.log(`      - ${err.field}: ${err.message} [${err.code}]`);
            });
            
            if (zodValidation.warnings.length > 0) {
                console.log(`   ⚠️ Предупреждения Zod (${zodValidation.warnings.length}):`);
                zodValidation.warnings.forEach(warn => {
                    console.log(`      - ${warn.field}: ${warn.message}`);
                });
            }
        }
        console.log('');
        
        // Шаг 6: Проверка максимальных доз
        console.log('6️⃣ Проверка максимальных доз...');
        if (parsedData.pediatricDosing && Array.isArray(parsedData.pediatricDosing)) {
            parsedData.pediatricDosing.forEach((rule, idx) => {
                console.log(`   Правило ${idx + 1}:`);
                console.log(`      Возраст: ${rule.minAgeMonths || '?'}-${rule.maxAgeMonths || '?'} мес`);
                console.log(`      Путь: ${rule.routeOfAdmin || 'не указан'}`);
                if (rule.maxSingleDose) {
                    console.log(`      ✅ Макс. разовая: ${rule.maxSingleDose} мг`);
                } else {
                    console.log(`      ⚠️ Макс. разовая: НЕ УКАЗАНА`);
                }
                if (rule.maxDailyDose) {
                    console.log(`      ✅ Макс. суточная: ${rule.maxDailyDose} мг`);
                } else {
                    console.log(`      ⚠️ Макс. суточная: НЕ УКАЗАНА`);
                }
            });
        } else {
            console.log('   ⚠️ Правила дозирования не найдены');
        }
        console.log('');
        
        // Итоговый отчет
        console.log('📊 ИТОГОВЫЙ ОТЧЕТ:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const hasErrors = validation.errors.length > 0 || zodValidation.errors.length > 0 || schemaComparison.missing.length > 0;
        const hasWarnings = validation.warnings.length > 0 || zodValidation.warnings.length > 0 || schemaComparison.typeMismatches.length > 0;
        
        if (!hasErrors && !hasWarnings) {
            console.log('✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО');
            console.log('   Данные полностью соответствуют структуре базы данных');
        } else if (!hasErrors) {
            console.log('✅ КРИТИЧНЫХ ОШИБОК НЕТ');
            console.log('   ⚠️ Есть предупреждения, но данные можно использовать');
        } else {
            console.log('❌ ОБНАРУЖЕНЫ КРИТИЧНЫЕ ОШИБКИ');
            console.log('   Требуется исправление перед сохранением в БД');
        }
        
        console.log(`\n   Статистика:`);
        console.log(`   - Отсутствующие поля: ${schemaComparison.missing.length}`);
        console.log(`   - Несоответствия типов: ${schemaComparison.typeMismatches.length}`);
        console.log(`   - Ошибки валидатора: ${validation.errors.length}`);
        console.log(`   - Предупреждения валидатора: ${validation.warnings.length}`);
        console.log(`   - Ошибки Zod: ${zodValidation.errors.length}`);
        console.log(`   - Предупреждения Zod: ${zodValidation.warnings.length}`);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Детальная информация о структуре
        console.log('📋 СТРУКТУРА ДАННЫХ (первые 2000 символов):');
        const dataPreview = JSON.stringify(parsedData, null, 2).slice(0, 2000);
        console.log(dataPreview);
        if (JSON.stringify(parsedData, null, 2).length > 2000) {
            console.log('...\n');
        }
        
        return {
            success: !hasErrors,
            parsedData,
            validation,
            zodValidation,
            schemaComparison
        };
        
    } catch (error) {
        console.error('❌ ОШИБКА ТЕСТИРОВАНИЯ:');
        console.error(error);
        throw error;
    }
}

// Запуск теста
if (require.main === module) {
    runTest()
        .then(result => {
            if (result.success) {
                console.log('✅ Тест завершен успешно');
                process.exit(0);
            } else {
                console.log('⚠️ Тест завершен с предупреждениями');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Тест завершен с ошибкой:', error);
            process.exit(1);
        });
}

module.exports = { runTest };
