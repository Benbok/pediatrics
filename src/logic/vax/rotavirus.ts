import { VaccineStatus, RotavirusRiskFactor } from '../../types';
import { VaxRule } from './rules';

/**
 * Rotavirus Rules (Strict)
 * 1. Contraindications: Intussusception, GI Malformation, SCID.
 * 2. First dose strictly between 6 and 12 weeks.
 *    - If age > 12 weeks and no 1st dose -> The whole course is unavailable.
 * 3. Course completion strictly before 8 months (32 weeks).
 */
export const rotavirusRules: VaxRule = (vaccine, context) => {
    if (!vaccine.id.startsWith('rota')) return null;

    const { ageInWeeks, ageInMonths, profile } = context;
    const record = vaccine.userRecord;

    // 1. Contraindications
    const contraindications = profile.rotaRiskFactors || [];
    if (
        contraindications.includes(RotavirusRiskFactor.INTUSSUSCEPTION_HISTORY) ||
        contraindications.includes(RotavirusRiskFactor.GI_MALFORMATION) ||
        contraindications.includes(RotavirusRiskFactor.SCID)
    ) {
        return {
            status: VaccineStatus.SKIPPED,
            alertMessage: 'Отменено: риск инвагинации или ИДС'
        };
    }

    // If already completed, no need to enforce deadlines (unless we want to flag it was done late? no)
    if (record?.isCompleted) return null;

    // 2. First Dose Strict Window (12 weeks)
    if (vaccine.id === 'rota-1') {
        if (ageInWeeks > 12) {
            return {
                status: VaccineStatus.MISSED,
                alertMessage: "ВАКЦИНАЦИЯ НЕДОСТУПНА: Первая доза строго до 12 недель (3 мес). Риск инвагинации."
            };
        }
    }

    // 3. Course Completion Deadline (8 months)
    if (ageInMonths >= 8) {
        return {
            status: VaccineStatus.MISSED,
            alertMessage: "Сроки упущены: вакцинация должна быть завершена до 8 месяцев."
        };
    }

    // If we are dealing with Dose 2 or 3, and Dose 1 is MISSED (due to age), they should also be MISSED.
    // However, the rule above (ageInWeeks > 12 for Dose 1) only affects Dose 1.
    // If Dose 1 is not done, and child is > 12 weeks, does Dose 2/3 become invalid?
    // YES. You can't start with Dose 2.
    // We check all vaccines in the list.

    // Check if Dose 1 is missed/unavailable
    if (vaccine.id === 'rota-2' || vaccine.id === 'rota-3') {
        const dose1 = context.allVaccines.find(v => v.id === 'rota-1');

        // If Dose 1 is missed (due to age), then subsequent doses are also blocked
        // Note: dose1 might not be evaluated fully yet if array is unsorted or depending on order,
        // BUT calculateVaccineSchedule augments status before rules.
        // However, the rule for Dose 1 (age > 12 weeks) sets status to MISSED. 
        // Since we are iterating rules, and we don't know if Dose 1 rule ran yet? 
        // Actually we run all rules for each vaccine.

        // If child > 12 weeks and Dose 1 is NOT completed -> Block all.
        const dose1Completed = dose1?.userRecord?.isCompleted;
        if (!dose1Completed && ageInWeeks > 12) {
            return {
                status: VaccineStatus.MISSED,
                alertMessage: "Вакцинация не начата вовремя (до 12 недель)."
            };
        }
    }

    return null;
};
