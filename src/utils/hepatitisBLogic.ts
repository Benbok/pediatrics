import { HepBRiskFactor, VaccinationProfile, UserVaccineRecord } from '../types';

/**
 * HEPATITIS B VACCINATION LOGIC
 * Based on Order № 1122н (National Calendar of Preventive Vaccinations)
 * 
 * Two schedules:
 * - Standard (0-1-6): For children without risk factors
 * - Risk (0-1-2-12): For children with Hepatitis B risk factors
 */

export type HepBSchedule = 'standard' | 'risk';

export interface HepBDose {
    doseNumber: 1 | 2 | 3 | 4;
    ageMonths: number;
    description: string;
}

// Standard Schedule: 0-1-6 months
export const HEP_B_STANDARD_SCHEDULE: HepBDose[] = [
    { doseNumber: 1, ageMonths: 0, description: 'Первые 24 часа жизни (в роддоме)' },
    { doseNumber: 2, ageMonths: 1, description: '1 месяц' },
    { doseNumber: 3, ageMonths: 6, description: '6 месяцев' },
];

// Risk Schedule: 0-1-2-12 months
export const HEP_B_RISK_SCHEDULE: HepBDose[] = [
    { doseNumber: 1, ageMonths: 0, description: 'Первые 24 часа + иммуноглобулин' },
    { doseNumber: 2, ageMonths: 1, description: '1 месяц' },
    { doseNumber: 3, ageMonths: 2, description: '2 месяца' },
    { doseNumber: 4, ageMonths: 12, description: '12 месяцев' },
];

/**
 * Determine which Hepatitis B schedule applies to a child
 */
export function determineHepBSchedule(profile: VaccinationProfile | null): HepBSchedule {
    if (!profile || !profile.hepBRiskFactors || profile.hepBRiskFactors.length === 0) {
        return 'standard';
    }
    return 'risk';
}

/**
 * Get risk factor description in Russian
 */
export function getHepBRiskFactorLabel(factor: HepBRiskFactor): string {
    const labels: Record<HepBRiskFactor, string> = {
        [HepBRiskFactor.MOTHER_HBSAG]: 'Мать — носитель HBsAg',
        [HepBRiskFactor.MOTHER_SICK]: 'Мать больна гепатитом В',
        [HepBRiskFactor.MOTHER_3RD_TRIMESTER]: 'Мать перенесла гепатит В в 3-м триместре',
        [HepBRiskFactor.MOTHER_NO_TEST]: 'Нет результатов обследования матери',
        [HepBRiskFactor.MOTHER_DRUGS]: 'Мать употребляет наркотики',
        [HepBRiskFactor.FAMILY_CARRIER]: 'В семье есть носитель/больной',
    };
    return labels[factor];
}

/**
 * Interval Validation
 * Per medical guidelines:
 * - V1 → V2: minimum 1 month (4 weeks)
 * - V2 → V3: minimum 8 weeks
 * - V1 → V3: minimum 16 weeks
 */
export interface IntervalValidation {
    isValid: boolean;
    message?: string;
}

export function validateHepBIntervals(doses: UserVaccineRecord[]): IntervalValidation {
    if (doses.length < 2) return { isValid: true };

    const sortedDoses = [...doses]
        .filter(d => d.completedDate && d.isCompleted)
        .sort((a, b) => new Date(a.completedDate!).getTime() - new Date(b.completedDate!).getTime());

    if (sortedDoses.length < 2) return { isValid: true };

    const getMonthsDiff = (date1: string, date2: string) => {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    };

    // V1 → V2: minimum 1 month
    if (sortedDoses.length >= 2) {
        const diff = getMonthsDiff(sortedDoses[0].completedDate!, sortedDoses[1].completedDate!);
        if (diff < 1) {
            return {
                isValid: false,
                message: `Между 1-й и 2-й дозой должен быть минимум 1 месяц (фактически: ${diff.toFixed(1)} мес)`,
            };
        }
    }

    // V2 → V3: minimum 8 weeks (≈2 months)
    if (sortedDoses.length >= 3) {
        const diff = getMonthsDiff(sortedDoses[1].completedDate!, sortedDoses[2].completedDate!);
        if (diff < 2) {
            return {
                isValid: false,
                message: `Между 2-й и 3-й дозой должно быть минимум 8 недель/2 месяца (фактически: ${diff.toFixed(1)} мес)`,
            };
        }
    }

    // V1 → V3: minimum 16 weeks (≈4 months)
    if (sortedDoses.length >= 3) {
        const diff = getMonthsDiff(sortedDoses[0].completedDate!, sortedDoses[2].completedDate!);
        if (diff < 4) {
            return {
                isValid: false,
                message: `Между 1-й и 3-й дозой должно быть минимум 16 недель/4 месяца (фактически: ${diff.toFixed(1)} мес)`,
            };
        }
    }

    return { isValid: true };
}

/**
 * Catch-Up Plan
 *  Principle: "The series is never reset" - all previous doses count
 */
export interface CatchUpPlan {
    nextDoseNumber: number;
    recommendedAgeMonths: number;
    instructions: string;
}

export function getHepBCatchUpPlan(
    existingDoses: UserVaccineRecord[],
    schedule: HepBSchedule,
    currentAgeMonths: number
): CatchUpPlan | null {
    const completedDoses = existingDoses.filter(d => d.isCompleted).length;
    const targetSchedule = schedule === 'risk' ? HEP_B_RISK_SCHEDULE : HEP_B_STANDARD_SCHEDULE;

    if (completedDoses >= targetSchedule.length) {
        return null; // Fully vaccinated
    }

    const nextDose = targetSchedule[completedDoses];
    const recommendedAge = Math.max(currentAgeMonths, nextDose.ageMonths);

    let instructions = '';
    if (completedDoses === 0) {
        instructions = 'Начать вакцинацию с первой дозы как можно скорее.';
    } else if (completedDoses === 1) {
        instructions = `Сделать 2-ю дозу (интервал с 1-й: минимум 1 месяц). Затем 3-ю через 5 месяцев после 2-й.`;
    } else if (completedDoses === 2) {
        instructions = `Сделать 3-ю дозу (интервал со 2-й: минимум 2 месяца, с 1-й: минимум 4 месяца).`;
    } else if (completedDoses === 3 && schedule === 'risk') {
        instructions = `Сделать 4-ю дозу в 12 месяцев (ревакцинация для группы риска).`;
    }

    return {
        nextDoseNumber: nextDose.doseNumber,
        recommendedAgeMonths: recommendedAge,
        instructions,
    };
}

/**
 * Check if HBIG (Hepatitis B Immunoglobulin) is required
 */
export function requiresHBIG(profile: VaccinationProfile | null): boolean {
    if (!profile || !profile.hepBRiskFactors) return false;

    // HBIG is required for newborns from HBsAg+ mothers
    const criticalRisks = [HepBRiskFactor.MOTHER_HBSAG, HepBRiskFactor.MOTHER_SICK];
    return profile.hepBRiskFactors.some(rf => criticalRisks.includes(rf));
}

/**
 * Get HBIG instructions
 */
export function getHBIGInstructions(profile: VaccinationProfile | null): string | null {
    if (!profile || !requiresHBIG(profile)) return null;

    return `⚠️ Одновременно с первой дозой вакцины (в разные бедра) необходимо ввести специфический иммуноглобулин человека против гепатита В (HBIG) в дозе 100 МЕ. Это нужно сделать в первые 12 часов жизни. Эффективность предотвращения инфекции — до 97%.`;
}
