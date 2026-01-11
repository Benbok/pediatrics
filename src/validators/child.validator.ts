import { z } from 'zod';

export const ChildProfileSchema = z.object({
    id: z.number().optional(),
    name: z.string()
        .min(2, 'Имя должно содержать минимум 2 символа')
        .max(50, 'Имя должно содержать максимум 50 символов')
        .regex(/^[а-яёА-ЯЁ\s-]+$/, 'Имя должно содержать только кириллицу, пробелы и дефисы'),
    surname: z.string()
        .min(2, 'Фамилия должна содержать минимум 2 символа')
        .max(50, 'Фамилия должна содержать максимум 50 символов')
        .regex(/^[а-яёА-ЯЁ\s-]+$/, 'Фамилия должна содержать только кириллицу, пробелы и дефисы'),
    patronymic: z.string()
        .max(50, 'Отчество должно содержать максимум 50 символов')
        .regex(/^[а-яёА-ЯЁ\s-]*$/, 'Отчество должно содержать только кириллицу, пробелы и дефисы')
        .optional()
        .nullable(),
    birthDate: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Неверный формат даты (ГГГГ-ММ-ДД)')
        .refine((date) => {
            const d = new Date(date);
            return !isNaN(d.getTime()) && d <= new Date();
        }, 'Дата рождения не может быть в будущем')
        .refine((date) => {
            const d = new Date(date);
            const eighteenYearsAgo = new Date();
            eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
            return d >= eighteenYearsAgo;
        }, 'Пациент должен быть младше 18 лет'),
    birthWeight: z.number()
        .min(500, 'Вес при рождении должен быть не менее 500 г')
        .max(8000, 'Вес при рождении должен быть не более 8000 г'),
    gender: z.enum(['male', 'female'], 'Выберите пол (мужской или женский)'),
});

export type ChildProfileInput = z.infer<typeof ChildProfileSchema>;
