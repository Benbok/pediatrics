const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');

const VisitTemplateSchema = z.object({
    id: z.number().optional(),
    name: z.string().min(1, 'Название шаблона обязательно'),
    visitType: z.enum(['primary', 'followup', 'consultation', 'emergency', 'urgent']),
    specialty: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    templateData: z.string().min(1, 'Данные шаблона обязательны'),
    medicationTemplateId: z.number().optional().nullable(),
    examTemplateSetId: z.number().optional().nullable(),
    isDefault: z.boolean().default(false),
    isPublic: z.boolean().default(true),
    createdById: z.number().positive(),
});

const VisitTemplateService = {
    /**
     * Получить шаблон по ID
     */
    async getById(id) {
        return await prisma.visitTemplate.findUnique({
            where: { id: Number(id) },
            include: {
                createdBy: {
                    select: { fullName: true }
                },
                medicationTemplate: {
                    include: {
                        createdBy: {
                            select: { fullName: true }
                        }
                    }
                }
            }
        });
    },

    /**
     * Получить все шаблоны (публичные и пользователя)
     */
    async getAll(userId) {
        return await prisma.visitTemplate.findMany({
            where: {
                OR: [
                    { isPublic: true },
                    { createdById: Number(userId) }
                ]
            },
            include: {
                createdBy: {
                    select: { fullName: true }
                }
            },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });
    },

    /**
     * Получить шаблоны по типу приема
     */
    async getByVisitType(visitType, userId) {
        return await prisma.visitTemplate.findMany({
            where: {
                visitType,
                OR: [
                    { isPublic: true },
                    { createdById: Number(userId) }
                ]
            },
            include: {
                createdBy: {
                    select: { fullName: true }
                }
            },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });
    },

    /**
     * Создать или обновить шаблон
     */
    async upsert(data, userId) {
        const validated = VisitTemplateSchema.parse(data);
        const { id, ...rest } = validated;

        // Проверка, что templateData - валидный JSON
        try {
            JSON.parse(rest.templateData);
        } catch (e) {
            throw new Error('Данные шаблона должны быть валидным JSON');
        }

        if (id) {
            // При обновлении проверяем права доступа
            const existingTemplate = await prisma.visitTemplate.findUnique({
                where: { id: Number(id) }
            });

            if (!existingTemplate) {
                throw new Error('Шаблон не найден');
            }

            if (existingTemplate.createdById !== Number(userId)) {
                throw new Error('У вас нет прав на редактирование этого шаблона');
            }

            return await prisma.visitTemplate.update({
                where: { id },
                data: rest,
            });
        }

        return await prisma.visitTemplate.create({
            data: rest,
        });
    },

    /**
     * Удалить шаблон
     */
    async delete(id, userId) {
        // Проверяем, что пользователь - создатель шаблона
        const template = await prisma.visitTemplate.findUnique({
            where: { id: Number(id) }
        });

        if (!template) {
            throw new Error('Шаблон не найден');
        }

        if (template.createdById !== Number(userId)) {
            throw new Error('У вас нет прав на удаление этого шаблона');
        }

        return await prisma.visitTemplate.delete({
            where: { id: Number(id) },
        });
    },

    /**
     * Применить шаблон к данным приема
     * Если шаблон ссылается на medicationTemplateId или examTemplateSetId,
     * эти шаблоны будут загружены и применены отдельно
     */
    async applyTemplate(templateId, existingData = {}) {
        try {
            const template = await this.getById(templateId);
            if (!template) {
                throw new Error('Шаблон не найден');
            }

            const templateDataParsed = JSON.parse(template.templateData);
            
            // Мерджим данные шаблона с существующими данными
            // Существующие данные имеют приоритет (не перезаписываем непустые поля)
            const merged = {
                ...templateDataParsed,
                ...existingData,
                // Специальная обработка для некоторых полей
                id: existingData.id, // ID не перезаписываем
                childId: existingData.childId, // childId не перезаписываем
                doctorId: existingData.doctorId, // doctorId не перезаписываем
                visitDate: existingData.visitDate || templateDataParsed.visitDate || new Date().toISOString().split('T')[0],
            };

            // Удаляем пустые поля из шаблона, чтобы не перезаписывать заполненные
            Object.keys(templateDataParsed).forEach(key => {
                if (existingData[key] && existingData[key] !== null && existingData[key] !== '') {
                    // Оставляем существующее значение
                } else if (templateDataParsed[key]) {
                    merged[key] = templateDataParsed[key];
                }
            });

            // Возвращаем также ссылки на шаблоны назначений и текстов осмотра
            return {
                mergedData: merged,
                medicationTemplateId: template.medicationTemplateId,
                examTemplateSetId: template.examTemplateSetId,
            };
        } catch (e) {
            logger.error('[VisitTemplateService] Failed to apply template:', e);
            throw new Error('Ошибка применения шаблона: неверный формат данных');
        }
    }
};

module.exports = { VisitTemplateService, VisitTemplateSchema };
