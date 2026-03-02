import { z } from 'zod';

export const ToastTypeEnum = z.enum(['success', 'error', 'info', 'warning']);
export type ToastType = z.infer<typeof ToastTypeEnum>;

export const ToastSchema = z.object({
    id: z.string().min(1),
    type: ToastTypeEnum,
    message: z.string().min(1).max(200),
    durationMs: z.number().int().positive().optional(),
});

export type ToastModel = z.infer<typeof ToastSchema>;
