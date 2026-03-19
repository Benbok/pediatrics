'use strict';

const { ipcMain } = require('electron');
const { NutritionService } = require('./service.cjs');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { logAudit, logger } = require('../../logger.cjs');
const { CacheService } = require('../../services/cacheService.cjs');
const { z } = require('zod');

// ——— Zod Schemas (backend validation) ———

const NutritionProductSchema = z.object({
    id: z.number().optional(),
    categoryId: z.number().min(1),
    brand: z.string().max(200).optional().nullable(),
    name: z.string().min(1).max(300),
    energyKcalPer100ml: z.number().min(0).max(2000).optional().nullable(),
    energyKcalPer100g: z.number().min(0).max(2000).optional().nullable(),
    proteinGPer100g: z.number().min(0).max(100).optional().nullable(),
    fatGPer100g: z.number().min(0).max(100).optional().nullable(),
    carbsGPer100g: z.number().min(0).max(100).optional().nullable(),
    minAgeDays: z.number().min(0).max(1095),
    maxAgeDays: z.number().min(0).max(1095),
    formulaType: z.string().max(100).optional().nullable(),
    isArchived: z.boolean().optional(),
    compositionJson: z.string().optional().nullable(),
});

const ChildFeedingPlanSchema = z.object({
    id: z.number().optional(),
    childId: z.number().min(1),
    createdByUserId: z.number().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ageDays: z.number().min(0).max(1095),
    weightKg: z.number().min(0.3).max(50),
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

const NutritionTemplateItemSchema = z.object({
    mealOrder: z.number().min(1).max(12),
    productCategoryId: z.number().min(1),
    portionSizeG: z.number().min(1).max(3000),
    isExample: z.boolean().optional(),
    note: z.string().max(500).optional().nullable(),
});

const NutritionTemplateSchema = z.object({
    id: z.number().optional(),
    ageMinDays: z.number().min(0).max(1095),
    ageMaxDays: z.number().min(0).max(1095),
    title: z.string().min(1).max(300),
    description: z.string().max(2000).optional().nullable(),
    items: z.array(NutritionTemplateItemSchema).min(1),
}).refine(
    (d) => d.ageMinDays <= d.ageMaxDays,
    { message: 'Минимальный возраст не может быть больше максимального', path: ['ageMinDays'] },
);

function handleZodError(error) {
    if (error instanceof z.ZodError) {
        throw new Error(error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
    }
    throw error;
}

const NUTRITION_REF_KEY = 'reference_all';
const PLANS_PREFIX = 'child_plans_';

const setupNutritionHandlers = () => {

    // ——— Age Norms (reference data, cached 5 min) ———

    ipcMain.handle('nutrition:get-age-norms', ensureAuthenticated(async () => {
        try {
            const cached = CacheService.get('nutrition', 'age_norms');
            if (cached) return cached;

            const norms = await NutritionService.getAgeNorms();
            CacheService.set('nutrition', 'age_norms', norms);
            return norms;
        } catch (error) {
            logger.error('[Nutrition] get-age-norms failed:', error);
            throw error;
        }
    }));

    // ——— Product Categories (reference data, cached 5 min) ———

    ipcMain.handle('nutrition:get-product-categories', ensureAuthenticated(async () => {
        try {
            const cached = CacheService.get('nutrition', 'categories');
            if (cached) return cached;

            const categories = await NutritionService.getProductCategories();
            CacheService.set('nutrition', 'categories', categories);
            return categories;
        } catch (error) {
            logger.error('[Nutrition] get-product-categories failed:', error);
            throw error;
        }
    }));

    // ——— Products ———

    ipcMain.handle('nutrition:get-products', ensureAuthenticated(async (_, categoryId) => {
        try {
            const cacheKey = categoryId != null ? `products_cat_${categoryId}` : 'products_all';
            const cached = CacheService.get('nutrition', cacheKey);
            if (cached) return cached;

            const products = await NutritionService.getProducts(categoryId);
            CacheService.set('nutrition', cacheKey, products);
            return products;
        } catch (error) {
            logger.error('[Nutrition] get-products failed:', error);
            throw error;
        }
    }));

    ipcMain.handle('nutrition:upsert-product', ensureAuthenticated(async (_, data) => {
        try {
            const validated = NutritionProductSchema.parse(data);
            const result = await NutritionService.upsertProduct(validated);

            // Invalidate product caches
            CacheService.invalidate('nutrition', 'products_all');
            if (validated.categoryId) {
                CacheService.invalidate('nutrition', `products_cat_${validated.categoryId}`);
            }

            const session = getSession();
            logAudit('NUTRITION_PRODUCT_UPSERT', {
                productId: result.id,
                name: result.name,
                userId: session?.user?.id,
            });

            return result;
        } catch (error) {
            logger.error('[Nutrition] upsert-product failed:', error);
            handleZodError(error);
        }
    }));

    ipcMain.handle('nutrition:delete-product', ensureAuthenticated(async (_, id) => {
        try {
            const result = await NutritionService.deleteProduct(id);

            CacheService.invalidate('nutrition', 'products_all');

            const session = getSession();
            logAudit('NUTRITION_PRODUCT_DELETE', { productId: id, userId: session?.user?.id });

            return result;
        } catch (error) {
            logger.error('[Nutrition] delete-product failed:', error);
            throw error;
        }
    }));

    // ——— Feeding Templates (reference data, cached 5 min) ———

    ipcMain.handle('nutrition:get-templates', ensureAuthenticated(async (_, ageDays) => {
        try {
            const cacheKey = ageDays != null ? `templates_age_${ageDays}` : 'templates_all';
            const cached = CacheService.get('nutrition', cacheKey);
            if (cached) return cached;

            const templates = await NutritionService.getTemplates(ageDays);
            CacheService.set('nutrition', cacheKey, templates);
            return templates;
        } catch (error) {
            logger.error('[Nutrition] get-templates failed:', error);
            throw error;
        }
    }));

    ipcMain.handle('nutrition:get-template-items', ensureAuthenticated(async (_, templateId) => {
        try {
            const cacheKey = `template_items_${templateId}`;
            const cached = CacheService.get('nutrition', cacheKey);
            if (cached) return cached;

            const items = await NutritionService.getTemplateItems(templateId);
            CacheService.set('nutrition', cacheKey, items);
            return items;
        } catch (error) {
            logger.error('[Nutrition] get-template-items failed:', error);
            throw error;
        }
    }));

    ipcMain.handle('nutrition:upsert-template', ensureAuthenticated(async (_, data) => {
        try {
            const validated = NutritionTemplateSchema.parse(data);
            const result = await NutritionService.upsertTemplate(validated);

            // Template updates may affect multiple age-specific cache keys
            CacheService.invalidate('nutrition');

            const session = getSession();
            logAudit('NUTRITION_TEMPLATE_UPSERT', {
                templateId: result.id,
                title: result.title,
                userId: session?.user?.id,
            });

            return result;
        } catch (error) {
            logger.error('[Nutrition] upsert-template failed:', error);
            handleZodError(error);
        }
    }));

    ipcMain.handle('nutrition:delete-template', ensureAuthenticated(async (_, id) => {
        try {
            const result = await NutritionService.deleteTemplate(id);

            CacheService.invalidate('nutrition');

            const session = getSession();
            logAudit('NUTRITION_TEMPLATE_DELETE', {
                templateId: Number(id),
                userId: session?.user?.id,
            });

            return Boolean(result);
        } catch (error) {
            logger.error('[Nutrition] delete-template failed:', error);
            throw error;
        }
    }));

    // ——— Child Feeding Plans ———

    ipcMain.handle('nutrition:get-child-feeding-plans', ensureAuthenticated(async (_, childId) => {
        try {
            const cacheKey = `${PLANS_PREFIX}${childId}`;
            const cached = CacheService.get('nutrition', cacheKey);
            if (cached) return cached;

            const plans = await NutritionService.getFeedingPlans(childId);
            CacheService.set('nutrition', cacheKey, plans);
            return plans;
        } catch (error) {
            logger.error('[Nutrition] get-child-feeding-plans failed:', error);
            throw error;
        }
    }));

    ipcMain.handle('nutrition:save-child-feeding-plan', ensureAuthenticated(async (_, data) => {
        try {
            const session = getSession();
            const dataWithUser = {
                ...data,
                createdByUserId: session.user.id,
            };
            const validated = ChildFeedingPlanSchema.parse(dataWithUser);

            const result = await NutritionService.saveFeedingPlan(validated);

            // Invalidate this child's plans cache
            CacheService.invalidate('nutrition', `${PLANS_PREFIX}${validated.childId}`);

            logAudit('NUTRITION_PLAN_SAVE', {
                planId: result.id,
                childId: validated.childId,
                feedingType: validated.feedingType,
                userId: session?.user?.id,
            });

            return result;
        } catch (error) {
            logger.error('[Nutrition] save-child-feeding-plan failed:', error);
            handleZodError(error);
        }
    }));

    ipcMain.handle('nutrition:delete-child-feeding-plan', ensureAuthenticated(async (_, id) => {
        try {
            // Fetch plan first to know childId for cache invalidation
            const { prisma } = require('../../prisma-client.cjs');
            const plan = await prisma.childFeedingPlan.findUnique({ where: { id: Number(id) } });
            if (plan) {
                CacheService.invalidate('nutrition', `${PLANS_PREFIX}${plan.childId}`);
            }

            const result = await NutritionService.deleteFeedingPlan(id);

            const session = getSession();
            logAudit('NUTRITION_PLAN_DELETE', { planId: id, userId: session?.user?.id });

            return result;
        } catch (error) {
            logger.error('[Nutrition] delete-child-feeding-plan failed:', error);
            throw error;
        }
    }));

    // ——— Bulk import products from JSON ———

    ipcMain.handle('nutrition:bulk-upsert-products', ensureAuthenticated(async (_, products) => {
        if (!Array.isArray(products)) {
            throw new Error('Ожидается массив объектов продуктов');
        }

        const results = [];

        for (let i = 0; i < products.length; i++) {
            const raw = products[i];
            const label = raw?.name ? `"${raw.name}"` : `#${i + 1}`;

            try {
                const validated = NutritionProductSchema.parse(raw);
                const saved = await NutritionService.upsertProduct(validated);
                results.push({
                    index: i,
                    status: 'success',
                    id: saved.id,
                    name: saved.name,
                });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    results.push({
                        index: i,
                        status: 'error',
                        name: raw?.name ?? `Продукт ${i + 1}`,
                        errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
                    });
                } else {
                    results.push({
                        index: i,
                        status: 'error',
                        name: raw?.name ?? `Продукт ${i + 1}`,
                        errors: [error.message ?? 'Неизвестная ошибка'],
                    });
                }
            }
        }

        // Invalidate all product caches after bulk operation
        const savedCount = results.filter((r) => r.status === 'success').length;
        if (savedCount > 0) {
            CacheService.invalidate('nutrition', 'products_all');
            const affectedCats = new Set(
                products
                    .filter((_, i) => results[i]?.status === 'success')
                    .map((p) => p?.categoryId)
                    .filter(Boolean)
            );
            for (const catId of affectedCats) {
                CacheService.invalidate('nutrition', `products_cat_${catId}`);
            }

            const session = getSession();
            logAudit('NUTRITION_BULK_IMPORT', {
                savedCount,
                totalCount: products.length,
                userId: session?.user?.id,
            });
        }

        return results;
    }));
};

module.exports = { setupNutritionHandlers };
