const { ipcMain } = require('electron');
const { MedicationService } = require('./service.cjs');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit } = require('../../logger.cjs');

const setupMedicationHandlers = () => {
    ipcMain.handle('medications:list', ensureAuthenticated(async () => {
        const meds = await MedicationService.list();
        return meds.map(m => ({
            ...m,
            forms: JSON.parse(m.forms || '[]'),
            pediatricDosing: JSON.parse(m.pediatricDosing || '[]'),
            indications: JSON.parse(m.indications || '[]')
        }));
    }));

    ipcMain.handle('medications:get-by-id', ensureAuthenticated(async (_, id) => {
        const med = await MedicationService.getById(id);
        if (!med) return null;
        return {
            ...med,
            forms: JSON.parse(med.forms || '[]'),
            pediatricDosing: JSON.parse(med.pediatricDosing || '[]'),
            indications: JSON.parse(med.indications || '[]')
        };
    }));

    ipcMain.handle('medications:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const result = await MedicationService.upsert(data);
            logAudit(data.id ? 'MEDICATION_UPDATED' : 'MEDICATION_CREATED', { name: result.nameRu });
            return result;
        } catch (error) {
            if (error.name === 'ZodError') {
                throw new Error(error.errors.map(e => e.message).join(', '));
            }
            throw error;
        }
    }));

    ipcMain.handle('medications:delete', ensureAuthenticated(async (_, id) => {
        await MedicationService.delete(id);
        logAudit('MEDICATION_DELETED', { id });
        return true;
    }));

    ipcMain.handle('medications:link-disease', ensureAuthenticated(async (_, data) => {
        return await MedicationService.linkToDisease(data);
    }));

    ipcMain.handle('medications:calculate-dose', ensureAuthenticated(async (_, { medicationId, weight, ageMonths }) => {
        return await MedicationService.calculateDose(medicationId, weight, ageMonths);
    }));

    ipcMain.handle('medications:get-by-disease', ensureAuthenticated(async (_, diseaseId) => {
        const { DiseaseService } = require('../diseases/service.cjs');
        const disease = await DiseaseService.getById(diseaseId);

        if (!disease) return [];

        const icd10Codes = JSON.parse(disease.icd10Codes || '[]');
        const allCodes = [disease.icd10Code, ...icd10Codes];

        return await MedicationService.getByIcd10Codes(allCodes);
    }));
};

module.exports = { setupMedicationHandlers };
