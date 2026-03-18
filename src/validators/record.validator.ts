import { z } from 'zod';

export const UserVaccineRecordSchema = z.object({
    id: z.number().optional(),
    childId: z.number().optional(),
    vaccineId: z.string().min(2, 'Неверный ID вакцины').max(100, 'Неверный ID вакцины'),
    isCompleted: z.boolean(),
    completedDate: z.string()
        .nullable()
        .refine((date) => !date || (new Date(date) <= new Date()), 'Дата выполнения не может быть в будущем'),
    vaccineBrand: z.string().max(100).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
    dose: z.string().max(50).optional().nullable(),
    series: z.string().max(50).optional().nullable(),
    expiryDate: z.string().nullable().optional(),
    manufacturer: z.string().max(100).optional().nullable(),
    ignoreValidation: z.boolean().optional(),
}).refine((data) => {
    if (data.isCompleted && !data.completedDate) {
        return false;
    }
    return true;
}, {
    message: 'Укажите дату выполнения для завершенной прививки',
    path: ['completedDate'],
});

export type UserVaccineRecordInput = z.infer<typeof UserVaccineRecordSchema>;
