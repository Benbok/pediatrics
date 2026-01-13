import { Medication } from '../../../types';

export const medicationService = {
    /**
     * Fetch all medications
     */
    async getMedications(): Promise<Medication[]> {
        try {
            return await window.electronAPI.getMedications();
        } catch (error) {
            console.error('[MedicationService] Failed to fetch medications:', error);
            throw error;
        }
    },

    /**
     * Fetch a single medication by ID
     */
    async getMedication(id: number): Promise<Medication & { diseases: any[] }> {
        try {
            return await window.electronAPI.getMedication(id);
        } catch (error) {
            console.error('[MedicationService] Failed to fetch medication details:', error);
            throw error;
        }
    },

    /**
     * Create or update a medication
     */
    async upsertMedication(data: Medication): Promise<Medication> {
        try {
            return await window.electronAPI.upsertMedication(data);
        } catch (error) {
            console.error('[MedicationService] Failed to save medication:', error);
            throw error;
        }
    },

    /**
     * Delete a medication
     */
    async deleteMedication(id: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteMedication(id);
        } catch (error) {
            console.error('[MedicationService] Failed to delete medication:', error);
            throw error;
        }
    },

    /**
     * Calculate dosage for child
     */
    async calculateDose(medicationId: number, weight: number, ageMonths: number): Promise<any> {
        try {
            return await window.electronAPI.calculateDose({ medicationId, weight, ageMonths });
        } catch (error) {
            console.error('[MedicationService] Dose calculation failed:', error);
            throw error;
        }
    },

    /**
     * Link medication to a disease
     */
    async linkToDisease(data: { diseaseId: number; medicationId: number; priority?: number; dosing?: string; duration?: string }): Promise<any> {
        try {
            return await window.electronAPI.linkMedicationToDisease(data);
        } catch (error) {
            console.error('[MedicationService] Linking to disease failed:', error);
            throw error;
        }
    },

    /**
     * Get medications for a specific disease by ICD-10 matching
     */
    async getMedicationsByDisease(diseaseId: number): Promise<Medication[]> {
        try {
            return await window.electronAPI.getMedicationsByDisease(diseaseId);
        } catch (error) {
            console.error('[MedicationService] Failed to fetch medications for disease:', error);
            throw error;
        }
    }
};
