import { VaccineStatus, MeningoRiskFactor, PolioRiskFactor, PneumoRiskFactor } from '../../types';
import { VaxRule } from './rules';

/**
 * Meningococcal Rules (ACWY - Menactra, MenB - Bexsero)
 * 1. Menactra (ACWY):
 *    - 9-23m: 2 doses (>= 3m interval)
 *    - >= 2y: 1 dose single injection
 * 2. Bexsero (MenB):
 *    - 2-5m: 3+1 series
 *    - 6-11m: 2+1 series
 *    - >= 12m: 2 doses (>= 1m interval)
 * 3. Priority: Risk groups (Asplenia, HIv, Dormitory, Travel) must see "OVERDUE/DUE"
 * 4. Regional: Moscow children 3-6y get it for free (Regional advantage).
 */
export const meningoRules: VaxRule = (vaccine, context) => {
    if (!vaccine.id.startsWith('mening-')) return null;

    const { profile, records, ageInMonths } = context;
    const record = vaccine.userRecord;

    if (record?.isCompleted) return null;

    // Detect High-Risk Groups for Meningo
    const isHighRisk = (profile.meningRiskFactors && profile.meningRiskFactors.length > 0) ||
        (profile.polioRiskFactors?.includes(PolioRiskFactor.IMMUNODEFICIENCY)) ||
        (profile.pneumoRiskFactors?.includes(PneumoRiskFactor.HIV)) ||
        (profile.pneumoRiskFactors?.includes(PneumoRiskFactor.ASPLENIA)) ||
        (profile.pneumoRiskFactors?.includes(PneumoRiskFactor.COCHLEAR));

    let updates: Partial<typeof vaccine> = {};

    // 1. Menactra ACWY Logic
    if (vaccine.id === 'mening-acwy-1') {
        if (ageInMonths >= 24) {
            updates.description = "V1. Однократно (для детей от 2 лет).";
        }
    }

    if (vaccine.id === 'mening-acwy-2') {
        if (ageInMonths >= 24) {
            // Check if they already have one dose. If they don't have ANY, acwy-1 will be enough.
            const hasFirstDose = records.some(r => r.vaccineId === 'mening-acwy-1' && r.isCompleted);
            if (!hasFirstDose) {
                return {
                    status: VaccineStatus.SKIPPED,
                    alertMessage: "После 2 лет достаточно 1 дозы Менактры. Вторая (V2) не требуется."
                };
            }
        }
    }

    // 2. Status handling for 'Recommended' vaccines
    // If NOT high risk, it stays PLANNED/DUE but we might want to flag it as 'RECOMMENDED'
    if (isHighRisk) {
        updates.alertMessage = "⚠️ КРИТИЧЕСКАЯ ЗАЩИТА: Получение менингококковой вакцины обязательно для вашей группы риска.";
        // High risk patients should see this as an active requirement
    } else {
        // Moscow regional privilege (3-6 years)
        if (ageInMonths >= 36 && ageInMonths <= 72) {
            updates.alertMessage = "🎁 РЕГИОНАЛЬНАЯ ЛЬГОТА (Москва): Дети 3-6 лет могут получить Менактру бесплатно перед детским садом.";
        }
    }

    return Object.keys(updates).length > 0 ? updates : null;
};
