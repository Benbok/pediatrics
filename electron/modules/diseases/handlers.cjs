const { ipcMain } = require('electron');
const { DiseaseService, DiseaseSchema } = require('./service.cjs');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { normalizeDiseaseData } = require('../../utils/diseaseNormalization.cjs');
const { logAudit, logger } = require('../../logger.cjs');
const { CacheService } = require('../../services/cacheService.cjs');
const { DiseaseValidator } = require('./validator.cjs');
const { z } = require('zod');
const { computeQaCacheEntry } = require('../../services/ragQaPrecomputeService.cjs');

const RAG_LAST_CACHE_PREFIX = 'rag_last_answer_';

function getRagLastCacheKey(diseaseId) {
    return `${RAG_LAST_CACHE_PREFIX}${Number(diseaseId)}`;
}

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
            CacheService.invalidate('visits', 'all_diagnostic_tests');
            CacheService.invalidate('diseases', 'diagnostic_test_catalog');
            if (result.id) {
                CacheService.invalidate('diseases', `id_${result.id}`); // Конкретное заболевание
                CacheService.invalidate('diseases', getRagLastCacheKey(result.id));
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
        CacheService.invalidate('visits', 'all_diagnostic_tests');
        CacheService.invalidate('diseases', 'diagnostic_test_catalog');
        CacheService.invalidate('diseases', `id_${id}`);
        CacheService.invalidate('diseases', getRagLastCacheKey(id));

        return true;
    }));

    ipcMain.handle('diseases:upload-guideline', ensureAuthenticated(async (_, { diseaseId, pdfPath }) => {
        const guideline = await DiseaseService.uploadGuideline(diseaseId, pdfPath);
        logAudit('GUIDELINE_UPLOADED', { diseaseId, guidelineId: guideline.id });

        // Инвалидируем кеш заболевания (guidelines изменились)
        CacheService.invalidate('diseases', `id_${diseaseId}`);
        CacheService.invalidate('diseases', getRagLastCacheKey(diseaseId));

        // Запускаем фоновый precompute стандартных вопросов
        schedulePrecompute(diseaseId);

        return guideline;
    }));

    ipcMain.handle('diseases:upload-guidelines-batch', ensureAuthenticated(async (_, { diseaseId, pdfPaths }) => {
        const result = await DiseaseService.uploadGuidelinesBatch(diseaseId, pdfPaths);
        logAudit('GUIDELINES_BATCH_UPLOADED', { diseaseId, count: result.success.length });

        // Инвалидируем кеш заболевания
        CacheService.invalidate('diseases', `id_${diseaseId}`);
        CacheService.invalidate('diseases', getRagLastCacheKey(diseaseId));

        // Запускаем фоновый precompute стандартных вопросов
        if (result.success.length > 0) schedulePrecompute(diseaseId);

        return result;
    }));

    // Async upload handlers
    ipcMain.handle('diseases:upload-guidelines-async', ensureAuthenticated(async (_, { diseaseId, pdfPaths }) => {
        try {
            const schema = z.object({
                diseaseId: z.number().or(z.string().transform(Number)),
                pdfPaths: z.array(z.string()).min(1),
            });
            const validated = schema.parse({ diseaseId, pdfPaths });

            const result = await DiseaseService.uploadGuidelinesAsync(validated.diseaseId, validated.pdfPaths);
            logAudit('GUIDELINES_ASYNC_QUEUED', { diseaseId: validated.diseaseId, count: validated.pdfPaths.length });
            return result;
        } catch (error) {
            logger.error('[Diseases] Failed to queue async guideline upload:', error);
            throw error;
        }
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
            CacheService.invalidate('diseases', getRagLastCacheKey(guideline.diseaseId));
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
            CacheService.invalidate('diseases', getRagLastCacheKey(guideline.diseaseId));
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

    ipcMain.handle('diseases:get-diagnostic-catalog-test-names', ensureAuthenticated(async () => {
        return await DiseaseService.getDiagnosticCatalogTestNames();
    }));

    ipcMain.handle('diseases:resolve-test-name', ensureAuthenticated(async (_, inputName) => {
        const validated = z.string().max(500).parse(inputName);
        return await DiseaseService.resolveDiagnosticTestName(validated);
    }));

    ipcMain.handle('diseases:link-test-alias', ensureAuthenticated(async (_, { aliasText, canonicalName }) => {
        const schema = z.object({
            aliasText: z.string().min(1).max(500),
            canonicalName: z.string().min(1).max(500),
        });
        const validated = schema.parse({ aliasText, canonicalName });
        return await DiseaseService.linkTestAlias(validated.aliasText, validated.canonicalName);
    }));

    // ============= DIAGNOSTIC CATALOG CRUD =============

    ipcMain.handle('diseases:catalog-list', ensureAuthenticated(async (_, search) => {
        const term = search ? z.string().max(200).parse(search) : '';
        return await DiseaseService.listDiagnosticCatalogEntries(term);
    }));

    ipcMain.handle('diseases:catalog-create', ensureAuthenticated(async (_, { nameRu, type, aliases }) => {
        const schema = z.object({
            nameRu: z.string().min(1).max(500),
            type: z.enum(['lab', 'instrumental']).default('lab'),
            aliases: z.array(z.string().max(500)).default([]),
        });
        const v = schema.parse({ nameRu, type, aliases });
        return await DiseaseService.createCatalogEntry(v.nameRu, v.type, v.aliases);
    }));

    ipcMain.handle('diseases:catalog-update', ensureAuthenticated(async (_, { id, data }) => {
        const schema = z.object({
            id: z.number().int().positive(),
            data: z.object({
                nameRu: z.string().min(1).max(500).optional(),
                type: z.enum(['lab', 'instrumental']).optional(),
                aliases: z.array(z.string().max(500)).optional(),
            }),
        });
        const v = schema.parse({ id, data });
        return await DiseaseService.updateCatalogEntry(v.id, v.data);
    }));

    ipcMain.handle('diseases:catalog-delete', ensureAuthenticated(async (_, id) => {
        const entryId = z.number().int().positive().parse(id);
        return await DiseaseService.deleteCatalogEntry(entryId);
    }));

    ipcMain.handle('diseases:reindex-guideline-chunks', ensureAuthenticated(async () => {
        const ok = await DiseaseService.reindexGuidelineChunks();
        logAudit('GUIDELINE_CHUNKS_REINDEXED', { ok });

        // Invalidate diseases cache because guideline-derived search may change
        CacheService.invalidate('diseases', 'all');
        return ok;
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
        CacheService.invalidate('diseases', `id_${data.diseaseId}`);
        return note;
    }));

    ipcMain.handle('diseases:notes-update', ensureAuthenticated(async (_, { id, data }) => {
        const session = getSession();
        const note = await DiseaseService.updateNote(id, data, session.user.id);
        logAudit('DISEASE_NOTE_UPDATED', { noteId: id });
        CacheService.invalidate('diseases', `id_${note.diseaseId}`);
        return note;
    }));

    ipcMain.handle('diseases:notes-delete', ensureAuthenticated(async (_, id) => {
        const session = getSession();
        const deleted = await DiseaseService.deleteNote(id, session.user.id);
        logAudit('DISEASE_NOTE_DELETED', { noteId: id });
        CacheService.invalidate('diseases', `id_${deleted.diseaseId}`);
        return true;
    }));

    // ============= RAG AI ASSISTANT HANDLERS =============
    const { ragQuery, ragQueryStream, reindexGuidelineEmbeddings } = require('../../services/ragPipelineService.cjs');
    const { schedulePrecompute, triggerPrecompute, getQaCache, QA_TEMPLATES } = require('../../services/ragQaPrecomputeService.cjs');

    // Zod-схема для входных параметров RAG-запроса (Phase 1.2 — compliance fix)
    const RagQueryInputSchema = z.object({
        query: z.string().min(1).max(4000),
        diseaseId: z.number().int().positive(),
        history: z.array(z.object({ q: z.string(), a: z.string() })).optional().default([]),
    });

    ipcMain.handle('rag:get-last', ensureAuthenticated(async (_, { diseaseId }) => {
        const normalizedDiseaseId = Number(diseaseId);
        if (!Number.isFinite(normalizedDiseaseId) || normalizedDiseaseId <= 0) {
            return null;
        }
        return CacheService.get('diseases', getRagLastCacheKey(normalizedDiseaseId));
    }));

    ipcMain.handle('rag:query', ensureAuthenticated(async (_, payload) => {
        try {
            const { query, diseaseId: rawDiseaseId, history } = RagQueryInputSchema.parse({
                ...payload,
                diseaseId: Number(payload?.diseaseId),
            });
            const normalizedDiseaseId = rawDiseaseId;
            const cacheKey = getRagLastCacheKey(normalizedDiseaseId);

            // Храним только последний ответ: новый запрос сбрасывает предыдущий кеш.
            CacheService.invalidate('diseases', cacheKey);

            const result = await ragQuery({ query, diseaseId: normalizedDiseaseId, history: Array.isArray(history) ? history : [] });
            CacheService.set('diseases', cacheKey, {
                query: String(query || ''),
                answer: result.answer || '',
                sources: Array.isArray(result.sources) ? result.sources : [],
                context: result.context || '',
                cachedAt: new Date().toISOString(),
            });
            return { ok: true, ...result };
        } catch (err) {
            logger.error('[RAG] ragQuery error:', err);
            return { ok: false, error: err.message };
        }
    }));

    ipcMain.on('rag:stream', async (event, payload) => {
        // Phase 1.1: auth guard for ipcMain.on (ensureAuthenticated не поддерживает on)
        if (!getSession().isAuthenticated) {
            logger.warn('[RAG] Unauthorized rag:stream attempt');
            if (!event.sender.isDestroyed()) event.sender.send('rag:error', 'Unauthorized');
            return;
        }
        try {
            const { query, diseaseId: normalizedDiseaseId, history } = RagQueryInputSchema.parse({
                ...payload,
                diseaseId: Number(payload?.diseaseId),
            });
            const cacheKey = getRagLastCacheKey(normalizedDiseaseId);
            let streamedAnswer = '';

            // Храним только последний ответ: новый запрос сбрасывает предыдущий кеш.
            CacheService.invalidate('diseases', cacheKey);

            const { sources, context } = await ragQueryStream({
                query,
                diseaseId: normalizedDiseaseId,
                history: Array.isArray(history) ? history : [],
                onToken: (token) => {
                    streamedAnswer += String(token || '');
                    if (!event.sender.isDestroyed()) event.sender.send('rag:token', token);
                },
            });

            CacheService.set('diseases', cacheKey, {
                query: String(query || ''),
                answer: streamedAnswer.trim(),
                sources: Array.isArray(sources) ? sources : [],
                context: context || '',
                cachedAt: new Date().toISOString(),
            });

            if (!event.sender.isDestroyed()) event.sender.send('rag:done', { sources, context });
        } catch (err) {
            logger.error('[RAG] ragQueryStream error:', err);
            if (!event.sender.isDestroyed()) event.sender.send('rag:error', err.message);
        }
    });

    ipcMain.handle('rag:reindex', ensureAuthenticated(async (event, { diseaseId }) => {
        try {
            const normalizedDiseaseId = Number(diseaseId);
            const result = await reindexGuidelineEmbeddings(normalizedDiseaseId, (done, total) => {
                if (!event.sender.isDestroyed()) event.sender.send('rag:reindex:progress', { done, total });
            });
            CacheService.invalidate('diseases', getRagLastCacheKey(normalizedDiseaseId));
            return { ok: true, ...result };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }));

    ipcMain.handle('rag:qa:list', ensureAuthenticated(async (_, { diseaseId }) => {
        try {
            const normalizedDiseaseId = Number(diseaseId);
            if (!Number.isFinite(normalizedDiseaseId) || normalizedDiseaseId <= 0) return [];
            return await getQaCache(normalizedDiseaseId);
        } catch (err) {
            logger.error('[RAG] rag:qa:list error:', err);
            return [];
        }
    }));

    ipcMain.handle('rag:qa:trigger', ensureAuthenticated(async (_, { diseaseId }) => {
        try {
            const normalizedDiseaseId = Number(diseaseId);
            if (!Number.isFinite(normalizedDiseaseId) || normalizedDiseaseId <= 0) return { ok: false };
            await triggerPrecompute(normalizedDiseaseId);
            return { ok: true };
        } catch (err) {
            logger.error('[RAG] rag:qa:trigger error:', err);
            return { ok: false, error: err.message };
        }
    }));

    ipcMain.handle('rag:qa:templates', ensureAuthenticated(async () => {
        return QA_TEMPLATES;
    }));

    ipcMain.handle('rag:qa:compute-single', ensureAuthenticated(async (_, { diseaseId, templateId }) => {
        try {
            const entry = await computeQaCacheEntry(diseaseId, templateId);
            return entry;
        } catch (err) {
            logger.error('[RAG] rag:qa:compute-single error:', err);
            return null;
        }
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

            const catalogEntries = await DiseaseService.loadDiagnosticTestCatalog();
            diseaseData = normalizeDiseaseData(diseaseData, catalogEntries);

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
