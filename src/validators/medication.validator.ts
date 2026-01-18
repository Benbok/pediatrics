import { z } from 'zod';

const RouteOfAdminSchema = z.enum([
    'oral',
    'rectal',
    'iv_bolus',
    'iv_infusion',
    'iv_slow',
    'im',
    'sc',
    'sublingual',
    'topical',
    'inhalation',
    'intranasal',
    'transdermal',
]);

export const MedicationSchema = z.object({
    id: z.number().optional(),
    nameRu: z.string().min(1, 'Название препарата обязательно'),
    nameEn: z.string().nullable().optional(),
    activeSubstance: z.string().min(1, 'Действующее вещество обязательно'),
    atcCode: z.string().nullable().optional(),
    icd10Codes: z.array(z.string()).optional(),
    packageDescription: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    forms: z.array(z.any()).default([]),
    pediatricDosing: z.array(z.any()).default([]),
    adultDosing: z.any().nullable().optional(),
    contraindications: z.string().min(1, 'Противопоказания обязательны'),
    cautionConditions: z.string().nullable().optional(),
    sideEffects: z.string().nullable().optional(),
    interactions: z.string().nullable().optional(),
    pregnancy: z.string().nullable().optional(),
    lactation: z.string().nullable().optional(),
    indications: z.array(z.any()).default([]),
    vidalUrl: z.string().url().nullable().optional(),
    clinicalPharmGroup: z.string().nullable().optional(),
    pharmTherapyGroup: z.string().nullable().optional(),
    minInterval: z.number().min(0).max(24).nullable().optional(),
    maxDosesPerDay: z.number().min(1).max(20).nullable().optional(),
    maxDurationDays: z.number().min(1).nullable().optional(),
    routeOfAdmin: RouteOfAdminSchema.nullable().optional(),
    isFavorite: z.boolean().optional(),
    userTags: z.array(z.string()).nullable().optional(),
    usageCount: z.number().optional(),
    lastUsedAt: z.union([z.string(), z.date()]).nullable().optional()
        .transform((value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value ?? null;
        }),
    createdAt: z.union([z.string(), z.date()]).optional()
        .transform((value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        }),
    updatedAt: z.union([z.string(), z.date()]).optional()
        .transform((value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        }),
});

export type MedicationInput = z.infer<typeof MedicationSchema>;

// Схема для расчета дозировки
export const CalculateDoseSchema = z.object({
    medicationId: z.number().min(1, 'ID препарата должен быть больше 0'),
    weight: z.number().min(0.5, 'Вес должен быть не менее 0.5 кг').max(200, 'Вес должен быть не более 200 кг'),
    ageMonths: z.number().min(0, 'Возраст в месяцах не может быть отрицательным').max(216, 'Возраст не должен превышать 18 лет'),
    height: z.number().min(30, 'Рост должен быть не менее 30 см').max(250, 'Рост должен быть не более 250 см').nullable().optional(),
});

export type CalculateDoseInput = z.infer<typeof CalculateDoseSchema>;

// Схема для связи препарата с заболеванием
export const LinkMedicationToDiseaseSchema = z.object({
    diseaseId: z.number().min(1, 'ID заболевания должен быть больше 0'),
    medicationId: z.number().min(1, 'ID препарата должен быть больше 0'),
    priority: z.number().min(1).max(10).optional(),
    dosing: z.string().optional(),
    duration: z.string().optional(),
});

export type LinkMedicationToDiseaseInput = z.infer<typeof LinkMedicationToDiseaseSchema>;
