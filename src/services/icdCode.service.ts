import { IcdCode, IcdCodeSearchParams, IcdCodeSearchResult } from '../types';

export const icdCodeService = {
    /**
     * Загрузка данных МКБ (вызывается при старте модуля)
     */
    async loadCodes(): Promise<{ success: boolean; count: number }> {
        try {
            return await window.electronAPI.loadIcdCodes();
        } catch (error) {
            console.error('[IcdCodeService] Failed to load ICD codes:', error);
            throw error;
        }
    },

    /**
     * Получение кода МКБ по точному совпадению кода
     */
    async getByCode(code: string): Promise<IcdCode | null> {
        try {
            if (!code || typeof code !== 'string') {
                return null;
            }
            return await window.electronAPI.getIcdCodeByCode(code);
        } catch (error) {
            console.error('[IcdCodeService] Failed to get ICD code:', error);
            throw error;
        }
    },

    /**
     * Поиск по коду или названию
     */
    async searchCodes(params: IcdCodeSearchParams): Promise<IcdCodeSearchResult> {
        try {
            return await window.electronAPI.searchIcdCodes(params);
        } catch (error) {
            console.error('[IcdCodeService] Failed to search ICD codes:', error);
            throw error;
        }
    },

    /**
     * Получение кодов по категории (A-Z)
     */
    async getCodesByCategory(category: string, limit?: number, offset?: number): Promise<IcdCodeSearchResult> {
        try {
            return await window.electronAPI.getIcdCodesByCategory({ category, limit, offset });
        } catch (error) {
            console.error('[IcdCodeService] Failed to get ICD codes by category:', error);
            throw error;
        }
    },

    /**
     * Получение всех кодов с пагинацией
     */
    async getAllCodes(limit?: number, offset?: number): Promise<IcdCodeSearchResult> {
        try {
            return await window.electronAPI.getAllIcdCodes({ limit, offset });
        } catch (error) {
            console.error('[IcdCodeService] Failed to get all ICD codes:', error);
            throw error;
        }
    },

    /**
     * Получение списка всех доступных категорий
     */
    async getCategories(): Promise<string[]> {
        try {
            return await window.electronAPI.getIcdCategories();
        } catch (error) {
            console.error('[IcdCodeService] Failed to get ICD categories:', error);
            throw error;
        }
    }
};
