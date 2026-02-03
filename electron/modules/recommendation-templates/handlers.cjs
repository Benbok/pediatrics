const { ipcMain } = require('electron');
const { RecommendationTemplateService } = require('./service.cjs');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit, logger } = require('../../logger.cjs');

/**
 * Регистрация IPC handlers для шаблонов рекомендаций
 */
module.exports.setupRecommendationTemplateHandlers = () => {
    ipcMain.handle('recommendation-templates:get-by-id', ensureAuthenticated(async (_, id) => {
        try {
            return await RecommendationTemplateService.getById(id);
        } catch (error) {
            logger.error('[RecommendationTemplateHandler] Failed to get template', { error, id });
            throw error;
        }
    }));

    ipcMain.handle('recommendation-templates:get-all', ensureAuthenticated(async (_, userId) => {
        try {
            return await RecommendationTemplateService.getAll(userId);
        } catch (error) {
            logger.error('[RecommendationTemplateHandler] Failed to get all templates', { error, userId });
            throw error;
        }
    }));

    ipcMain.handle('recommendation-templates:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const result = await RecommendationTemplateService.upsert(data);
            logAudit(data.id ? 'RECOMMENDATION_TEMPLATE_UPDATED' : 'RECOMMENDATION_TEMPLATE_CREATED', {
                templateId: result.id,
                userId: data.createdById
            });
            return result;
        } catch (error) {
            logger.error('[RecommendationTemplateHandler] Failed to upsert template', { error, data });
            throw error;
        }
    }));

    ipcMain.handle('recommendation-templates:delete', ensureAuthenticated(async (_, id, userId) => {
        try {
            await RecommendationTemplateService.delete(id, userId);
            logAudit('RECOMMENDATION_TEMPLATE_DELETED', { templateId: id, userId });
            return true;
        } catch (error) {
            logger.error('[RecommendationTemplateHandler] Failed to delete template', { error, id, userId });
            throw error;
        }
    }));
};
