import { VaccineStatus, FluRiskFactor } from '../../types';
import { VaxRule } from './rules';

/**
 * Influenza Rules (The most complex module)
 * 1. Seasonality: 
 *    - Season starts roughly August/September. 
 *    - We define "Current Season" as: 
 *      If month >= 7 (August), Season Year = Current Year.
 *      Else, Season Year = Current Year - 1.
 *      Start Date: Aug 1st of Season Year.
 * 2. Frequency: Annual.
 * 3. Naive Child Rule (First Time):
 *    - If Age < 3 years (36 mo) AND Not previously vaccinated:
 *      -> Needs 2 doses with 4 week interval.
 *    - Else -> 1 dose.
 * 4. Risk Groups:
 *    - 6mo - 5yr: High priority.
 *    - Students: High priority.
 *    - Chronic: High priority.
 */
export const fluRules: VaxRule = (vaccine, context) => {
    if (vaccine.id !== 'flu') return null;

    const { profile, records, ageInMonths } = context;

    // 1. Determine Seasonality
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11. Aug is 7.

    // Logic: If we are in Jan 2026, the season started Aug 2025.
    // If we are in Sep 2025, the season started Aug 2025.
    const seasonStartYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    const seasonStartDate = new Date(seasonStartYear, 7, 1); // Aug 1st.

    // Filter records for "This Season"
    const seasonRecords = records.filter(r => {
        if (!r.isCompleted) return false;
        // Fix for type checking: assume record has date string or timestamp
        const rDateString = (r as any).date || (r as any).timestamp;
        if (!rDateString) return false;

        const rDate = new Date(rDateString);
        return rDate >= seasonStartDate && r.vaccineId === 'flu';
    });

    const lifetimeRecords = records.filter(r => r.isCompleted && r.vaccineId === 'flu');

    let updates: Partial<typeof vaccine> = {};
    updates.status = VaccineStatus.PLANNED; // Default assumption

    // RISK FACTORS
    const isStudent = profile.fluRiskFactors?.includes(FluRiskFactor.STUDENT);
    const isChronic = profile.fluRiskFactors?.includes(FluRiskFactor.CHRONIC);
    const isLittleKid = ageInMonths >= 6 && ageInMonths < 60; // < 5 years

    const isHighPriority = isStudent || isChronic || isLittleKid;

    // --- LOGIC TREE ---

    // A. "Naive" Child Rule (Age < 36 months)
    // Needs 2 doses if it's their very first season of vaccination.

    if (ageInMonths < 36) {
        // Case 1: Strictly 0 lifetime doses.
        if (lifetimeRecords.length === 0) {
            updates.status = VaccineStatus.PLANNED;
            updates.description = "Первая вакцинация в жизни: потребуется 2 дозы с интервалом 4 недели.";
            updates.alertMessage = "⚠️ ПЕРВЫЙ РАЗ: Детям до 3 лет вакцину вводят двукратно!";
            if (isHighPriority) {
                // If we are in season (Sep-Mar), it's DUE_NOW
                if (currentMonth >= 8 || currentMonth <= 2) {
                    updates.status = VaccineStatus.DUE_NOW;
                }
            }
            return updates;
        }

        // Case 2: Has 1 lifetime dose.
        if (lifetimeRecords.length === 1) {
            // Was this dose given THIS season?
            if (seasonRecords.length === 1) {
                // Determine interval
                const lastRec = seasonRecords[0];
                const lastDoseDate = new Date((lastRec as any).date || (lastRec as any).timestamp);
                const diffTime = Math.abs(now.getTime() - lastDoseDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 28) {
                    updates.status = VaccineStatus.PLANNED;
                    updates.description = `V2. Вторая доза для формирования иммунитета (через ${28 - diffDays} дн).`;
                    updates.alertMessage = "⏳ Ждем 4 недели после первой дозы.";
                } else {
                    updates.status = VaccineStatus.DUE_NOW;
                    updates.description = "V2. Вторая доза необходима сейчас!";
                    updates.alertMessage = "⚠️ ВТОРАЯ ДОЗА: Завершите курс первичной вакцинации.";
                }
                return updates;
            } else {
                // The 1 dose was in a PREVIOUS season.
                // So now they are not "naive" anymore in the strict sense?
                // Actually, if they only got 1 dose ever and it was last year, they *might* just need 1 this year.
                // CDC says: "Children 6 months through 8 years... need 2 doses ... if they have not received a total of >=2 doses in life".
                // Our user instruction is simpler: "If age < 3... and previously vaccinated false -> 2 doses".
                // "Else -> 1 dose".
                // Implicitly: If they had 1 dose last year, they are "previously vaccinated". So 1 dose is enough.
                // So we fall through to Annual Logic.
            }
        }
    }

    // B. Annual Logic (Standard)
    if (seasonRecords.length >= 1) {
        // Already vaccinated this season.
        // Wait, what if they are <3y and need 2 doses, but we handled that in Block A (Case 2).
        // If we represent Block A correctly, we shouldn't reach here if unmet V2 is needed?
        // Actually, Block A Case 2 handles "lifetime=1".
        // What if lifetime=2 (both this season)? -> Then seasonRecords=2. -> Completed.
        return { status: VaccineStatus.COMPLETED, description: "Вакцинация в этом сезоне пройдена." };
    } else {
        // No vaccine this season.
        updates.status = VaccineStatus.PLANNED;
        updates.description = `Сезон ${seasonStartYear}-${seasonStartYear + 1}. Ежегодная защита.`;

        // Urgency
        // If we are IN season (Sep - Mar or so), and haven't done it -> URGENT/DUE_NOW for risk groups.
        // Or if just "Season started" (Aug/Sep).
        const isSeasonPeak = (currentMonth >= 8) || (currentMonth <= 3); // Sep to Apr

        if (isSeasonPeak) {
            if (isHighPriority) {
                updates.status = VaccineStatus.DUE_NOW;
                updates.alertMessage = "🔥 СЕЗОН ГРИППА: Сделайте прививку до начала эпидемии (Сентябрь-Ноябрь).";
            } else {
                updates.status = VaccineStatus.DUE_NOW; // Generally recommended for everyone in season
                updates.alertMessage = "Рекомендуется сделать до начала роста заболеваемости.";
            }
        }
    }

    return Object.keys(updates).length > 0 ? updates : null;
};
