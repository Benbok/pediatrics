import { z } from 'zod';
import {
    HeredityDataSchema,
    BirthDataSchema,
    FeedingDataSchema,
    InfectiousDiseasesDataSchema,
    AllergyStatusDataSchema,
} from './anamnesis025.validator';

// Схема для объекта диагноза (код МКБ необязателен при ручном вводе)
export const DiagnosisEntrySchema = z.object({
    code: z
        .union([
            z.string().regex(/^[A-Z]\d{2}\.?\d{0,2}$/, 'Неверный формат кода МКБ (например: J45.0)'),
            z.literal(''),
        ])
        .optional(),
    nameRu: z.string().min(1, 'Название диагноза обязательно'),
    diseaseId: z.number().positive().optional(),
});

// Схема для валидации формата кода МКБ
const IcdCodeSchema = z.string()
    .regex(/^[A-Z]\d{2}\.?\d{0,2}$/, 'Неверный формат кода МКБ (например: J45.0)');

export const VisitTypeSchema = z.enum(['primary', 'followup', 'consultation', 'emergency', 'urgent'], {
    message: 'Тип приема должен быть: primary, followup, consultation, emergency или urgent'
});

export const VisitPlaceSchema = z.enum(['clinic', 'home', 'other'], {
    message: 'Место приема должно быть: clinic, home или other'
});

export const VisitOutcomeSchema = z.enum(['recovery', 'improvement', 'no_change', 'worsening'], {
    message: 'Исход должен быть: recovery, improvement, no_change или worsening'
});

export const PatientRouteSchema = z.enum(['ambulatory', 'hospitalization', 'consultation', 'other'], {
    message: 'Маршрут должен быть: ambulatory, hospitalization, consultation или other'
});

export const VisitSchema = z.object({
    id: z.number().optional(),
    childId: z.number().min(1, 'ID пациента должен быть больше 0'),
    doctorId: z.number().min(1, 'ID врача должен быть больше 0'),
    visitDate: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Неверный формат даты (ГГГГ-ММ-ДД)')
        .refine((date) => {
            const d = new Date(date);
            return !isNaN(d.getTime());
        }, 'Неверная дата'),
    
    // Тип приема и организационные данные
    visitType: VisitTypeSchema.nullable().optional(),
    visitPlace: VisitPlaceSchema.nullable().optional(),
    visitTime: z.string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Неверный формат времени (ЧЧ:ММ)')
        .nullable()
        .optional(),
    ticketNumber: z.string().nullable().optional(),
    referringDoctorId: z.number().positive().nullable().optional(),
    
    // Anthropometry
    currentWeight: z.number()
        .min(0.5, 'Вес должен быть не менее 0.5 кг')
        .max(200, 'Вес должен быть не более 200 кг')
        .nullable()
        .optional(),
    currentHeight: z.number()
        .min(30, 'Рост должен быть не менее 30 см')
        .max(250, 'Рост должен быть не более 250 см')
        .nullable()
        .optional(),
    bmi: z.number().nullable().optional(),
    bsa: z.number().nullable().optional(),
    
    // АНАМНЕЗ ЗАБОЛЕВАНИЯ (для всех типов приема)
    diseaseOnset: z.string().nullable().optional(),
    diseaseCourse: z.string().nullable().optional(),
    treatmentBeforeVisit: z.string().nullable().optional(),

    // АНАМНЕЗ ЖИЗНИ 025/у (только для primary/consultation)
    heredityData: z.union([z.string(), HeredityDataSchema]).nullable().optional(),
    birthData: z.union([z.string(), BirthDataSchema]).nullable().optional(),
    feedingData: z.union([z.string(), FeedingDataSchema]).nullable().optional(),
    infectiousDiseasesData: z.union([z.string(), InfectiousDiseasesDataSchema]).nullable().optional(),
    allergyStatusData: z.union([z.string(), AllergyStatusDataSchema]).nullable().optional(),
    
    // Показатели жизнедеятельности (Vital Signs)
    // Валидация здесь только техническая - для типа данных
    // Клиническая валидация выполняется на уровне UI (визуальные подсказки)
    bloodPressureSystolic: z.number()
        .int()
        .min(0, 'Систолическое АД должно быть положительным числом')
        .max(300, 'Систолическое АД не должно превышать 300 мм рт.ст.')
        .nullable()
        .optional(),
    bloodPressureDiastolic: z.number()
        .int()
        .min(0, 'Диастолическое АД должно быть положительным числом')
        .max(200, 'Диастолическое АД не должно превышать 200 мм рт.ст.')
        .nullable()
        .optional(),
    pulse: z.number()
        .int()
        .min(0, 'Пульс должен быть положительным числом')
        .max(250, 'Пульс не должен превышать 250 уд/мин')
        .nullable()
        .optional(),
    respiratoryRate: z.number()
        .int()
        .min(0, 'ЧДД должна быть положительным числом')
        .max(150, 'ЧДД не должна превышать 150 в минуту')
        .nullable()
        .optional(),
    temperature: z.number()
        .min(20.0, 'Температура не должна быть ниже 20°C')
        .max(45.0, 'Температура не должна превышать 45°C')
        .nullable()
        .optional(),
    oxygenSaturation: z.number()
        .int()
        .min(0, 'Сатурация должна быть от 0 до 100%')
        .max(100, 'Сатурация должна быть от 0 до 100%')
        .nullable()
        .optional(),
    consciousnessLevel: z.string().nullable().optional(),
    
    // Объективный осмотр по системам (структурированный JSON)
    generalCondition: z.string().nullable().optional(),
    consciousness: z.string().nullable().optional(),
    skinMucosa: z.string().nullable().optional(),
    lymphNodes: z.string().nullable().optional(),
    musculoskeletal: z.string().nullable().optional(),
    respiratory: z.string().nullable().optional(),
    cardiovascular: z.string().nullable().optional(),
    abdomen: z.string().nullable().optional(),
    urogenital: z.string().nullable().optional(),
    nervousSystem: z.string().nullable().optional(),
    
    // Input
    complaints: z.string().min(1, 'Жалобы обязательны для заполнения'),
    complaintsJson: z.any().nullable().optional(),
    physicalExam: z.string().nullable().optional(),
    
    // Диагностика и лечение
    additionalExaminationPlan: z.string().nullable().optional(),
    laboratoryTests: z.union([z.string(), z.array(z.any())]).nullable().optional(), // JSON массив
    instrumentalTests: z.union([z.string(), z.array(z.any())]).nullable().optional(), // JSON массив
    consultationRequests: z.union([z.string(), z.array(z.any())]).nullable().optional(), // JSON массив
    physiotherapy: z.string().nullable().optional(),
    isFirstTimeDiagnosis: z.boolean().nullable().optional(),
    isTrauma: z.boolean().nullable().optional(),
    
    // Диагнозы (структурированные с поддержкой ручного ввода и МКБ)
    primaryDiagnosis: z.union([z.string(), DiagnosisEntrySchema]).nullable().optional(), // JSON строка или объект
    complications: z.union([z.string(), z.array(DiagnosisEntrySchema)]).nullable().optional(), // JSON массив
    comorbidities: z.union([z.string(), z.array(DiagnosisEntrySchema)]).nullable().optional(), // JSON массив
    // Legacy поля для обратной совместимости
    primaryDiagnosisId: z.number().nullable().optional(),
    complicationIds: z.union([z.string(), z.array(z.number())]).nullable().optional(),
    comorbidityIds: z.union([z.string(), z.array(z.number())]).nullable().optional(),
    
    // Treatment
    prescriptions: z.array(z.object({
        medicationId: z.number().optional(),
        name: z.string().optional(),
        dosing: z.string().optional(),
        duration: z.string().optional(),
        singleDoseMg: z.number().nullable().optional(),
        timesPerDay: z.number().nullable().optional(),
        formId: z.string().nullable().optional(),
        routeOfAdmin: z.string().nullable().optional(),
        packagingDescription: z.string().nullable().optional(),
        dilution: z.object({
            enabled: z.boolean(),
            diluentType: z.enum(['nacl_0_9', 'glucose_5', 'glucose_10', 'water_inj']).nullable().optional(),
            diluentVolumeMl: z.number().positive().nullable().optional(),
            concentrationMgPerMl: z.number().positive().nullable().optional(),
            finalVolumeMl: z.number().positive().nullable().optional(),
        }).nullable().optional(),
    })).default([]),
    recommendations: z.string().nullable().optional(),
    
    // Исходы и маршрутизация
    outcome: VisitOutcomeSchema.nullable().optional(),
    patientRoute: PatientRouteSchema.nullable().optional(),
    hospitalizationIndication: z.string().nullable().optional(),
    nextVisitDate: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Неверный формат даты (ГГГГ-ММ-ДД)')
        .nullable()
        .optional(),
    
    // Документооборот
    disabilityCertificate: z.boolean().nullable().optional(),
    preferentialPrescription: z.boolean().nullable().optional(),
    certificateIssued: z.boolean().nullable().optional(),
    
    status: z.enum(['draft', 'completed'], {
        message: 'Статус должен быть "draft" или "completed"'
    }),
    notes: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
}).superRefine((data, ctx) => {
    // Валидация по типу приема
    const typeValidation = validateVisitTypeRequirements(data);
    if (!typeValidation.valid) {
        typeValidation.errors.forEach(error => {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
                path: ['visitType'],
            });
        });
    }

    // Если указаны оба значения АД — САД должно быть >= ДАД
    if (
        typeof data.bloodPressureSystolic === 'number' &&
        typeof data.bloodPressureDiastolic === 'number' &&
        data.bloodPressureSystolic < data.bloodPressureDiastolic
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Систолическое АД не может быть меньше диастолического',
            path: ['bloodPressureSystolic'],
        });
    }
}).refine((data) => {
    // Валидация уникальности кодов в осложнениях и сопутствующих
    if (data.complications) {
        const complications = typeof data.complications === 'string' 
            ? JSON.parse(data.complications) 
            : data.complications;
        if (Array.isArray(complications)) {
            const codes = complications.map((c: any) => c.code).filter(Boolean);
            return new Set(codes).size === codes.length;
        }
    }
    return true;
}, {
    message: 'Коды осложнений должны быть уникальными',
    path: ['complications'],
}).refine((data) => {
    // Валидация уникальности кодов в сопутствующих
    if (data.comorbidities) {
        const comorbidities = typeof data.comorbidities === 'string' 
            ? JSON.parse(data.comorbidities) 
            : data.comorbidities;
        if (Array.isArray(comorbidities)) {
            const codes = comorbidities.map((c: any) => c.code).filter(Boolean);
            return new Set(codes).size === codes.length;
        }
    }
    return true;
}, {
    message: 'Коды сопутствующих диагнозов должны быть уникальными',
    path: ['comorbidities'],
});

export type VisitInput = z.infer<typeof VisitSchema>;

// Вспомогательная функция для проверки обязательных полей по типу приема
function validateVisitTypeRequirements(data: z.infer<typeof VisitSchema>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data.visitType) {
        return { valid: true, errors: [] }; // Тип не выбран - пропускаем проверку
    }

    switch (data.visitType) {
        case 'primary':
            // Для первичного приема обязательны: жалобы, дата, основной диагноз
            if (!data.complaints?.trim()) {
                errors.push('Для первичного приема обязательны жалобы');
            }
            if (!data.visitDate) {
                errors.push('Для первичного приема обязательна дата приема');
            }
            // Основной диагноз обязателен перед завершением приема
            if (data.status === 'completed' && !data.primaryDiagnosis) {
                errors.push('Для завершения первичного приема обязателен основной диагноз');
            }
            break;

        case 'followup':
            // Для повторного приема: жалобы, дата, динамика
            if (!data.complaints?.trim()) {
                errors.push('Для повторного приема обязательны жалобы');
            }
            if (!data.visitDate) {
                errors.push('Для повторного приема обязательна дата приема');
            }
            break;

        case 'consultation':
            // Для консультации: жалобы, направивший врач, заключение
            if (!data.complaints?.trim()) {
                errors.push('Для консультации обязательны жалобы');
            }
            if (!data.referringDoctorId) {
                errors.push('Для консультации обязателен направивший врач');
            }
            if (data.status === 'completed' && !data.primaryDiagnosis) {
                errors.push('Для завершения консультации обязателен диагноз');
            }
            break;

        case 'emergency':
        case 'urgent':
            // Для экстренного/неотложного: жалобы или диагноз, время, критичные показатели
            if (!data.complaints?.trim() && !data.primaryDiagnosis) {
                errors.push('Для экстренного приема обязательны жалобы или диагноз');
            }
            if (!data.visitTime) {
                errors.push('Для экстренного приема обязательно время приема');
            }
            // Критичные показатели желательны
            if (!data.temperature && !data.pulse && !data.bloodPressureSystolic) {
                errors.push('Для экстренного приема желательно указать показатели жизнедеятельности');
            }
            break;
    }

    return { valid: errors.length === 0, errors };
}

// Схемы для разных типов приемов с дополнительными проверками
export const PrimaryVisitSchema = VisitSchema.safeExtend({
    visitType: z.literal('primary'),
}).superRefine((data, ctx) => {
    const validation = validateVisitTypeRequirements(data);
    if (!validation.valid) {
        validation.errors.forEach(error => {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
            });
        });
    }
});

export const FollowupVisitSchema = VisitSchema.safeExtend({
    visitType: z.literal('followup'),
}).superRefine((data, ctx) => {
    const validation = validateVisitTypeRequirements(data);
    if (!validation.valid) {
        validation.errors.forEach(error => {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
            });
        });
    }
});

export const ConsultationVisitSchema = VisitSchema.safeExtend({
    visitType: z.literal('consultation'),
    referringDoctorId: z.number().positive(),
}).superRefine((data, ctx) => {
    const validation = validateVisitTypeRequirements(data);
    if (!validation.valid) {
        validation.errors.forEach(error => {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
            });
        });
    }
});

export const EmergencyVisitSchema = VisitSchema.safeExtend({
    visitType: z.literal('emergency'),
}).superRefine((data, ctx) => {
    const validation = validateVisitTypeRequirements(data);
    if (!validation.valid) {
        validation.errors.forEach(error => {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
            });
        });
    }
});

export const UrgentVisitSchema = VisitSchema.safeExtend({
    visitType: z.literal('urgent'),
}).superRefine((data, ctx) => {
    const validation = validateVisitTypeRequirements(data);
    if (!validation.valid) {
        validation.errors.forEach(error => {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: error,
            });
        });
    }
});

// Функция для получения схемы по типу приема
export function getVisitSchemaByType(visitType: string | null | undefined) {
    if (!visitType) return VisitSchema;
    
    switch (visitType) {
        case 'primary':
            return PrimaryVisitSchema;
        case 'followup':
            return FollowupVisitSchema;
        case 'consultation':
            return ConsultationVisitSchema;
        case 'emergency':
            return EmergencyVisitSchema;
        case 'urgent':
            return UrgentVisitSchema;
        default:
            return VisitSchema;
    }
}

// Схема для анализа посещения (только ID)
export const AnalyzeVisitSchema = z.object({
    visitId: z.number().min(1, 'ID посещения должен быть больше 0'),
});

export type AnalyzeVisitInput = z.infer<typeof AnalyzeVisitSchema>;

// Экспорт схем для диагнозов (DiagnosisEntrySchema уже экспортирован выше)
export { IcdCodeSchema };
