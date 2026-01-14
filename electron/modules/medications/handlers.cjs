const { ipcMain } = require('electron');
const { MedicationService } = require('./service.cjs');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit, logger } = require('../../logger.cjs');
const { CacheService } = require('../../services/cacheService.cjs');

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
        const cacheKey = 'all';
        
        // Проверяем кеш
        const cached = CacheService.get('medications', cacheKey);
        if (cached) {
            return cached;
        }

        const meds = await MedicationService.list();
        const parsed = meds.map(m => ({
            ...m,
            forms: safeJsonParse(m.forms, []),
            pediatricDosing: safeJsonParse(m.pediatricDosing, []),
            indications: safeJsonParse(m.indications, [])
        }));

        // Сохраняем в кеш
        CacheService.set('medications', cacheKey, parsed);
        
        return parsed;
    }));

    ipcMain.handle('medications:get-by-id', ensureAuthenticated(async (_, id) => {
        const cacheKey = `id_${id}`;
        
        // Проверяем кеш
        const cached = CacheService.get('medications', cacheKey);
        if (cached) {
            return cached;
        }

        const med = await MedicationService.getById(id);
        if (!med) return null;

        const parsed = {
            ...med,
            forms: safeJsonParse(med.forms, []),
            pediatricDosing: safeJsonParse(med.pediatricDosing, []),
            indications: safeJsonParse(med.indications, [])
        };

        // Сохраняем в кеш
        CacheService.set('medications', cacheKey, parsed);
        
        return parsed;
    }));

    ipcMain.handle('medications:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const result = await MedicationService.upsert(data);
            logAudit(data.id ? 'MEDICATION_UPDATED' : 'MEDICATION_CREATED', { name: result.nameRu });
            
            // Инвалидируем кеш препаратов
            CacheService.invalidate('medications', 'all'); // Список всех препаратов
            if (result.id) {
                CacheService.invalidate('medications', `id_${result.id}`); // Конкретный препарат
                // Также инвалидируем кеш для всех заболеваний, связанных с этим препаратом
                // (через medications:get-by-disease)
                CacheService.invalidate('medications', `by_disease_${result.id}`);
            }
            
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
        
        // Инвалидируем кеш препаратов
        CacheService.invalidate('medications', 'all');
        CacheService.invalidate('medications', `id_${id}`);
        // Инвалидируем все кеши по заболеваниям (так как препарат мог быть связан с разными)
        // Можно оптимизировать позже, сохраняя список связанных заболеваний
        CacheService.invalidate('medications', `by_disease_${id}`);
        
        return true;
    }));

    ipcMain.handle('medications:link-disease', ensureAuthenticated(async (_, data) => {
        return await MedicationService.linkToDisease(data);
    }));

    ipcMain.handle('medications:calculate-dose', ensureAuthenticated(async (_, { medicationId, weight, ageMonths, height }) => {
        return await MedicationService.calculateDose(medicationId, weight, ageMonths, height || null);
    }));

    ipcMain.handle('medications:get-by-disease', ensureAuthenticated(async (_, diseaseId) => {
        const cacheKey = `disease_${diseaseId}`;
        
        // Проверяем кеш
        const cached = CacheService.get('medications', cacheKey);
        if (cached) {
            return cached;
        }

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
        
        // Сохраняем в кеш
        CacheService.set('medications', cacheKey, medications);
        
        return medications;
    }));
};

module.exports = { setupMedicationHandlers };
