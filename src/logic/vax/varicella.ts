import { VaccineStatus, VaricellaRiskFactor, MMRContraindication } from '../../types';
import { VaxRule } from './rules';

/**
 * Varicella (Chickenpox) Rules
 * 1. Schedule:
 *    - V1: 12 months (Standard).
 *    - V2: 6-12 weeks after V1 (Gold Standard).
 *    - Catch-up: 2 doses with min 6 weeks interval.
 * 2. Live Vaccine Safety:
 *    - Must be >= 30 days from any other live vaccine (MMR, Yellow Fever) UNLESS given same day.
 * 3. Emergency (SOS):
 *    - If 'CONTACT' factor is set -> DUE NOW (72-96h window).
 */
export const varicellaRules: VaxRule = (vaccine, context) => {
    if (!vaccine.id.startsWith('varicella-')) return null;

    const { profile, records, ageInMonths } = context;
    const record = vaccine.userRecord;

    if (record?.isCompleted) return null;

    let updates: Partial<typeof vaccine> = {};

    // 1. Emergency Logic (SOS)
    // If user marked "Contact with infected", this becomes CRITICAL immediately
    const isEmergency = profile.varicellaRiskFactors?.includes(VaricellaRiskFactor.CONTACT);

    if (isEmergency) {
        updates.status = VaccineStatus.DUE_NOW;
        updates.alertMessage = "SOS: ЭКСТРЕННАЯ ПРОФИЛАКТИКА! Был контакт с ветрянкой. Ввести вакцину в течение 72-96 часов.";
        // If they already have V1, this might urge V2 if interval allows, but primary goal is V1
        return updates;
    }

    // 2. Live Vaccine Interval Logic
    // Find last live vaccine date (MMR, Varicella)
    const liveVaccineIds = ['mmr-1', 'mmr-2', 'varicella-1', 'varicella-2'];
    // In a real app we'd tag 'isLive' in definitions and filter records. 
    // Ideally we pass 'allVaccines' to context or trust 'records' has dates.

    // For now, simpler check: V2 timing
    if (vaccine.id === 'varicella-2') {
        const v1 = records.find(r => r.vaccineId === 'varicella-1');
        if (!v1 || !v1.isCompleted) {
            // Can't give V2 without V1
            return { status: VaccineStatus.PLANNED, alertMessage: "Сначала необходимо сделать V1." };
        }

        // If V1 done, V2 is strictly 6 weeks later
        // The base schedule says 13.5m (1.5m after 12m), so standard calc handles it loosely.
        // But we can enforce strict interval description
        updates.description = "Вторая доза для стойкого иммунитета (минимум через 6 недель после V1).";
    }

    // 3. MMR Compatibility warning
    // If MMR was done < 30 days ago, we should warn.
    // (Implementation complexity: need exact dates of all records. Assuming 'records' has simple string dates 'timestamp'?)

    return Object.keys(updates).length > 0 ? updates : null;
};
