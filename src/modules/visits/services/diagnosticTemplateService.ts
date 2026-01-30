import { DiagnosticTemplate, DiagnosticPlanItem } from '../../../types';
import { DiagnosticTemplateSchema } from '../../../validators/diagnosticTemplate.validator';
import { logger } from '../../../services/logger';

export const diagnosticTemplateService = {
    /**
     * Get diagnostic template by ID
     */
    async getById(id: number): Promise<DiagnosticTemplate | null> {
        try {
            return await window.electronAPI.getDiagnosticTemplate(id);
        } catch (error) {
            logger.error('[DiagnosticTemplateService] Failed to get template', { error, id });
            throw error;
        }
    },

    /**
     * Get all diagnostic templates for user (personal + public)
     */
    async getAll(userId: number): Promise<DiagnosticTemplate[]> {
        try {
            return await window.electronAPI.getAllDiagnosticTemplates(userId);
        } catch (error) {
            logger.error('[DiagnosticTemplateService] Failed to get all templates', { error, userId });
            throw error;
        }
    },

    /**
     * Create or update diagnostic template
     */
    async upsert(data: DiagnosticTemplate): Promise<DiagnosticTemplate> {
        // Validate data using Zod
        const validation = DiagnosticTemplateSchema.safeParse(data);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.upsertDiagnosticTemplate(validation.data as DiagnosticTemplate);
        } catch (error: any) {
            logger.error('[DiagnosticTemplateService] Failed to save template', { error, data });
            throw new Error(error.message || 'Ошибка при сохранении шаблона');
        }
    },

    /**
     * Delete diagnostic template
     */
    async delete(id: number, userId: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteDiagnosticTemplate(id, userId);
        } catch (error) {
            logger.error('[DiagnosticTemplateService] Failed to delete template', { error, id, userId });
            throw error;
        }
    },

    /**
     * Parse template items from string or return array as-is
     */
    parseItems(items: string | DiagnosticPlanItem[]): DiagnosticPlanItem[] {
        if (Array.isArray(items)) {
            return items;
        }
        
        if (typeof items === 'string') {
            try {
                return JSON.parse(items);
            } catch {
                return [];
            }
        }
        
        return [];
    }
};
