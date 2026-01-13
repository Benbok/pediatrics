const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');

/**
 * Безопасный парсинг JSON полей
 */
function safeJsonParse(value, defaultValue = []) {
    if (!value || value === null) return defaultValue;
    if (typeof value !== 'string') return defaultValue;
    if (value.trim() === '') return defaultValue;
    
    try {
        return JSON.parse(value);
    } catch (error) {
        logger.warn('[MedicationService] Failed to parse JSON, using default:', error.message);
        return defaultValue;
    }
}

// Medication Validation Schema
const MedicationSchema = z.object({
    id: z.number().optional(),
    nameRu: z.string().min(2),
    nameEn: z.string().optional().nullable(),
    activeSubstance: z.string().min(2),
    atcCode: z.string().optional().nullable(),
    icd10Codes: z.array(z.string()).default([]),
    packageDescription: z.string().optional().nullable(),
    manufacturer: z.string().optional().nullable(),
    forms: z.array(z.any()).default([]), // Expected to be serialized JSON
    pediatricDosing: z.any(), // JSON structure for age/weight rules (Vidal format)
    adultDosing: z.any().optional().nullable(),
    contraindications: z.string(),
    cautionConditions: z.string().optional().nullable(),
    sideEffects: z.string().optional().nullable(),
    interactions: z.string().optional().nullable(),
    pregnancy: z.string().optional().nullable(),
    lactation: z.string().optional().nullable(),
    indications: z.array(z.any()).default([]), // List of conditions/ICD codes
    registrationNumber: z.string().optional().nullable(),
    vidalUrl: z.string().optional().nullable(),
    // Новые поля для ограничений дозирования
    minInterval: z.number().int().min(1).max(24).optional().nullable(), // часы
    maxDosesPerDay: z.number().int().min(1).max(10).optional().nullable(),
    maxDurationDays: z.number().int().min(1).max(365).optional().nullable(),
    routeOfAdmin: z.enum(['oral', 'rectal', 'iv', 'im', 'sublingual', 'topical', 'inhalation']).optional().nullable(),
});

const MedicationService = {
    /**
     * Get all medications
     */
    async list() {
        const medications = await prisma.medication.findMany({
            orderBy: { nameRu: 'asc' },
        });
        return medications.map(med => ({
            ...med,
            icd10Codes: safeJsonParse(med.icd10Codes, [])
        }));
    },

    /**
     * Get medications that match any of the provided ICD-10 codes
     */
    async getByIcd10Codes(icd10Codes) {
        logger.info(`[MedicationService] Searching medications for ICD codes:`, icd10Codes);
        
        const medications = await prisma.medication.findMany();
        logger.info(`[MedicationService] Total medications in DB: ${medications.length}`);

        const matched = medications.filter(med => {
            const medCodes = safeJsonParse(med.icd10Codes, []);
            const hasMatch = medCodes.some(code => icd10Codes.includes(code));
            
            if (hasMatch) {
                logger.info(`[MedicationService] Match found: ${med.nameRu}, codes:`, medCodes);
            }
            
            return hasMatch;
        }).map(med => ({
            ...med,
            icd10Codes: safeJsonParse(med.icd10Codes, [])
        }));
        
        logger.info(`[MedicationService] Found ${matched.length} matching medications`);
        return matched;
    },

    /**
     * Get medication by ID
     */
    async getById(id) {
        const medication = await prisma.medication.findUnique({
            where: { id: Number(id) },
            include: {
                diseases: {
                    include: {
                        disease: true
                    }
                }
            }
        });

        if (!medication) return null;

        return {
            ...medication,
            forms: safeJsonParse(medication.forms, []),
            pediatricDosing: safeJsonParse(medication.pediatricDosing, []),
            adultDosing: medication.adultDosing ? safeJsonParse(medication.adultDosing, null) : null,
            indications: safeJsonParse(medication.indications, []),
            icd10Codes: safeJsonParse(medication.icd10Codes, []),
        };
    },

    /**
     * Upsert medication
     */
    async upsert(data) {
        const validated = MedicationSchema.parse(data);
        const { id, ...rest } = validated;

        const dbData = {
            ...rest,
            icd10Codes: JSON.stringify(rest.icd10Codes),
            forms: JSON.stringify(rest.forms),
            pediatricDosing: JSON.stringify(rest.pediatricDosing),
            adultDosing: rest.adultDosing ? JSON.stringify(rest.adultDosing) : null,
            indications: JSON.stringify(rest.indications),
            // Новые поля сохраняются как есть (они уже валидированы Zod)
        };

        if (id) {
            return await prisma.medication.update({
                where: { id },
                data: dbData,
            });
        }

        return await prisma.medication.create({
            data: dbData,
        });
    },

    /**
     * Delete medication
     */
    async delete(id) {
        return await prisma.medication.delete({
            where: { id: Number(id) },
        });
    },

    /**
     * Link medication to a disease
     */
    async linkToDisease(data) {
        return await prisma.diseaseMedication.upsert({
            where: {
                diseaseId_medicationId: {
                    diseaseId: Number(data.diseaseId),
                    medicationId: Number(data.medicationId),
                }
            },
            update: {
                priority: data.priority || 1,
                dosing: data.dosing,
                duration: data.duration,
            },
            create: {
                diseaseId: Number(data.diseaseId),
                medicationId: Number(data.medicationId),
                priority: data.priority || 1,
                dosing: data.dosing,
                duration: data.duration,
            }
        });
    },

    /**
     * Calculate dosage based on child's age/weight/height
     * @param {number} medicationId - ID препарата
     * @param {number} childWeight - вес в кг (текущий, не при рождении!)
     * @param {number} childAgeMonths - возраст в месяцах
     * @param {number} [childHeight] - рост в см (опционально, для расчета ППТ)
     */
    async calculateDose(medicationId, childWeight, childAgeMonths, childHeight = null) {
        const medication = await this.getById(medicationId);
        if (!medication) throw new Error('Препарат не найден');

        const dosingRules = JSON.parse(medication.pediatricDosing || '[]');

        // Find matching rule by age and weight
        const rule = dosingRules.find(r => {
            const ageMatch = childAgeMonths >= (r.minAgeMonths || 0) &&
                            childAgeMonths <= (r.maxAgeMonths || 999);
            const weightMatch = !r.minWeightKg || childWeight >= r.minWeightKg;
            const weightMaxMatch = !r.maxWeightKg || childWeight <= r.maxWeightKg;
            return ageMatch && weightMatch && weightMaxMatch;
        });

        if (!rule) {
            return {
                canUse: false,
                message: 'Нет данных по дозированию для данного возраста и веса'
            };
        }

        const { calculateBSA } = require('../../utils/anthropometry.cjs');
        let bsa = null;
        if (childHeight && childWeight) {
            try {
                bsa = calculateBSA(childWeight, childHeight);
            } catch (err) {
                // BSA calculation failed, continue without it
            }
        }

        // Determine dosing type and calculate
        let singleDoseMg = null;
        let dailyDoseMg = null;
        let instruction = '';

        if (rule.dosing) {
            const dosing = rule.dosing;
            
            if (dosing.type === 'weight_based' && dosing.mgPerKg) {
                // Дозирование по весу (мг/кг)
                singleDoseMg = childWeight * dosing.mgPerKg;
                if (dosing.maxMgPerKg) {
                    singleDoseMg = Math.min(singleDoseMg, childWeight * dosing.maxMgPerKg);
                }
            } else if (dosing.type === 'bsa_based' && dosing.mgPerM2 && bsa) {
                // Дозирование по площади тела (мг/м²)
                singleDoseMg = bsa * dosing.mgPerM2;
            } else if (dosing.type === 'fixed' && dosing.fixedDose) {
                // Фиксированная доза
                singleDoseMg = dosing.fixedDose.min || dosing.fixedDose.max || 0;
                if (dosing.fixedDose.unit === 'ml' && rule.form) {
                    // Для растворов нужно конвертировать мл в мг
                    // Это требует информации о концентрации формы выпуска
                    // Пока возвращаем базовую дозу
                }
            }
        } else if (rule.mgPerKg) {
            // Старый формат (backward compatibility)
            singleDoseMg = childWeight * rule.mgPerKg;
        }

        if (singleDoseMg !== null) {
            dailyDoseMg = singleDoseMg * (rule.timesPerDay || 1);
            
            // Проверка ограничений
            if (rule.maxSingleDose) {
                singleDoseMg = Math.min(singleDoseMg, rule.maxSingleDose);
            }
            if (rule.maxDailyDose) {
                dailyDoseMg = Math.min(dailyDoseMg, rule.maxDailyDose);
            }

            instruction = rule.instruction || 
                (singleDoseMg ? `По ${Math.round(singleDoseMg)}мг ${rule.timesPerDay || 1} раза в день` : 'См. инструкцию');
        } else {
            instruction = rule.instruction || 'См. инструкцию';
        }

        const warnings = [];
        if (rule.maxSingleDose && singleDoseMg && singleDoseMg > rule.maxSingleDose) {
            warnings.push(`Превышена максимальная разовая доза (${rule.maxSingleDose}мг)`);
        }
        if (rule.maxDailyDose && dailyDoseMg && dailyDoseMg > rule.maxDailyDose) {
            warnings.push(`Превышена максимальная суточная доза (${rule.maxDailyDose}мг)`);
        }

        return {
            canUse: true,
            singleDoseMg: singleDoseMg ? Math.round(singleDoseMg * 10) / 10 : null,
            dailyDoseMg: dailyDoseMg ? Math.round(dailyDoseMg * 10) / 10 : null,
            timesPerDay: rule.timesPerDay || 1,
            maxSingleDose: rule.maxSingleDose || null,
            maxDailyDose: rule.maxDailyDose || null,
            minInterval: medication.minInterval || null,
            maxDosesPerDay: medication.maxDosesPerDay || null,
            instruction,
            warnings: warnings.length > 0 ? warnings : null,
            bsa: bsa ? Math.round(bsa * 100) / 100 : null
        };
    }
};

module.exports = { MedicationService, MedicationSchema };
