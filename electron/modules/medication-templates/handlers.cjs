const { ipcMain } = require('electron');
const { MedicationTemplateService } = require('./service.cjs');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { logAudit, logger } = require('../../logger.cjs');

/**
 * Регистрация IPC handlers для шаблонов назначений
 */
module.exports.setupMedicationTemplateHandlers = () => {
    ipcMain.handle('medication-templates:get-by-id', ensureAuthenticated(async (_, id) => {
        try {
            return await MedicationTemplateService.getById(id);
        } catch (error) {
            logger.error('[MedicationTemplateHandler] Failed to get template', { error, id });
            throw error;
        }
    }));

    ipcMain.handle('medication-templates:get-all', ensureAuthenticated(async () => {
        try {
            const { user } = getSession();
            return await MedicationTemplateService.getAll(user.id);
        } catch (error) {
            logger.error('[MedicationTemplateHandler] Failed to get all templates', { error });
            throw error;
        }
    }));

    ipcMain.handle('medication-templates:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const { user } = getSession();
            const result = await MedicationTemplateService.upsert({ ...data, createdById: user.id });
            logAudit(data.id ? 'MEDICATION_TEMPLATE_UPDATED' : 'MEDICATION_TEMPLATE_CREATED', {
                templateId: result.id,
                userId: user.id
            });
            return result;
        } catch (error) {
            logger.error('[MedicationTemplateHandler] Failed to upsert template', { error, data });
            throw error;
        }
    }));

    ipcMain.handle('medication-templates:delete', ensureAuthenticated(async (_, id) => {
        try {
            const { user } = getSession();
            await MedicationTemplateService.delete(id, user.id);
            logAudit('MEDICATION_TEMPLATE_DELETED', { templateId: id, userId: user.id });
            return true;
        } catch (error) {
            logger.error('[MedicationTemplateHandler] Failed to delete template', { error, id });
            throw error;
        }
    }));

    ipcMain.handle('medication-templates:prepare-application', ensureAuthenticated(async (_, { templateId, childWeight, childAgeMonths, childHeight }) => {
        try {
            return await MedicationTemplateService.prepareTemplateApplication(
                templateId,
                childWeight,
                childAgeMonths,
                childHeight
            );
        } catch (error) {
            logger.error('[MedicationTemplateHandler] Failed to prepare template application', {
                error,
                templateId,
                childWeight,
                childAgeMonths,
                childHeight
            });
            throw error;
        }
    }));
};
