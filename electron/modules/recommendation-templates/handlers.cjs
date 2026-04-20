const { ipcMain } = require('electron');
const { RecommendationTemplateService } = require('./service.cjs');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
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

    ipcMain.handle('recommendation-templates:get-all', ensureAuthenticated(async () => {
        try {
            const { user } = getSession();
            return await RecommendationTemplateService.getAll(user.id);
        } catch (error) {
            logger.error('[RecommendationTemplateHandler] Failed to get all templates', { error });
            throw error;
        }
    }));

    ipcMain.handle('recommendation-templates:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const { user } = getSession();
            const result = await RecommendationTemplateService.upsert({ ...data, createdById: user.id });
            logAudit(data.id ? 'RECOMMENDATION_TEMPLATE_UPDATED' : 'RECOMMENDATION_TEMPLATE_CREATED', {
                templateId: result.id,
                userId: user.id
            });
            return result;
        } catch (error) {
            logger.error('[RecommendationTemplateHandler] Failed to upsert template', { error, data });
            throw error;
        }
    }));

    ipcMain.handle('recommendation-templates:delete', ensureAuthenticated(async (_, id) => {
        try {
            const { user } = getSession();
            await RecommendationTemplateService.delete(id, user.id);
            logAudit('RECOMMENDATION_TEMPLATE_DELETED', { templateId: id, userId: user.id });
            return true;
        } catch (error) {
            logger.error('[RecommendationTemplateHandler] Failed to delete template', { error, id });
            throw error;
        }
    }));
};
