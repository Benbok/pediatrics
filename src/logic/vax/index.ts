import { AugmentedVaccine, ChildProfile, VaccinationProfile, UserVaccineRecord, VaccineStatus } from '../../types';
import { VaxRuleContext } from './rules';
import { bcgRules } from './bcg';
import { hepatitisBRules } from './hepatitisB';
import { rotavirusRules } from './rotavirus';
import { hibRules } from './hib';
import { pneumoRules } from './pneumo';
import { dtpRules } from './dtp';
import { mmrRules } from './mmr';
import { polioRules } from './polio';
import { meningoRules } from './meningo';
import { varicellaRules } from './varicella';
import { hepaRules } from './hepa';
import { fluRules } from './flu';
import { hpvRules } from './hpv';
import { tbeRules } from './tbe';
import { atsRules } from './ats';

const RULES = [
    bcgRules,
    hepatitisBRules,
    rotavirusRules,
    hibRules,
    pneumoRules,
    dtpRules,
    polioRules,
    mmrRules,
    meningoRules,
    varicellaRules,
    hepaRules,
    fluRules,
    hpvRules,
    tbeRules,
    atsRules
];

import { calculateAgeInMonths, calculateAgeInWeeks } from '../../utils/ageUtils';

export const calculateVaccineSchedule = (
    child: ChildProfile,
    profile: VaccinationProfile,
    records: UserVaccineRecord[],
    baseSchedule: any[] // VaccineDefinition[]
): AugmentedVaccine[] => {
    const birthDate = new Date(child.birthDate);
    const today = new Date();
    const ageInWeeks = calculateAgeInWeeks(child.birthDate, today);
    const ageInMonths = calculateAgeInMonths(child.birthDate, today);

    const isHepBRiskGroup = profile.hepBRiskFactors && profile.hepBRiskFactors.length > 0;

    // 1. Initial Filtering (Risk Groups)
    const filteredBase = baseSchedule.filter(v => {
        if (v.requiredRiskFactor === 'hepB') return isHepBRiskGroup;
        if (v.excludedRiskFactor === 'hepB') return !isHepBRiskGroup;
        return true;
    });

    // 2. Initial Augmentation (Dates & Status)
    const augmented: AugmentedVaccine[] = filteredBase.map(v => {
        const dueDate = new Date(birthDate);
        dueDate.setMonth(dueDate.getMonth() + v.ageMonthStart);

        // --- Combined Vaccine Logic (Sync) ---
        // Find if this vaccine is covered by a combined vaccine record
        let record = records.find(r => r.vaccineId === v.id);

        if (!record) {
            // Check if it's covered by a combined record at the same visit age
            const comboRecord = records.find(r => {
                const brand = r.vaccineBrand?.toLowerCase() || '';
                const isCombo = brand.includes('пентаксим') || brand.includes('инфанрикс гекса');
                if (!isCombo) return false;

                // Match by stage (1, 2, 3)
                const stageMatch = v.id.endsWith(r.vaccineId.slice(-1));
                if (!stageMatch) return false;

                // Component logic
                if (v.id.startsWith('polio') || v.id.startsWith('hib')) return true;
                if (v.id.startsWith('hepb') && brand.includes('гекса')) return true;

                return false;
            });

            if (comboRecord) {
                record = {
                    ...comboRecord,
                    isCompleted: true,
                    vaccineId: v.id,
                    notes: `В составе ${comboRecord.vaccineBrand}. ${comboRecord.notes || ''}`
                };
            }
        }

        let status = record?.isCompleted ? VaccineStatus.COMPLETED : VaccineStatus.PLANNED;

        // Base "Planned/Due/Overdue" logic
        if (status !== VaccineStatus.COMPLETED) {
            if (dueDate < today) {
                const oneMonthPastDue = new Date(dueDate);
                oneMonthPastDue.setMonth(oneMonthPastDue.getMonth() + 1);
                status = today > oneMonthPastDue ? VaccineStatus.OVERDUE : VaccineStatus.DUE_NOW;
            }
        }

        return { ...v, status, userRecord: record, dueDate };
    });

    // 3. Apply Modular Rules
    const context: VaxRuleContext = {
        child,
        profile,
        records,
        allVaccines: augmented,
        today,
        ageInMonths,
        ageInWeeks
    };

    return augmented.map(v => {
        let updates = {};
        for (const rule of RULES) {
            const result = rule(v, context);
            if (result) {
                updates = { ...updates, ...result };
            }
        }
        return { ...v, ...updates };
    }).sort((a, b) => {
        const timeA = a.dueDate?.getTime() || 0;
        const timeB = b.dueDate?.getTime() || 0;
        return timeA - timeB;
    });
};
