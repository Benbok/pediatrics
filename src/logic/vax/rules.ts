import { AugmentedVaccine, ChildProfile, VaccinationProfile, UserVaccineRecord } from '../../types';

export interface VaxRuleContext {
    child: ChildProfile;
    profile: VaccinationProfile;
    records: UserVaccineRecord[];
    allVaccines: AugmentedVaccine[];
    today: Date;
    ageInMonths: number;
    ageInWeeks: number;
}

export type VaxRule = (vaccine: AugmentedVaccine, context: VaxRuleContext) => Partial<AugmentedVaccine> | null;
