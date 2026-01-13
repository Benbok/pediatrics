const { ipcMain } = require('electron');
const { MedicationService } = require('./service.cjs');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit, logger } = require('../../logger.cjs');

/**
 * Безопасный парсинг JSON полей
 */
function safeJsonParse(value, defaultValue = []) {
    if (!value || value === null) return defaultValue;
    if (typeof value !== 'string') return defaultValue;
    if (value.trim() === '') return defaultValue;
    
    try {
        return JSON.parse(value);
    } catch (error) {
        logger.warn('[MedicationHandlers] Failed to parse JSON, using default:', error.message);
        return defaultValue;
    }
}

const setupMedicationHandlers = () => {
    ipcMain.handle('medications:list', ensureAuthenticated(async () => {
        const meds = await MedicationService.list();
        return meds.map(m => ({
            ...m,
            forms: safeJsonParse(m.forms, []),
            pediatricDosing: safeJsonParse(m.pediatricDosing, []),
            indications: safeJsonParse(m.indications, [])
        }));
    }));

    ipcMain.handle('medications:get-by-id', ensureAuthenticated(async (_, id) => {
        const med = await MedicationService.getById(id);
        if (!med) return null;
        return {
            ...med,
            forms: safeJsonParse(med.forms, []),
            pediatricDosing: safeJsonParse(med.pediatricDosing, []),
            indications: safeJsonParse(med.indications, [])
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

    ipcMain.handle('medications:calculate-dose', ensureAuthenticated(async (_, { medicationId, weight, ageMonths, height }) => {
        return await MedicationService.calculateDose(medicationId, weight, ageMonths, height || null);
    }));

    ipcMain.handle('medications:get-by-disease', ensureAuthenticated(async (_, diseaseId) => {
        const { DiseaseService } = require('../diseases/service.cjs');
        const disease = await DiseaseService.getById(diseaseId);

        if (!disease) {
            logger.warn(`[MedicationHandlers] Disease not found: ${diseaseId}`);
            return [];
        }

        // Безопасно парсим ICD коды из заболевания
        // disease.icd10Codes уже распарсен в DiseaseService.getById, но может быть строкой из БД
        const icd10Codes = Array.isArray(disease.icd10Codes) 
            ? disease.icd10Codes 
            : safeJsonParse(disease.icd10Codes, []);
        
        // Собираем все коды, фильтруя null/undefined
        const allCodes = [disease.icd10Code, ...icd10Codes].filter(c => c && c.trim && c.trim() !== '');
        
        logger.info(`[MedicationHandlers] Searching medications for disease ${diseaseId} with codes:`, allCodes);

        if (allCodes.length === 0) {
            logger.warn(`[MedicationHandlers] No ICD codes found for disease ${diseaseId}`);
            return [];
        }

        const medications = await MedicationService.getByIcd10Codes(allCodes);
        logger.info(`[MedicationHandlers] Found ${medications.length} medications for disease ${diseaseId}`);
        
        return medications;
    }));
};

module.exports = { setupMedicationHandlers };
