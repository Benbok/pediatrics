import { VaccineStatus, PolioRiskFactor, PneumoRiskFactor } from '../../types';
import { VaxRule } from './rules';

/**
 * Hib (Haemophilus influenzae type b) Rules
 * 1. Standard: 3, 4.5, 6, 18m
 * 2. Catch-up (Dynamic dose reduction):
 *    - Start 6-12m: 2 doses (1m interval) + RV (at 18m or 1y after V2)
 *    - Start 12m-5y: 1 dose strictly.
 *    - > 5y: Usually not needed except for risk groups.
 * 3. Clinical Priority: Risk groups must not miss doses.
 */
export const hibRules: VaxRule = (vaccine, context) => {
    if (!vaccine.id.startsWith('hib')) return null;

    const { child, profile, ageInMonths } = context;
    const record = vaccine.userRecord;

    if (record?.isCompleted) return null;

    // Detect High-Risk Groups for Hib (based on shared factors)
    const isHighRisk = (profile.polioRiskFactors?.some(f =>
        [PolioRiskFactor.HIV_EXPOSURE,
        PolioRiskFactor.IMMUNODEFICIENCY,
        PolioRiskFactor.ONCOLOGY,
        PolioRiskFactor.INSTITUTIONALIZED].includes(f))) ||
        (profile.pneumoRiskFactors?.includes(PneumoRiskFactor.HIV)) ||
        (profile.pneumoRiskFactors?.includes(PneumoRiskFactor.ASPLENIA));

    let updates: Partial<typeof vaccine> = {};

    // 1. Age-based Skip Logic (Catch-up)
    if (ageInMonths >= 60 && !isHighRisk) {
        return {
            status: VaccineStatus.SKIPPED,
            alertMessage: "После 5 лет вакцинация Hib здоровым детям не проводится."
        };
    }

    if (ageInMonths >= 12) {
        // If starting after 1 year, only 1 dose is needed.
        const hibRecords = context.records.filter(r => r.vaccineId.startsWith('hib') && r.isCompleted);
        const hasAnyHib = hibRecords.length > 0;

        if (hasAnyHib) {
            return {
                status: VaccineStatus.SKIPPED,
                alertMessage: "При начале вакцинации после 1 года достаточно 1 дозы. Курс считается завершенным."
            };
        } else if (vaccine.id !== 'hib-1') {
            return {
                status: VaccineStatus.SKIPPED,
                alertMessage: "Пропуск: При старте после 12 мес. достаточно одной инъекции (V1)."
            };
        }
    }

    if (ageInMonths >= 6 && ageInMonths < 12) {
        // Start 6-12m: 2 doses + RV. Skip hib-3.
        if (vaccine.id === 'hib-3') {
            return {
                status: VaccineStatus.SKIPPED,
                alertMessage: "Пропуск согласно краткой схеме (старт в 6-12 мес): нужно 2 дозы + ревакцинация."
            };
        }
    }

    // 2. Risk Group Prioritization
    if (isHighRisk) {
        updates.alertMessage = '⚠️ КРИТИЧЕСКИ ВАЖНО: Ребенок в группе риска по Hib. Не допускайте пропусков графика!';
    }

    return Object.keys(updates).length > 0 ? updates : null;
};
