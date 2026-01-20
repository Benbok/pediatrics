import { MedicationTemplate, MedicationTemplateItem } from '../../../types';
import { MedicationTemplateSchema } from '../../../validators/template.validator';
import { logger } from '../../../services/logger';

export const medicationTemplateService = {
    /**
     * Get medication template by ID
     */
    async getById(id: number): Promise<MedicationTemplate | null> {
        try {
            return await window.electronAPI.getMedicationTemplate(id);
        } catch (error) {
            logger.error('[MedicationTemplateService] Failed to get template', { error, id });
            throw error;
        }
    },

    /**
     * Get all medication templates for user
     */
    async getAll(userId: number): Promise<MedicationTemplate[]> {
        try {
            return await window.electronAPI.getAllMedicationTemplates(userId);
        } catch (error) {
            logger.error('[MedicationTemplateService] Failed to get all templates', { error, userId });
            throw error;
        }
    },

    /**
     * Create or update medication template
     */
    async upsert(data: MedicationTemplate): Promise<MedicationTemplate> {
        // Validate data using Zod
        const validation = MedicationTemplateSchema.safeParse(data);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.upsertMedicationTemplate(validation.data as MedicationTemplate);
        } catch (error: any) {
            logger.error('[MedicationTemplateService] Failed to save template', { error, data });
            throw new Error(error.message || 'Ошибка при сохранении шаблона');
        }
    },

    /**
     * Delete medication template
     */
    async delete(id: number, userId: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteMedicationTemplate(id, userId);
        } catch (error) {
            logger.error('[MedicationTemplateService] Failed to delete template', { error, id, userId });
            throw error;
        }
    },

    /**
     * Prepare template application - returns medication items ready for dose calculation
     */
    async prepareApplication(params: {
        templateId: number;
        childWeight: number;
        childAgeMonths: number;
        childHeight?: number | null;
    }): Promise<MedicationTemplateItem[]> {
        try {
            return await window.electronAPI.prepareMedicationTemplateApplication(params);
        } catch (error) {
            logger.error('[MedicationTemplateService] Failed to prepare template application', { error, params });
            throw error;
        }
    }
};
