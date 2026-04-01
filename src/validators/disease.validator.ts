import { z } from 'zod';

const normalizeListValue = (value: string): string => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const addDuplicateIssue = (
    ctx: z.RefinementCtx,
    path: (string | number)[],
    message: string,
) => {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message,
    });
};

export const SymptomCategoryEnum = z.enum(['clinical', 'physical', 'laboratory', 'other']);
export type SymptomCategoryType = z.infer<typeof SymptomCategoryEnum>;

export const SymptomSchema = z.object({
    text: z.string().min(1, 'Текст симптома не может быть пустым'),
    category: SymptomCategoryEnum.default('other'),
});

export const DiagnosticPlanItemSchema = z.object({
    type: z.enum(['lab', 'instrumental']),
    test: z.string(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    rationale: z.string().optional().nullable(),
});

export const TreatmentPlanItemSchema = z.object({
    category: z.enum(['symptomatic', 'etiologic', 'supportive', 'other']),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
});

export const DiseaseRecommendationItemSchema = z.object({
    category: z.enum(['regimen', 'nutrition', 'followup', 'activity', 'education', 'other']).default('other'),
    text: z.string(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
});

export const DiseaseSchema = z.object({
    id: z.number().optional(),
    icd10Code: z.string().min(3).max(10),
    icd10Codes: z.array(z.string()).default([]),
    nameRu: z.string().min(2),
    nameEn: z.string().optional().nullable(),
    description: z.string(),
    symptoms: z.array(SymptomSchema).default([]),
    diagnosticPlan: z.array(DiagnosticPlanItemSchema).optional().default([]),
    treatmentPlan: z.array(TreatmentPlanItemSchema).optional().default([]),
    clinicalRecommendations: z.array(DiseaseRecommendationItemSchema).optional().default([]),
    differentialDiagnosis: z.array(z.string()).optional().default([]),
    redFlags: z.array(z.string()).optional().default([]),
}).superRefine((data, ctx) => {
    const diagnosticSeen = new Map<string, number>();
    data.diagnosticPlan.forEach((item, index) => {
        const normalizedTest = normalizeListValue(item.test);
        if (!normalizedTest) return;
        if (diagnosticSeen.has(normalizedTest)) {
            addDuplicateIssue(ctx, ['diagnosticPlan', index, 'test'], `Исследование "${item.test}" уже добавлено в план диагностики`);
            return;
        }
        diagnosticSeen.set(normalizedTest, index);
    });

    const treatmentSeen = new Map<string, number>();
    data.treatmentPlan.forEach((item, index) => {
        const normalizedDescription = normalizeListValue(item.description);
        if (!normalizedDescription) return;
        if (treatmentSeen.has(normalizedDescription)) {
            addDuplicateIssue(ctx, ['treatmentPlan', index, 'description'], `Пункт лечения "${item.description}" уже добавлен`);
            return;
        }
        treatmentSeen.set(normalizedDescription, index);
    });

    const recommendationSeen = new Map<string, number>();
    data.clinicalRecommendations.forEach((item, index) => {
        const normalizedText = normalizeListValue(item.text);
        if (!normalizedText) return;
        if (recommendationSeen.has(normalizedText)) {
            addDuplicateIssue(ctx, ['clinicalRecommendations', index, 'text'], `Рекомендация "${item.text}" уже добавлена`);
            return;
        }
        recommendationSeen.set(normalizedText, index);
    });
});

export type DiseaseInput = z.infer<typeof DiseaseSchema>;
