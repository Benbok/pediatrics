const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');
const { calculateBMI, calculateBSA, validateAnthropometry } = require('../../utils/anthropometry.cjs');
const { normalizeText, normalizeContraindicationsText } = require('../../utils/cdssVocabulary.cjs');
const { parseComplaints, rankDiagnoses } = require('../../services/cdssService.cjs');
const { DiseaseService } = require('../diseases/service.cjs');
const { decrypt } = require('../../crypto.cjs');

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

/**
 * Определение типа приема на основе истории
 */
async function determineVisitType(childId, doctorId, visitDate, referringDoctorId = null) {
    if (referringDoctorId) {
        return 'consultation';
    }
    
    // Проверяем, был ли ранее прием у этого врача
    const previousVisits = await prisma.visit.findMany({
        where: {
            childId: Number(childId),
            doctorId: Number(doctorId),
            visitDate: { lt: new Date(visitDate) }
        },
        orderBy: { visitDate: 'desc' },
        take: 1
    });
    
    if (previousVisits.length === 0) {
        return 'primary';
    }
    
    const lastVisit = previousVisits[0];
    const daysSinceLastVisit = Math.floor((new Date(visitDate) - new Date(lastVisit.visitDate)) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastVisit > 30) {
        return 'primary'; // Если прошло более месяца, считаем первичным
    }
    
    return 'followup';
}

/**
 * Нормализация диагнозов: конвертация в единый формат и синхронизация legacy полей
 */
function normalizeDiagnoses(data) {
    const result = { ...data };
    
    // Нормализация primaryDiagnosis
    if (result.primaryDiagnosis) {
        if (typeof result.primaryDiagnosis === 'string') {
            try {
                result.primaryDiagnosis = JSON.parse(result.primaryDiagnosis);
            } catch (e) {
                logger.warn('[VisitService] Failed to parse primaryDiagnosis JSON:', e.message);
            }
        }
        // Заполняем legacy поле из diseaseId
        if (result.primaryDiagnosis?.diseaseId && !result.primaryDiagnosisId) {
            result.primaryDiagnosisId = result.primaryDiagnosis.diseaseId;
        }
    }
    
    // Нормализация complications
    if (result.complications) {
        if (typeof result.complications === 'string') {
            try {
                result.complications = JSON.parse(result.complications);
            } catch (e) {
                logger.warn('[VisitService] Failed to parse complications JSON:', e.message);
                result.complications = [];
            }
        }
        // Синхронизация с legacy полем
        if (Array.isArray(result.complications)) {
            const ids = result.complications
                .map(c => c.diseaseId)
                .filter(Boolean);
            if (ids.length > 0) {
                result.complicationIds = JSON.stringify(ids);
            }
        }
    }
    
    // Нормализация comorbidities
    if (result.comorbidities) {
        if (typeof result.comorbidities === 'string') {
            try {
                result.comorbidities = JSON.parse(result.comorbidities);
            } catch (e) {
                logger.warn('[VisitService] Failed to parse comorbidities JSON:', e.message);
                result.comorbidities = [];
            }
        }
        // Синхронизация с legacy полем
        if (Array.isArray(result.comorbidities)) {
            const ids = result.comorbidities
                .map(c => c.diseaseId)
                .filter(Boolean);
            if (ids.length > 0) {
                result.comorbidityIds = JSON.stringify(ids);
            }
        }
    }
    
    // Сериализация диагнозов для сохранения в БД
    if (result.primaryDiagnosis && typeof result.primaryDiagnosis === 'object') {
        result.primaryDiagnosis = JSON.stringify(result.primaryDiagnosis);
    }
    if (result.complications && Array.isArray(result.complications)) {
        result.complications = JSON.stringify(result.complications);
    }
    if (result.comorbidities && Array.isArray(result.comorbidities)) {
        result.comorbidities = JSON.stringify(result.comorbidities);
    }
    
    return result;
}

/**
 * Генерация номера талона 025-1/у
 */
function generateTicketNumber(childId, visitDate) {
    const date = new Date(visitDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Формат: ГГГГ-ММ-ДД-XXXX (где XXXX - порядковый номер для этого дня)
    return `${year}-${month}-${day}-${String(childId).padStart(4, '0')}`;
}

/**
 * Автозаполнение данных из предыдущего приема
 */
async function autofillFromPreviousVisit(childId, visitDate) {
    const previousVisit = await prisma.visit.findFirst({
        where: {
            childId: Number(childId),
            visitDate: { lt: new Date(visitDate) }
        },
        orderBy: { visitDate: 'desc' }
    });
    
    if (!previousVisit) return {};
    
    return {
        // Антропометрия обычно не копируется (измеряется каждый раз)
        // Анамнез жизни обычно статичен, можно копировать
        lifeHistory: previousVisit.lifeHistory || null,
        // Хронические диагнозы - можно предложить как сопутствующие
        // (но не копировать автоматически, только если указано в legacy поле)
    };
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

// Схема для объекта диагноза
const DiagnosisEntrySchema = z.object({
    code: z.string().regex(/^[A-Z]\d{2}\.?\d{0,2}$/, 'Неверный формат кода МКБ'),
    nameRu: z.string().min(1, 'Название диагноза обязательно'),
    diseaseId: z.number().positive().optional(),
});

const VisitSchema = z.object({
    id: z.number().optional(),
    childId: z.number(),
    doctorId: z.number(),
    visitDate: z.string().or(z.date()),
    
    // Тип приема и организационные данные
    visitType: z.enum(['primary', 'followup', 'consultation', 'emergency', 'urgent']).optional().nullable(),
    visitPlace: z.enum(['clinic', 'home', 'other']).optional().nullable(),
    visitTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
    ticketNumber: z.string().optional().nullable(),
    referringDoctorId: z.number().positive().optional().nullable(),
    
    // Anthropometry
    currentWeight: z.number().min(0.5).max(200).optional().nullable(),
    currentHeight: z.number().min(30).max(250).optional().nullable(),
    bmi: z.number().optional().nullable(),
    bsa: z.number().optional().nullable(),
    
    // Анамнез (структурированный)
    diseaseHistory: z.string().optional().nullable(),
    lifeHistory: z.string().optional().nullable(),
    allergyHistory: z.string().optional().nullable(),
    previousDiseases: z.string().optional().nullable(),
    
    // Показатели жизнедеятельности
    // Валидация здесь только техническая - для типа данных
    // Клиническая валидация выполняется на уровне UI (визуальные подсказки)
    bloodPressureSystolic: z.number().int().min(0).max(300).optional().nullable(),
    bloodPressureDiastolic: z.number().int().min(0).max(200).optional().nullable(),
    pulse: z.number().int().min(0).max(300).optional().nullable(),
    respiratoryRate: z.number().int().min(0).max(100).optional().nullable(),
    temperature: z.number().min(20.0).max(50.0).optional().nullable(),
    oxygenSaturation: z.number().int().min(0).max(100).optional().nullable(),
    consciousnessLevel: z.string().optional().nullable(),
    
    // Объективный осмотр по системам
    generalCondition: z.string().optional().nullable(),
    consciousness: z.string().optional().nullable(),
    skinMucosa: z.string().optional().nullable(),
    lymphNodes: z.string().optional().nullable(),
    musculoskeletal: z.string().optional().nullable(),
    respiratory: z.string().optional().nullable(),
    cardiovascular: z.string().optional().nullable(),
    abdomen: z.string().optional().nullable(),
    urogenital: z.string().optional().nullable(),
    nervousSystem: z.string().optional().nullable(),
    
    // Input
    complaints: z.string().min(1),
    complaintsJson: z.string().optional().nullable(),
    physicalExam: z.string().optional().nullable(),
    
    // Диагностика и лечение
    additionalExaminationPlan: z.string().optional().nullable(),
    laboratoryTests: z.union([z.string(), z.array(z.any())]).optional().nullable(),
    instrumentalTests: z.union([z.string(), z.array(z.any())]).optional().nullable(),
    consultationRequests: z.union([z.string(), z.array(z.any())]).optional().nullable(),
    physiotherapy: z.string().optional().nullable(),
    isFirstTimeDiagnosis: z.boolean().optional().nullable(),
    isTrauma: z.boolean().optional().nullable(),
    
    // Диагнозы (структурированные)
    primaryDiagnosis: z.union([z.string(), DiagnosisEntrySchema]).optional().nullable(),
    complications: z.union([z.string(), z.array(DiagnosisEntrySchema)]).optional().nullable(),
    comorbidities: z.union([z.string(), z.array(DiagnosisEntrySchema)]).optional().nullable(),
    // Legacy поля
    primaryDiagnosisId: z.number().optional().nullable(),
    complicationIds: z.union([z.string(), z.array(z.number())]).optional().nullable(),
    comorbidityIds: z.union([z.string(), z.array(z.number())]).optional().nullable(),
    
    // Treatment
    prescriptions: z.array(z.any()).default([]),
    recommendations: z.string().optional().nullable(),
    
    // Исходы и маршрутизация
    outcome: z.enum(['recovery', 'improvement', 'no_change', 'worsening']).optional().nullable(),
    patientRoute: z.enum(['ambulatory', 'hospitalization', 'consultation', 'other']).optional().nullable(),
    hospitalizationIndication: z.string().optional().nullable(),
    nextVisitDate: z.string().optional().nullable(),
    
    // Документооборот
    informedConsentId: z.number().positive().optional().nullable(),
    disabilityCertificate: z.boolean().optional().nullable(),
    preferentialPrescription: z.boolean().optional().nullable(),
    certificateIssued: z.boolean().optional().nullable(),
    
    status: z.enum(['draft', 'completed']).default('draft'),
    notes: z.string().optional().nullable(),
});

const VisitService = {
    /**
     * Парсинг JSON полей при возврате данных из БД
     */
    _parseVisitFields(visit) {
        if (!visit) return visit;
        
        const parsed = { ...visit };
        
        // Парсинг диагнозов
        if (parsed.primaryDiagnosis && typeof parsed.primaryDiagnosis === 'string') {
            try {
                parsed.primaryDiagnosis = JSON.parse(parsed.primaryDiagnosis);
            } catch (e) {
                logger.warn('[VisitService] Failed to parse primaryDiagnosis:', e.message);
            }
        }
        if (parsed.complications && typeof parsed.complications === 'string') {
            try {
                parsed.complications = JSON.parse(parsed.complications);
            } catch (e) {
                logger.warn('[VisitService] Failed to parse complications:', e.message);
            }
        }
        if (parsed.comorbidities && typeof parsed.comorbidities === 'string') {
            try {
                parsed.comorbidities = JSON.parse(parsed.comorbidities);
            } catch (e) {
                logger.warn('[VisitService] Failed to parse comorbidities:', e.message);
            }
        }
        
        // Парсинг других JSON полей
        parsed.complicationIds = safeJsonParse(parsed.complicationIds, []);
        parsed.comorbidityIds = safeJsonParse(parsed.comorbidityIds, []);
        parsed.prescriptions = safeJsonParse(parsed.prescriptions, []);
        parsed.laboratoryTests = safeJsonParse(parsed.laboratoryTests, []);
        parsed.instrumentalTests = safeJsonParse(parsed.instrumentalTests, []);
        parsed.consultationRequests = safeJsonParse(parsed.consultationRequests, []);
        
        return parsed;
    },

    /**
     * List visits for a child
     */
    async listForChild(childId) {
        try {
            const visits = await prisma.visit.findMany({
                where: { childId: Number(childId) },
                include: {
                    primaryDisease: true,
                    doctor: {
                        select: { fullName: true }
                    },
                    informedConsent: {
                        select: {
                            id: true,
                            status: true,
                            consentDate: true
                        }
                    }
                },
                orderBy: { visitDate: 'desc' }
            });
            
            return visits.map(v => this._parseVisitFields(v));
        } catch (error) {
            logger.error('[VisitService] Failed to list visits for child:', {
                error: error.message,
                stack: error.stack,
                childId
            });
            throw error;
        }
    },

    /**
     * Get visit by ID
     */
    async getById(id) {
        const visit = await prisma.visit.findUnique({
            where: { id: Number(id) },
            include: {
                child: true,
                primaryDisease: true,
                doctor: true,
                informedConsent: true
            }
        });
        
        return this._parseVisitFields(visit);
    },

    /**
     * Upsert visit
     */
    async upsert(data) {
        const validated = VisitSchema.parse(data);
        const { id, ...rest } = validated;

        // Определение типа приема, если не указан
        if (!rest.visitType) {
            rest.visitType = await determineVisitType(
                rest.childId,
                rest.doctorId,
                rest.visitDate,
                rest.referringDoctorId
            );
        }

        // Генерация номера талона, если не указан
        if (!rest.ticketNumber && !id) {
            rest.ticketNumber = generateTicketNumber(rest.childId, rest.visitDate);
        }

        // Автозаполнение из предыдущего приема (только для новых)
        if (!id) {
            const autofilled = await autofillFromPreviousVisit(rest.childId, rest.visitDate);
            Object.assign(rest, autofilled);
        }

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

        // Нормализация диагнозов
        const normalized = normalizeDiagnoses(rest);

        // Подготовка данных для БД
        const dbData = {
            ...normalized,
            visitDate: new Date(rest.visitDate),
            bmi,
            bsa,
            // Сериализация JSON полей
            complicationIds: typeof normalized.complicationIds === 'string' 
                ? normalized.complicationIds 
                : JSON.stringify(normalized.complicationIds || []),
            comorbidityIds: typeof normalized.comorbidityIds === 'string'
                ? normalized.comorbidityIds
                : JSON.stringify(normalized.comorbidityIds || []),
            prescriptions: JSON.stringify(normalized.prescriptions || []),
            laboratoryTests: typeof normalized.laboratoryTests === 'string' 
                ? normalized.laboratoryTests 
                : (normalized.laboratoryTests ? JSON.stringify(normalized.laboratoryTests) : null),
            instrumentalTests: typeof normalized.instrumentalTests === 'string'
                ? normalized.instrumentalTests
                : (normalized.instrumentalTests ? JSON.stringify(normalized.instrumentalTests) : null),
            consultationRequests: typeof normalized.consultationRequests === 'string'
                ? normalized.consultationRequests
                : (normalized.consultationRequests ? JSON.stringify(normalized.consultationRequests) : null),
            nextVisitDate: normalized.nextVisitDate ? new Date(normalized.nextVisitDate) : null,
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
     * Расширенный анализ с учетом анамнеза, показателей жизнедеятельности и клинического осмотра
     */
    async analyzeVisit(visitId) {
        const visit = await this.getById(visitId);
        if (!visit) throw new Error('Прием не найден');

        // Собираем все клинические данные для анализа
        const clinicalData = [];
        if (visit.complaints && visit.complaints.trim().length > 0) {
            clinicalData.push(`Жалобы: ${visit.complaints}`);
        }
        if (visit.diseaseHistory) {
            clinicalData.push(`Анамнез заболевания: ${visit.diseaseHistory}`);
        }
        if (visit.allergyHistory) {
            clinicalData.push(`Аллергологический анамнез: ${visit.allergyHistory}`);
        }
        if (visit.physicalExam) {
            clinicalData.push(`Объективный осмотр: ${visit.physicalExam}`);
        }
        
        // Добавляем показатели жизнедеятельности
        const vitalSigns = [];
        if (visit.temperature) vitalSigns.push(`Температура: ${visit.temperature}°C`);
        if (visit.pulse) vitalSigns.push(`Пульс: ${visit.pulse} уд/мин`);
        if (visit.bloodPressureSystolic && visit.bloodPressureDiastolic) {
            vitalSigns.push(`АД: ${visit.bloodPressureSystolic}/${visit.bloodPressureDiastolic} мм рт.ст.`);
        }
        if (visit.respiratoryRate) vitalSigns.push(`ЧДД: ${visit.respiratoryRate} в минуту`);
        if (visit.oxygenSaturation) vitalSigns.push(`SpO2: ${visit.oxygenSaturation}%`);
        
        if (vitalSigns.length > 0) {
            clinicalData.push(`Показатели жизнедеятельности: ${vitalSigns.join(', ')}`);
        }
        
        // Добавляем объективный осмотр по системам
        const systemsExam = [];
        if (visit.generalCondition) systemsExam.push(`Общее состояние: ${visit.generalCondition}`);
        if (visit.respiratory) systemsExam.push(`Органы дыхания: ${visit.respiratory}`);
        if (visit.cardiovascular) systemsExam.push(`ССС: ${visit.cardiovascular}`);
        if (visit.abdomen) systemsExam.push(`Органы брюшной полости: ${visit.abdomen}`);
        if (visit.nervousSystem) systemsExam.push(`Нервная система: ${visit.nervousSystem}`);
        
        if (systemsExam.length > 0) {
            clinicalData.push(`Объективный осмотр по системам: ${systemsExam.join('; ')}`);
        }

        const combinedClinicalText = clinicalData.join('\n\n');

        if (combinedClinicalText.trim().length === 0) {
            return [];
        }

        try {
            // 1. Получаем данные ребенка для контекста
            const child = visit.child;
            if (!child) {
                throw new Error('Данные ребенка не найдены');
            }

            // Рассчитываем возраст
            const birthDateStr = decrypt(child.birthDate);
            const birthDate = new Date(birthDateStr);
            const now = new Date();
            const ageMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 +
                (now.getMonth() - birthDate.getMonth());

            // 2. Парсим клинические данные через Gemini (расширенный анализ)
            logger.info(`[VisitService] Parsing clinical data for visit ${visitId}`);
            const parsed = await parseComplaints(
                combinedClinicalText,
                ageMonths,
                visit.currentWeight || null
            );

            if (!parsed.symptoms || parsed.symptoms.length === 0) {
                logger.warn('[VisitService] No symptoms extracted from clinical data');
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

            // 4. Ранжируем через Gemini с учетом всех данных
            logger.info(`[VisitService] Ranking ${topCandidates.length} candidate diseases`);
            const rankings = await rankDiagnoses(
                parsed.symptoms,
                topCandidates,
                {
                    ageMonths,
                    weight: visit.currentWeight || null,
                    height: visit.currentHeight || null,
                    temperature: visit.temperature || null,
                    vitalSigns: vitalSigns.join(', ')
                }
            );

            // 5. Формируем результат с полными данными заболеваний
            logger.info(`[VisitService] Mapping ${rankings.length} rankings to diseases`);

            const suggestions = rankings.map(ranking => {
                const disease = topCandidates.find(d => d.id === ranking.diseaseId);
                if (!disease) {
                    logger.warn(`[VisitService] Disease ID ${ranking.diseaseId} not found in candidates`);
                    return null;
                }

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
            return this._fallbackAnalysis(combinedClinicalText);
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
        if (!child.birthDate) {
            throw new Error(`У ребенка (id=${childId}) не указана дата рождения`);
        }

        // Дешифруем дату рождения (в БД хранится в зашифрованном виде)
        const birthDate = decrypt(child.birthDate); // Decrypts "hash..." to "YYYY-MM-DD"
        const now = new Date();

        logger.info(`[VisitService] Calculating age for child ${childId}, birthDate: ${birthDate}`);

        const ageMonths = calculateAgeInMonths(birthDate, now);

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
