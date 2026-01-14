const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');
const { CacheService } = require('../../services/cacheService.cjs');

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
    indications: z.any().default([]), // List of conditions/ICD codes (can be string or array)
    vidalUrl: z.string().optional().nullable(),
    // Клинико-фармакологические группы
    clinicalPharmGroup: z.string().optional().nullable(),
    pharmTherapyGroup: z.string().optional().nullable(),
    // Новые поля для ограничений дозирования
    minInterval: z.number().int().min(1).max(24).optional().nullable(), // часы
    maxDosesPerDay: z.number().int().min(1).max(10).optional().nullable(),
    maxDurationDays: z.number().int().min(1).max(365).optional().nullable(),
    routeOfAdmin: z.enum(['oral', 'rectal', 'iv', 'im', 'sublingual', 'topical', 'inhalation', 'iv_bolus', 'iv_infusion', 'iv_slow', 'sc', 'intranasal', 'transdermal']).optional().nullable(),
    // Избранное и теги
    isFavorite: z.boolean().optional().default(false),
    userTags: z.array(z.string()).optional().nullable(),
    usageCount: z.number().int().optional().default(0),
    lastUsedAt: z.string().optional().nullable(),
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
            icd10Codes: safeJsonParse(med.icd10Codes, []),
            userTags: safeJsonParse(med.userTags, [])
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
            icd10Codes: safeJsonParse(med.icd10Codes, []),
            userTags: safeJsonParse(med.userTags, [])
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
            userTags: safeJsonParse(medication.userTags, []),
        };
    },

    /**
     * Upsert medication
     */
    async upsert(data, userId = null, source = 'manual') {
        const validated = MedicationSchema.parse(data);
        const { id, ...rest } = validated;

        // Получить старые данные для сравнения
        const oldData = id ? await this.getById(id) : null;

        // Нормализация данных перед сохранением
        const normalizeArray = (value) => {
            if (!value) return [];
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') return [];
            return [];
        };
        
        const normalizeString = (value) => {
            if (!value) return '';
            if (Array.isArray(value)) return JSON.stringify(value);
            return String(value);
        };

        const dbData = {
            ...rest,
            icd10Codes: JSON.stringify(normalizeArray(rest.icd10Codes)),
            forms: JSON.stringify(normalizeArray(rest.forms)),
            pediatricDosing: JSON.stringify(normalizeArray(rest.pediatricDosing)),
            adultDosing: rest.adultDosing ? JSON.stringify(normalizeArray(rest.adultDosing)) : null,
            indications: normalizeString(rest.indications),
            contraindications: normalizeString(rest.contraindications),
            cautionConditions: Array.isArray(rest.cautionConditions) ? JSON.stringify(rest.cautionConditions) : (rest.cautionConditions || null),
            userTags: rest.userTags ? JSON.stringify(normalizeArray(rest.userTags)) : null,
            routeOfAdmin: Array.isArray(rest.routeOfAdmin) ? rest.routeOfAdmin[0] : rest.routeOfAdmin,
            // Новые поля сохраняются как есть (они уже валидированы Zod)
        };

        let result;
        if (id) {
            result = await prisma.medication.update({
                where: { id },
                data: dbData,
            });
            
            // Логировать изменение
            if (userId) {
                await this.logChange(id, userId, 'update', oldData, data, source);
            }
        } else {
            result = await prisma.medication.create({
                data: dbData,
            });
            
            // Логировать создание
            if (userId) {
                await this.logChange(result.id, userId, 'create', null, data, source);
            }
        }

        return result;
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
            } else if (dosing.type === 'age_based' && dosing.ageBasedDose) {
                // Дозирование только по возрасту
                singleDoseMg = dosing.ageBasedDose.dose;
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

        // Добавить информацию об инфузии
        let infusionDetails = null;
        if (rule.infusion) {
            infusionDetails = {
                concentration: rule.infusion.concentration,
                dilution: rule.infusion.dilution,
                rate: rule.infusion.infusionRate || null,
                duration: rule.infusion.duration || null,
                compatibility: rule.infusion.compatibility || [],
                maxConcentration: rule.infusion.maxConcentration || null,
            };
        }

        return {
            canUse: true,
            singleDoseMg: singleDoseMg ? Math.round(singleDoseMg * 10) / 10 : null,
            dailyDoseMg: dailyDoseMg ? Math.round(dailyDoseMg * 10) / 10 : null,
            timesPerDay: rule.timesPerDay || 1,
            intervalHours: rule.intervalHours || null,
            maxSingleDose: rule.maxSingleDose || null,
            maxDailyDose: rule.maxDailyDose || null,
            minInterval: medication.minInterval || null,
            maxDosesPerDay: medication.maxDosesPerDay || null,
            routeOfAdmin: rule.routeOfAdmin || medication.routeOfAdmin || null,
            infusion: infusionDetails,
            instruction,
            warnings: warnings.length > 0 ? warnings : null,
            bsa: bsa ? Math.round(bsa * 100) / 100 : null
        };
    },

    /**
     * Проверяет существование препарата с таким же названием
     * @param {string} nameRu - Название препарата
     * @param {number} excludeId - ID препарата, который нужно исключить из проверки (для редактирования)
     * @returns {Promise<Medication|null>} - Найденный препарат или null
     */
    async checkDuplicate(nameRu, excludeId = null) {
        const normalizedName = nameRu.trim().toLowerCase();
        
        const medications = await prisma.medication.findMany({
            where: excludeId ? {
                id: { not: excludeId }
            } : undefined
        });
        
        // Поиск по точному совпадению (без учета регистра)
        const duplicate = medications.find(med => 
            med.nameRu.toLowerCase() === normalizedName
        );
        
        if (duplicate) {
            return {
                ...duplicate,
                icd10Codes: safeJsonParse(duplicate.icd10Codes, []),
                forms: safeJsonParse(duplicate.forms, []),
                pediatricDosing: safeJsonParse(duplicate.pediatricDosing, []),
                userTags: safeJsonParse(duplicate.userTags, [])
            };
        }
        
        return null;
    },

    /**
     * Получить список всех клинико-фармакологических групп
     */
    async getPharmacologicalGroups() {
        const medications = await prisma.medication.findMany({
            select: {
                clinicalPharmGroup: true
            }
        });
        
        const groups = new Set();
        medications.forEach(med => {
            if (med.clinicalPharmGroup) groups.add(med.clinicalPharmGroup);
        });
        
        return Array.from(groups).sort();
    },

    /**
     * Поиск по группе
     */
    async searchByGroup(groupName) {
        const medications = await prisma.medication.findMany({
            where: {
                clinicalPharmGroup: { contains: groupName }
            },
            orderBy: { nameRu: 'asc' }
        });
        
        return medications.map(med => ({
            ...med,
            icd10Codes: safeJsonParse(med.icd10Codes, []),
            pediatricDosing: safeJsonParse(med.pediatricDosing, []),
            userTags: safeJsonParse(med.userTags, [])
        }));
    },

    /**
     * Добавить/убрать из избранного
     */
    async toggleFavorite(medicationId) {
        const medication = await prisma.medication.findUnique({
            where: { id: medicationId }
        });
        
        if (!medication) throw new Error('Препарат не найден');
        
        return await prisma.medication.update({
            where: { id: medicationId },
            data: { isFavorite: !medication.isFavorite }
        });
    },

    /**
     * Добавить тег
     */
    async addTag(medicationId, tag) {
        const medication = await this.getById(medicationId);
        if (!medication) throw new Error('Препарат не найден');
        
        const tags = safeJsonParse(medication.userTags, []);
        
        if (!tags.includes(tag)) {
            tags.push(tag);
            await prisma.medication.update({
                where: { id: medicationId },
                data: { userTags: JSON.stringify(tags) }
            });
        }
        
        return true;
    },

    /**
     * Увеличить счетчик использования
     */
    async incrementUsage(medicationId) {
        await prisma.medication.update({
            where: { id: medicationId },
            data: {
                usageCount: { increment: 1 },
                lastUsedAt: new Date()
            }
        });
        CacheService.invalidate('medications', 'all');
        CacheService.invalidate('medications', `id_${medicationId}`);
        return true;
    },

    /**
     * Логирование изменений
     */
    async logChange(medicationId, userId, changeType, oldData, newData, source = 'manual') {
        if (!userId) {
            // Если userId не передан, не логируем
            return;
        }
        
        const changes = [];
        
        // Сравнить старые и новые данные
        const fieldsToTrack = [
            'nameRu', 'activeSubstance', 'atcCode', 'manufacturer',
            'clinicalPharmGroup', 'pediatricDosing', 'contraindications'
        ];
        
        fieldsToTrack.forEach(field => {
            const oldValue = oldData?.[field];
            const newValue = newData?.[field];
            
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                changes.push({
                    field,
                    oldValue: oldValue || null,
                    newValue: newValue || null
                });
            }
        });
        
        if (changes.length > 0 || changeType === 'create' || changeType === 'delete') {
            await prisma.medicationChangeLog.create({
                data: {
                    medicationId,
                    userId,
                    changeType,
                    changes: JSON.stringify(changes),
                    source
                }
            });
        }
    },

    /**
     * Получить историю изменений
     */
    async getChangeHistory(medicationId, limit = 50) {
        const logs = await prisma.medicationChangeLog.findMany({
            where: { medicationId },
            include: { user: true },
            orderBy: { changedAt: 'desc' },
            take: limit
        });
        
        return logs.map(log => ({
            ...log,
            changes: safeJsonParse(log.changes, [])
        }));
    }
};

module.exports = { MedicationService, MedicationSchema };
