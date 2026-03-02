import { VaccineStatus, PolioRiskFactor } from '../../types';
import { VaxRule } from './rules';

/**
 * POLIO VACCINATION LOGIC (Полиомиелит)
 * Based on Order № 1122н and SanPiN 3.3686-21.
 * 
 * STANDARD: V1, V2, V3, RV1 (all IPV) -> RV2, RV3 (OPV)
 * RISK GROUPS: V1, V2, V3, RV1, RV2, RV3 (all IPV)
 */
export const polioRules: VaxRule = (vaccine, context) => {
    if (!vaccine.id.startsWith('polio-')) return null;

    const { child, profile, records, today } = context;

    // 1. Identify Risk Group Path
    const isRiskGroup = (profile.polioRiskFactors && profile.polioRiskFactors.length > 0) ||
        (profile.pneumoRiskFactors?.includes('pneumo-premature' as any)) ||
        ((profile.birthWeight || 0) > 0 && (profile.birthWeight || 0) < 2500);

    // 2. Count existing IPV doses
    const ipvCount = records.filter(r => {
        if (!r.isCompleted || !r.completedDate) return false;
        const brand = r.vaccineBrand?.toLowerCase() || '';
        if (brand.includes('пентаксим') ||
            brand.includes('гекса') ||
            brand.includes('полимилекс') ||
            brand.includes('имовакс')) return true;
        return ['polio-1', 'polio-2', 'polio-3', 'polio-rv1'].includes(r.vaccineId);
    }).length;

    // 3. Logic for RV2 and RV3
    const isLateDose = vaccine.id === 'polio-rv2' || vaccine.id === 'polio-rv3';
    let updates: Partial<typeof vaccine> = {};

    if (isLateDose) {
        if (isRiskGroup) {
            updates.alertMessage = '⚠️ ГРУППА РИСКА: Использовать только ИПВ (укол). Живые капли (ОПВ) противопоказаны.';
        } else if (ipvCount < 2) {
            updates.alertMessage = '🛑 БЕЗОПАСНОСТЬ: Нельзя вводить ОПВ (капли), пока не получено минимум 2 дозы ИПВ (укол). Рекомендуется ИПВ.';
        }
    }

    // 4. SanPiN 60-day Segregation Warning
    if (ipvCount < 3) {
        const birthDate = new Date(child.birthDate);
        const ageInDays = (today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
        const ageInMonths = ageInDays / 30.44;

        if (ageInMonths > 3) {
            const segregationWarning = '📢 СанПиН: У ребенка менее 3-х доз полио. При вакцинации других детей в группе каплями (ОПВ), требуется разобщение на 60 дней.';
            updates.alertMessage = updates.alertMessage
                ? `${updates.alertMessage}\n\n${segregationWarning}`
                : segregationWarning;
        }
    }

    return Object.keys(updates).length > 0 ? updates : null;
};
