import { z } from 'zod';

/**
 * Schema for individual diagnostic plan item
 */
export const DiagnosticPlanItemSchema = z.object({
  type: z.enum(['lab', 'instrumental']),
  test: z.string().min(1, 'Название исследования обязательно'),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  rationale: z.string().nullable().optional()
});

/**
 * Schema for diagnostic template
 */
export const DiagnosticTemplateSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, 'Название шаблона обязательно'),
  description: z.string().nullable().optional(),
  items: z.union([
    z.string(),
    z.array(DiagnosticPlanItemSchema)
  ]),
  isPublic: z.boolean().optional(),
  createdById: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type DiagnosticPlanItemInput = z.infer<typeof DiagnosticPlanItemSchema>;
export type DiagnosticTemplateInput = z.infer<typeof DiagnosticTemplateSchema>;
