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

const MedicationFormSchema = z.object({
    id: z.string().min(1, 'ID формы обязателен'),
    type: z.string().min(1, 'Тип формы обязателен'),
    concentration: z.string().nullable().optional(),
    unit: z.string().nullable().optional(),
    strengthMg: z.number().nullable().optional(),
    mgPerMl: z.number().nullable().optional(),
    volumeMl: z.number().nullable().optional(),
    description: z.string().nullable().optional(),
});

const FixedDoseSchema = z.object({
    min: z.number().nullable().optional(),
    max: z.number().nullable().optional(),
    unit: z.string().nullable().optional(),
});

const AgeBasedDoseSchema = z.object({
    dose: z.number(),
    unit: z.string().nullable().optional(),
});

const DosingRuleSchema = z.object({
    type: z.enum(['weight_based', 'bsa_based', 'fixed', 'age_based']),
    mgPerKg: z.number().nullable().optional(),
    maxMgPerKg: z.number().nullable().optional(),
    mgPerM2: z.number().nullable().optional(),
    fixedDose: FixedDoseSchema.nullable().optional(),
    ageBasedDose: AgeBasedDoseSchema.nullable().optional(),
});

const PediatricDosingRuleSchema = z.object({
    minAgeMonths: z.number().nullable().optional(),
    maxAgeMonths: z.number().nullable().optional(),
    minWeightKg: z.number().nullable().optional(),
    maxWeightKg: z.number().nullable().optional(),
    formId: z.string().nullable().optional(),
    unit: z.string().nullable().optional(),
    dosing: DosingRuleSchema.nullable().optional(),
    routeOfAdmin: RouteOfAdminSchema.nullable().optional(),
    timesPerDay: z.number().nullable().optional(),
    intervalHours: z.number().nullable().optional(),
    maxSingleDose: z.number().nullable().optional(),
    maxSingleDosePerKg: z.number().nullable().optional(),
    maxDailyDose: z.number().nullable().optional(),
    maxDailyDosePerKg: z.number().nullable().optional(),
    instruction: z.string().nullable().optional(),
    infusion: z.any().nullable().optional(),
});

const AdultDosingRuleSchema = PediatricDosingRuleSchema;

export const MedicationSchema = z.object({
    id: z.number().optional(),
    nameRu: z.string().min(1, 'Название препарата обязательно'),
    nameEn: z.string().nullable().optional(),
    activeSubstance: z.string().min(1, 'Действующее вещество обязательно'),
    atcCode: z.string().nullable().optional(),
    icd10Codes: z.array(z.string()).optional(),
    packageDescription: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    forms: z.array(MedicationFormSchema).default([]),
    pediatricDosing: z.array(PediatricDosingRuleSchema).default([]),
    adultDosing: z.array(AdultDosingRuleSchema).nullable().optional(),
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
