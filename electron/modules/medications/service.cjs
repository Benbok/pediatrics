const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');

// Medication Validation Schema
const MedicationSchema = z.object({
    id: z.number().optional(),
    nameRu: z.string().min(2),
    nameEn: z.string().optional().nullable(),
    activeSubstance: z.string().min(2),
    atcCode: z.string().optional().nullable(),
    manufacturer: z.string().optional().nullable(),
    forms: z.array(z.any()).default([]), // Expected to be serialized JSON
    pediatricDosing: z.any(), // JSON structure for age/weight rules
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
});

const MedicationService = {
    /**
     * Get all medications
     */
    async list() {
        return await prisma.medication.findMany({
            orderBy: { nameRu: 'asc' },
        });
    },

    /**
     * Get medication by ID
     */
    async getById(id) {
        return await prisma.medication.findUnique({
            where: { id: Number(id) },
            include: {
                diseases: {
                    include: {
                        disease: true
                    }
                }
            }
        });
    },

    /**
     * Upsert medication
     */
    async upsert(data) {
        const validated = MedicationSchema.parse(data);
        const { id, ...rest } = validated;

        const dbData = {
            ...rest,
            forms: JSON.stringify(rest.forms),
            pediatricDosing: JSON.stringify(rest.pediatricDosing),
            adultDosing: rest.adultDosing ? JSON.stringify(rest.adultDosing) : null,
            indications: JSON.stringify(rest.indications),
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
     * Calculate dosage based on child's age/weight
     */
    async calculateDose(medicationId, childWeight, childAgeMonths) {
        const medication = await this.getById(medicationId);
        if (!medication) throw new Error('Препарат не найден');

        const dosingRules = JSON.parse(medication.pediatricDosing || '[]');

        // Find matching rule by age
        const rule = dosingRules.find(r =>
            childAgeMonths >= (r.minAgeMonths || 0) &&
            childAgeMonths <= (r.maxAgeMonths || 999)
        );

        if (!rule) {
            return {
                canUse: false,
                message: 'Нет данных по дозированию для данного возраста'
            };
        }

        // Weight based calculation
        if (rule.mgPerKg) {
            const singleDoseMg = childWeight * rule.mgPerKg;
            const dailyDoseMg = singleDoseMg * (rule.timesPerDay || 1);

            return {
                canUse: true,
                singleDoseMg,
                dailyDoseMg,
                timesPerDay: rule.timesPerDay,
                maxDailyMg: rule.maxDailyMg ? Math.min(dailyDoseMg, rule.maxDailyMg) : dailyDoseMg,
                instruction: rule.instruction || `По ${singleDoseMg}мг ${rule.timesPerDay} раза в день`
            };
        }

        return {
            canUse: true,
            instruction: rule.instruction || 'См. инструкцию'
        };
    }
};

module.exports = { MedicationService, MedicationSchema };
