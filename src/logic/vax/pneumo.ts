import { VaccineStatus, PneumoRiskFactor } from '../../types';
import { VaxRule } from './rules';

/**
 * Pneumococcal Rules
 * Standard (PCV13): 2m, 4.5m, 15m (RV)
 * Catch-up (PCV13):
 * - 7-11m: 2 + 1 (RV)
 * - 12-23m: 2 doses (2m interval)
 * - 24m+: 1 dose
 * High Risk: PCV13 + PPV23 (after 2y, 8 weeks after ПКВ13)
 */
export const pneumoRules: VaxRule = (vaccine, context) => {
    const { ageInMonths, profile } = context;
    const record = vaccine.userRecord;
    const id = vaccine.id;

    if (!id.startsWith('pneumo')) return null;
    if (record?.isCompleted) return null;

    const isHighRisk = (profile?.pneumoRiskFactors?.length ?? 0) > 0;

    // PPV23 Specific Logic
    if (id === 'pneumo-ppv23') {
        if (!isHighRisk) {
            return {
                status: VaccineStatus.SKIPPED,
                alertMessage: "Рекомендуется только для групп риска (аспления, ВИЧ, хронические болезни и др.)."
            };
        }
        if (ageInMonths < 24) {
            return {
                status: VaccineStatus.PLANNED,
                alertMessage: "Вводится строго после 2 лет."
            };
        }
        // Check if PCV13 is completed (Prevenar 13 / PKB13)
        // We look for any completed pneumo-1, pneumo-2 or pneumo-rv
        const hasPCV13 = context.records.some(r =>
            (r.vaccineId === 'pneumo-1' || r.vaccineId === 'pneumo-2' || r.vaccineId === 'pneumo-rv') &&
            r.isCompleted
        );
        if (!hasPCV13) {
            return {
                status: VaccineStatus.PLANNED,
                alertMessage: "Сначала необходимо завершить курс ПКВ13 (Превенар 13)."
            };
        }
    }

    // Catch-up for PCV13 (PCV-1, PCV-2, PCV-RV)
    if (id === 'pneumo-1' || id === 'pneumo-2' || id === 'pneumo-rv') {
        // Start after 24 months
        if (ageInMonths >= 24) {
            if (id === 'pneumo-1') {
                return null; // Keep first dose
            }
            if (!isHighRisk) {
                return {
                    status: VaccineStatus.SKIPPED,
                    alertMessage: "Здоровым детям после 2 лет достаточно 1 дозы ПКВ13."
                };
            }
        }

        // Start 12-23 months (Only 2 doses needed)
        if (ageInMonths >= 12 && ageInMonths < 24) {
            if (id === 'pneumo-rv' && !isHighRisk) {
                return {
                    status: VaccineStatus.SKIPPED,
                    alertMessage: "При старте после года достаточно 2 доз."
                };
            }
        }
    }

    return null;
};
