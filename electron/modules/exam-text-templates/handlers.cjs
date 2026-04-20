const { ipcMain } = require('electron');
const { ExamTextTemplateService } = require('./service.cjs');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
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

    ipcMain.handle('exam-text-templates:get-by-system', ensureAuthenticated(async (_, systemKey) => {
        try {
            const { user } = getSession();
            return await ExamTextTemplateService.getBySystemKey(systemKey, user.id);
        } catch (error) {
            logger.error('[ExamTextTemplateHandler] Failed to get templates by system', { error, systemKey });
            throw error;
        }
    }));

    ipcMain.handle('exam-text-templates:get-all', ensureAuthenticated(async () => {
        try {
            const { user } = getSession();
            return await ExamTextTemplateService.getAll(user.id);
        } catch (error) {
            logger.error('[ExamTextTemplateHandler] Failed to get all templates', { error });
            throw error;
        }
    }));

    ipcMain.handle('exam-text-templates:get-by-tags', ensureAuthenticated(async (_, { tags }) => {
        try {
            const { user } = getSession();
            return await ExamTextTemplateService.getByTags(tags, user.id);
        } catch (error) {
            logger.error('[ExamTextTemplateHandler] Failed to get templates by tags', { error, tags });
            throw error;
        }
    }));

    ipcMain.handle('exam-text-templates:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const { user } = getSession();
            const result = await ExamTextTemplateService.upsert({ ...data, createdById: user.id });
            logAudit(data.id ? 'EXAM_TEXT_TEMPLATE_UPDATED' : 'EXAM_TEXT_TEMPLATE_CREATED', {
                templateId: result.id,
                userId: user.id
            });
            return result;
        } catch (error) {
            logger.error('[ExamTextTemplateHandler] Failed to upsert template', { error, data });
            throw error;
        }
    }));

    ipcMain.handle('exam-text-templates:delete', ensureAuthenticated(async (_, id) => {
        try {
            const { user } = getSession();
            await ExamTextTemplateService.delete(id, user.id);
            logAudit('EXAM_TEXT_TEMPLATE_DELETED', { templateId: id, userId: user.id });
            return true;
        } catch (error) {
            logger.error('[ExamTextTemplateHandler] Failed to delete template', { error, id });
            throw error;
        }
    }));
};
