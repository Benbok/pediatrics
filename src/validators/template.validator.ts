import { z } from 'zod';

// Схема для элемента шаблона назначений
export const MedicationTemplateItemSchema = z.object({
    medicationId: z.number().min(1, 'ID препарата должен быть больше 0'),
    preferredRoute: z.string().optional().nullable(),
    defaultDuration: z.string().optional().nullable(),
    overrideInstruction: z.string().optional().nullable(),
    overrideSingleDoseMg: z.number().optional().nullable(),
    overrideTimesPerDay: z.number().int().optional().nullable(),
    notes: z.string().optional().nullable(),
});

// Схема для шаблона назначений
export const MedicationTemplateSchema = z.object({
    id: z.number().optional(),
    name: z.string().min(1, 'Название шаблона обязательно'),
    description: z.string().optional().nullable(),
    items: z.union([
        z.string(), // JSON строка из БД
        z.array(MedicationTemplateItemSchema) // Парсированный массив
    ]),
    isPublic: z.boolean().default(false),
    createdById: z.number().min(1, 'ID создателя обязателен'),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

// Схема для шаблона текста осмотра
export const ExamTextTemplateSchema = z.object({
    id: z.number().optional(),
    name: z.string().optional().nullable(),
    systemKey: z.string().min(1, 'Ключ системы обязателен'),
    text: z.string().min(1, 'Текст шаблона обязателен'),
    tags: z.union([
        z.string(), // JSON строка из БД
        z.array(z.string()) // Парсированный массив
    ]).default([]),
    isPublic: z.boolean().default(false),
    createdById: z.number().min(1, 'ID создателя обязателен'),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

// Схема для расширенного шаблона приема
export const VisitTemplateSchema = z.object({
    id: z.number().optional(),
    name: z.string().min(1, 'Название шаблона обязательно'),
    visitType: z.string(),
    specialty: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    templateData: z.union([
        z.string(), // JSON строка из БД
        z.any() // Парсированный объект
    ]),
    medicationTemplateId: z.number().optional().nullable(),
    examTemplateSetId: z.number().optional().nullable(), // Можно хранить как JSON массив ID в templateData
    isDefault: z.boolean().default(false),
    isPublic: z.boolean().default(true),
    createdById: z.number().min(1, 'ID создателя обязателен'),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export type MedicationTemplateItem = z.infer<typeof MedicationTemplateItemSchema>;
export type MedicationTemplateInput = z.infer<typeof MedicationTemplateSchema>;
export type ExamTextTemplateInput = z.infer<typeof ExamTextTemplateSchema>;
export type VisitTemplateInput = z.infer<typeof VisitTemplateSchema>;
