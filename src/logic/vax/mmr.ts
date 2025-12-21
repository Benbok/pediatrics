import { VaccineStatus, MMRContraindication, PolioRiskFactor, PneumoRiskFactor } from '../../types';
import { VaxRule } from './rules';

/**
 * MMR (Measles, Mumps, Rubella) Rules
 * 1. Standard: 12m, 6y
 * 2. Live Vaccine Rule: 30-day interval between different live vaccines 
 *    (unless given on the same day).
 * 3. Mantoux Rule: Mantoux must be BEFORE or SAME DAY as MMR. 
 *    If MMR given first, wait 4-6 weeks for Mantoux.
 * 4. Delayed Reaction: Warning for days 5-15.
 */
export const mmrRules: VaxRule = (vaccine, context) => {
    if (!vaccine.id.startsWith('mmr')) return null;

    const { child, profile, records, today } = context;
    const record = vaccine.userRecord;

    if (record?.isCompleted) {
        // Handle delayed reaction warning for recently completed MMR
        if (record.completedDate) {
            const date = new Date(record.completedDate);
            const daysSince = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince >= 5 && daysSince <= 15) {
                return {
                    alertMessage: "🔔 ПЕРИОД РЕАКЦИИ (5-15 день): Возможно повышение температуры или легкая сыпь. Ребенок не заразен, это норма."
                };
            }
        }
        return null;
    }

    let updates: Partial<typeof vaccine> = {};

    // 1. Absolute Contraindications
    if (profile.mmrContraindications && profile.mmrContraindications.length > 0) {
        return {
            status: VaccineStatus.SKIPPED,
            alertMessage: "🛑 ПРОТИВОПОКАЗАНО: У ребенка имеются абсолютные противопоказания к живой вакцине КПК."
        };
    }

    // Proxy for immunosuppression from other modules
    const isImmuno = (profile.polioRiskFactors?.includes(PolioRiskFactor.IMMUNODEFICIENCY)) ||
        (profile.pneumoRiskFactors?.includes(PneumoRiskFactor.HIV));

    if (isImmuno) {
        return {
            status: VaccineStatus.SKIPPED,
            alertMessage: "🛑 ПРОТИВОПОКАЗАНО: Живые вакцины (КПК) запрещены при выраженном иммунодефиците."
        };
    }

    // 2. Live Vaccine Interval Rule (30 days)
    const otherLiveRecords = records.filter(r => {
        if (!r.isCompleted || !r.completedDate || r.vaccineId === vaccine.id) return false;
        // Check if the vaccine definition for this record is marked as live
        // In index.ts we augment the schedule, but here we might need to check the definition manually
        // For now, hardcode major ones or expect context to handle
        return ['rota-1', 'rota-2', 'rota-3', 'bcg-1', 'varicella'].some(id => r.vaccineId.startsWith(id));
    });

    for (const r of otherLiveRecords) {
        const compDate = new Date(r.completedDate!);
        const diffDays = Math.abs((today.getTime() - compDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays < 30) {
            updates.alertMessage = `⚠️ ИНТЕРВАЛ: После живой вакцины (${r.vaccineId}) должно пройти не менее 30 дней.`;
            updates.status = VaccineStatus.PLANNED;
        }
    }

    // 3. Mantoux Rule
    if (profile.mantouxDate) {
        const mDate = new Date(profile.mantouxDate);
        const diffDays = (today.getTime() - mDate.getTime()) / (1000 * 60 * 60 * 24);

        // If Mantoux was long ago (> 1 year), might need fresh one but that's general rule
        // The specific rule is: if MMR is planned, check if Mantoux was recent or same day.
        // If we want to GIVE MMR now, and Mantoux was NOT given recently, should we warn?
        // Usually, in Russia, Mantoux is done once a year.
    } else {
        updates.alertMessage = updates.alertMessage
            ? `${updates.alertMessage}\n📍 Рекомендуется сначала провести пробу Манту.`
            : "📍 Перед первой вакцинацией КПК в 12 мес. рекомендуется провести пробу Манту.";
    }

    return Object.keys(updates).length > 0 ? updates : null;
};
