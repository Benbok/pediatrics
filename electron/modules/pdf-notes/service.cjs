const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');

const PdfNoteSchema = z.object({
    pdfPath: z.string().min(1),
    page: z.number().int().min(1),
    content: z.string().min(1).max(2000),
});

const PdfNoteUpdateSchema = PdfNoteSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Нет данных для обновления' }
);

const PdfNoteService = {
    async listNotes(pdfPath, page, userId) {
        const where = {
            pdfPath,
            authorId: userId,
        };

        if (page) {
            where.page = Number(page);
        }

        return await prisma.pdfNote.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    },

    async createNote(data, userId) {
        const validated = PdfNoteSchema.parse(data);
        return await prisma.pdfNote.create({
            data: {
                ...validated,
                authorId: userId,
            },
        });
    },

    async updateNote(id, data, userId) {
        const validated = PdfNoteUpdateSchema.parse(data);
        const existing = await prisma.pdfNote.findFirst({
            where: { id: Number(id), authorId: userId },
        });

        if (!existing) {
            throw new Error('Заметка не найдена');
        }

        return await prisma.pdfNote.update({
            where: { id: existing.id },
            data: validated,
        });
    },

    async deleteNote(id, userId) {
        const existing = await prisma.pdfNote.findFirst({
            where: { id: Number(id), authorId: userId },
        });

        if (!existing) {
            throw new Error('Заметка не найдена');
        }

        await prisma.pdfNote.delete({
            where: { id: existing.id },
        });
    },
};

module.exports = { PdfNoteService };
