const { ipcMain } = require('electron');
const { VisitService } = require('./service.cjs');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit } = require('../../logger.cjs');

const setupVisitHandlers = () => {
    ipcMain.handle('visits:list-for-child', ensureAuthenticated(async (_, childId) => {
        const visits = await VisitService.listForChild(childId);
        return visits.map(v => ({
            ...v,
            complicationIds: JSON.parse(v.complicationIds || '[]'),
            comorbidityIds: JSON.parse(v.comorbidityIds || '[]'),
            prescriptions: JSON.parse(v.prescriptions || '[]'),
        }));
    }));

    ipcMain.handle('visits:get-by-id', ensureAuthenticated(async (_, id) => {
        const visit = await VisitService.getById(id);
        if (!visit) return null;
        return {
            ...visit,
            complicationIds: JSON.parse(visit.complicationIds || '[]'),
            comorbidityIds: JSON.parse(visit.comorbidityIds || '[]'),
            prescriptions: JSON.parse(visit.prescriptions || '[]'),
        };
    }));

    ipcMain.handle('visits:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const result = await VisitService.upsert(data);
            logAudit(data.id ? 'VISIT_UPDATED' : 'VISIT_CREATED', { visitId: result.id, childId: result.childId });
            return result;
        } catch (error) {
            if (error.name === 'ZodError') {
                throw new Error(error.errors.map(e => e.message).join(', '));
            }
            throw error;
        }
    }));

    ipcMain.handle('visits:delete', ensureAuthenticated(async (_, id) => {
        await VisitService.delete(id);
        logAudit('VISIT_DELETED', { id });
        return true;
    }));

    ipcMain.handle('visits:analyze', ensureAuthenticated(async (_, visitId) => {
        return await VisitService.analyzeVisit(visitId);
    }));
};

module.exports = { setupVisitHandlers };
