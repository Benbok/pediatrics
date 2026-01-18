const { logger } = require('../../logger.cjs');
const { getCanonicalSet, normalizeText } = require('../../utils/cdssVocabulary.cjs');

/**
 * Валидатор данных заболеваний с проверкой на типичные ошибки AI
 */
class DiseaseValidator {
    constructor() {
        this.warnings = [];
        this.errors = [];
    }

    /**
     * Валидация всех данных заболевания
     */
    validate(diseaseData) {
        this.warnings = [];
        this.errors = [];

        this.validateRequiredFields(diseaseData);
        this.validateIcd10Codes(diseaseData);
        this.validateSymptoms(diseaseData);
        this.validateDiagnosticPlan(diseaseData);
        this.validateTreatmentPlan(diseaseData);
        this.validateStringList(diseaseData, 'differentialDiagnosis');
        this.validateStringList(diseaseData, 'redFlags');
        this.validateTextFields(diseaseData);
        this.validateConsistency(diseaseData);

        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            needsReview: this.warnings.length > 0 || this.errors.length > 0
        };
    }

    /**
     * Проверка обязательных полей
     */
    validateRequiredFields(data) {
        // Проверка основного кода МКБ-10
        if (!data.icd10Code || typeof data.icd10Code !== 'string' || data.icd10Code.trim() === '') {
            this.errors.push({
                field: 'icd10Code',
                message: 'Обязательное поле: код МКБ-10'
            });
        } else {
            // Проверка формата кода МКБ-10 (минимум 3 символа, максимум 10)
            const codePattern = /^[A-Z][0-9]{2}(\.[0-9]+)?$/;
            if (!codePattern.test(data.icd10Code)) {
                this.warnings.push({
                    field: 'icd10Code',
                    message: `Необычный формат кода МКБ-10: "${data.icd10Code}". Проверьте корректность.`,
                    severity: 'medium'
                });
            }
        }

        // Проверка названия
        if (!data.nameRu || typeof data.nameRu !== 'string' || data.nameRu.trim().length < 2) {
            this.errors.push({
                field: 'nameRu',
                message: 'Обязательное поле: название заболевания (минимум 2 символа)'
            });
        } else if (data.nameRu.trim().length < 5) {
            this.warnings.push({
                field: 'nameRu',
                message: 'Название заболевания очень короткое. Проверьте корректность.',
                severity: 'low'
            });
        }

        // Проверка описания
        if (!data.description || typeof data.description !== 'string' || data.description.trim() === '') {
            this.errors.push({
                field: 'description',
                message: 'Обязательное поле: описание заболевания'
            });
        } else if (data.description.trim().length < 20) {
            this.warnings.push({
                field: 'description',
                message: 'Описание заболевания очень короткое. Рекомендуется более подробное описание.',
                severity: 'medium'
            });
        }
    }

    /**
     * Проверка кодов МКБ-10
     */
    validateIcd10Codes(data) {
        // Проверка основного кода уже выполнена в validateRequiredFields
        
        // Проверка массива дополнительных кодов
        if (data.icd10Codes) {
            if (!Array.isArray(data.icd10Codes)) {
                this.errors.push({
                    field: 'icd10Codes',
                    message: 'Поле icd10Codes должно быть массивом строк'
                });
                return;
            }

            // Проверка формата каждого кода
            const codePattern = /^[A-Z][0-9]{2}(\.[0-9]+)?$/;
            data.icd10Codes.forEach((code, idx) => {
                if (typeof code !== 'string') {
                    this.errors.push({
                        field: `icd10Codes[${idx}]`,
                        message: 'Каждый код МКБ-10 должен быть строкой'
                    });
                } else if (!codePattern.test(code)) {
                    this.warnings.push({
                        field: `icd10Codes[${idx}]`,
                        message: `Необычный формат кода МКБ-10: "${code}"`,
                        severity: 'low'
                    });
                }
            });

            // Проверка, что основной код есть в списке всех кодов
            if (data.icd10Code && !data.icd10Codes.includes(data.icd10Code)) {
                this.warnings.push({
                    field: 'icd10Codes',
                    message: 'Основной код МКБ-10 отсутствует в списке всех кодов. Рекомендуется добавить.',
                    severity: 'medium'
                });
            }

            // Проверка на дубликаты
            const uniqueCodes = [...new Set(data.icd10Codes)];
            if (uniqueCodes.length !== data.icd10Codes.length) {
                this.warnings.push({
                    field: 'icd10Codes',
                    message: 'Обнаружены дублирующиеся коды МКБ-10 в массиве',
                    severity: 'low'
                });
            }
        }
    }

    /**
     * Проверка симптомов
     */
    validateSymptoms(data) {
        if (data.symptoms !== undefined && data.symptoms !== null) {
            if (!Array.isArray(data.symptoms)) {
                this.errors.push({
                    field: 'symptoms',
                    message: 'Поле symptoms должно быть массивом строк'
                });
                return;
            }

            // Проверка пустого массива симптомов
            if (data.symptoms.length === 0) {
                this.warnings.push({
                    field: 'symptoms',
                    message: 'Не указано ни одного симптома. Рекомендуется добавить основные симптомы заболевания.',
                    severity: 'medium'
                });
            }

            const canonicalSymptoms = getCanonicalSet('symptoms');

            // Проверка каждого симптома
            data.symptoms.forEach((symptom, idx) => {
                if (typeof symptom !== 'string') {
                    this.errors.push({
                        field: `symptoms[${idx}]`,
                        message: 'Каждый симптом должен быть строкой'
                    });
                } else if (symptom.trim().length === 0) {
                    this.errors.push({
                        field: `symptoms[${idx}]`,
                        message: 'Симптом не может быть пустой строкой'
                    });
                } else if (symptom.trim().length < 3) {
                    this.warnings.push({
                        field: `symptoms[${idx}]`,
                        message: `Симптом слишком короткий: "${symptom}"`,
                        severity: 'low'
                    });
                } else if (canonicalSymptoms.size > 0 && !canonicalSymptoms.has(normalizeText(symptom))) {
                    this.warnings.push({
                        field: `symptoms[${idx}]`,
                        message: `Симптом не найден в словаре (будет сохранен как есть): "${symptom}"`,
                        severity: 'low'
                    });
                }
            });

            // Проверка на дубликаты симптомов
            const uniqueSymptoms = [...new Set(data.symptoms.map(s => s.trim().toLowerCase()))];
            if (uniqueSymptoms.length !== data.symptoms.length) {
                this.warnings.push({
                    field: 'symptoms',
                    message: 'Обнаружены дублирующиеся симптомы (с учетом регистра)',
                    severity: 'low'
                });
            }
        }
    }

    /**
     * Проверка диагностического плана
     */
    validateDiagnosticPlan(data) {
        if (data.diagnosticPlan === undefined || data.diagnosticPlan === null) return;
        if (!Array.isArray(data.diagnosticPlan)) {
            this.errors.push({
                field: 'diagnosticPlan',
                message: 'Поле diagnosticPlan должно быть массивом объектов'
            });
            return;
        }

        data.diagnosticPlan.forEach((item, idx) => {
            if (!item || typeof item !== 'object') {
                this.errors.push({
                    field: `diagnosticPlan[${idx}]`,
                    message: 'Элемент diagnosticPlan должен быть объектом'
                });
                return;
            }
            if (!item.type || !['lab', 'instrumental'].includes(item.type)) {
                this.errors.push({
                    field: `diagnosticPlan[${idx}].type`,
                    message: 'type должен быть "lab" или "instrumental"'
                });
            }
            if (!item.test || typeof item.test !== 'string' || item.test.trim() === '') {
                this.errors.push({
                    field: `diagnosticPlan[${idx}].test`,
                    message: 'test обязателен'
                });
            }
        });
    }

    /**
     * Проверка плана лечения
     */
    validateTreatmentPlan(data) {
        if (data.treatmentPlan === undefined || data.treatmentPlan === null) return;
        if (!Array.isArray(data.treatmentPlan)) {
            this.errors.push({
                field: 'treatmentPlan',
                message: 'Поле treatmentPlan должно быть массивом объектов'
            });
            return;
        }

        data.treatmentPlan.forEach((item, idx) => {
            if (!item || typeof item !== 'object') {
                this.errors.push({
                    field: `treatmentPlan[${idx}]`,
                    message: 'Элемент treatmentPlan должен быть объектом'
                });
                return;
            }
            if (!item.category || !['symptomatic', 'etiologic', 'supportive', 'other'].includes(item.category)) {
                this.errors.push({
                    field: `treatmentPlan[${idx}].category`,
                    message: 'category должен быть "symptomatic", "etiologic", "supportive" или "other"'
                });
            }
            if (!item.description || typeof item.description !== 'string' || item.description.trim() === '') {
                this.errors.push({
                    field: `treatmentPlan[${idx}].description`,
                    message: 'description обязателен'
                });
            }
        });
    }

    /**
     * Проверка массива строк (например, redFlags)
     */
    validateStringList(data, fieldName) {
        if (data[fieldName] === undefined || data[fieldName] === null) return;
        if (!Array.isArray(data[fieldName])) {
            this.errors.push({
                field: fieldName,
                message: `Поле ${fieldName} должно быть массивом строк`
            });
            return;
        }
        data[fieldName].forEach((item, idx) => {
            if (typeof item !== 'string' || item.trim() === '') {
                this.errors.push({
                    field: `${fieldName}[${idx}]`,
                    message: 'Элемент должен быть непустой строкой'
                });
            }
        });
    }

    /**
     * Проверка текстовых полей
     */
    validateTextFields(data) {
        // Проверка nameEn (необязательное поле)
        if (data.nameEn !== undefined && data.nameEn !== null) {
            if (typeof data.nameEn !== 'string') {
                this.errors.push({
                    field: 'nameEn',
                    message: 'Поле nameEn должно быть строкой или null'
                });
            } else if (data.nameEn.trim().length < 2 && data.nameEn.trim().length > 0) {
                this.warnings.push({
                    field: 'nameEn',
                    message: 'Английское название слишком короткое',
                    severity: 'low'
                });
            }
        }

        // Проверка описания на наличие только пробелов или спецсимволов
        if (data.description && typeof data.description === 'string') {
            const textOnly = data.description.replace(/\s+/g, ' ').trim();
            if (textOnly.length < 20) {
                this.warnings.push({
                    field: 'description',
                    message: 'Описание может быть слишком коротким для полноценного описания заболевания',
                    severity: 'medium'
                });
            }
        }
    }

    /**
     * Проверка согласованности данных
     */
    validateConsistency(data) {
        // Проверка, что основной код совпадает с первым элементом массива (если массив не пустой)
        if (data.icd10Code && data.icd10Codes && data.icd10Codes.length > 0) {
            // Не ошибка, но предупреждение если не совпадает
            if (data.icd10Codes[0] !== data.icd10Code) {
                this.warnings.push({
                    field: 'icd10Codes',
                    message: 'Первый код в массиве icd10Codes обычно должен совпадать с основным кодом icd10Code',
                    severity: 'low'
                });
            }
        }

        // Проверка длины описания (слишком длинное может быть проблемой)
        if (data.description && data.description.length > 10000) {
            this.warnings.push({
                field: 'description',
                message: 'Описание очень длинное (>10000 символов). Возможно, это ошибка.',
                severity: 'medium'
            });
        }
    }
}

module.exports = { DiseaseValidator };
