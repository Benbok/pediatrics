import { RecommendationTemplate } from '../../../types';
import { logger } from '../../../services/logger';

export const recommendationTemplateService = {
    /**
     * Get recommendation template by ID
     */
    async getById(id: number): Promise<RecommendationTemplate | null> {
        try {
            return await window.electronAPI.getRecommendationTemplate(id);
        } catch (error) {
            logger.error('[RecommendationTemplateService] Failed to get template', { error, id });
            throw error;
        }
    },

    /**
     * Get all recommendation templates for user (personal + public)
     */
    async getAll(userId: number): Promise<RecommendationTemplate[]> {
        try {
            return await window.electronAPI.getRecommendationTemplates(userId);
        } catch (error) {
            logger.error('[RecommendationTemplateService] Failed to get all templates', { error, userId });
            throw error;
        }
    },

    /**
     * Create or update recommendation template
     */
    async upsert(data: RecommendationTemplate): Promise<RecommendationTemplate> {
        // Basic validation
        if (!data.name || data.name.trim() === '') {
            throw new Error('Название шаблона обязательно');
        }

        if (!data.items || (Array.isArray(data.items) && data.items.length === 0)) {
            throw new Error('Шаблон должен содержать хотя бы одну рекомендацию');
        }

        try {
            return await window.electronAPI.upsertRecommendationTemplate(data);
        } catch (error: any) {
            logger.error('[RecommendationTemplateService] Failed to save template', { error, data });
            throw new Error(error.message || 'Ошибка при сохранении шаблона');
        }
    },

    /**
     * Delete recommendation template
     */
    async delete(id: number, userId: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteRecommendationTemplate(id, userId);
        } catch (error) {
            logger.error('[RecommendationTemplateService] Failed to delete template', { error, id, userId });
            throw error;
        }
    },

    /**
     * Parse template items from string or return array as-is
     */
    parseItems(items: string | string[]): string[] {
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
