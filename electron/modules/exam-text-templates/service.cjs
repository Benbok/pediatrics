const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');

// Схема для шаблона текста осмотра
const ExamTextTemplateSchema = z.object({
    id: z.number().optional(),
    name: z.string().optional().nullable(),
    systemKey: z.string().min(1, 'Ключ системы обязателен'),
    text: z.string().min(1, 'Текст шаблона обязателен'),
    tags: z.union([
        z.string(), // JSON строка
        z.array(z.string()) // Массив строк
    ]).default([]),
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
        logger.warn('[ExamTextTemplateService] Failed to parse JSON', { error: error.message });
        return defaultValue;
    }
}

const ExamTextTemplateService = {
    /**
     * Получить шаблон по ID
     */
    async getById(id) {
        const template = await prisma.examTextTemplate.findUnique({
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
            tags: safeJsonParse(template.tags, []),
        };
    },

    /**
     * Получить все шаблоны пользователя для конкретной системы
     */
    async getBySystemKey(systemKey, userId) {
        const templates = await prisma.examTextTemplate.findMany({
            where: {
                systemKey,
                createdById: Number(userId)
            },
            include: {
                createdBy: {
                    select: { lastName: true, firstName: true, middleName: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Парсим JSON поля
        return templates.map(t => ({
            ...t,
            tags: safeJsonParse(t.tags, []),
        }));
    },

    /**
     * Получить все шаблоны пользователя
     */
    async getAll(userId) {
        const templates = await prisma.examTextTemplate.findMany({
            where: {
                createdById: Number(userId)
            },
            include: {
                createdBy: {
                    select: { lastName: true, firstName: true, middleName: true }
                }
            },
            orderBy: {
                systemKey: 'asc',
                createdAt: 'desc'
            }
        });

        // Парсим JSON поля
        return templates.map(t => ({
            ...t,
            tags: safeJsonParse(t.tags, []),
        }));
    },

    /**
     * Получить шаблоны по тегам
     */
    async getByTags(tags, userId) {
        const allTemplates = await this.getAll(userId);
        const tagArray = Array.isArray(tags) ? tags : [tags];

        return allTemplates.filter(template => {
            const templateTags = safeJsonParse(template.tags, []);
            return tagArray.some(tag => templateTags.includes(tag));
        });
    },

    /**
     * Создать или обновить шаблон
     */
    async upsert(data) {
        const validated = ExamTextTemplateSchema.parse(data);
        const { id, tags, ...rest } = validated;

        // Сериализуем tags в JSON строку, если это массив
        const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : tags;

        // Проверяем, что tags - валидный JSON
        try {
            JSON.parse(tagsJson);
        } catch (e) {
            throw new Error('Теги должны быть валидным JSON');
        }

        const dataToSave = {
            ...rest,
            tags: tagsJson,
        };

        if (id) {
            return await prisma.examTextTemplate.update({
                where: { id },
                data: dataToSave,
            });
        }

        return await prisma.examTextTemplate.create({
            data: dataToSave,
        });
    },

    /**
     * Удалить шаблон
     */
    async delete(id, userId) {
        const template = await prisma.examTextTemplate.findUnique({
            where: { id: Number(id) }
        });

        if (!template) {
            throw new Error('Шаблон не найден');
        }

        if (template.createdById !== Number(userId)) {
            throw new Error('Недостаточно прав для удаления шаблона');
        }

        return await prisma.examTextTemplate.delete({
            where: { id: Number(id) }
        });
    }
};

module.exports = { ExamTextTemplateService };
