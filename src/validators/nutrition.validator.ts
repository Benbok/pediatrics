import { z } from 'zod';

export const NutritionProductSchema = z.object({
  id: z.number().optional(),
  categoryId: z.number().min(1, 'Выберите категорию продукта'),
  brand: z.string().max(200).optional().nullable(),
  name: z.string().min(1, 'Введите название').max(300),
  energyKcalPer100ml: z.number().min(0).max(2000).optional().nullable(),
  energyKcalPer100g: z.number().min(0).max(2000).optional().nullable(),
  proteinGPer100g: z.number().min(0).max(100).optional().nullable(),
  fatGPer100g: z.number().min(0).max(100).optional().nullable(),
  carbsGPer100g: z.number().min(0).max(100).optional().nullable(),
  minAgeDays: z.number().min(0).max(1095, 'Максимум 3 года'),
  maxAgeDays: z.number().min(0).max(1095, 'Максимум 3 года'),
  formulaType: z.string().max(100).optional().nullable(),
  isArchived: z.boolean().optional(),
  compositionJson: z.string().optional().nullable(),
}).refine(
  (d) => d.minAgeDays <= d.maxAgeDays,
  { message: 'Минимальный возраст не может быть больше максимального', path: ['minAgeDays'] },
).refine(
  (d) => d.energyKcalPer100ml != null || d.energyKcalPer100g != null,
  { message: 'Укажите калорийность (на 100 мл или на 100 г)', path: ['energyKcalPer100ml'] },
);

export const ChildFeedingPlanSchema = z.object({
  id: z.number().optional(),
  childId: z.number().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD'),
  ageDays: z.number().min(0).max(1095, 'Возраст не может превышать 3 года'),
  weightKg: z.number().min(0.3, 'Вес слишком мал').max(50, 'Вес > 50 кг — проверьте значение'),
  birthWeightG: z.number().min(500).max(7000).optional().nullable(),
  feedingType: z.enum(['BF', 'MF', 'FF']),
  dailyEnergyNeedKcal: z.number().min(0).max(5000),
  dailyVolumeNeedMl: z.number().min(0).max(3000).optional().nullable(),
  mealsPerDay: z.number().min(1).max(12),
  estimatedBreastMilkMl: z.number().min(0).max(2000).optional().nullable(),
  formulaVolumeMl: z.number().min(0).max(2000).optional().nullable(),
  formulaId: z.number().optional().nullable(),
  comments: z.string().max(2000).optional().nullable(),
});

export const NutritionTemplateItemSchema = z.object({
  mealOrder: z.number().min(1).max(12),
  productCategoryId: z.number().min(1, 'Выберите категорию продукта'),
  portionSizeG: z.number().min(1, 'Порция должна быть больше 0').max(3000),
  isExample: z.boolean().optional(),
  note: z.string().max(500).optional().nullable(),
});

export const NutritionTemplateSchema = z.object({
  id: z.number().optional(),
  ageMinDays: z.number().min(0).max(1095),
  ageMaxDays: z.number().min(0).max(1095),
  title: z.string().min(1, 'Введите название шаблона').max(300),
  description: z.string().max(2000).optional().nullable(),
  items: z.array(NutritionTemplateItemSchema).min(1, 'Добавьте хотя бы один пункт рациона'),
}).refine(
  (d) => d.ageMinDays <= d.ageMaxDays,
  { message: 'Минимальный возраст не может быть больше максимального', path: ['ageMinDays'] },
);

export type NutritionProductInput = z.infer<typeof NutritionProductSchema>;
export type ChildFeedingPlanInput = z.infer<typeof ChildFeedingPlanSchema>;
export type NutritionTemplateInput = z.infer<typeof NutritionTemplateSchema>;
