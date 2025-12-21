import { VaccineStatus, HepARiskFactor } from '../../types';
import { VaxRule } from './rules';

/**
 * Hepatitis A Rules
 * 1. Schedule:
 *    - V1: 12m+ (Imported) or 3y (Russian). logic uses 12m as base availability.
 *    - V2: 6-12 months after V1.
 * 2. Status:
 *    - Mandatory/Free: If 'REGION_MOSCOW' or 'CONTACT' or 'OCCUPATIONAL'.
 *    - Recommended: If 'TRAVEL'.
 *    - Optional: For others.
 * 3. Emergency:
 *    - If 'CONTACT' -> DUE_NOW (Safety net).
 */
export const hepaRules: VaxRule = (vaccine, context) => {
    if (!vaccine.id.startsWith('hepa-')) return null;

    const { profile, records, ageInMonths } = context;
    const record = vaccine.userRecord;

    if (record?.isCompleted) return null;

    let updates: Partial<typeof vaccine> = {};

    // Risk Factors
    const isMoscow = profile.hepaRiskFactors?.includes(HepARiskFactor.REGION_MOSCOW);
    const isContact = profile.hepaRiskFactors?.includes(HepARiskFactor.CONTACT);
    const isTravel = profile.hepaRiskFactors?.includes(HepARiskFactor.TRAVEL_SOUTH);
    const isOccupational = profile.hepaRiskFactors?.includes(HepARiskFactor.OCCUPATIONAL);

    const isMandatory = isMoscow || isContact || isOccupational;

    // 1. Mandatory / Recommended Status Override
    if (isMandatory) {
        // "Mandatory" usually means distinct visual cue, but here we can use alertMessage
        if (isMoscow) {
            updates.alertMessage = "🎁 РЕГИОНАЛЬНАЯ ЛЬГОТА (Москва): Входит в календарь, бесплатно перед садом/школой.";
        } else if (isContact) {
            updates.status = VaccineStatus.DUE_NOW;
            updates.alertMessage = "🆘 ЭКСТРЕННО: Был контакт с желтухой. Вакцинация в первые дни предотвращает болезнь.";
            return updates; // Return early for emergency
        }
    } else if (isTravel) {
        updates.alertMessage = "✈️ ПУТЕШЕСТВИЯ: Рекомендуется сделать за 2-4 недели до поездки на море/юг.";
    }

    // 2. Schedule Logic
    if (vaccine.id === 'hepa-2') {
        const v1 = records.find(r => r.vaccineId === 'hepa-1');

        if (!v1 || !v1.isCompleted) {
            return { status: VaccineStatus.PLANNED, alertMessage: "Сначала необходимо сделать V1." };
        }

        // V1 done. Check interval.
        // Standard interval 6-12 months.
        // We rely on standard calculation but emphasize connection
        updates.description = "V2. Закрепление иммунитета (через 6-12 месяцев после первой дозы).";
    }

    return Object.keys(updates).length > 0 ? updates : null;
};
