import { PatientAllergy } from '../types';
import { PatientAllergySchema } from '../validators/patientAllergy.validator';
import { logger } from './logger';

export const patientAllergyService = {
    async listByChild(childId: number): Promise<PatientAllergy[]> {
        try {
            return await window.electronAPI.getPatientAllergies(childId);
        } catch (error) {
            logger.error('[PatientAllergyService] Failed to fetch allergies', { error, childId });
            throw error;
        }
    },

    async create(allergy: PatientAllergy): Promise<PatientAllergy> {
        const validation = PatientAllergySchema.safeParse(allergy);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.createPatientAllergy(validation.data as PatientAllergy);
        } catch (error: any) {
            logger.error('[PatientAllergyService] Failed to create allergy', { error, allergy });
            throw new Error(error.message || 'Ошибка при создании аллергии');
        }
    },

    async update(id: number, updates: Partial<PatientAllergy>): Promise<PatientAllergy> {
        const validation = PatientAllergySchema.partial().safeParse(updates);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.updatePatientAllergy(id, validation.data);
        } catch (error: any) {
            logger.error('[PatientAllergyService] Failed to update allergy', { error, id, updates });
            throw new Error(error.message || 'Ошибка при обновлении аллергии');
        }
    },

    async delete(id: number): Promise<boolean> {
        try {
            return await window.electronAPI.deletePatientAllergy(id);
        } catch (error) {
            logger.error('[PatientAllergyService] Failed to delete allergy', { error, id });
            throw error;
        }
    }
};
