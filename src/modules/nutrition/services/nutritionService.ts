import type {
  NutritionAgeNorm,
  NutritionProductCategory,
  NutritionProduct,
  NutritionFeedingTemplate,
  NutritionFeedingTemplateItem,
  ChildFeedingPlan,
  NutritionTemplateUpsertInput,
} from '../../../types';
import {
  NutritionProductSchema,
  ChildFeedingPlanSchema,
  NutritionTemplateSchema,
  type NutritionProductInput,
} from '../../../validators/nutrition.validator';

// ─── Types exported for use by import panel ───────────────────────────────────
export type ProductValidationResult = {
  index: number;
  status: 'valid' | 'invalid';
  name: string;
  data?: NutritionProductInput;
  errors?: string[];
};

export type JsonValidationResponse = {
  parseError?: string;
  results?: ProductValidationResult[];
};
import { logger } from '../../../services/logger';

export const nutritionService = {
  // ——— Reference Data ———

  async getAgeNorms(): Promise<NutritionAgeNorm[]> {
    try {
      return await window.electronAPI!.getNutritionAgeNorms();
    } catch (error: any) {
      logger.error('[NutritionService] getAgeNorms failed', { error });
      throw error;
    }
  },

  async getAgeNormForAge(ageDays: number): Promise<NutritionAgeNorm | null> {
    const norms = await nutritionService.getAgeNorms();
    return (
      norms.find((n) => n.ageMinDays <= ageDays && n.ageMaxDays >= ageDays) ?? null
    );
  },

  async getProductCategories(): Promise<NutritionProductCategory[]> {
    try {
      return await window.electronAPI!.getNutritionProductCategories();
    } catch (error: any) {
      logger.error('[NutritionService] getProductCategories failed', { error });
      throw error;
    }
  },

  // ——— Products ———

  async getProducts(categoryId?: number | null): Promise<NutritionProduct[]> {
    try {
      return await window.electronAPI!.getNutritionProducts(categoryId);
    } catch (error: any) {
      logger.error('[NutritionService] getProducts failed', { error });
      throw error;
    }
  },

  async getFormulaProducts(ageDays?: number): Promise<NutritionProduct[]> {
    const all = await nutritionService.getProducts();
    return all.filter((p) => {
      const isFormula = p.category?.code === 'INFANT_FORMULA';
      if (!isFormula) return false;
      if (p.isArchived) return false;
      if (ageDays !== undefined) {
        return p.minAgeDays <= ageDays && p.maxAgeDays >= ageDays;
      }
      return true;
    });
  },

  async upsertProduct(data: Partial<NutritionProduct>): Promise<NutritionProduct> {
    const validation = NutritionProductSchema.safeParse(data);
    if (!validation.success) {
      const msg = validation.error.issues.map((i) => i.message).join('; ');
      throw new Error(`Ошибка валидации: ${msg}`);
    }
    try {
      return await window.electronAPI!.upsertNutritionProduct(validation.data);
    } catch (error: any) {
      logger.error('[NutritionService] upsertProduct failed', { error });
      throw new Error(error.message || 'Ошибка при сохранении продукта');
    }
  },

  async deleteProduct(id: number): Promise<boolean> {
    try {
      return await window.electronAPI!.deleteNutritionProduct(id);
    } catch (error: any) {
      logger.error('[NutritionService] deleteProduct failed', { error });
      throw new Error(error.message || 'Ошибка при удалении продукта');
    }
  },

  validateProductsJson(rawJson: string): JsonValidationResponse {
    try {
      const value = JSON.parse(rawJson.trim());
      if (!Array.isArray(value)) {
        return { parseError: 'Ожидается массив JSON ([ {...}, {...} ]). Убедитесь, что данные обёрнуты в [ ].' };
      }
      const results: ProductValidationResult[] = (value as unknown[]).map((item, i) => {
        const res = NutritionProductSchema.safeParse(item);
        if (res.success) {
          return {
            index: i,
            status: 'valid' as const,
            name: res.data.name,
            data: res.data,
          };
        }
        const typedItem = item as Record<string, unknown>;
        return {
          index: i,
          status: 'invalid' as const,
          name: (typedItem?.name as string) || `Продукт ${i + 1}`,
          errors: res.error.issues.map((e) => `${e.path.join('.') || 'поле'}: ${e.message}`),
        };
      });
      return { results };
    } catch (e: any) {
      return { parseError: `Синтаксическая ошибка JSON: ${e.message}` };
    }
  },

  async bulkUpsertProducts(
    products: unknown[]
  ): Promise<Array<{ index: number; status: 'success' | 'error'; id?: number; name: string; errors?: string[] }>> {
    // 1st validation: client-side (UX layer)
    const validated: NutritionProductInput[] = [];
    for (const p of products) {
      const res = NutritionProductSchema.safeParse(p);
      if (!res.success) {
        const msg = res.error.issues.map((i) => i.message).join('; ');
        throw new Error(`Ошибка валидации: ${msg}`);
      }
      validated.push(res.data);
    }
    // 2nd validation happens in IPC handler (security layer)
    try {
      return await window.electronAPI!.bulkUpsertNutritionProducts(validated);
    } catch (error: any) {
      logger.error('[NutritionService] bulkUpsertProducts failed', { error });
      throw new Error(error.message || 'Ошибка при пакетном импорте');
    }
  },

  // ——— Feeding Templates ———

  async getTemplates(ageDays?: number | null): Promise<NutritionFeedingTemplate[]> {
    try {
      return await window.electronAPI!.getNutritionTemplates(ageDays);
    } catch (error: any) {
      logger.error('[NutritionService] getTemplates failed', { error });
      throw error;
    }
  },

  async getTemplateItems(templateId: number): Promise<NutritionFeedingTemplateItem[]> {
    try {
      return await window.electronAPI!.getNutritionTemplateItems(templateId);
    } catch (error: any) {
      logger.error('[NutritionService] getTemplateItems failed', { error });
      throw error;
    }
  },

  async upsertTemplate(data: NutritionTemplateUpsertInput): Promise<NutritionFeedingTemplate> {
    const validation = NutritionTemplateSchema.safeParse(data);
    if (!validation.success) {
      const msg = validation.error.issues.map((i) => i.message).join('; ');
      throw new Error(`Ошибка валидации: ${msg}`);
    }
    try {
      return await window.electronAPI!.upsertNutritionTemplate(validation.data);
    } catch (error: any) {
      logger.error('[NutritionService] upsertTemplate failed', { error });
      throw new Error(error.message || 'Ошибка при сохранении шаблона питания');
    }
  },

  async deleteTemplate(id: number): Promise<boolean> {
    try {
      return await window.electronAPI!.deleteNutritionTemplate(id);
    } catch (error: any) {
      logger.error('[NutritionService] deleteTemplate failed', { error });
      throw new Error(error.message || 'Ошибка при удалении шаблона питания');
    }
  },

  // ——— Child Feeding Plans ———

  async getFeedingPlans(childId: number): Promise<ChildFeedingPlan[]> {
    try {
      return await window.electronAPI!.getChildFeedingPlans(childId);
    } catch (error: any) {
      logger.error('[NutritionService] getFeedingPlans failed', { error });
      throw error;
    }
  },

  async saveFeedingPlan(data: Partial<ChildFeedingPlan>): Promise<ChildFeedingPlan> {
    const validation = ChildFeedingPlanSchema.safeParse(data);
    if (!validation.success) {
      const msg = validation.error.issues.map((i) => i.message).join('; ');
      throw new Error(`Ошибка валидации: ${msg}`);
    }
    try {
      return await window.electronAPI!.saveChildFeedingPlan(validation.data);
    } catch (error: any) {
      logger.error('[NutritionService] saveFeedingPlan failed', { error });
      throw new Error(error.message || 'Ошибка при сохранении плана питания');
    }
  },

  async deleteFeedingPlan(id: number): Promise<boolean> {
    try {
      return await window.electronAPI!.deleteChildFeedingPlan(id);
    } catch (error: any) {
      logger.error('[NutritionService] deleteFeedingPlan failed', { error });
      throw new Error(error.message || 'Ошибка при удалении плана питания');
    }
  },
};
