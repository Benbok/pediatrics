const { prisma } = require('../../prisma-client.cjs');
const { z } = require('zod');

const AllergySchema = z.object({
    childId: z.number().int().min(1),
    substance: z.string().min(2).max(200),
    reaction: z.string().max(500).optional().nullable(),
    severity: z.enum(['mild', 'moderate', 'severe']).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
});

const AllergyUpdateSchema = AllergySchema.omit({ childId: true }).partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Нет данных для обновления' }
);

async function assertChildAccess(childId, userId, isAdmin) {
    const whereClause = isAdmin
        ? { id: Number(childId) }
        : {
            id: Number(childId),
            OR: [
                { createdByUserId: userId },
                { shares: { some: { sharedWith: userId } } }
            ]
        };

    const child = await prisma.child.findFirst({
        where: whereClause,
        select: { id: true }
    });

    if (!child) {
        throw new Error('Нет доступа к пациенту');
    }
}

const PatientAllergyService = {
    AllergySchema,
    AllergyUpdateSchema,

    async listByChild(childId, userId, isAdmin) {
        await assertChildAccess(childId, userId, isAdmin);
        return await prisma.patientAllergy.findMany({
            where: { childId: Number(childId) },
            orderBy: { createdAt: 'desc' }
        });
    },

    async create(data, userId, isAdmin) {
        const validated = AllergySchema.parse(data);
        await assertChildAccess(validated.childId, userId, isAdmin);
        return await prisma.patientAllergy.create({
            data: validated
        });
    },

    async update(id, data, userId, isAdmin) {
        const validated = AllergyUpdateSchema.parse(data);
        const existing = await prisma.patientAllergy.findUnique({
            where: { id: Number(id) },
            select: { id: true, childId: true }
        });

        if (!existing) {
            throw new Error('Аллергия не найдена');
        }

        await assertChildAccess(existing.childId, userId, isAdmin);

        return await prisma.patientAllergy.update({
            where: { id: existing.id },
            data: validated
        });
    },

    async delete(id, userId, isAdmin) {
        const existing = await prisma.patientAllergy.findUnique({
            where: { id: Number(id) },
            select: { id: true, childId: true }
        });

        if (!existing) {
            throw new Error('Аллергия не найдена');
        }

        await assertChildAccess(existing.childId, userId, isAdmin);

        await prisma.patientAllergy.delete({
            where: { id: existing.id }
        });
    }
};

module.exports = { PatientAllergyService };
