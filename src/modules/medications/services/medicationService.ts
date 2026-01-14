import { Medication } from '../../../types';
import { dataEvents } from '../../../services/dataEvents';

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
    async upsertMedication(data: Medication, source: 'manual' | 'vidal_import' = 'manual'): Promise<Medication> {
        try {
            const result = await window.electronAPI.upsertMedication(data, source);
            // Уведомляем об изменении данных для инвалидации кеша
            dataEvents.notifyUpdated('medications', result.id);
            return result;
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
            const result = await window.electronAPI.deleteMedication(id);
            // Уведомляем об удалении для инвалидации кеша
            dataEvents.notifyDeleted('medications', id);
            return result;
        } catch (error) {
            console.error('[MedicationService] Failed to delete medication:', error);
            throw error;
        }
    },

    /**
     * Calculate dosage for child
     */
    async calculateDose(medicationId: number, weight: number, ageMonths: number, height?: number | null): Promise<any> {
        try {
            return await window.electronAPI.calculateDose({ medicationId, weight, ageMonths, height: height || null });
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
    },

    /**
     * Check for duplicate medication by name
     */
    async checkDuplicate(nameRu: string, excludeId?: number): Promise<{
        success: boolean;
        hasDuplicate: boolean;
        duplicate?: Medication | null;
        error?: string;
    }> {
        try {
            return await window.electronAPI.checkDuplicateMedication(nameRu, excludeId);
        } catch (error) {
            console.error('[MedicationService] Failed to check duplicate:', error);
            throw error;
        }
    },

    /**
     * Import medication from Vidal URL
     */
    async importFromVidal(url: string): Promise<{
        success: boolean;
        data?: Medication;
        validation?: {
            isValid: boolean;
            errors: any[];
            warnings: any[];
            needsReview: boolean;
        };
        error?: string;
    }> {
        try {
            return await window.electronAPI.importFromVidal(url);
        } catch (error: any) {
            console.error('[MedicationService] Failed to import from Vidal:', error);
            return {
                success: false,
                error: error.message || 'Не удалось импортировать данные'
            };
        }
    },

    /**
     * Import medication from JSON string
     */
    async importFromJson(jsonString: string): Promise<{
        success: boolean;
        data?: Medication;
        validation?: {
            isValid: boolean;
            errors: any[];
            warnings: any[];
            needsReview: boolean;
        };
        error?: string;
    }> {
        try {
            return await window.electronAPI.importFromJson(jsonString);
        } catch (error: any) {
            console.error('[MedicationService] Failed to import from JSON:', error);
            return {
                success: false,
                error: error.message || 'Не удалось импортировать данные из JSON'
            };
        }
    },

    /**
     * Get all pharmacological groups
     */
    async getPharmacologicalGroups(): Promise<string[]> {
        try {
            return await window.electronAPI.getPharmacologicalGroups();
        } catch (error) {
            console.error('[MedicationService] Failed to get groups:', error);
            throw error;
        }
    },

    /**
     * Search medications by pharmacological group
     */
    async searchByGroup(groupName: string): Promise<Medication[]> {
        try {
            return await window.electronAPI.searchMedicationsByGroup(groupName);
        } catch (error) {
            console.error('[MedicationService] Failed to search by group:', error);
            throw error;
        }
    },

    /**
     * Toggle favorite status
     */
    async toggleFavorite(medicationId: number): Promise<boolean> {
        try {
            const result = await window.electronAPI.toggleMedicationFavorite(medicationId);
            // Уведомляем об изменении для инвалидации кеша
            dataEvents.notifyUpdated('medications', medicationId);
            return result;
        } catch (error) {
            console.error('[MedicationService] Failed to toggle favorite:', error);
            throw error;
        }
    },

    /**
     * Add tag to medication
     */
    async addTag(medicationId: number, tag: string): Promise<boolean> {
        try {
            return await window.electronAPI.addMedicationTag(medicationId, tag);
        } catch (error) {
            console.error('[MedicationService] Failed to add tag:', error);
            throw error;
        }
    },

    /**
     * Get change history for medication
     */
    async getChangeHistory(medicationId: number): Promise<any[]> {
        try {
            return await window.electronAPI.getMedicationChangeHistory(medicationId);
        } catch (error) {
            console.error('[MedicationService] Failed to get change history:', error);
            throw error;
        }
    }
};
