/**
 * Живой тест парсера Vidal
 * Парсит реальную страницу препарата и сравнивает с структурой БД
 */

const https = require('https');
const { parseVidalWithAI } = require('./vidal-parser-standalone.cjs');
require('dotenv').config({ path: '.env.local' });

// Цвета для консоли
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

/**
 * Загрузить HTML со страницы
 */
function fetchHTML(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

/**
 * Структура модели Medication из Prisma
 */
const MEDICATION_SCHEMA = {
    id: 'Int (auto)',
    nameRu: 'String (required)',
    nameEn: 'String (optional)',
    activeSubstance: 'String (required)',
    atcCode: 'String (optional)',
    icd10Codes: 'String (JSON array, default "[]")',
    packageDescription: 'String (optional)',
    manufacturer: 'String (optional)',
    forms: 'String (JSON, required)',
    pediatricDosing: 'String (JSON, required)',
    adultDosing: 'String (JSON, optional)',
    contraindications: 'String (required)',
    cautionConditions: 'String (optional)',
    sideEffects: 'String (optional)',
    interactions: 'String (optional)',
    pregnancy: 'String (optional)',
    lactation: 'String (optional)',
    indications: 'String (required)',
    registrationNumber: 'String (optional)',
    vidalUrl: 'String (optional)',
    clinicalPharmGroup: 'String (optional)',
    pharmTherapyGroup: 'String (optional)',
    minInterval: 'Int (optional)',
    maxDosesPerDay: 'Int (optional)',
    maxDurationDays: 'Int (optional)',
    routeOfAdmin: 'String (optional)',
    isFavorite: 'Boolean (default false)',
    userTags: 'String (JSON, optional)',
    usageCount: 'Int (default 0)',
    lastUsedAt: 'DateTime (optional)',
    createdAt: 'DateTime (auto)',
    updatedAt: 'DateTime (auto)'
};

/**
 * Проверить наличие обязательных полей
 */
function validateRequiredFields(parsedData) {
    const requiredFields = [
        'nameRu',
        'activeSubstance',
        'forms',
        'pediatricDosing',
        'contraindications',
        'indications'
    ];
    
    const errors = [];
    const warnings = [];
    
    for (const field of requiredFields) {
        if (!parsedData[field]) {
            errors.push(`❌ Отсутствует обязательное поле: ${field}`);
        } else if (field === 'forms' || field === 'pediatricDosing') {
            // Проверить что это массив
            if (!Array.isArray(parsedData[field])) {
                errors.push(`❌ Поле ${field} должно быть массивом`);
            } else if (parsedData[field].length === 0) {
                warnings.push(`⚠️  Поле ${field} пустое`);
            }
        }
    }
    
    return { errors, warnings };
}

/**
 * Проверить структуру pediatricDosing
 */
function validatePediatricDosing(dosing) {
    const errors = [];
    const warnings = [];
    
    if (!Array.isArray(dosing)) {
        errors.push('❌ pediatricDosing должен быть массивом');
        return { errors, warnings };
    }
    
    dosing.forEach((rule, index) => {
        const prefix = `Правило #${index + 1}:`;
        
        // Обязательные поля
        if (rule.minAgeMonths === undefined) warnings.push(`⚠️  ${prefix} нет minAgeMonths`);
        if (!rule.dosing) {
            errors.push(`❌ ${prefix} отсутствует поле dosing`);
        } else {
            if (!rule.dosing.type) {
                errors.push(`❌ ${prefix} нет dosing.type`);
            } else if (!['weight_based', 'fixed', 'age_based'].includes(rule.dosing.type)) {
                errors.push(`❌ ${prefix} неверный dosing.type: ${rule.dosing.type}`);
            }
            
            if (rule.dosing.type === 'weight_based' && !rule.dosing.mgPerKg) {
                errors.push(`❌ ${prefix} weight_based требует mgPerKg`);
            }
            
            if (rule.dosing.type === 'fixed' && !rule.dosing.fixedDose) {
                errors.push(`❌ ${prefix} fixed требует fixedDose`);
            }
        }
        
        if (!rule.routeOfAdmin) warnings.push(`⚠️  ${prefix} нет routeOfAdmin`);
        if (!rule.maxSingleDose) warnings.push(`⚠️  ${prefix} нет maxSingleDose`);
        if (!rule.maxDailyDose) warnings.push(`⚠️  ${prefix} нет maxDailyDose`);
        
        // Проверка максимальных доз (должны быть в мг, не в граммах)
        if (rule.maxSingleDose && rule.maxSingleDose < 10) {
            warnings.push(`⚠️  ${prefix} maxSingleDose=${rule.maxSingleDose} - возможно в граммах, а не мг?`);
        }
        if (rule.maxDailyDose && rule.maxDailyDose < 50) {
            warnings.push(`⚠️  ${prefix} maxDailyDose=${rule.maxDailyDose} - возможно в граммах, а не мг?`);
        }
    });
    
    return { errors, warnings };
}

/**
 * Проверить структуру forms
 */
function validateForms(forms) {
    const errors = [];
    const warnings = [];
    
    if (!Array.isArray(forms)) {
        errors.push('❌ forms должен быть массивом');
        return { errors, warnings };
    }
    
    forms.forEach((form, index) => {
        if (!form.type) errors.push(`❌ Форма #${index + 1}: нет type`);
        if (!form.description) warnings.push(`⚠️  Форма #${index + 1}: нет description`);
    });
    
    return { errors, warnings };
}

/**
 * Главная функция теста
 */
async function runTest() {
    console.log(`${colors.bold}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║  ТЕСТ ПАРСЕРА VIDAL (Живые данные)    ║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}\n`);
    
    const testUrl = 'https://www.vidal.ru/drugs/paracetamol-5';
    
    try {
        // Шаг 1: Загрузка HTML
        console.log(`${colors.yellow}[1/4] Загрузка HTML со страницы...${colors.reset}`);
        console.log(`      URL: ${testUrl}`);
        const html = await fetchHTML(testUrl);
        console.log(`${colors.green}      ✓ Загружено ${html.length} символов${colors.reset}\n`);
        
        // Шаг 2: Парсинг с помощью AI
        console.log(`${colors.yellow}[2/4] Парсинг с помощью Gemini AI...${colors.reset}`);
        const parsedData = await parseVidalWithAI(html);
        console.log(`${colors.green}      ✓ Парсинг завершен${colors.reset}\n`);
        
        // Шаг 3: Вывод результатов
        console.log(`${colors.yellow}[3/4] Распарсенные данные:${colors.reset}`);
        console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        console.log(JSON.stringify(parsedData, null, 2));
        console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
        
        // Шаг 4: Валидация
        console.log(`${colors.yellow}[4/4] Валидация соответствия схеме БД:${colors.reset}`);
        console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        
        let totalErrors = 0;
        let totalWarnings = 0;
        
        // Проверка обязательных полей
        const { errors: reqErrors, warnings: reqWarnings } = validateRequiredFields(parsedData);
        totalErrors += reqErrors.length;
        totalWarnings += reqWarnings.length;
        
        if (reqErrors.length > 0) {
            console.log(`\n${colors.red}${colors.bold}Ошибки обязательных полей:${colors.reset}`);
            reqErrors.forEach(err => console.log(`  ${err}`));
        }
        
        if (reqWarnings.length > 0) {
            console.log(`\n${colors.yellow}Предупреждения:${colors.reset}`);
            reqWarnings.forEach(warn => console.log(`  ${warn}`));
        }
        
        // Проверка pediatricDosing
        if (parsedData.pediatricDosing) {
            const { errors: dosErrors, warnings: dosWarnings } = validatePediatricDosing(parsedData.pediatricDosing);
            totalErrors += dosErrors.length;
            totalWarnings += dosWarnings.length;
            
            if (dosErrors.length > 0) {
                console.log(`\n${colors.red}${colors.bold}Ошибки pediatricDosing:${colors.reset}`);
                dosErrors.forEach(err => console.log(`  ${err}`));
            }
            
            if (dosWarnings.length > 0) {
                console.log(`\n${colors.yellow}Предупреждения pediatricDosing:${colors.reset}`);
                dosWarnings.forEach(warn => console.log(`  ${warn}`));
            }
        }
        
        // Проверка forms
        if (parsedData.forms) {
            const { errors: formErrors, warnings: formWarnings } = validateForms(parsedData.forms);
            totalErrors += formErrors.length;
            totalWarnings += formWarnings.length;
            
            if (formErrors.length > 0) {
                console.log(`\n${colors.red}${colors.bold}Ошибки forms:${colors.reset}`);
                formErrors.forEach(err => console.log(`  ${err}`));
            }
            
            if (formWarnings.length > 0) {
                console.log(`\n${colors.yellow}Предупреждения forms:${colors.reset}`);
                formWarnings.forEach(warn => console.log(`  ${warn}`));
            }
        }
        
        // Проверка дополнительных полей БД
        console.log(`\n${colors.cyan}Соответствие полям БД:${colors.reset}`);
        const dbFields = [
            { name: 'nameRu', value: parsedData.nameRu, required: true },
            { name: 'nameEn', value: parsedData.nameEn, required: false },
            { name: 'activeSubstance', value: parsedData.activeSubstance, required: true },
            { name: 'atcCode', value: parsedData.atcCode, required: false },
            { name: 'manufacturer', value: parsedData.manufacturer, required: false },
            { name: 'registrationNumber', value: parsedData.registrationNumber, required: false },
            { name: 'clinicalPharmGroup', value: parsedData.clinicalPharmGroup, required: false },
            { name: 'pharmTherapyGroup', value: parsedData.pharmTherapyGroup, required: false },
            { name: 'packageDescription', value: parsedData.packageDescription, required: false },
            { name: 'minInterval', value: parsedData.minInterval, required: false },
            { name: 'maxDosesPerDay', value: parsedData.maxDosesPerDay, required: false },
            { name: 'maxDurationDays', value: parsedData.maxDurationDays, required: false },
            { name: 'routeOfAdmin', value: parsedData.routeOfAdmin, required: false },
            { name: 'icd10Codes', value: parsedData.icd10Codes, required: false }
        ];
        
        dbFields.forEach(field => {
            const status = field.value ? 
                `${colors.green}✓ Есть${colors.reset}` : 
                field.required ? `${colors.red}✗ Отсутствует (ОБЯЗАТЕЛЬНО!)${colors.reset}` : `${colors.yellow}- Нет${colors.reset}`;
            console.log(`  ${field.name.padEnd(25)} ${status}`);
            if (field.value && typeof field.value !== 'string' && typeof field.value !== 'number') {
                console.log(`    ${colors.cyan}→ Тип: ${Array.isArray(field.value) ? 'Array' : typeof field.value}${colors.reset}`);
            }
        });
        
        // Итоговый результат
        console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        console.log(`${colors.bold}ИТОГО:${colors.reset}`);
        console.log(`  Ошибок: ${totalErrors > 0 ? colors.red : colors.green}${totalErrors}${colors.reset}`);
        console.log(`  Предупреждений: ${totalWarnings > 0 ? colors.yellow : colors.green}${totalWarnings}${colors.reset}`);
        
        if (totalErrors === 0) {
            console.log(`\n${colors.green}${colors.bold}✓ ТЕСТ ПРОЙДЕН! Данные соответствуют схеме БД.${colors.reset}`);
        } else {
            console.log(`\n${colors.red}${colors.bold}✗ ТЕСТ НЕ ПРОЙДЕН! Есть критические ошибки.${colors.reset}`);
        }
        
        // Сравнение со схемой Prisma
        console.log(`\n${colors.cyan}Сравнение с моделью Medication (Prisma):${colors.reset}`);
        console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        Object.entries(MEDICATION_SCHEMA).forEach(([field, type]) => {
            const hasField = parsedData.hasOwnProperty(field) || 
                            field.includes('auto') || 
                            field.includes('default') ||
                            field === 'id' ||
                            field === 'isFavorite' ||
                            field === 'userTags' ||
                            field === 'usageCount' ||
                            field === 'lastUsedAt' ||
                            field === 'createdAt' ||
                            field === 'updatedAt';
            
            const status = hasField ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
            console.log(`  ${status} ${field.padEnd(25)} ${colors.cyan}${type}${colors.reset}`);
        });
        
    } catch (error) {
        console.error(`\n${colors.red}${colors.bold}❌ ОШИБКА:${colors.reset}`);
        console.error(`${colors.red}${error.message}${colors.reset}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Запуск теста
runTest();
