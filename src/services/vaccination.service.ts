import {
    ChildProfile,
    VaccinationProfile,
    UserVaccineRecord,
    AugmentedVaccine,
    VaccineDefinition,
    VaccineStatus
} from '../types';
import { VACCINE_SCHEDULE } from '../constants';
import { calculateVaccineSchedule } from '../logic/vax';
import { VaccinationProfileSchema } from '../validators/vaccination.validator';
import { UserVaccineRecordSchema } from '../validators/record.validator';

/**
 * VACCINATION SERVICE
 * 
 * Centralized logic for vaccination profiles, records and schedule calculations.
 */
export const vaccinationService = {
    /**
     * Fetch vaccination profile for a child
     */
    async getProfile(childId: number): Promise<VaccinationProfile> {
        try {
            return await window.electronAPI.getVaccinationProfile(childId);
        } catch (error) {
            console.error(`Service error: Failed to get profile for child ${childId}`, error);
            throw error;
        }
    },

    /**
     * Update vaccination profile
     */
    async updateProfile(profile: VaccinationProfile): Promise<boolean> {
        // Validate profile using Zod
        const validation = VaccinationProfileSchema.safeParse(profile);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации профиля: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.updateVaccinationProfile(validation.data as VaccinationProfile);
        } catch (error: any) {
            console.error('Service error: Failed to update profile', error);
            throw new Error(error.message || 'Ошибка при сохранении профиля');
        }
    },

    /**
     * Fetch all vaccination records for a child
     */
    async getRecords(childId: number): Promise<UserVaccineRecord[]> {
        try {
            return await window.electronAPI.getRecords(childId);
        } catch (error) {
            console.error(`Service error: Failed to get records for child ${childId}`, error);
            throw error;
        }
    },

    /**
     * Save a vaccination record
     */
    async saveRecord(record: UserVaccineRecord): Promise<boolean> {
        // Validate record using Zod
        const validation = UserVaccineRecordSchema.safeParse(record);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join('\n');
            throw new Error(errorMsg);
        }

        try {
            return await window.electronAPI.saveRecord(validation.data as UserVaccineRecord);
        } catch (error: any) {
            console.error('Service error: Failed to save record', error);
            throw new Error(error.message || 'Ошибка при сохранении записи');
        }
    },

    /**
     * Delete a vaccination record
     */
    async deleteRecord(childId: number, vaccineId: string): Promise<boolean> {
        try {
            return await window.electronAPI.deleteRecord(childId, vaccineId);
        } catch (error) {
            console.error(`Service error: Failed to delete record ${vaccineId}`, error);
            throw error;
        }
    },

    /**
     * Calculate full augmented schedule
     */
    calculateSchedule(
        child: ChildProfile,
        profile: VaccinationProfile,
        records: UserVaccineRecord[],
        customVaccines: VaccineDefinition[] = []
    ): AugmentedVaccine[] {
        const allDefinitions = [...VACCINE_SCHEDULE, ...customVaccines];
        return calculateVaccineSchedule(child, profile, records, allDefinitions);
    },

    /**
     * Get summary statistics from schedule
     */
    getStats(schedule: AugmentedVaccine[]) {
        const total = schedule.length;
        const done = schedule.filter(x => x.status === VaccineStatus.COMPLETED).length;
        const overdue = schedule.filter(x => x.status === VaccineStatus.OVERDUE).length;
        const due = schedule.filter(x => x.status === VaccineStatus.DUE_NOW).length;
        return { total, done, overdue, due };
    }
};
