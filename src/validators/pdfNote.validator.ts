import { z } from 'zod';

export const PdfNoteSchema = z.object({
    pdfPath: z.string().min(1, 'PDF путь обязателен'),
    page: z.number().int().min(1, 'Номер страницы должен быть >= 1'),
    content: z.string().min(1, 'Текст заметки обязателен').max(2000, 'Заметка не должна превышать 2000 символов'),
});

export const PdfNoteUpdateSchema = PdfNoteSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Нет данных для обновления' }
);
