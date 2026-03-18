import {
    ChildProfile,
    VaccinationProfile,
    UserVaccineRecord,
    AugmentedVaccine,
    VaccineDefinition,
    VaccineStatus,
    VaccineCatalogEntry,
    VaccinePlanTemplate,
    VaccinePlanDose,
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
    toCatalogEntry(definition: VaccineDefinition): VaccineCatalogEntry {
        return {
            vaccineId: definition.id,
            name: definition.name,
            disease: definition.disease,
            ageMonthStart: definition.ageMonthStart,
            description: definition.description || null,
            requiredRiskFactor: definition.requiredRiskFactor || null,
            excludedRiskFactor: definition.excludedRiskFactor || null,
            isLive: Boolean(definition.isLive),
            isRecommended: Boolean(definition.isRecommended),
            lectureId: definition.lectureId || null,
            availableBrands: definition.availableBrands || [],
            isDeleted: false,
        };
    },

    /**
     * Fetch global vaccine catalog overrides/additions
     */
    async getVaccineCatalog(): Promise<VaccineCatalogEntry[]> {
        try {
            if (!window.electronAPI?.getVaccineCatalog) return [];
            return await window.electronAPI.getVaccineCatalog();
        } catch (error) {
            console.error('Service error: Failed to get vaccine catalog', error);
            return [];
        }
    },

    /**
     * Upsert global vaccine catalog entry
     */
    async upsertVaccineCatalogEntry(entry: VaccineCatalogEntry): Promise<VaccineCatalogEntry> {
        if (!window.electronAPI?.upsertVaccineCatalogEntry) {
            throw new Error('Функция каталога вакцин недоступна');
        }
        return window.electronAPI.upsertVaccineCatalogEntry(entry);
    },

    /**
     * Mark global vaccine catalog entry as deleted/restored
     */
    async setVaccineCatalogEntryDeleted(vaccineId: string, isDeleted: boolean): Promise<VaccineCatalogEntry> {
        if (!window.electronAPI?.setVaccineCatalogEntryDeleted) {
            throw new Error('Функция каталога вакцин недоступна');
        }
        return window.electronAPI.setVaccineCatalogEntryDeleted(vaccineId, isDeleted);
    },

    async getVaccinePlans(): Promise<VaccinePlanTemplate[]> {
        try {
            if (!window.electronAPI?.getVaccinePlans) return [];
            return await window.electronAPI.getVaccinePlans();
        } catch (error) {
            console.error('Service error: Failed to get vaccine plans', error);
            return [];
        }
    },

    async upsertVaccinePlanTemplate(plan: VaccinePlanTemplate): Promise<VaccinePlanTemplate> {
        if (!window.electronAPI?.upsertVaccinePlan) {
            throw new Error('Функция планов вакцинации недоступна');
        }
        return window.electronAPI.upsertVaccinePlan(plan);
    },

    async setVaccinePlanDeleted(planId: string, isDeleted: boolean): Promise<VaccinePlanTemplate> {
        if (!window.electronAPI?.setVaccinePlanDeleted) {
            throw new Error('Функция планов вакцинации недоступна');
        }
        return window.electronAPI.setVaccinePlanDeleted(planId, isDeleted);
    },

    async ensureBaselineCatalogSeeded(forceUpdate = false): Promise<{ inserted: number; updated: number }> {
        const current = await this.getVaccineCatalog();
        const currentById = new Map(current.map((entry) => [entry.vaccineId, entry]));

        let inserted = 0;
        let updated = 0;

        for (const definition of VACCINE_SCHEDULE) {
            const existing = currentById.get(definition.id);
            if (!existing) {
                await this.upsertVaccineCatalogEntry(this.toCatalogEntry(definition));
                inserted += 1;
                continue;
            }

            if (forceUpdate) {
                await this.upsertVaccineCatalogEntry({
                    ...this.toCatalogEntry(definition),
                    vaccineId: definition.id,
                });
                updated += 1;
            }
        }

        return { inserted, updated };
    },

    buildPlanEntries(baseEntry: VaccineCatalogEntry, months: number[]): VaccineCatalogEntry[] {
        const normalized = Array.from(new Set(months.map((value) => Number(value))))
            .filter((value) => Number.isFinite(value) && value >= 0 && value <= 240)
            .sort((a, b) => a - b);

        if (!normalized.length) {
            return [baseEntry];
        }

        if (normalized.length === 1) {
            return [{
                ...baseEntry,
                ageMonthStart: normalized[0],
            }];
        }

        return normalized.map((ageMonthStart, index) => ({
            ...baseEntry,
            vaccineId: `${baseEntry.vaccineId}-${index + 1}`,
            name: `${baseEntry.name} (доза ${index + 1})`,
            ageMonthStart,
        }));
    },

    async upsertVaccinePlan(baseEntry: VaccineCatalogEntry, months: number[], intervalsDays: number[] = []): Promise<VaccineCatalogEntry[]> {
        const normalizedMonths = Array.from(new Set(months.map((value) => Number(value))))
            .filter((value) => Number.isFinite(value) && value >= 0 && value <= 240)
            .sort((a, b) => a - b);

        const normalizedIntervals = intervalsDays.map((value) => Number(value));

        const doses: VaccinePlanDose[] = normalizedMonths.map((ageMonthStart, index) => ({
            ageMonthStart,
            minIntervalDays: Number.isInteger(normalizedIntervals[index]) && normalizedIntervals[index] >= 0
                ? normalizedIntervals[index]
                : null,
        }));

        if (!doses.length) {
            throw new Error('Для плана нужно указать хотя бы одну дозу');
        }

        const planId = baseEntry.planId || baseEntry.vaccineId;
        await this.upsertVaccinePlanTemplate({
            planId,
            vaccineBaseId: baseEntry.vaccineId,
            name: baseEntry.name,
            disease: baseEntry.disease,
            description: baseEntry.description || null,
            isLive: Boolean(baseEntry.isLive),
            isRecommended: Boolean(baseEntry.isRecommended),
            availableBrands: baseEntry.availableBrands || [],
            lectureId: baseEntry.lectureId || null,
            doses,
            isDeleted: false,
        });

        return this.getVaccineCatalog();
    },

    mergeDefinitions(
        customVaccines: VaccineDefinition[] = [],
        catalogEntries: VaccineCatalogEntry[] = []
    ): VaccineDefinition[] {
        const merged = new Map<string, VaccineDefinition>(
            VACCINE_SCHEDULE.map((v) => [v.id, { ...v }])
        );

        for (const entry of catalogEntries) {
            if (!entry?.vaccineId) continue;

            if (entry.isDeleted) {
                merged.delete(entry.vaccineId);
                continue;
            }

            const existing = merged.get(entry.vaccineId);
            merged.set(entry.vaccineId, {
                ...(existing || { id: entry.vaccineId }),
                id: entry.vaccineId,
                name: entry.name,
                disease: entry.disease,
                ageMonthStart: entry.ageMonthStart,
                description: entry.description || undefined,
                requiredRiskFactor: entry.requiredRiskFactor || undefined,
                excludedRiskFactor: entry.excludedRiskFactor || undefined,
                isLive: Boolean(entry.isLive),
                isRecommended: Boolean(entry.isRecommended),
                lectureId: entry.lectureId || undefined,
                availableBrands: entry.availableBrands || [],
            });
        }

        for (const custom of customVaccines) {
            merged.set(custom.id, custom);
        }

        return Array.from(merged.values()).sort((a, b) => {
            if (a.ageMonthStart !== b.ageMonthStart) {
                return a.ageMonthStart - b.ageMonthStart;
            }
            return a.name.localeCompare(b.name, 'ru');
        });
    },

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
        customVaccines: VaccineDefinition[] = [],
        catalogEntries: VaccineCatalogEntry[] = []
    ): AugmentedVaccine[] {
        const allDefinitions = this.mergeDefinitions(customVaccines, catalogEntries);
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
