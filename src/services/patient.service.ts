import { ChildProfile } from '../types';
import { ChildProfileSchema } from '../validators/child.validator';
import { getFormattedAge } from '../utils/ageUtils';

/**
 * PATIENT SERVICE
 * 
 * Centralized logic for patient management.
 * Interfaces with electronAPI and handles validation.
 */
export const patientService = {
    /**
     * Fetch all children from database
     */
    async getAllChildren(): Promise<ChildProfile[]> {
        try {
            return await window.electronAPI.getChildren();
        } catch (error) {
            console.error('Service error: Failed to fetch children', error);
            throw error;
        }
    },

    /**
     * Fetch a single child by ID
     */
    async getChildById(id: number): Promise<ChildProfile | null> {
        try {
            return await window.electronAPI.getChild(id);
        } catch (error) {
            console.error(`Service error: Failed to fetch child ${id}`, error);
            return null;
        }
    },

    /**
     * Create a new child profile
     */
    async createChild(data: Partial<ChildProfile>): Promise<ChildProfile> {
        // Validate data using Zod
        const validation = ChildProfileSchema.safeParse(data);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.createChild(validation.data as ChildProfile);
        } catch (error: any) {
            console.error('Service error: Failed to create child', error);
            throw new Error(error.message || 'Ошибка при сохранении данных пациента');
        }
    },

    /**
     * Update an existing child profile
     */
    async updateChild(id: number, updates: Partial<ChildProfile>): Promise<boolean> {
        // Validate partial updates
        const validation = ChildProfileSchema.partial().safeParse(updates);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.updateChild(id, validation.data);
        } catch (error: any) {
            console.error(`Service error: Failed to update child ${id}`, error);
            throw new Error(error.message || 'Ошибка при обновлении данных пациента');
        }
    },

    /**
     * Delete a child profile
     */
    async deleteChild(id: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteChild(id);
        } catch (error) {
            console.error(`Service error: Failed to delete child ${id}`, error);
            throw error;
        }
    },

    /**
     * Format full name helper
     */
    getFullName(child: ChildProfile): string {
        return [child.surname, child.name, child.patronymic].filter(Boolean).join(' ');
    },

    /**
     * Calculate age label helper
     * 
     * @param birthDate - Дата рождения
     * @returns Отформатированная строка возраста
     */
    getAgeLabel(birthDate: string): string {
        return getFormattedAge(birthDate, new Date(), 'short');
    }
};
