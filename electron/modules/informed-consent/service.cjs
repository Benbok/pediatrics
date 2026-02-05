const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');

const InformedConsentSchema = z.object({
    id: z.number().optional(),
    visitId: z.number().positive().optional().nullable(),
    childId: z.number().positive(),
    doctorId: z.number().positive(),
    consentDate: z.string().or(z.date()).optional(),
    
    // Описание вмешательства
    interventionDescription: z.string().min(1, 'Описание вмешательства обязательно'),
    goals: z.string().optional().nullable(),
    alternatives: z.string().optional().nullable(),
    
    // Информация о рисках
    risks: z.string().optional().nullable(),
    seriousComplicationsFrequency: z.string().optional().nullable(),
    
    // Статус согласия
    status: z.enum(['given', 'refused', 'withdrawn']).default('given'),
    patientSignature: z.string().optional().nullable(),
    doctorSignature: z.string().optional().nullable(),
    signatureDate: z.string().or(z.date()).optional().nullable(),
    
    // Для несовершеннолетних
    parentName: z.string().optional().nullable(),
    parentRelation: z.string().optional().nullable(),
    
    notes: z.string().optional().nullable(),
});

const InformedConsentService = {
    /**
     * Получить согласие по ID
     */
    async getById(id) {
        return await prisma.informedConsent.findUnique({
            where: { id: Number(id) },
            include: {
                visit: true,
                child: true,
                doctor: {
                    select: { lastName: true, firstName: true, middleName: true }
                }
            }
        });
    },

    /**
     * Получить согласие по ID визита
     */
    async getByVisitId(visitId) {
        return await prisma.informedConsent.findUnique({
            where: { visitId: Number(visitId) },
            include: {
                visit: true,
                child: true,
                doctor: {
                    select: { lastName: true, firstName: true, middleName: true }
                }
            }
        });
    },

    /**
     * Получить историю согласий для ребенка
     */
    async getHistoryForChild(childId) {
        return await prisma.informedConsent.findMany({
            where: { childId: Number(childId) },
            include: {
                visit: {
                    select: { id: true, visitDate: true }
                },
                doctor: {
                    select: { lastName: true, firstName: true, middleName: true }
                }
            },
            orderBy: { consentDate: 'desc' }
        });
    },

    /**
     * Создать или обновить согласие
     */
    async upsert(data) {
        const validated = InformedConsentSchema.parse(data);
        const { id, ...rest } = validated;

        const dbData = {
            ...rest,
            consentDate: rest.consentDate ? new Date(rest.consentDate) : new Date(),
            signatureDate: rest.signatureDate ? new Date(rest.signatureDate) : null,
        };

        if (id) {
            return await prisma.informedConsent.update({
                where: { id },
                data: dbData,
            });
        }

        return await prisma.informedConsent.create({
            data: dbData,
        });
    },

    /**
     * Удалить согласие
     */
    async delete(id) {
        return await prisma.informedConsent.delete({
            where: { id: Number(id) },
        });
    },

    /**
     * Получить шаблон согласия для стандартного вмешательства
     */
    getTemplateForIntervention(interventionType) {
        const templates = {
            'medication': {
                interventionDescription: 'Назначение лекарственных препаратов согласно клиническим рекомендациям',
                risks: 'Возможные побочные эффекты, аллергические реакции, индивидуальная непереносимость компонентов препарата',
                goals: 'Достижение терапевтического эффекта, устранение симптомов заболевания'
            },
            'laboratory': {
                interventionDescription: 'Забор биологического материала для лабораторного исследования',
                risks: 'Незначительный дискомфорт при заборе материала, возможность образования гематомы',
                goals: 'Получение диагностической информации'
            },
            'instrumental': {
                interventionDescription: 'Инструментальное диагностическое исследование',
                risks: 'Минимальные риски, связанные с методикой проведения исследования',
                goals: 'Визуализация и оценка состояния органов и систем'
            },
            'procedure': {
                interventionDescription: 'Лечебная процедура',
                risks: 'Возможные местные реакции, дискомфорт во время процедуры',
                goals: 'Достижение лечебного эффекта'
            }
        };

        return templates[interventionType] || templates['procedure'];
    },

    /**
     * Проверить необходимость нового согласия
     */
    async needsNewConsent(childId, interventionDescription) {
        // Получаем последнее согласие для этого ребенка
        const lastConsent = await prisma.informedConsent.findFirst({
            where: {
                childId: Number(childId),
                status: 'given'
            },
            orderBy: { consentDate: 'desc' }
        });

        if (!lastConsent) return true;

        // Проверяем, соответствует ли описание вмешательства
        // Если вмешательство существенно отличается, требуется новое согласие
        // Здесь можно добавить логику сравнения через AI или ключевые слова
        const daysSinceLastConsent = Math.floor(
            (new Date() - new Date(lastConsent.consentDate)) / (1000 * 60 * 60 * 24)
        );

        // Если прошло более 30 дней, рекомендуется новое согласие
        return daysSinceLastConsent > 30;
    }
};

module.exports = { InformedConsentService, InformedConsentSchema };
