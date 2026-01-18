import { Medication } from '../../../types';
import { dataEvents } from '../../../services/dataEvents';
import { MedicationSchema, CalculateDoseSchema, LinkMedicationToDiseaseSchema } from '../../../validators/medication.validator';
import { logger } from '../../../services/logger';

export const medicationService = {
    /**
     * Fetch all medications
     */
    async getMedications(): Promise<Medication[]> {
        try {
            return await window.electronAPI.getMedications();
        } catch (error) {
            logger.error('[MedicationService] Failed to fetch medications', { error });
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
            logger.error('[MedicationService] Failed to fetch medication details', { error, medicationId: id });
            throw error;
        }
    },

    /**
     * Create or update a medication
     */
    async upsertMedication(data: Medication, source: 'manual' | 'vidal_import' = 'manual'): Promise<Medication> {
        // Validate data using Zod
        const validation = MedicationSchema.safeParse(data);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            const result = await window.electronAPI.upsertMedication(validation.data as Medication, source);
            // Уведомляем об изменении данных для инвалидации кеша
            dataEvents.notifyUpdated('medications', result.id);
            return result;
        } catch (error: any) {
            logger.error('[MedicationService] Failed to save medication', { error, medicationData: data });
            throw new Error(error.message || 'Ошибка при сохранении препарата');
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
            logger.error('[MedicationService] Failed to delete medication', { error, medicationId: id });
            throw error;
        }
    },

    /**
     * Calculate dosage for child
     */
    async calculateDose(medicationId: number, weight: number, ageMonths: number, height?: number | null): Promise<any> {
        // Validate input using Zod
        const validation = CalculateDoseSchema.safeParse({ medicationId, weight, ageMonths, height });
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.calculateDose(validation.data);
        } catch (error: any) {
            logger.error('[MedicationService] Dose calculation failed', { error, medicationId, weight, ageMonths, height });
            throw new Error(error.message || 'Ошибка при расчете дозировки');
        }
    },

    /**
     * Link medication to a disease
     */
    async linkToDisease(data: { diseaseId: number; medicationId: number; priority?: number; dosing?: string; duration?: string }): Promise<any> {
        // Validate input using Zod
        const validation = LinkMedicationToDiseaseSchema.safeParse(data);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.linkMedicationToDisease(validation.data);
        } catch (error: any) {
            logger.error('[MedicationService] Linking to disease failed', { error, linkData: data });
            throw new Error(error.message || 'Ошибка при связи препарата с заболеванием');
        }
    },

    /**
     * Get medications for a specific disease by ICD-10 matching
     */
    async getMedicationsByDisease(diseaseId: number): Promise<Medication[]> {
        try {
            return await window.electronAPI.getMedicationsByDisease(diseaseId);
        } catch (error) {
            logger.error('[MedicationService] Failed to fetch medications for disease', { error, diseaseId });
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
            logger.error('[MedicationService] Failed to check duplicate', { error, nameRu, excludeId });
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
            logger.error('[MedicationService] Failed to import from Vidal', { error, url });
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
            logger.error('[MedicationService] Failed to import from JSON', { error });
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
            logger.error('[MedicationService] Failed to get groups', { error });
            throw error;
        }
    },

    /**
     * Get all form types
     */
    async getFormTypes(): Promise<string[]> {
        try {
            return await window.electronAPI.getFormTypes();
        } catch (error) {
            logger.error('[MedicationService] Failed to get form types', { error });
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
            logger.error('[MedicationService] Failed to search by group', { error, groupName });
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
            logger.error('[MedicationService] Failed to toggle favorite', { error, medicationId });
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
            logger.error('[MedicationService] Failed to add tag', { error, medicationId, tag });
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
            logger.error('[MedicationService] Failed to get change history', { error, medicationId });
            throw error;
        }
    }
};
