import { ExamTextTemplate } from '../../../types';
import { ExamTextTemplateSchema } from '../../../validators/template.validator';
import { logger } from '../../../services/logger';

function getElectronApi() {
    const api = window.electronAPI;
    if (!api) {
        throw new Error('Electron API is unavailable');
    }
    return api;
}

export const examTextTemplateService = {
    /**
     * Get exam text template by ID
     */
    async getById(id: number): Promise<ExamTextTemplate | null> {
        try {
            return await getElectronApi().getExamTextTemplate(id);
        } catch (error) {
            logger.error('[ExamTextTemplateService] Failed to get template', { error, id });
            throw error;
        }
    },

    /**
     * Get exam text templates by system key
     */
    async getBySystemKey(systemKey: string, userId: number): Promise<ExamTextTemplate[]> {
        try {
            return await getElectronApi().getExamTextTemplatesBySystem(systemKey, userId);
        } catch (error) {
            logger.error('[ExamTextTemplateService] Failed to get templates by system', { error, systemKey, userId });
            throw error;
        }
    },

    /**
     * Get all exam text templates for user
     */
    async getAll(userId: number): Promise<ExamTextTemplate[]> {
        try {
            return await getElectronApi().getAllExamTextTemplates(userId);
        } catch (error) {
            logger.error('[ExamTextTemplateService] Failed to get all templates', { error, userId });
            throw error;
        }
    },

    /**
     * Get exam text templates by tags
     */
    async getByTags(tags: string | string[], userId: number): Promise<ExamTextTemplate[]> {
        try {
            const tagArray = Array.isArray(tags) ? tags : [tags];
            return await getElectronApi().getExamTextTemplatesByTags({ tags: tagArray, userId });
        } catch (error) {
            logger.error('[ExamTextTemplateService] Failed to get templates by tags', { error, tags, userId });
            throw error;
        }
    },

    /**
     * Create or update exam text template
     */
    async upsert(data: ExamTextTemplate): Promise<ExamTextTemplate> {
        // Validate data using Zod
        const validation = ExamTextTemplateSchema.safeParse(data);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await getElectronApi().upsertExamTextTemplate(validation.data as ExamTextTemplate);
        } catch (error: any) {
            logger.error('[ExamTextTemplateService] Failed to save template', { error, data });
            throw new Error(error.message || 'Ошибка при сохранении шаблона');
        }
    },

    /**
     * Delete exam text template
     */
    async delete(id: number, userId: number): Promise<boolean> {
        try {
            return await getElectronApi().deleteExamTextTemplate(id, userId);
        } catch (error) {
            logger.error('[ExamTextTemplateService] Failed to delete template', { error, id, userId });
            throw error;
        }
    }
};
