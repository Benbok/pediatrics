const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');

// Схема для шаблона рекомендаций
const RecommendationTemplateSchema = z.object({
    id: z.number().optional(),
    name: z.string().min(1, 'Название шаблона обязательно'),
    description: z.string().optional().nullable(),
    items: z.union([
        z.string(), // JSON строка
        z.array(z.string()) // Массив строк
    ]),
    isPublic: z.boolean().default(false),
    createdById: z.number().positive(),
});

/**
 * Безопасный парсинг JSON
 */
function safeJsonParse(value, defaultValue = []) {
    if (!value || value === null) return defaultValue;
    if (typeof value !== 'string') return defaultValue;
    if (value.trim() === '') return defaultValue;

    try {
        return JSON.parse(value);
    } catch (error) {
        logger.warn('[RecommendationTemplateService] Failed to parse JSON', { error: error.message });
        return defaultValue;
    }
}

const RecommendationTemplateService = {
    /**
     * Получить шаблон по ID
     */
    async getById(id) {
        const template = await prisma.recommendationTemplate.findUnique({
            where: { id: Number(id) },
            include: {
                createdBy: {
                    select: { lastName: true, firstName: true, middleName: true }
                }
            }
        });

        if (!template) return null;

        // Парсим JSON поля
        return {
            ...template,
            items: safeJsonParse(template.items, []),
        };
    },

    /**
     * Получить все шаблоны пользователя (персональные + публичные)
     */
    async getAll(userId) {
        const templates = await prisma.recommendationTemplate.findMany({
            where: {
                OR: [
                    { createdById: Number(userId) },
                    { isPublic: true }
                ]
            },
            include: {
                createdBy: {
                    select: { lastName: true, firstName: true, middleName: true }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // Парсим JSON поля
        return templates.map(t => ({
            ...t,
            items: safeJsonParse(t.items, []),
        }));
    },

    /**
     * Создать или обновить шаблон
     */
    async upsert(data) {
        const validated = RecommendationTemplateSchema.parse(data);
        const { id, items, ...rest } = validated;

        // Сериализуем items в JSON строку, если это массив
        const itemsJson = Array.isArray(items) ? JSON.stringify(items) : items;

        // Проверяем, что items - валидный JSON
        try {
            JSON.parse(itemsJson);
        } catch (e) {
            throw new Error('Элементы шаблона должны быть валидным JSON');
        }

        const dataToSave = {
            ...rest,
            items: itemsJson,
        };

        if (id) {
            // Проверяем права на редактирование
            const existing = await prisma.recommendationTemplate.findUnique({
                where: { id }
            });

            if (!existing) {
                throw new Error('Шаблон не найден');
            }

            if (existing.createdById !== Number(data.createdById)) {
                throw new Error('Недостаточно прав для редактирования шаблона');
            }

            return await prisma.recommendationTemplate.update({
                where: { id },
                data: dataToSave,
            });
        }

        return await prisma.recommendationTemplate.create({
            data: dataToSave,
        });
    },

    /**
     * Удалить шаблон
     */
    async delete(id, userId) {
        const template = await prisma.recommendationTemplate.findUnique({
            where: { id: Number(id) }
        });

        if (!template) {
            throw new Error('Шаблон не найден');
        }

        if (template.createdById !== Number(userId)) {
            throw new Error('Недостаточно прав для удаления шаблона');
        }

        return await prisma.recommendationTemplate.delete({
            where: { id: Number(id) }
        });
    }
};

module.exports = { RecommendationTemplateService };
