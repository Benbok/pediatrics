const { ipcMain } = require('electron');
const { VisitTemplateService } = require('./template-service.cjs');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit } = require('../../logger.cjs');
const { getSession } = require('../../auth.cjs');

const setupVisitTemplateHandlers = () => {
    ipcMain.handle('visit-templates:get-by-id', ensureAuthenticated(async (_, id) => {
        const template = await VisitTemplateService.getById(id);
        return template ? {
            ...template,
            createdAt: template.createdAt?.toISOString(),
            updatedAt: template.updatedAt?.toISOString(),
        } : null;
    }));

    ipcMain.handle('visit-templates:get-all', ensureAuthenticated(async () => {
        const session = getSession();
        const templates = await VisitTemplateService.getAll(session.user.id);
        return templates.map(t => ({
            ...t,
            createdAt: t.createdAt?.toISOString(),
            updatedAt: t.updatedAt?.toISOString(),
        }));
    }));

    ipcMain.handle('visit-templates:get-by-visit-type', ensureAuthenticated(async (_, visitType) => {
        const session = getSession();
        const templates = await VisitTemplateService.getByVisitType(visitType, session.user.id);
        return templates.map(t => ({
            ...t,
            createdAt: t.createdAt?.toISOString(),
            updatedAt: t.updatedAt?.toISOString(),
        }));
    }));

    ipcMain.handle('visit-templates:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const session = getSession();
            const result = await VisitTemplateService.upsert({
                ...data,
                createdById: data.createdById || session.user.id,
            }, session.user.id);
            logAudit(data.id ? 'VISIT_TEMPLATE_UPDATED' : 'VISIT_TEMPLATE_CREATED', {
                templateId: result.id,
                name: result.name
            });
            return {
                ...result,
                createdAt: result.createdAt?.toISOString(),
                updatedAt: result.updatedAt?.toISOString(),
            };
        } catch (error) {
            if (error.name === 'ZodError') {
                throw new Error(error.errors.map(e => e.message).join(', '));
            }
            throw error;
        }
    }));

    ipcMain.handle('visit-templates:delete', ensureAuthenticated(async (_, id) => {
        const session = getSession();
        await VisitTemplateService.delete(id, session.user.id);
        logAudit('VISIT_TEMPLATE_DELETED', { id });
        return true;
    }));

    ipcMain.handle('visit-templates:apply', ensureAuthenticated(async (_, { templateId, existingData }) => {
        return await VisitTemplateService.applyTemplate(templateId, existingData);
    }));
};

module.exports = { setupVisitTemplateHandlers };
