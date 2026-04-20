const { ipcMain } = require('electron');
const { DiagnosticTemplateService } = require('./service.cjs');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { logAudit, logger } = require('../../logger.cjs');

/**
 * Регистрация IPC handlers для шаблонов диагностики
 */
module.exports.setupDiagnosticTemplateHandlers = () => {
    ipcMain.handle('diagnostic-templates:get-by-id', ensureAuthenticated(async (_, id) => {
        try {
            return await DiagnosticTemplateService.getById(id);
        } catch (error) {
            logger.error('[DiagnosticTemplateHandler] Failed to get template', { error, id });
            throw error;
        }
    }));

    ipcMain.handle('diagnostic-templates:get-all', ensureAuthenticated(async () => {
        try {
            const { user } = getSession();
            return await DiagnosticTemplateService.getAll(user.id);
        } catch (error) {
            logger.error('[DiagnosticTemplateHandler] Failed to get all templates', { error });
            throw error;
        }
    }));

    ipcMain.handle('diagnostic-templates:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const { user } = getSession();
            const result = await DiagnosticTemplateService.upsert({ ...data, createdById: user.id });
            logAudit(data.id ? 'DIAGNOSTIC_TEMPLATE_UPDATED' : 'DIAGNOSTIC_TEMPLATE_CREATED', {
                templateId: result.id,
                userId: user.id
            });
            return result;
        } catch (error) {
            logger.error('[DiagnosticTemplateHandler] Failed to upsert template', { error, data });
            throw error;
        }
    }));

    ipcMain.handle('diagnostic-templates:delete', ensureAuthenticated(async (_, id) => {
        try {
            const { user } = getSession();
            await DiagnosticTemplateService.delete(id, user.id);
            logAudit('DIAGNOSTIC_TEMPLATE_DELETED', { templateId: id, userId: user.id });
            return true;
        } catch (error) {
            logger.error('[DiagnosticTemplateHandler] Failed to delete template', { error, id });
            throw error;
        }
    }));
};
