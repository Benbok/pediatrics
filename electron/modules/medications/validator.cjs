const { logger } = require('../../logger.cjs');

/**
 * Валидатор данных препаратов с проверкой на типичные ошибки AI
 */
class MedicationValidator {
    constructor() {
        this.warnings = [];
        this.errors = [];
    }

    /**
     * Валидация всех данных препарата
     */
    validate(medicationData) {
        this.warnings = [];
        this.errors = [];

        this.validateDosing(medicationData.pediatricDosing || [], medicationData.forms || []);
        this.validateForms(medicationData);
        this.validateFormLinks(medicationData);
        this.validateNumericFields(medicationData);
        this.validateTextFields(medicationData);
        this.validateConsistency(medicationData);

        return {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            needsReview: this.warnings.length > 0 || this.errors.length > 0
        };
    }

    /**
     * Определяет, используются ли МЕ/IU (Международные Единицы) вместо мг.
     * Проверяет rule.unit, unit связанной формы и unit внутри dosing.
     */
    isIUUnit(rule, forms = []) {
        const isIUString = (str) => {
            if (!str || typeof str !== 'string') return false;
            const upper = str.toUpperCase().trim();
            return upper === 'IU' || upper === 'ME' || upper === 'МЕ'
                || upper.includes('МЕ') || upper.endsWith(' IU') || upper.endsWith(' ME');
        };

        // 1. Поле unit у самого правила дозирования
        if (isIUString(rule.unit)) return true;

        // 2. Если есть formId — unit связанной формы выпуска
        if (rule.formId) {
            const form = forms.find(f => f.id === rule.formId);
            if (isIUString(form?.unit)) return true;
        }

        // 3. Unit внутри блока dosing (fixedDose / ageBasedDose)
        if (isIUString(rule.dosing?.fixedDose?.unit)) return true;
        if (isIUString(rule.dosing?.ageBasedDose?.unit)) return true;

        return false;
    }

    /**
     * Проверка дозирования на опасные значения
     */
    validateDosing(dosingRules, forms = []) {
        dosingRules.forEach((rule, idx) => {
            const isIU = this.isIUUnit(rule, forms);
            const unitLabel = isIU ? 'МЕ' : 'мг';

            // Проверка на слишком высокие дозы мг/кг (не применимо для МЕ/IU)
            if (!isIU && rule.dosing?.mgPerKg > 100) {
                this.warnings.push({
                    field: `pediatricDosing[${idx}].dosing.mgPerKg`,
                    message: `Очень высокая доза: ${rule.dosing.mgPerKg} мг/кг (обычно не более 100 мг/кг)`,
                    severity: 'high'
                });
            }

            // Проверка на нулевые или отрицательные значения
            if (rule.dosing?.mgPerKg <= 0) {
                this.errors.push({
                    field: `pediatricDosing[${idx}].dosing.mgPerKg`,
                    message: 'Доза не может быть нулевой или отрицательной'
                });
            }

            // Проверка возрастных диапазонов
            if (rule.minAgeMonths > rule.maxAgeMonths) {
                this.errors.push({
                    field: `pediatricDosing[${idx}]`,
                    message: `Минимальный возраст (${rule.minAgeMonths}) больше максимального (${rule.maxAgeMonths})`
                });
            }

            // КРИТИЧНО: Проверка наличия максимальных доз
            if (!rule.maxSingleDose && !rule.maxSingleDosePerKg) {
                this.warnings.push({
                    field: `pediatricDosing[${idx}].maxSingleDose`,
                    message: 'Не указана максимальная разовая доза (важно для безопасности!)',
                    severity: 'high'
                });
            }

            if (!rule.maxDailyDose && !rule.maxDailyDosePerKg) {
                this.warnings.push({
                    field: `pediatricDosing[${idx}].maxDailyDose`,
                    message: 'Не указана максимальная суточная доза (важно для безопасности!)',
                    severity: 'high'
                });
            }

            // Проверка на отсутствие инструкции
            if (!rule.instruction || rule.instruction.trim() === '') {
                this.warnings.push({
                    field: `pediatricDosing[${idx}].instruction`,
                    message: 'Отсутствует инструкция по применению',
                    severity: 'medium'
                });
            }

            // Проверка согласованности maxDailyDose vs maxSingleDose × timesPerDay.
            // Поддерживаются асимметричные схемы (разные дозы в разные приёмы),
            // например: утром 1 000 000 МЕ + вечером 500 000 МЕ = 1 500 000 МЕ/сутки.
            if (rule.maxDailyDose && rule.maxSingleDose && rule.timesPerDay) {
                const theoreticalMaxDaily = rule.maxSingleDose * rule.timesPerDay;

                if (rule.maxDailyDose < rule.maxSingleDose) {
                    // Суточная доза меньше разовой — явная ошибка данных
                    this.errors.push({
                        field: `pediatricDosing[${idx}].maxDailyDose`,
                        message: `Максимальная суточная доза (${rule.maxDailyDose} ${unitLabel}) меньше разовой (${rule.maxSingleDose} ${unitLabel}). Проверьте данные!`,
                        severity: 'high'
                    });
                } else if (rule.maxDailyDose < theoreticalMaxDaily * 0.9) {
                    // Суточная ≥ разовой, но < разовая × частота — вероятно асимметричная схема
                    this.warnings.push({
                        field: `pediatricDosing[${idx}].maxDailyDose`,
                        message: `Суточная доза (${rule.maxDailyDose} ${unitLabel}) меньше расчётной разовая × частота (${theoreticalMaxDaily} ${unitLabel}). ` +
                            `Если схема асимметричная (разные дозы в разные приёмы) — это норма. Иначе проверьте данные.`,
                        severity: 'high'
                    });
                }
            }

            // Проверка расчетной дозы vs максимальной (для weight_based, только мг)
            if (!isIU && rule.dosing?.mgPerKg && rule.maxSingleDose) {
                // Для среднего ребенка 20 кг
                const calculatedDose = 20 * rule.dosing.mgPerKg;

                if (calculatedDose > rule.maxSingleDose) {
                    this.warnings.push({
                        field: `pediatricDosing[${idx}].dosing.mgPerKg`,
                        message: `При весе 20 кг расчетная доза (${Math.round(calculatedDose)} мг) превысит максимальную разовую (${rule.maxSingleDose} мг)`,
                        severity: 'medium'
                    });
                }
            }

            // Проверка аномально больших доз.
            // Для МЕ/IU пороги мг неприменимы — пропускаем эти проверки.
            if (!isIU) {
                if (rule.maxSingleDose && rule.maxSingleDose > 5000) {
                    this.warnings.push({
                        field: `pediatricDosing[${idx}].maxSingleDose`,
                        message: `Очень большая максимальная разовая доза: ${rule.maxSingleDose} мг. Возможно ошибка в единицах измерения?`,
                        severity: 'high'
                    });
                }

                if (rule.maxSingleDosePerKg && rule.maxSingleDosePerKg > 200) {
                    this.warnings.push({
                        field: `pediatricDosing[${idx}].maxSingleDosePerKg`,
                        message: `Очень большая максимальная разовая доза: ${rule.maxSingleDosePerKg} мг/кг. Возможно ошибка в единицах?`,
                        severity: 'high'
                    });
                }

                if (rule.maxDailyDose && rule.maxDailyDose > 20000) {
                    this.warnings.push({
                        field: `pediatricDosing[${idx}].maxDailyDose`,
                        message: `Очень большая максимальная суточная доза: ${rule.maxDailyDose} мг. Возможно ошибка в единицах измерения?`,
                        severity: 'high'
                    });
                }

                if (rule.maxDailyDosePerKg && rule.maxDailyDosePerKg > 400) {
                    this.warnings.push({
                        field: `pediatricDosing[${idx}].maxDailyDosePerKg`,
                        message: `Очень большая максимальная суточная доза: ${rule.maxDailyDosePerKg} мг/кг. Возможно ошибка в единицах?`,
                        severity: 'high'
                    });
                }
            }
        });
    }

    /**
     * Проверка форм выпуска
     */
    validateForms(data) {
        if (!data.forms) return;
        if (!Array.isArray(data.forms)) {
            this.errors.push({
                field: 'forms',
                message: 'Поле forms должно быть массивом объектов'
            });
            return;
        }

        const ids = new Set();
        data.forms.forEach((form, idx) => {
            if (!form || typeof form !== 'object') {
                this.errors.push({
                    field: `forms[${idx}]`,
                    message: 'Элемент forms должен быть объектом'
                });
                return;
            }
            if (!form.id || typeof form.id !== 'string') {
                this.errors.push({
                    field: `forms[${idx}].id`,
                    message: 'id формы обязателен'
                });
            } else if (ids.has(form.id)) {
                this.warnings.push({
                    field: `forms[${idx}].id`,
                    message: `Дублирующийся id формы: ${form.id}`,
                    severity: 'medium'
                });
            } else {
                ids.add(form.id);
            }
        });
    }

    /**
     * Проверка связей formId в дозировках
     */
    validateFormLinks(data) {
        if (!data.pediatricDosing || !Array.isArray(data.pediatricDosing)) return;
        const forms = Array.isArray(data.forms) ? data.forms : [];
        const formIds = new Set(forms.map(f => f?.id).filter(Boolean));

        data.pediatricDosing.forEach((rule, idx) => {
            if (rule.formId && !formIds.has(rule.formId)) {
                this.warnings.push({
                    field: `pediatricDosing[${idx}].formId`,
                    message: `formId не найден среди forms: ${rule.formId}`,
                    severity: 'medium'
                });
            }
        });
    }

    /**
     * Проверка числовых полей
     */
    validateNumericFields(data) {
        if (data.minInterval && (data.minInterval < 0 || data.minInterval > 24)) {
            this.warnings.push({
                field: 'minInterval',
                message: `Минимальный интервал ${data.minInterval} часов выглядит подозрительно`,
                severity: 'medium'
            });
        }

        if (data.maxDosesPerDay && (data.maxDosesPerDay < 1 || data.maxDosesPerDay > 10)) {
            this.warnings.push({
                field: 'maxDosesPerDay',
                message: `Максимальное количество доз ${data.maxDosesPerDay} выглядит подозрительно`,
                severity: 'medium'
            });
        }
    }

    /**
     * Проверка текстовых полей на заполненность
     */
    validateTextFields(data) {
        const requiredFields = [
            { field: 'nameRu', label: 'Название препарата' },
            { field: 'activeSubstance', label: 'Действующее вещество' },
            { field: 'contraindications', label: 'Противопоказания' }
        ];

        requiredFields.forEach(({ field, label }) => {
            if (!data[field] || data[field].trim() === '') {
                this.errors.push({
                    field,
                    message: `Обязательное поле "${label}" не заполнено`
                });
            }
        });

        // Предупреждения о пустых необязательных, но важных полях
        if (!data.clinicalPharmGroup) {
            this.warnings.push({
                field: 'clinicalPharmGroup',
                message: 'Клинико-фармакологическая группа не заполнена',
                severity: 'low'
            });
        }
    }

    /**
     * Проверка согласованности данных
     */
    validateConsistency(data) {
        // Проверка соответствия путей введения и форм выпуска
        const oralRoutes = ['oral', 'sublingual'];
        const injectableRoutes = ['iv_bolus', 'iv_infusion', 'iv_slow', 'im', 'sc'];

        if (data.pediatricDosing) {
            data.pediatricDosing.forEach((rule, idx) => {
                // Если указан в/в путь, должны быть параметры инфузии
                if (injectableRoutes.includes(rule.routeOfAdmin) && !rule.infusion) {
                    this.warnings.push({
                        field: `pediatricDosing[${idx}].infusion`,
                        message: `Для ${rule.routeOfAdmin} рекомендуется указать параметры инфузии`,
                        severity: 'medium'
                    });
                }

                // Если указаны параметры инфузии, путь должен быть в/в
                if (rule.infusion && !injectableRoutes.includes(rule.routeOfAdmin)) {
                    this.warnings.push({
                        field: `pediatricDosing[${idx}].routeOfAdmin`,
                        message: `Параметры инфузии указаны, но путь введения не инъекционный`,
                        severity: 'high'
                    });
                }
            });
        }
    }
}

module.exports = { MedicationValidator };
