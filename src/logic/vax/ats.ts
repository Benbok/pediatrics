import { AugmentedVaccine, VaccineStatus } from '../../types';
import { VaxRule } from './rules';

/**
 * Rules for Anti-Tetanus Serum (ATS) / PSS / PSHI
 * 
 * Since this is emergency prophylaxis (trauma, home births), 
 * it should NOT be "Due" by default for any child.
 * 
 * It will only be active if the user explicitly marks it as completed.
 */
export const atsRules: VaxRule = (vaccine, context) => {
    if (vaccine.id !== 'ats-sos') return null;

    const userRecord = context.records.find(r => r.vaccineId === vaccine.id);

    if (userRecord) {
        return {
            status: VaccineStatus.COMPLETED,
            userRecord
        };
    }

    // By default, it's not needed (skipped in terms of mandatory schedule)
    return {
        status: VaccineStatus.SKIPPED
    };
};
