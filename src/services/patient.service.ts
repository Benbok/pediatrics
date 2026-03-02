import { ChildProfile } from '../types';
import { ChildProfileSchema } from '../validators/child.validator';
import { getFormattedAge } from '../utils/ageUtils';
import { dataEvents } from './dataEvents';
import { logger } from './logger';

/**
 * PATIENT SERVICE
 * 
 * Centralized logic for patient management.
 * Interfaces with electronAPI and handles validation.
 * Автоматическая инвалидация кеша через dataEvents.
 */
export const patientService = {
    /**
     * Fetch all children from database
     */
    async getAllChildren(): Promise<ChildProfile[]> {
        try {
            return await window.electronAPI.getChildren();
        } catch (error) {
            logger.error('Service error: Failed to fetch children', { error });
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
            logger.error(`Service error: Failed to fetch child ${id}`, { error, childId: id });
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
            const result = await window.electronAPI.createChild(validation.data as ChildProfile);
            // Уведомляем о создании для инвалидации кеша
            dataEvents.notifyCreated('patients', result.id);
            return result;
        } catch (error: any) {
            logger.error('Service error: Failed to create child', { error, data });
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
            const result = await window.electronAPI.updateChild(id, validation.data);
            // Уведомляем об обновлении для инвалидации кеша
            dataEvents.notifyUpdated('patients', id);
            return result;
        } catch (error: any) {
            logger.error(`Service error: Failed to update child ${id}`, { error, childId: id, updates });
            throw new Error(error.message || 'Ошибка при обновлении данных пациента');
        }
    },

    /**
     * Delete a child profile
     */
    async deleteChild(id: number): Promise<boolean> {
        try {
            const result = await window.electronAPI.deleteChild(id);
            // Уведомляем об удалении для инвалидации кеша
            dataEvents.notifyDeleted('patients', id);
            return result;
        } catch (error) {
            logger.error(`Service error: Failed to delete child ${id}`, { error, childId: id });
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
     * Returns formatted age as "X лет Y месяцев" (e.g., "2 года 3 месяца")
     *
     * @param birthDate - Дата рождения
     * @returns Отформатированная строка возраста (полный формат)
     */
    getAgeLabel(birthDate: string): string {
        return getFormattedAge(birthDate, new Date(), 'full');
    }
};
