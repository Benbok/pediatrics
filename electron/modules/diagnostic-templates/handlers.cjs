const { ipcMain } = require('electron');
const { DiagnosticTemplateService } = require('./service.cjs');
const { ensureAuthenticated } = require('../../auth.cjs');
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

    ipcMain.handle('diagnostic-templates:get-all', ensureAuthenticated(async (_, userId) => {
        try {
            return await DiagnosticTemplateService.getAll(userId);
        } catch (error) {
            logger.error('[DiagnosticTemplateHandler] Failed to get all templates', { error, userId });
            throw error;
        }
    }));

    ipcMain.handle('diagnostic-templates:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const result = await DiagnosticTemplateService.upsert(data);
            logAudit(data.id ? 'DIAGNOSTIC_TEMPLATE_UPDATED' : 'DIAGNOSTIC_TEMPLATE_CREATED', {
                templateId: result.id,
                userId: data.createdById
            });
            return result;
        } catch (error) {
            logger.error('[DiagnosticTemplateHandler] Failed to upsert template', { error, data });
            throw error;
        }
    }));

    ipcMain.handle('diagnostic-templates:delete', ensureAuthenticated(async (_, id, userId) => {
        try {
            await DiagnosticTemplateService.delete(id, userId);
            logAudit('DIAGNOSTIC_TEMPLATE_DELETED', { templateId: id, userId });
            return true;
        } catch (error) {
            logger.error('[DiagnosticTemplateHandler] Failed to delete template', { error, id, userId });
            throw error;
        }
    }));
};
