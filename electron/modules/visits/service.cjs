const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');

const VisitSchema = z.object({
    id: z.number().optional(),
    childId: z.number(),
    doctorId: z.number(),
    visitDate: z.string().or(z.date()),
    complaints: z.string().min(1),
    complaintsJson: z.string().optional().nullable(),
    physicalExam: z.string().optional().nullable(),
    primaryDiagnosisId: z.number().optional().nullable(),
    complicationIds: z.array(z.number()).default([]),
    comorbidityIds: z.array(z.number()).default([]),
    prescriptions: z.array(z.any()).default([]),
    recommendations: z.string().optional().nullable(),
    status: z.enum(['draft', 'completed']).default('draft'),
    notes: z.string().optional().nullable(),
});

const VisitService = {
    /**
     * List visits for a child
     */
    async listForChild(childId) {
        return await prisma.visit.findMany({
            where: { childId: Number(childId) },
            include: {
                primaryDiagnosis: true,
                doctor: {
                    select: { fullName: true }
                }
            },
            orderBy: { visitDate: 'desc' }
        });
    },

    /**
     * Get visit by ID
     */
    async getById(id) {
        return await prisma.visit.findUnique({
            where: { id: Number(id) },
            include: {
                child: true,
                primaryDiagnosis: true,
                doctor: true
            }
        });
    },

    /**
     * Upsert visit
     */
    async upsert(data) {
        const validated = VisitSchema.parse(data);
        const { id, ...rest } = validated;

        const dbData = {
            ...rest,
            visitDate: new Date(rest.visitDate),
            complicationIds: JSON.stringify(rest.complicationIds),
            comorbidityIds: JSON.stringify(rest.comorbidityIds),
            prescriptions: JSON.stringify(rest.prescriptions),
        };

        if (id) {
            return await prisma.visit.update({
                where: { id },
                data: dbData,
            });
        }

        return await prisma.visit.create({
            data: dbData,
        });
    },

    /**
     * Delete visit
     */
    async delete(id) {
        return await prisma.visit.delete({
            where: { id: Number(id) },
        });
    },

    /**
     * AI-powered analysis of complaints
     * Returns suggested diagnoses and relevant guideline chunks
     */
    async analyzeVisit(visitId) {
        const visit = await this.getById(visitId);
        if (!visit) throw new Error('Прием не найден');

        // Here we would call Gemini API to parse complaints and match with diseases
        // For now, returning top matching diseases by keywords
        const complaints = visit.complaints.toLowerCase();

        // Simple mock AI logic
        const diseases = await prisma.disease.findMany({
            include: {
                medications: {
                    include: { medication: true }
                }
            }
        });

        const suggestions = diseases
            .map(d => {
                const symptoms = JSON.parse(d.symptoms || '[]');
                const matches = symptoms.filter(s => complaints.includes(s.toLowerCase()));
                return {
                    disease: d,
                    score: matches.length / Math.max(symptoms.length, 1) +
                        (complaints.includes(d.nameRu.toLowerCase()) ? 1 : 0)
                };
            })
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score);

        return suggestions.slice(0, 3);
    }
};

module.exports = { VisitService, VisitSchema };
