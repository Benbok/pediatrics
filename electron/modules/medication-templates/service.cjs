const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');

// Схема для элемента шаблона назначений
const MedicationTemplateItemSchema = z.object({
    medicationId: z.number().min(1),
    preferredRoute: z.string().optional().nullable(),
    defaultDuration: z.string().optional().nullable(),
    overrideInstruction: z.string().optional().nullable(),
    overrideSingleDoseMg: z.number().optional().nullable(),
    overrideTimesPerDay: z.number().int().optional().nullable(),
    notes: z.string().optional().nullable(),
});

// Схема для шаблона назначений
const MedicationTemplateSchema = z.object({
    id: z.number().optional(),
    name: z.string().min(1, 'Название шаблона обязательно'),
    description: z.string().optional().nullable(),
    items: z.union([
        z.string(), // JSON строка
        z.array(MedicationTemplateItemSchema) // Массив объектов
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
        logger.warn('[MedicationTemplateService] Failed to parse JSON', { error: error.message });
        return defaultValue;
    }
}

const MedicationTemplateService = {
    /**
     * Получить шаблон по ID
     */
    async getById(id) {
        const template = await prisma.medicationTemplate.findUnique({
            where: { id: Number(id) },
            include: {
                createdBy: {
                    select: { fullName: true }
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
     * Получить все шаблоны пользователя (персональные)
     */
    async getAll(userId) {
        const templates = await prisma.medicationTemplate.findMany({
            where: {
                createdById: Number(userId)
            },
            include: {
                createdBy: {
                    select: { fullName: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
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
        const validated = MedicationTemplateSchema.parse(data);
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
            return await prisma.medicationTemplate.update({
                where: { id },
                data: dataToSave,
            });
        }

        return await prisma.medicationTemplate.create({
            data: dataToSave,
        });
    },

    /**
     * Удалить шаблон
     */
    async delete(id, userId) {
        const template = await prisma.medicationTemplate.findUnique({
            where: { id: Number(id) }
        });

        if (!template) {
            throw new Error('Шаблон не найден');
        }

        if (template.createdById !== Number(userId)) {
            throw new Error('Недостаточно прав для удаления шаблона');
        }

        return await prisma.medicationTemplate.delete({
            where: { id: Number(id) }
        });
    },

    /**
     * Применить шаблон к текущему приему (возвращает массив препаратов с рассчитанными дозами)
     * ВАЖНО: дозы НЕ рассчитываются здесь, только возвращаются структуры для расчета
     */
    async prepareTemplateApplication(templateId, childWeight, childAgeMonths, childHeight = null) {
        const template = await this.getById(templateId);
        if (!template) {
            throw new Error('Шаблон не найден');
        }

        // Возвращаем элементы шаблона с данными для расчета доз
        // Фактический расчет доз выполняется на frontend с учетом текущего веса/возраста
        const items = safeJsonParse(template.items, []);
        
        return items.map(item => ({
            medicationId: item.medicationId,
            preferredRoute: item.preferredRoute,
            defaultDuration: item.defaultDuration || '5-7 дней',
            overrideInstruction: item.overrideInstruction,
            overrideSingleDoseMg: item.overrideSingleDoseMg,
            overrideTimesPerDay: item.overrideTimesPerDay,
            notes: item.notes,
        }));
    }
};

module.exports = { MedicationTemplateService };
