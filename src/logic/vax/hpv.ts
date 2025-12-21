import { VaccineStatus, HpvRiskFactor } from '../../types';
import { VaxRule } from './rules';

/**
 * HPV Rules
 * 1. Standard Age: 9-14 years (best).
 * 2. Schedule < 15 years: 2 doses (0, 6-12 mo).
 * 3. Schedule >= 15 years: 3 doses (0, 1-2, 6 mo).
 * 4. Moscow Benefit: Free for girls 12-13 years.
 */
export const hpvRules: VaxRule = (vaccine, context) => {
    // Only apply to HPV vaccines
    if (!vaccine.id.startsWith('hpv')) return null;

    const { profile, records, ageInMonths } = context;

    // const isGirl = profile.gender === 'female'; // Gender not in profile yet
    const isMoscow = profile.hpvRiskFactors?.includes(HpvRiskFactor.REGION_MOSCOW);

    // Filter HPV records
    const userRecords = records.filter(r => r.vaccineId.startsWith('hpv') && r.isCompleted);
    const doseCount = userRecords.length;

    // Determine Start Age (Age at V1)
    // If V1 exists, use age at that time. If not, use current age.
    let ageAtStart = ageInMonths;
    if (doseCount >= 1) {
        // Find V1 date
        // We need date to calculate age at start.
        // Assuming we rely on simplified logic: if they have V1, we check if they completed the course.
        // If we can't reliably know age at start from records here (no date calc helper yet), 
        // we might fallback to current age if doseCount is small. 
        // BUT strict rule: if V1 given < 15y, then 2 doses.
        // This suggests we need the DATE of V1.
        // For now, I will implement a simplified check:
        // If current age < 15 years (180 months), we certainly assume 2 doses.
        // If current age >= 15 years, it depends when they started. 
        // If they have 0 doses -> 3 doses plan.
        // If they have 1 dose -> check date?
    }

    // SIMPLIFICATION for V1:
    // If vaccine.id === 'hpv-1'
    if (vaccine.id === 'hpv-1') {
        let updates: Partial<typeof vaccine> = {};

        // Moscow Free Logic
        if (isMoscow && isGirl && ageInMonths >= 144 && ageInMonths < 168) { // 12-13 years
            updates.note = "Для девочек 12-13 лет в Москве — бесплатно!";
            updates.alertMessage = "💰 В Москве доступна бесплатная вакцинация (Гардасил).";
        }

        return Object.keys(updates).length > 0 ? updates : null;
    }

    // SCHEDULE LOGIC
    // We treat 'hpv-2' and 'hpv-3' availability based on age.

    // Logic:
    // If current age < 15 years (180 months):
    // - Need 2 doses.
    // - hpv-3 should be skipped/hidden? Or just not calculated?
    // - CONSTANTS usually defines hpv-3. We might want to set status to SKIPPED if < 15y.

    if (ageInMonths < 180) {
        if (vaccine.id === 'hpv-3') {
            return { status: VaccineStatus.SKIPPED, description: "Схема до 15 лет подразумевает 2 дозы." };
        }
    }

    return null;
};
