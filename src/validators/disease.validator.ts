import { z } from 'zod';

export const SymptomCategoryEnum = z.enum(['clinical', 'physical', 'other']);
export type SymptomCategoryType = z.infer<typeof SymptomCategoryEnum>;

export const SymptomSchema = z.object({
    text: z.string().min(1, 'Текст симптома не может быть пустым'),
    category: SymptomCategoryEnum.default('other'),
});

export const DiseaseSchema = z.object({
    id: z.number().optional(),
    icd10Code: z.string().min(3).max(10),
    icd10Codes: z.array(z.string()).default([]),
    nameRu: z.string().min(2),
    nameEn: z.string().optional().nullable(),
    description: z.string(),
    symptoms: z.array(SymptomSchema).default([]),
    diagnosticPlan: z.array(z.object({
        type: z.enum(['lab', 'instrumental']),
        test: z.string(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        rationale: z.string().optional().nullable(),
    })).optional().default([]),
    treatmentPlan: z.array(z.object({
        category: z.enum(['symptomatic', 'etiologic', 'supportive', 'other']),
        description: z.string(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
    })).optional().default([]),
    differentialDiagnosis: z.array(z.string()).optional().default([]),
    redFlags: z.array(z.string()).optional().default([]),
});

export type DiseaseInput = z.infer<typeof DiseaseSchema>;
