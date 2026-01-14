import { Disease, ClinicalGuideline } from '../../../types';

/**
 * Сервис для работы с заболеваниями
 * Использует backend кеширование через IPC
 * Frontend кеширование через DataCacheContext (используется в компонентах)
 */
export const diseaseService = {
    /**
     * Fetch all diseases
     */
    async getDiseases(): Promise<Disease[]> {
        try {
            return await window.electronAPI.getDiseases();
        } catch (error) {
            console.error('[DiseaseService] Failed to fetch diseases:', error);
            throw error;
        }
    },

    /**
     * Fetch a single disease with guidelines
     */
    async getDisease(id: number): Promise<Disease & { guidelines: ClinicalGuideline[] }> {
        try {
            return await window.electronAPI.getDisease(id);
        } catch (error) {
            console.error('[DiseaseService] Failed to fetch disease details:', error);
            throw error;
        }
    },

    /**
     * Create or update a disease
     */
    async upsertDisease(data: Disease): Promise<Disease> {
        try {
            return await window.electronAPI.upsertDisease(data);
        } catch (error) {
            console.error('[DiseaseService] Failed to save disease:', error);
            throw error;
        }
    },

    /**
     * Delete a disease
     */
    async deleteDisease(id: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteDisease(id);
        } catch (error) {
            console.error('[DiseaseService] Failed to delete disease:', error);
            throw error;
        }
    },

    /**
     * Upload and parse a clinical guideline PDF
     */
    async uploadGuideline(diseaseId: number, pdfPath: string): Promise<ClinicalGuideline> {
        try {
            return await window.electronAPI.uploadGuideline(diseaseId, pdfPath);
        } catch (error) {
            console.error('[DiseaseService] Failed to upload guideline:', error);
            throw error;
        }
    },

    /**
     * Upload multiple guidelines at once
     */
    async uploadGuidelinesBatch(diseaseId: number, pdfPaths: string[]): Promise<{ success: ClinicalGuideline[]; errors: Array<{ path: string; error: string }> | null }> {
        try {
            return await window.electronAPI.uploadGuidelinesBatch(diseaseId, pdfPaths);
        } catch (error) {
            console.error('[DiseaseService] Failed to upload guidelines batch:', error);
            throw error;
        }
    },

    /**
     * Delete a guideline
     */
    async deleteGuideline(guidelineId: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteGuideline(guidelineId);
        } catch (error) {
            console.error('[DiseaseService] Failed to delete guideline:', error);
            throw error;
        }
    },

    /**
     * Search for diseases based on symptoms
     */
    async searchBySymptoms(symptoms: string[]): Promise<Disease[]> {
        try {
            return await window.electronAPI.searchDiseases(symptoms);
        } catch (error) {
            console.error('[DiseaseService] Search failed:', error);
            throw error;
        }
    }
};
