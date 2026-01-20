import { InformedConsent } from '../../../types';
import { logger } from '../../../services/logger';

export const informedConsentService = {
    /**
     * Получить согласие по ID
     */
    async getById(id: number): Promise<InformedConsent | null> {
        try {
            return await window.electronAPI.getInformedConsent(id);
        } catch (error) {
            logger.error('[InformedConsentService] Failed to get consent:', error);
            throw error;
        }
    },

    /**
     * Получить согласие по ID визита
     */
    async getByVisitId(visitId: number): Promise<InformedConsent | null> {
        try {
            return await window.electronAPI.getInformedConsentByVisitId(visitId);
        } catch (error) {
            logger.error('[InformedConsentService] Failed to get consent by visit ID:', error);
            throw error;
        }
    },

    /**
     * Получить историю согласий для ребенка
     */
    async getHistoryForChild(childId: number): Promise<InformedConsent[]> {
        try {
            return await window.electronAPI.getInformedConsentHistory(childId);
        } catch (error) {
            logger.error('[InformedConsentService] Failed to get consent history:', error);
            throw error;
        }
    },

    /**
     * Создать или обновить согласие
     */
    async upsert(data: Partial<InformedConsent>): Promise<InformedConsent> {
        try {
            return await window.electronAPI.upsertInformedConsent(data);
        } catch (error: any) {
            logger.error('[InformedConsentService] Failed to save consent:', error);
            throw new Error(error.message || 'Ошибка при сохранении согласия');
        }
    },

    /**
     * Удалить согласие
     */
    async delete(id: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteInformedConsent(id);
        } catch (error) {
            logger.error('[InformedConsentService] Failed to delete consent:', error);
            throw error;
        }
    },

    /**
     * Получить шаблон согласия для типа вмешательства
     */
    async getTemplate(interventionType: string): Promise<any> {
        try {
            return await window.electronAPI.getInformedConsentTemplate(interventionType);
        } catch (error) {
            logger.error('[InformedConsentService] Failed to get template:', error);
            throw error;
        }
    },

    /**
     * Проверить необходимость нового согласия
     */
    async needsNewConsent(childId: number, interventionDescription: string): Promise<boolean> {
        try {
            return await window.electronAPI.needsNewInformedConsent({ childId, interventionDescription });
        } catch (error) {
            logger.error('[InformedConsentService] Failed to check consent need:', error);
            throw error;
        }
    }
};
