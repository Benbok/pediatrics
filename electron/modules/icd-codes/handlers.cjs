const { ipcMain } = require('electron');
const { IcdCodeService } = require('./service.cjs');
const { ensureAuthenticated } = require('../../auth.cjs');

const setupIcdCodeHandlers = () => {
    /**
     * Загрузка данных МКБ (вызывается при старте или по требованию)
     */
    ipcMain.handle('icd-codes:load', ensureAuthenticated(async () => {
        try {
            await IcdCodeService.load();
            return { success: true, count: IcdCodeService.codes.length };
        } catch (error) {
            throw new Error(`Failed to load ICD codes: ${error.message}`);
        }
    }));

    /**
     * Получение кода МКБ по точному совпадению кода
     * КРИТИЧНО для интеграции с PDF парсингом
     */
    ipcMain.handle('icd-codes:get-by-code', ensureAuthenticated(async (_, code) => {
        try {
            if (!code || typeof code !== 'string') {
                return null;
            }
            return await IcdCodeService.getByCode(code);
        } catch (error) {
            throw new Error(`Failed to get ICD code: ${error.message}`);
        }
    }));

    /**
     * Поиск по коду или названию
     */
    ipcMain.handle('icd-codes:search', ensureAuthenticated(async (_, params) => {
        try {
            const { query, limit = 100, offset = 0 } = params || {};
            return await IcdCodeService.search(query, limit, offset);
        } catch (error) {
            throw new Error(`Failed to search ICD codes: ${error.message}`);
        }
    }));

    /**
     * Получение кодов по категории (A-Z)
     */
    ipcMain.handle('icd-codes:get-by-category', ensureAuthenticated(async (_, params) => {
        try {
            const { category, limit = 100, offset = 0 } = params || {};
            if (!category) {
                return { results: [], total: 0, limit, offset };
            }
            return await IcdCodeService.getByCategory(category, limit, offset);
        } catch (error) {
            throw new Error(`Failed to get ICD codes by category: ${error.message}`);
        }
    }));

    /**
     * Получение всех кодов с пагинацией
     */
    ipcMain.handle('icd-codes:get-all', ensureAuthenticated(async (_, params) => {
        try {
            const { limit = 100, offset = 0 } = params || {};
            return await IcdCodeService.getAll(limit, offset);
        } catch (error) {
            throw new Error(`Failed to get all ICD codes: ${error.message}`);
        }
    }));

    /**
     * Получение списка всех доступных категорий
     */
    ipcMain.handle('icd-codes:get-categories', ensureAuthenticated(async () => {
        try {
            return await IcdCodeService.getCategories();
        } catch (error) {
            throw new Error(`Failed to get ICD categories: ${error.message}`);
        }
    }));
};

module.exports = { setupIcdCodeHandlers };
