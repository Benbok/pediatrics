const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');
const { calculateBMI, calculateBSA, validateAnthropometry } = require('../../utils/anthropometry.cjs');
const { normalizeText, normalizeContraindicationsText } = require('../../utils/cdssVocabulary.cjs');
const { parseComplaints, rankDiagnoses } = require('../../services/cdssService.cjs');
const { DiseaseService } = require('../diseases/service.cjs');

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
        logger.warn('[VisitService] Failed to parse JSON, using default:', error.message);
        return defaultValue;
    }
}

function getAllergyWarnings(medication, allergies) {
    if (!allergies || allergies.length === 0) return [];

    const activeSubstance = normalizeText(medication.activeSubstance);
    const contraindications = normalizeText(normalizeContraindicationsText(medication.contraindications));

    return allergies
        .filter(allergy => {
            const substance = normalizeText(allergy.substance);
            if (!substance) return false;
            return activeSubstance.includes(substance) || contraindications.includes(substance);
        })
        .map(allergy => {
            const details = [
                allergy.substance,
                allergy.reaction ? `реакция: ${allergy.reaction}` : null,
                allergy.severity ? `тяжесть: ${allergy.severity}` : null
            ].filter(Boolean).join(', ');
            return `Аллергия: ${details}`;
        });
}

const VisitSchema = z.object({
    id: z.number().optional(),
    childId: z.number(),
    doctorId: z.number(),
    visitDate: z.string().or(z.date()),
    currentWeight: z.number().min(0.5).max(200).optional().nullable(),
    currentHeight: z.number().min(30).max(250).optional().nullable(),
    bmi: z.number().optional().nullable(),
    bsa: z.number().optional().nullable(),
    complaints: z.string().min(1),
    complaintsJson: z.string().optional().nullable(),
    physicalExam: z.string().optional().nullable(),
    primaryDiagnosisId: z.number().optional().nullable(),
    complicationIds: z.array(z.number()).default([]),
    comorbidityIds: z.array(z.number()).default([]),
    prescriptions: z.array(z.any()).default([]),
    recommendations: z.string().optional().nullable(),
    status: z.enum(['draft', 'completed']).default('draft'),
    notes: z.string().optional().nullable(),
});

const VisitService = {
    /**
     * List visits for a child
     */
    async listForChild(childId) {
        return await prisma.visit.findMany({
            where: { childId: Number(childId) },
            include: {
                primaryDiagnosis: true,
                doctor: {
                    select: { fullName: true }
                }
            },
            orderBy: { visitDate: 'desc' }
        });
    },

    /**
     * Get visit by ID
     */
    async getById(id) {
        return await prisma.visit.findUnique({
            where: { id: Number(id) },
            include: {
                child: true,
                primaryDiagnosis: true,
                doctor: true
            }
        });
    },

    /**
     * Upsert visit
     */
    async upsert(data) {
        const validated = VisitSchema.parse(data);
        const { id, ...rest } = validated;

        // Валидация антропометрии
        const anthropometryValidation = validateAnthropometry(rest.currentWeight, rest.currentHeight);
        if (!anthropometryValidation.valid) {
            throw new Error(anthropometryValidation.error);
        }

        // Автоматический расчет BMI и BSA если есть вес и рост
        let bmi = null;
        let bsa = null;
        if (rest.currentWeight && rest.currentHeight) {
            try {
                bmi = calculateBMI(rest.currentWeight, rest.currentHeight);
                bsa = calculateBSA(rest.currentWeight, rest.currentHeight);
            } catch (error) {
                logger.warn('[VisitService] Failed to calculate BMI/BSA:', error);
            }
        }

        const dbData = {
            ...rest,
            visitDate: new Date(rest.visitDate),
            bmi,
            bsa,
            complicationIds: JSON.stringify(rest.complicationIds),
            comorbidityIds: JSON.stringify(rest.comorbidityIds),
            prescriptions: JSON.stringify(rest.prescriptions),
        };

        if (id) {
            return await prisma.visit.update({
                where: { id },
                data: dbData,
            });
        }

        return await prisma.visit.create({
            data: dbData,
        });
    },

    /**
     * Delete visit
     */
    async delete(id) {
        return await prisma.visit.delete({
            where: { id: Number(id) },
        });
    },

    /**
     * AI-powered analysis of complaints
     * Returns suggested diagnoses with confidence scores and reasoning
     */
    async analyzeVisit(visitId) {
        const visit = await this.getById(visitId);
        if (!visit) throw new Error('Прием не найден');

        if (!visit.complaints || visit.complaints.trim().length === 0) {
            return [];
        }

        try {
            // 1. Получаем данные ребенка для контекста
            const child = visit.child;
            if (!child) {
                throw new Error('Данные ребенка не найдены');
            }

            // Рассчитываем возраст
            const birthDate = new Date(child.birthDate);
            const now = new Date();
            const ageMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + 
                            (now.getMonth() - birthDate.getMonth());

            // 2. Парсим жалобы через Gemini
            logger.info(`[VisitService] Parsing complaints for visit ${visitId}`);
            const parsed = await parseComplaints(
                visit.complaints,
                ageMonths,
                visit.currentWeight || null
            );

            if (!parsed.symptoms || parsed.symptoms.length === 0) {
                logger.warn('[VisitService] No symptoms extracted from complaints');
                return [];
            }

            // 3. Semantic search по симптомам (получаем топ-20 кандидатов)
            logger.info(`[VisitService] Searching diseases by symptoms: ${parsed.symptoms.join(', ')}`);
            const candidateDiseases = await DiseaseService.searchBySymptoms(parsed.symptoms);
            
            if (candidateDiseases.length === 0) {
                logger.warn('[VisitService] No diseases found for symptoms');
                return [];
            }

            // Ограничиваем до топ-20 для ранжирования
            const topCandidates = candidateDiseases.slice(0, 20);

            // 4. Ранжируем через Gemini (получаем топ-5)
            logger.info(`[VisitService] Ranking ${topCandidates.length} candidate diseases`);
            const rankings = await rankDiagnoses(
                parsed.symptoms,
                topCandidates,
                {
                    ageMonths,
                    weight: visit.currentWeight || null,
                    height: visit.currentHeight || null
                }
            );

            // 5. Формируем результат с полными данными заболеваний
            const suggestions = rankings.map(ranking => {
                const disease = topCandidates.find(d => d.id === ranking.diseaseId);
                if (!disease) return null;

                return {
                    disease: {
                        ...disease,
                        symptoms: Array.isArray(disease.symptoms) 
                            ? disease.symptoms 
                            : JSON.parse(disease.symptoms || '[]'),
                        icd10Codes: Array.isArray(disease.icd10Codes)
                            ? disease.icd10Codes
                            : JSON.parse(disease.icd10Codes || '[]')
                    },
                    confidence: ranking.confidence,
                    reasoning: ranking.reasoning,
                    matchedSymptoms: ranking.matchedSymptoms
                };
            }).filter(s => s !== null);

            logger.info(`[VisitService] Analysis complete: ${suggestions.length} suggestions`);
            return suggestions;

        } catch (error) {
            logger.error('[VisitService] Analysis failed:', error);
            // Fallback на простой поиск
            return this._fallbackAnalysis(visit.complaints);
        }
    },

    /**
     * Fallback метод для анализа (если AI недоступен)
     * @private
     */
    async _fallbackAnalysis(complaints) {
        const complaintsLower = complaints.toLowerCase();
        const diseases = await prisma.disease.findMany();

        const suggestions = diseases
            .map(d => {
                const symptoms = JSON.parse(d.symptoms || '[]');
                const matches = symptoms.filter(s => complaintsLower.includes(s.toLowerCase()));
                return {
                    disease: {
                        ...d,
                        symptoms,
                        icd10Codes: JSON.parse(d.icd10Codes || '[]')
                    },
                    confidence: matches.length / Math.max(symptoms.length, 1),
                    reasoning: `Совпало ${matches.length} симптомов`,
                    matchedSymptoms: matches
                };
            })
            .filter(s => s.confidence > 0)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5);

        return suggestions;
    },

    /**
     * Получает препараты для диагноза с автоматическим расчетом дозировок
     * @param {number} diseaseId - ID заболевания
     * @param {number} childId - ID ребенка
     * @returns {Promise<Array>} Массив препаратов с рекомендациями по дозировке
     */
    async getMedicationsForDiagnosis(diseaseId, childId) {
        const { DiseaseService } = require('../diseases/service.cjs');
        const { MedicationService } = require('../medications/service.cjs');
        const { calculateAgeInMonths } = require('../../utils/ageUtils.cjs');

        // Получаем заболевание с ICD-10 кодами
        const disease = await DiseaseService.getById(diseaseId);
        if (!disease) {
            throw new Error('Заболевание не найдено');
        }

        // Получаем данные ребенка
        const child = await prisma.child.findUnique({
            where: { id: Number(childId) }
        });
        if (!child) {
            throw new Error('Ребенок не найден');
        }

        const allergies = await prisma.patientAllergy.findMany({
            where: { childId: Number(childId) }
        });

        // Рассчитываем возраст
        const birthDate = new Date(child.birthDate);
        const now = new Date();
        const ageMonths = calculateAgeInMonths(child.birthDate, now);

        // Получаем ICD-10 коды заболевания
        const icd10Codes = safeJsonParse(disease.icd10Codes, []);
        const allCodes = [disease.icd10Code, ...icd10Codes].filter(c => c);

        // Получаем препараты по ICD-10 кодам
        const medications = await MedicationService.getByIcd10Codes(allCodes);

        // Для каждого препарата рассчитываем дозировку
        const recommendations = await Promise.all(
            medications.map(async (medication) => {
                try {
                    // Получаем последний визит для текущего веса/роста
                    const lastVisit = await prisma.visit.findFirst({
                        where: { childId: Number(childId) },
                        orderBy: { visitDate: 'desc' }
                    });

                    const weight = lastVisit?.currentWeight || (child.birthWeight / 1000);
                    const height = lastVisit?.currentHeight || null;

                    const doseInfo = await MedicationService.calculateDose(
                        medication.id,
                        weight,
                        ageMonths,
                        height
                    );

                    const allergyWarnings = getAllergyWarnings(medication, allergies);
                    const combinedWarnings = [
                        ...(doseInfo.warnings || []),
                        ...allergyWarnings
                    ];

                    return {
                        medication,
                        recommendedDose: doseInfo,
                        canUse: doseInfo.canUse !== false && allergyWarnings.length === 0,
                        warnings: combinedWarnings.length > 0 ? combinedWarnings : []
                    };
                } catch (error) {
                    logger.warn(`[VisitService] Failed to calculate dose for medication ${medication.id}:`, error);
                    return {
                        medication,
                        recommendedDose: null,
                        canUse: false,
                        warnings: [`Ошибка расчета дозировки: ${error.message}`]
                    };
                }
            })
        );

        // Сортируем по приоритету (если есть связь через DiseaseMedication)
        const diseaseMedications = await prisma.diseaseMedication.findMany({
            where: { diseaseId: Number(diseaseId) },
            include: { medication: true }
        });

        const prioritized = recommendations.map(rec => {
            const link = diseaseMedications.find(dm => dm.medicationId === rec.medication.id);
            return {
                ...rec,
                priority: link ? link.priority : 999,
                specificDosing: link?.dosing || null,
                duration: link?.duration || null
            };
        }).sort((a, b) => a.priority - b.priority);

        return prioritized;
    }
};

module.exports = { VisitService, VisitSchema };
