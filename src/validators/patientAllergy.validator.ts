import { z } from 'zod';

export const PatientAllergySchema = z.object({
    id: z.number().optional(),
    childId: z.number().min(1, 'ID пациента должен быть больше 0'),
    substance: z.string().min(2, 'Вещество должно содержать минимум 2 символа').max(200),
    reaction: z.string().max(500).optional().nullable(),
    severity: z.enum(['mild', 'moderate', 'severe']).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export type PatientAllergyInput = z.infer<typeof PatientAllergySchema>;
