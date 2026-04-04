const { ipcMain } = require('electron');
const { MedicationService } = require('./service.cjs');
const { ensureAuthenticated, getCurrentUser } = require('../../auth.cjs');
const { logAudit, logger } = require('../../logger.cjs');
const { CacheService } = require('../../services/cacheService.cjs');
const { parseVidalWithAI } = require('./vidalParser.cjs');
const { MedicationValidator } = require('./validator.cjs');
const { normalizeMedicationRoutes } = require('../../utils/routeOfAdmin.cjs');
const https = require('https');

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
    ipcMain.handle('medications:list-paginated', ensureAuthenticated(async (_, params = {}) => {
        const page = Number(params.page) > 0 ? Number(params.page) : 1;
        const pageSize = Number(params.pageSize) > 0 ? Number(params.pageSize) : 60;
        const search = typeof params.search === 'string' ? params.search.trim() : '';
        const group = typeof params.group === 'string' ? params.group.trim() : '';
        const formType = typeof params.formType === 'string' ? params.formType.trim() : '';
        const favoritesOnly = Boolean(params.favoritesOnly);

        const cacheKey = `page_${page}_size_${pageSize}_q_${search}_group_${group}_form_${formType}_fav_${favoritesOnly}`;
        const cached = CacheService.get('medications', cacheKey);
        if (cached) {
            return cached;
        }

        const result = await MedicationService.listPaginated({
            page,
            pageSize,
            search,
            group,
            formType,
            favoritesOnly,
        });

        CacheService.set('medications', cacheKey, result);
        return result;
    }));

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
            indications: safeJsonParse(m.indications, []),
            userTags: safeJsonParse(m.userTags, [])
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

        // getById уже возвращает распарсенные JSON-поля, не нужно парсить повторно
        // Сохраняем в кеш
        CacheService.set('medications', cacheKey, med);
        
        return med;
    }));

    ipcMain.handle('medications:upsert', ensureAuthenticated(async (event, data, source = 'manual') => {
        try {
            const user = getCurrentUser(event);
            const userId = user ? user.id : null;
            
            const result = await MedicationService.upsert(data, userId, source);
            logAudit(data.id ? 'MEDICATION_UPDATED' : 'MEDICATION_CREATED', { name: result.nameRu });

            // Инвалидируем весь namespace medications (all, id_*, disease_*)
            CacheService.invalidate('medications');

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

        // Инвалидируем весь namespace (включая all, id_*, disease_*)
        CacheService.invalidate('medications');

        return true;
    }));

    ipcMain.handle('medications:link-disease', ensureAuthenticated(async (_, data) => {
        const result = await MedicationService.linkToDisease(data);
        CacheService.invalidate('medications', `id_${data.medicationId}`);
        return result;
    }));

    ipcMain.handle('medications:unlink-disease', ensureAuthenticated(async (_, diseaseId, medicationId) => {
        const result = await MedicationService.unlinkFromDisease(diseaseId, medicationId);
        logAudit('MEDICATION_DISEASE_UNLINKED', { diseaseId, medicationId });
        CacheService.invalidate('medications', `id_${medicationId}`);
        return result;
    }));

    ipcMain.handle('medications:calculate-dose', ensureAuthenticated(async (_, params) => {
        const { medicationId, weight, ageMonths, height, ruleIndex } = params || {};
        return await MedicationService.calculateDose(medicationId, weight, ageMonths, height ?? null, ruleIndex);
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

    // Проверка дубликата препарата
    ipcMain.handle('medications:checkDuplicate', ensureAuthenticated(async (_, nameRu, excludeId) => {
        try {
            logger.info(`[Medications] Checking duplicate for: ${nameRu}`);
            const duplicate = await MedicationService.checkDuplicate(nameRu, excludeId);
            
            return {
                success: true,
                hasDuplicate: !!duplicate,
                duplicate: duplicate || null
            };
        } catch (error) {
            logger.error(`[Medications] Failed to check duplicate:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }));

    // Импорт из Видаль
    ipcMain.handle('medications:importFromVidal', ensureAuthenticated(async (event, url) => {
        try {
            logger.info(`[Medications] Importing from Vidal: ${url}`);
            
            // Загрузить HTML
            const html = await new Promise((resolve, reject) => {
                https.get(url, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(data));
                }).on('error', reject);
            });
            
            // Парсить с помощью AI
            let medicationData = await parseVidalWithAI(html);
            medicationData.vidalUrl = url;
            medicationData = normalizeMedicationRoutes(medicationData);
            
            // ВАЛИДАЦИЯ ДАННЫХ
            const validator = new MedicationValidator();
            const validation = validator.validate(medicationData);
            
            logger.info(`[Medications] Validation results:`, {
                isValid: validation.isValid,
                errorsCount: validation.errors.length,
                warningsCount: validation.warnings.length
            });
            
            return {
                success: true,
                data: medicationData,
                validation: {
                    isValid: validation.isValid,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    needsReview: validation.needsReview
                }
            };
        } catch (error) {
            logger.error(`[Medications] Failed to import from Vidal:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }));

    // Импорт из JSON
    ipcMain.handle('medications:importFromJson', ensureAuthenticated(async (event, jsonString) => {
        try {
            logger.info(`[Medications] Importing from JSON (length: ${jsonString.length})`);
            
            // Парсинг JSON
            let medicationData;
            try {
                medicationData = JSON.parse(jsonString);
            } catch (parseError) {
                logger.error(`[Medications] JSON parse error:`, parseError);
                return {
                    success: false,
                    error: parseError.message.includes('JSON') 
                        ? 'Неверный формат JSON. Проверьте синтаксис.'
                        : `Ошибка парсинга JSON: ${parseError.message}`
                };
            }
            
            medicationData = normalizeMedicationRoutes(medicationData);

            // Валидация через MedicationValidator
            const validator = new MedicationValidator();
            const validation = validator.validate(medicationData);
            
            logger.info(`[Medications] Validation results:`, {
                isValid: validation.isValid,
                errorsCount: validation.errors.length,
                warningsCount: validation.warnings.length
            });
            
            return {
                success: true,
                data: medicationData,
                validation: {
                    isValid: validation.isValid,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    needsReview: validation.needsReview
                }
            };
        } catch (error) {
            logger.error(`[Medications] Failed to import from JSON:`, error);
            return {
                success: false,
                error: error.message || 'Неизвестная ошибка при импорте JSON'
            };
        }
    }));

    // Получить фармакологические группы
    ipcMain.handle('medications:getPharmacologicalGroups', ensureAuthenticated(async () => {
        const cacheKey = 'groups';
        const cached = CacheService.get('medications', cacheKey);
        if (cached) {
            return cached;
        }

        const result = await MedicationService.getPharmacologicalGroups();
        CacheService.set('medications', cacheKey, result);
        return result;
    }));

    // Получить типы форм выпуска
    ipcMain.handle('medications:getFormTypes', ensureAuthenticated(async () => {
        const cacheKey = 'form_types';
        const cached = CacheService.get('medications', cacheKey);
        if (cached) {
            return cached;
        }

        const result = await MedicationService.getFormTypes();
        CacheService.set('medications', cacheKey, result);
        return result;
    }));

    // Поиск по группе
    ipcMain.handle('medications:searchByGroup', ensureAuthenticated(async (_, groupName) => {
        return await MedicationService.searchByGroup(groupName);
    }));

    // Избранное
    ipcMain.handle('medications:toggleFavorite', ensureAuthenticated(async (_, medicationId) => {
        await MedicationService.toggleFavorite(medicationId);
        CacheService.invalidate('medications');
        return true;
    }));

    // Добавить тег
    ipcMain.handle('medications:addTag', ensureAuthenticated(async (_, medicationId, tag) => {
        await MedicationService.addTag(medicationId, tag);
        CacheService.invalidate('medications');
        return true;
    }));

    // История изменений
    ipcMain.handle('medications:getChangeHistory', ensureAuthenticated(async (_, medicationId) => {
        return await MedicationService.getChangeHistory(medicationId);
    }));
};

module.exports = { setupMedicationHandlers };
