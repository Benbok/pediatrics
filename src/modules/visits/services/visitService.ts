import { Visit, DiagnosisSuggestion, MedicationRecommendation } from '../../../types';
import { VisitSchema, AnalyzeVisitSchema } from '../../../validators/visit.validator';
import { logger } from '../../../services/logger';

export const visitService = {
    /**
     * Fetch all visits for a specific child
     */
    async getVisits(childId: number): Promise<Visit[]> {
        try {
            return await window.electronAPI.getVisits(childId);
        } catch (error) {
            logger.error('[VisitService] Failed to fetch visits', { error, childId });
            throw error;
        }
    },

    /**
     * Fetch a single visit by ID
     */
    async getVisit(id: number): Promise<Visit> {
        try {
            return await window.electronAPI.getVisit(id);
        } catch (error) {
            logger.error('[VisitService] Failed to fetch visit details', { error, visitId: id });
            throw error;
        }
    },

    /**
     * Create or update a visit
     */
    async upsertVisit(data: Visit): Promise<Visit> {
        // Validate data using Zod
        const validation = VisitSchema.safeParse(data);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.upsertVisit(validation.data as Visit);
        } catch (error: any) {
            logger.error('[VisitService] Failed to save visit', { error, visitData: data });
            throw new Error(error.message || 'Ошибка при сохранении посещения');
        }
    },

    /**
     * Delete a visit
     */
    async deleteVisit(id: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteVisit(id);
        } catch (error) {
            logger.error('[VisitService] Failed to delete visit', { error, visitId: id });
            throw error;
        }
    },

    /**
     * Analyze visit complaints for CDSS suggestions
     */
    async analyzeVisit(visitId: number): Promise<DiagnosisSuggestion[]> {
        // Validate visitId
        const validation = AnalyzeVisitSchema.safeParse({ visitId });
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.analyzeVisit(validation.data.visitId);
        } catch (error: any) {
            logger.error('[VisitService] Visit analysis failed', { error, visitId });
            throw new Error(error.message || 'Ошибка при анализе посещения');
        }
    },

    /**
     * Get medications for a specific diagnosis with calculated doses
     */
    async getMedicationsForDiagnosis(diseaseId: number, childId: number): Promise<MedicationRecommendation[]> {
        // Validate IDs
        if (!diseaseId || diseaseId < 1) {
            throw new Error('ID заболевания должен быть больше 0');
        }
        if (!childId || childId < 1) {
            throw new Error('ID пациента должен быть больше 0');
        }

        try {
            return await window.electronAPI.getMedicationsForDiagnosis({ diseaseId, childId });
        } catch (error: any) {
            logger.error('[VisitService] Failed to get medications for diagnosis', { error, diseaseId, childId });
            throw new Error(error.message || 'Ошибка при получении препаратов для диагноза');
        }
    },

    /**
     * Check if medication is already in prescriptions list
     * Business logic helper - validates duplicate medications
     */
    checkDuplicateMedication(prescriptions: any[], medicationId: number): { isDuplicate: boolean; errorMessage?: string } {
        if (!prescriptions || !Array.isArray(prescriptions)) {
            return { isDuplicate: false };
        }

        const existing = prescriptions.find((p: any) => p.medicationId === medicationId);
        
        if (existing) {
            return {
                isDuplicate: true,
                errorMessage: `Препарат уже добавлен в назначения`
            };
        }

        return { isDuplicate: false };
    }
};
