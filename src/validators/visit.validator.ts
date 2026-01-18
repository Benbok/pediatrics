import { z } from 'zod';

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
    complaints: z.string().min(1, 'Жалобы обязательны для заполнения'),
    complaintsJson: z.any().nullable().optional(),
    physicalExam: z.string().nullable().optional(),
    primaryDiagnosisId: z.number().nullable().optional(),
    complicationIds: z.array(z.number()).nullable().optional(),
    comorbidityIds: z.array(z.number()).nullable().optional(),
    prescriptions: z.array(z.any()).default([]),
    recommendations: z.string().nullable().optional(),
    status: z.enum(['draft', 'completed'], {
        errorMap: () => ({ message: 'Статус должен быть "draft" или "completed"' })
    }),
    notes: z.string().nullable().optional(),
    createdAt: z.string().optional(),
});

export type VisitInput = z.infer<typeof VisitSchema>;

// Схема для анализа посещения (только ID)
export const AnalyzeVisitSchema = z.object({
    visitId: z.number().min(1, 'ID посещения должен быть больше 0'),
});

export type AnalyzeVisitInput = z.infer<typeof AnalyzeVisitSchema>;
