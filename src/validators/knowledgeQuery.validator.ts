import { z } from 'zod';

export const KnowledgeQueryRequestSchema = z.object({
    query: z
        .string({ required_error: 'Вопрос обязателен' })
        .min(3, 'Вопрос должен содержать минимум 3 символа')
        .max(500, 'Вопрос не должен превышать 500 символов')
        .transform(s => s.trim()),
});

export type KnowledgeQueryRequest = z.infer<typeof KnowledgeQueryRequestSchema>;
