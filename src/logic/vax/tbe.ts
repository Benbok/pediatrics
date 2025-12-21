import { VaccineStatus, TbeRiskFactor } from '../../types';
import { VaxRule } from './rules';

/**
 * TBE (Tick-borne Encephalitis) Rules
 * 1. Standard Scheme: V1 (Autumn) -> V2 (1-7 months later, usually 5-7).
 * 2. Emergency Scheme: V1 (Spring) -> V2 (14 days later).
 * 3. V3: 1 year after V2.
 * 4. Revax: Every 3 years.
 * 5. Safety: Immunity forms 2 weeks after V2.
 */
export const tbeRules: VaxRule = (vaccine, context) => {
    // Only apply to TBE vaccines
    if (!vaccine.id.startsWith('tbe')) return null;

    const { profile, records, ageInMonths } = context;
    const isEndemic = profile.tbeRiskFactors?.includes(TbeRiskFactor.ENDEMIC_REGION);
    const isTravel = profile.tbeRiskFactors?.includes(TbeRiskFactor.TRAVEL_FOREST);

    if (!isEndemic && !isTravel) {
        // Not relevant if not in risk group? 
        // We can hide it or mark as skipped if user has no interest. 
        // But usually recommended to show as optional.
        return null;
    }

    const updates: Partial<typeof vaccine> = {};

    // Determine current month for Recommendation Logic
    const now = new Date();
    const month = now.getMonth(); // 0 = Jan, 2 = Mar, 3 = Apr, 8 = Sep, 9 = Oct

    // Seasonal Logic for V1
    if (vaccine.id === 'tbe-1') {
        const hasV1 = records.some(r => r.vaccineId === 'tbe-1' && r.isCompleted);
        if (!hasV1) {
            // Recommendation
            if (month >= 8 || month <= 2) { // Sep - Mar
                updates.status = VaccineStatus.PLANNED;
                updates.description = "Оптимально начать сейчас (Плановая схема: V1, через 5-7 мес V2).";
            } else { // Apr - Aug
                updates.status = VaccineStatus.DUE_NOW;
                updates.description = "Начинайте по ЭКСТРЕННОЙ схеме (V1, через 2 нед V2), если планируете в лес.";
                updates.alertMessage = "🔥 Сезон клещей! Используйте Экстренную схему (интервал 14 дней).";
            }
        }
        return Object.keys(updates).length > 0 ? updates : null;
    }

    // Logic for V2
    if (vaccine.id === 'tbe-2') {
        // Check date of V1
        const v1 = records.find(r => r.vaccineId === 'tbe-1' && r.isCompleted);
        if (v1 && v1.completedDate) {
            const v1Date = new Date(v1.completedDate);
            const v1Month = v1Date.getMonth();

            // If V1 was in Autumn (Aug-Dec), suggest Standard (Spring V2)
            // If V1 was in Spring (Mar-Jul), suggest Emergency (2 weeks)

            // But actually, we just check: CURRENTLY do we need emergency?
            // Or we adhere to the scheme started.

            // If 14 days haven't passed:
            const diffTime = Math.abs(now.getTime() - v1Date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 14) {
                updates.dueDate = new Date(v1Date.getTime() + 14 * 24 * 60 * 60 * 1000); // V1 + 14d
                updates.status = VaccineStatus.PLANNED;
                updates.alertMessage = "⏳ Ждите 14 дней для второй дозы (Минимальный интервал).";
            } else {
                // > 14 days passed.
                // If it's Klech season, urge to do it.
                updates.status = VaccineStatus.DUE_NOW;
                updates.alertMessage = "⚠️ В лес можно только через 2 недели ПОСЛЕ этой дозы!";
            }
        }
        return Object.keys(updates).length > 0 ? updates : null;
    }

    return null;
};
