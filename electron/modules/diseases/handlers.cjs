const { ipcMain } = require('electron');
const { DiseaseService, DiseaseSchema } = require('./service.cjs');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { normalizeDiseaseData } = require('../../utils/diseaseNormalization.cjs');
const { logAudit, logger } = require('../../logger.cjs');
const { CacheService } = require('../../services/cacheService.cjs');
const { DiseaseValidator } = require('./validator.cjs');

function safeJsonParse(value, defaultValue = []) {
    if (!value || value === null) return defaultValue;
    if (typeof value !== 'string') return defaultValue;
    if (value.trim() === '') return defaultValue;

    try {
        return JSON.parse(value);
    } catch (error) {
        logger.warn('[Diseases] Failed to parse JSON, using default:', error.message);
        return defaultValue;
    }
}

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
            symptoms: safeJsonParse(d.symptoms, []),
            diagnosticPlan: safeJsonParse(d.diagnosticPlan, []),
            treatmentPlan: safeJsonParse(d.treatmentPlan, []),
            differentialDiagnosis: safeJsonParse(d.differentialDiagnosis, []),
            redFlags: safeJsonParse(d.redFlags, []),
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

        // DiseaseService.getById уже возвращает распарсенные массивы
        const disease = await DiseaseService.getById(id);
        if (!disease) return null;

        // Сохраняем в кеш (без повторного парсинга!)
        CacheService.set('diseases', cacheKey, disease);

        return disease;
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

    // Async upload handlers
    ipcMain.handle('diseases:upload-guidelines-async', ensureAuthenticated(async (_, { diseaseId, pdfPaths }) => {
        const jobIds = await DiseaseService.uploadGuidelinesAsync(diseaseId, pdfPaths);
        logAudit('GUIDELINES_ASYNC_QUEUED', { diseaseId, count: pdfPaths.length });
        return jobIds;
    }));

    ipcMain.handle('diseases:get-upload-status', ensureAuthenticated(async (_, jobIds) => {
        return DiseaseService.getUploadStatus(jobIds);
    }));

    ipcMain.handle('diseases:update-guideline', ensureAuthenticated(async (_, { id, data }) => {
        const guideline = await DiseaseService.updateGuideline(id, data);
        logAudit('GUIDELINE_UPDATED', { guidelineId: id });

        // Инвалидируем кеш заболевания
        if (guideline && guideline.diseaseId) {
            CacheService.invalidate('diseases', `id_${guideline.diseaseId}`);
        }

        return guideline;
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

    ipcMain.handle('diseases:get-guideline-plan', ensureAuthenticated(async (_, diseaseId) => {
        return await DiseaseService.getGuidelinePlan(diseaseId);
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

    // Импорт из JSON
    ipcMain.handle('diseases:importFromJson', ensureAuthenticated(async (event, jsonString) => {
        try {
            logger.info(`[Diseases] Importing from JSON (length: ${jsonString.length})`);

            // Парсинг JSON
            let diseaseData;
            try {
                diseaseData = JSON.parse(jsonString);
            } catch (parseError) {
                logger.error(`[Diseases] JSON parse error:`, parseError);
                return {
                    success: false,
                    error: parseError.message.includes('JSON')
                        ? 'Неверный формат JSON. Проверьте синтаксис.'
                        : `Ошибка парсинга JSON: ${parseError.message}`
                };
            }

            // Поддержка старого формата symptoms: string[] при импорте
            if (Array.isArray(diseaseData.symptoms) && diseaseData.symptoms.length > 0 && typeof diseaseData.symptoms[0] === 'string') {
                logger.info('[Diseases] Converting old format symptoms to new format');
                diseaseData.symptoms = diseaseData.symptoms.map(text => ({ text: String(text).trim(), category: 'other' })).filter(s => s.text.length > 0);
            }

            diseaseData = normalizeDiseaseData(diseaseData);

            // Валидация через DiseaseValidator
            const validator = new DiseaseValidator();
            const validation = validator.validate(diseaseData);

            logger.info(`[Diseases] Validation results:`, {
                isValid: validation.isValid,
                errorsCount: validation.errors.length,
                warningsCount: validation.warnings.length
            });

            return {
                success: true,
                data: diseaseData,
                validation: {
                    isValid: validation.isValid,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    needsReview: validation.needsReview
                }
            };
        } catch (error) {
            logger.error(`[Diseases] Failed to import from JSON:`, error);
            return {
                success: false,
                error: error.message || 'Неизвестная ошибка при импорте JSON'
            };
        }
    }));
};

module.exports = { setupDiseaseHandlers };
