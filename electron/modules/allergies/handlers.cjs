const { ipcMain } = require('electron');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { logAudit } = require('../../logger.cjs');
const { PatientAllergyService } = require('./service.cjs');

const setupAllergyHandlers = () => {
    ipcMain.handle('allergies:list-by-child', ensureAuthenticated(async (_, childId) => {
        const session = getSession();
        return await PatientAllergyService.listByChild(childId, session.user.id, session.user.isAdmin);
    }));

    ipcMain.handle('allergies:create', ensureAuthenticated(async (_, data) => {
        const session = getSession();
        const allergy = await PatientAllergyService.create(data, session.user.id, session.user.isAdmin);
        logAudit('PATIENT_ALLERGY_CREATED', { childId: allergy.childId, allergyId: allergy.id });
        return allergy;
    }));

    ipcMain.handle('allergies:update', ensureAuthenticated(async (_, { id, data }) => {
        const session = getSession();
        const allergy = await PatientAllergyService.update(id, data, session.user.id, session.user.isAdmin);
        logAudit('PATIENT_ALLERGY_UPDATED', { allergyId: allergy.id });
        return allergy;
    }));

    ipcMain.handle('allergies:delete', ensureAuthenticated(async (_, id) => {
        const session = getSession();
        await PatientAllergyService.delete(id, session.user.id, session.user.isAdmin);
        logAudit('PATIENT_ALLERGY_DELETED', { allergyId: id });
        return true;
    }));
};

module.exports = { setupAllergyHandlers };
