import { Visit, DiagnosisSuggestion, MedicationRecommendation } from '../../../types';

export const visitService = {
    /**
     * Fetch all visits for a specific child
     */
    async getVisits(childId: number): Promise<Visit[]> {
        try {
            return await window.electronAPI.getVisits(childId);
        } catch (error) {
            console.error('[VisitService] Failed to fetch visits:', error);
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
            console.error('[VisitService] Failed to fetch visit details:', error);
            throw error;
        }
    },

    /**
     * Create or update a visit
     */
    async upsertVisit(data: Visit): Promise<Visit> {
        try {
            return await window.electronAPI.upsertVisit(data);
        } catch (error) {
            console.error('[VisitService] Failed to save visit:', error);
            throw error;
        }
    },

    /**
     * Delete a visit
     */
    async deleteVisit(id: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteVisit(id);
        } catch (error) {
            console.error('[VisitService] Failed to delete visit:', error);
            throw error;
        }
    },

    /**
     * Analyze visit complaints for CDSS suggestions
     */
    async analyzeVisit(visitId: number): Promise<DiagnosisSuggestion[]> {
        try {
            return await window.electronAPI.analyzeVisit(visitId);
        } catch (error) {
            console.error('[VisitService] Visit analysis failed:', error);
            throw error;
        }
    },

    /**
     * Get medications for a specific diagnosis with calculated doses
     */
    async getMedicationsForDiagnosis(diseaseId: number, childId: number): Promise<MedicationRecommendation[]> {
        try {
            return await window.electronAPI.getMedicationsForDiagnosis({ diseaseId, childId });
        } catch (error) {
            console.error('[VisitService] Failed to get medications for diagnosis:', error);
            throw error;
        }
    }
};
