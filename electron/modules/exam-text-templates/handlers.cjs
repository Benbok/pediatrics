const { ipcMain } = require('electron');
const { ExamTextTemplateService } = require('./service.cjs');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit, logger } = require('../../logger.cjs');

/**
 * Регистрация IPC handlers для шаблонов текстов осмотра
 */
module.exports.setupExamTextTemplateHandlers = () => {
    ipcMain.handle('exam-text-templates:get-by-id', ensureAuthenticated(async (_, id) => {
        try {
            return await ExamTextTemplateService.getById(id);
        } catch (error) {
            logger.error('[ExamTextTemplateHandler] Failed to get template', { error, id });
            throw error;
        }
    }));

    ipcMain.handle('exam-text-templates:get-by-system', ensureAuthenticated(async (_, systemKey, userId) => {
        try {
            return await ExamTextTemplateService.getBySystemKey(systemKey, userId);
        } catch (error) {
            logger.error('[ExamTextTemplateHandler] Failed to get templates by system', { error, systemKey, userId });
            throw error;
        }
    }));

    ipcMain.handle('exam-text-templates:get-all', ensureAuthenticated(async (_, userId) => {
        try {
            return await ExamTextTemplateService.getAll(userId);
        } catch (error) {
            logger.error('[ExamTextTemplateHandler] Failed to get all templates', { error, userId });
            throw error;
        }
    }));

    ipcMain.handle('exam-text-templates:get-by-tags', ensureAuthenticated(async (_, { tags, userId }) => {
        try {
            return await ExamTextTemplateService.getByTags(tags, userId);
        } catch (error) {
            logger.error('[ExamTextTemplateHandler] Failed to get templates by tags', { error, tags, userId });
            throw error;
        }
    }));

    ipcMain.handle('exam-text-templates:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const result = await ExamTextTemplateService.upsert(data);
            logAudit(data.id ? 'EXAM_TEXT_TEMPLATE_UPDATED' : 'EXAM_TEXT_TEMPLATE_CREATED', {
                templateId: result.id,
                userId: data.createdById
            });
            return result;
        } catch (error) {
            logger.error('[ExamTextTemplateHandler] Failed to upsert template', { error, data });
            throw error;
        }
    }));

    ipcMain.handle('exam-text-templates:delete', ensureAuthenticated(async (_, id, userId) => {
        try {
            await ExamTextTemplateService.delete(id, userId);
            logAudit('EXAM_TEXT_TEMPLATE_DELETED', { templateId: id, userId });
            return true;
        } catch (error) {
            logger.error('[ExamTextTemplateHandler] Failed to delete template', { error, id, userId });
            throw error;
        }
    }));
};
