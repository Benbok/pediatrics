import { Disease, ClinicalGuideline, GuidelinePlan, CategorizedSymptom, SymptomCategory } from '../../../types';
import { dataEvents } from '../../../services/dataEvents';

/**
 * Сервис для работы с заболеваниями
 * Использует backend кеширование через IPC
 * Frontend кеширование через DataCacheContext (используется в компонентах)
 * Автоматическая инвалидация кеша через dataEvents
 */
const safeJsonParse = <T>(value: any, fallback: T): T => {
    if (value === null || value === undefined) return fallback;
    if (Array.isArray(value)) return value as T;
    if (typeof value !== 'string') return fallback;
    if (value.trim() === '') return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
};

export function parseSymptoms(symptoms: any): CategorizedSymptom[] {
    const parsed = Array.isArray(symptoms) ? symptoms : safeJsonParse<any[]>(symptoms, []);
    if (parsed.length === 0) return [];
    if (typeof parsed[0] === 'string') {
        return parsed.map((text: string) => ({ text: String(text).trim(), category: 'other' as SymptomCategory }));
    }
    return parsed.map((s: any) => ({
        text: (s && s.text) ? String(s.text).trim() : '',
        category: (s && s.category && ['clinical', 'physical', 'other'].includes(s.category)) ? s.category as SymptomCategory : 'other' as SymptomCategory
    })).filter((s: CategorizedSymptom) => s.text.length > 0);
}

const normalizeDisease = <T extends Disease>(data: T): T => {
    return {
        ...data,
        icd10Codes: Array.isArray(data.icd10Codes) ? data.icd10Codes : safeJsonParse<string[]>(data.icd10Codes, []),
        symptoms: parseSymptoms(data.symptoms),
        diagnosticPlan: Array.isArray(data.diagnosticPlan) ? data.diagnosticPlan : safeJsonParse<any[]>(data.diagnosticPlan as any, []),
        treatmentPlan: Array.isArray(data.treatmentPlan) ? data.treatmentPlan : safeJsonParse<any[]>(data.treatmentPlan as any, []),
        differentialDiagnosis: Array.isArray(data.differentialDiagnosis) ? data.differentialDiagnosis : safeJsonParse<string[]>(data.differentialDiagnosis as any, []),
        redFlags: Array.isArray(data.redFlags) ? data.redFlags : safeJsonParse<string[]>(data.redFlags as any, [])
    };
};

export const diseaseService = {
    /**
     * Fetch all diseases
     */
    async getDiseases(): Promise<Disease[]> {
        try {
            const data = await window.electronAPI.getDiseases();
            return data.map(disease => normalizeDisease(disease));
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
            const data = await window.electronAPI.getDisease(id);
            return data ? normalizeDisease(data) : data;
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
            const result = await window.electronAPI.upsertDisease(data);
            // Уведомляем об изменении для инвалидации кеша
            dataEvents.notifyUpdated('diseases', result.id);
            return result;
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
            const result = await window.electronAPI.deleteDisease(id);
            // Уведомляем об удалении для инвалидации кеша
            dataEvents.notifyDeleted('diseases', id);
            return result;
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
     * Update a guideline (rename)
     */
    async updateGuideline(guidelineId: number, title: string): Promise<ClinicalGuideline> {
        try {
            return await window.electronAPI.updateGuideline(guidelineId, { title });
        } catch (error) {
            console.error('[DiseaseService] Failed to update guideline:', error);
            throw error;
        }
    },

    /**
     * Delete a guideline
     */
    async deleteGuideline(guidelineId: number): Promise<boolean> {
        try {
            const result = await window.electronAPI.deleteGuideline(guidelineId);
            // Уведомляем об изменении для инвалидации кеша diseases (guideline - часть disease)
            dataEvents.notifyUpdated('diseases');
            return result;
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
    },

    /**
     * Get normalized guideline plan for a disease
     */
    async getGuidelinePlan(diseaseId: number): Promise<GuidelinePlan> {
        try {
            return await window.electronAPI.getGuidelinePlan(diseaseId);
        } catch (error) {
            console.error('[DiseaseService] Failed to fetch guideline plan:', error);
            throw error;
        }
    },

    /**
     * Import disease from JSON string
     */
    async importFromJson(jsonString: string): Promise<{
        success: boolean;
        data?: Disease;
        validation?: {
            isValid: boolean;
            errors: any[];
            warnings: any[];
            needsReview: boolean;
        };
        error?: string;
    }> {
        try {
            const result = await window.electronAPI.importDiseaseFromJson(jsonString);
            if (result?.data) {
                result.data = normalizeDisease(result.data);
            }
            return result;
        } catch (error: any) {
            console.error('[DiseaseService] Failed to import from JSON', { error });
            return {
                success: false,
                error: error.message || 'Не удалось импортировать данные из JSON'
            };
        }
    }
};
