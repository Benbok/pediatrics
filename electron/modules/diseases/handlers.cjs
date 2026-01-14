const { ipcMain } = require('electron');
const { DiseaseService, DiseaseSchema } = require('./service.cjs');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { logAudit } = require('../../logger.cjs');
const { CacheService } = require('../../services/cacheService.cjs');

const setupDiseaseHandlers = () => {
    ipcMain.handle('diseases:list', ensureAuthenticated(async () => {
        const cacheKey = 'all';
        
        // Проверяем кеш
        const cached = CacheService.get('diseases', cacheKey);
        if (cached) {
            return cached;
        }

        const diseases = await DiseaseService.list();
        const parsed = diseases.map(d => ({
            ...d,
            symptoms: JSON.parse(d.symptoms || '[]')
        }));

        // Сохраняем в кеш
        CacheService.set('diseases', cacheKey, parsed);
        
        return parsed;
    }));

    ipcMain.handle('diseases:get-by-id', ensureAuthenticated(async (_, id) => {
        const cacheKey = `id_${id}`;
        
        // Проверяем кеш
        const cached = CacheService.get('diseases', cacheKey);
        if (cached) {
            return cached;
        }

        const disease = await DiseaseService.getById(id);
        if (!disease) return null;

        const parsed = {
            ...disease,
            symptoms: JSON.parse(disease.symptoms || '[]')
        };

        // Сохраняем в кеш
        CacheService.set('diseases', cacheKey, parsed);
        
        return parsed;
    }));

    ipcMain.handle('diseases:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const result = await DiseaseService.upsert(data);
            logAudit(data.id ? 'DISEASE_UPDATED' : 'DISEASE_CREATED', { icd10: result.icd10Code });
            
            // Инвалидируем кеш заболеваний
            CacheService.invalidate('diseases', 'all'); // Список всех заболеваний
            if (result.id) {
                CacheService.invalidate('diseases', `id_${result.id}`); // Конкретное заболевание
            }
            
            return result;
        } catch (error) {
            if (error.name === 'ZodError') {
                throw new Error(error.errors.map(e => e.message).join(', '));
            }
            throw error;
        }
    }));

    ipcMain.handle('diseases:delete', ensureAuthenticated(async (_, id) => {
        await DiseaseService.delete(id);
        logAudit('DISEASE_DELETED', { id });
        
        // Инвалидируем кеш заболеваний
        CacheService.invalidate('diseases', 'all');
        CacheService.invalidate('diseases', `id_${id}`);
        
        return true;
    }));

    ipcMain.handle('diseases:upload-guideline', ensureAuthenticated(async (_, { diseaseId, pdfPath }) => {
        const guideline = await DiseaseService.uploadGuideline(diseaseId, pdfPath);
        logAudit('GUIDELINE_UPLOADED', { diseaseId, guidelineId: guideline.id });
        
        // Инвалидируем кеш заболевания (guidelines изменились)
        CacheService.invalidate('diseases', `id_${diseaseId}`);
        
        return guideline;
    }));

    ipcMain.handle('diseases:upload-guidelines-batch', ensureAuthenticated(async (_, { diseaseId, pdfPaths }) => {
        const result = await DiseaseService.uploadGuidelinesBatch(diseaseId, pdfPaths);
        logAudit('GUIDELINES_BATCH_UPLOADED', { diseaseId, count: result.success.length });
        
        // Инвалидируем кеш заболевания
        CacheService.invalidate('diseases', `id_${diseaseId}`);
        
        return result;
    }));

    ipcMain.handle('diseases:delete-guideline', ensureAuthenticated(async (_, guidelineId) => {
        const guideline = await DiseaseService.deleteGuideline(guidelineId);
        logAudit('GUIDELINE_DELETED', { guidelineId });
        
        // Инвалидируем кеш заболевания, если удалили guideline
        // Нужно получить diseaseId из guideline или из базы
        // Для простоты инвалидируем все - можно оптимизировать позже
        if (guideline && guideline.diseaseId) {
            CacheService.invalidate('diseases', `id_${guideline.diseaseId}`);
        }
        
        return true;
    }));

    ipcMain.handle('diseases:search', ensureAuthenticated(async (_, symptoms) => {
        return await DiseaseService.searchBySymptoms(symptoms);
    }));

    ipcMain.handle('diseases:parse-pdf-only', ensureAuthenticated(async (_, pdfPath) => {
        return await DiseaseService.parsePdfOnly(pdfPath);
    }));

    // ============= DISEASE NOTES HANDLERS =============

    ipcMain.handle('diseases:notes-list', ensureAuthenticated(async (_, diseaseId) => {
        const session = getSession();
        return await DiseaseService.listNotes(diseaseId, session.user.id);
    }));

    ipcMain.handle('diseases:notes-create', ensureAuthenticated(async (_, data) => {
        const session = getSession();
        const note = await DiseaseService.createNote(data, session.user.id);
        logAudit('DISEASE_NOTE_CREATED', { diseaseId: data.diseaseId, noteId: note.id });
        return note;
    }));

    ipcMain.handle('diseases:notes-update', ensureAuthenticated(async (_, { id, data }) => {
        const session = getSession();
        const note = await DiseaseService.updateNote(id, data, session.user.id);
        logAudit('DISEASE_NOTE_UPDATED', { noteId: id });
        return note;
    }));

    ipcMain.handle('diseases:notes-delete', ensureAuthenticated(async (_, id) => {
        const session = getSession();
        await DiseaseService.deleteNote(id, session.user.id);
        logAudit('DISEASE_NOTE_DELETED', { noteId: id });
        return true;
    }));
};

module.exports = { setupDiseaseHandlers };
