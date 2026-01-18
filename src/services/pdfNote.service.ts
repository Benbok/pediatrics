import { PdfNote } from '../types';
import { PdfNoteSchema, PdfNoteUpdateSchema } from '../validators/pdfNote.validator';
import { logger } from './logger';

export const pdfNoteService = {
    async list(pdfPath: string, page?: number): Promise<PdfNote[]> {
        try {
            return await window.electronAPI.getPdfNotes({ pdfPath, page });
        } catch (error) {
            logger.error('[PDF Notes] Failed to list notes', { error, pdfPath, page });
            throw error;
        }
    },

    async create(data: Partial<PdfNote>): Promise<PdfNote> {
        const validation = PdfNoteSchema.safeParse(data);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.createPdfNote(validation.data);
        } catch (error) {
            logger.error('[PDF Notes] Failed to create note', { error });
            throw error;
        }
    },

    async update(id: number, data: Partial<PdfNote>): Promise<PdfNote> {
        const validation = PdfNoteUpdateSchema.safeParse(data);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.updatePdfNote(id, validation.data);
        } catch (error) {
            logger.error('[PDF Notes] Failed to update note', { error, id });
            throw error;
        }
    },

    async remove(id: number): Promise<void> {
        try {
            await window.electronAPI.deletePdfNote(id);
        } catch (error) {
            logger.error('[PDF Notes] Failed to delete note', { error, id });
            throw error;
        }
    },
};
