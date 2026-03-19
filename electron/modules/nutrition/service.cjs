'use strict';

const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');

const NutritionService = {
    // ——— Age Norms ———

    async getAgeNorms() {
        return prisma.nutritionAgeNorm.findMany({
            orderBy: { ageMinDays: 'asc' },
        });
    },

    async getAgeNormForAge(ageDays) {
        return prisma.nutritionAgeNorm.findFirst({
            where: {
                ageMinDays: { lte: ageDays },
                ageMaxDays: { gte: ageDays },
            },
        });
    },

    // ——— Product Categories ———

    async getProductCategories() {
        return prisma.nutritionProductCategory.findMany({
            orderBy: { name: 'asc' },
        });
    },

    // ——— Products ———

    async getProducts(categoryId) {
        const where = {};
        if (categoryId !== undefined && categoryId !== null) {
            where.categoryId = Number(categoryId);
        }
        return prisma.nutritionProduct.findMany({
            where,
            include: { category: { select: { code: true, name: true } } },
            orderBy: [{ isArchived: 'asc' }, { name: 'asc' }],
        });
    },

    async upsertProduct(data) {
        const { id, ...fields } = data;
        if (id) {
            return prisma.nutritionProduct.update({
                where: { id },
                data: {
                    ...fields,
                    updatedAt: new Date(),
                },
                include: { category: { select: { code: true, name: true } } },
            });
        }
        return prisma.nutritionProduct.create({
            data: fields,
            include: { category: { select: { code: true, name: true } } },
        });
    },

    async archiveProduct(id) {
        return prisma.nutritionProduct.update({
            where: { id: Number(id) },
            data: { isArchived: true, updatedAt: new Date() },
        });
    },

    async deleteProduct(id) {
        // Hard delete — only possible if no feeding plans reference it
        const plans = await prisma.childFeedingPlan.count({
            where: { formulaId: Number(id) },
        });
        if (plans > 0) {
            // Soft delete instead
            return NutritionService.archiveProduct(id);
        }
        return prisma.nutritionProduct.delete({ where: { id: Number(id) } });
    },

    // ——— Feeding Templates ———

    async getTemplates(ageDays) {
        const where = {};
        if (ageDays !== undefined && ageDays !== null) {
            where.ageMinDays = { lte: ageDays };
            where.ageMaxDays = { gte: ageDays };
        }
        return prisma.nutritionFeedingTemplate.findMany({
            where,
            orderBy: { ageMinDays: 'asc' },
        });
    },

    async getTemplateItems(templateId) {
        return prisma.nutritionFeedingTemplateItem.findMany({
            where: { templateId: Number(templateId) },
            include: { productCategory: { select: { code: true, name: true } } },
            orderBy: { mealOrder: 'asc' },
        });
    },

    async upsertTemplate(data) {
        const { id, items, ...templateFields } = data;
        return prisma.$transaction(async (tx) => {
            let template;
            if (id) {
                template = await tx.nutritionFeedingTemplate.update({
                    where: { id: Number(id) },
                    data: templateFields,
                });
                await tx.nutritionFeedingTemplateItem.deleteMany({
                    where: { templateId: Number(id) },
                });
            } else {
                template = await tx.nutritionFeedingTemplate.create({
                    data: templateFields,
                });
            }

            if (Array.isArray(items) && items.length > 0) {
                await tx.nutritionFeedingTemplateItem.createMany({
                    data: items.map((item) => ({
                        templateId: template.id,
                        mealOrder: Number(item.mealOrder),
                        productCategoryId: Number(item.productCategoryId),
                        portionSizeG: Number(item.portionSizeG),
                        isExample: item.isExample !== false,
                        note: item.note ?? null,
                    })),
                });
            }

            return template;
        });
    },

    async deleteTemplate(id) {
        return prisma.nutritionFeedingTemplate.delete({ where: { id: Number(id) } });
    },

    // ——— Child Feeding Plans ———

    async getFeedingPlans(childId) {
        return prisma.childFeedingPlan.findMany({
            where: { childId: Number(childId) },
            include: {
                formula: { select: { id: true, name: true, brand: true, energyKcalPer100ml: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    },

    async saveFeedingPlan(data) {
        const {
            id,
            childId,
            createdByUserId,
            formulaId,
            ...fields
        } = data;

        if (!childId || !createdByUserId) {
            throw new Error('childId и createdByUserId обязательны для сохранения плана питания');
        }

        const relationData = {
            child: { connect: { id: Number(childId) } },
            createdBy: { connect: { id: Number(createdByUserId) } },
            ...(formulaId
                ? { formula: { connect: { id: Number(formulaId) } } }
                : {}),
        };

        if (id) {
            return prisma.childFeedingPlan.update({
                where: { id: Number(id) },
                data: {
                    ...fields,
                    ...relationData,
                    ...(formulaId ? {} : { formula: { disconnect: true } }),
                },
                include: {
                    formula: { select: { id: true, name: true, brand: true, energyKcalPer100ml: true } },
                },
            });
        }
        return prisma.childFeedingPlan.create({
            data: {
                ...fields,
                ...relationData,
            },
            include: {
                formula: { select: { id: true, name: true, brand: true, energyKcalPer100ml: true } },
            },
        });
    },

    async deleteFeedingPlan(id) {
        return prisma.childFeedingPlan.delete({ where: { id: Number(id) } });
    },
};

module.exports = { NutritionService };
