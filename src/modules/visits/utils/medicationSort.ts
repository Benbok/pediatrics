import { Medication } from '../../../types';
import type { PediatricDosingRule } from '../../../types';

type MedicationAllergyRisk = {
    hasMedicationRisk: boolean;
    hasGroupRisk: boolean;
};

export function sortMedicationsByFavoriteThenName(medications: Medication[]): Medication[] {
    return [...medications].sort((a, b) => {
        const favoriteDiff = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
        if (favoriteDiff !== 0) {
            return favoriteDiff;
        }

        return a.nameRu.localeCompare(b.nameRu, 'ru', { sensitivity: 'base' });
    });
}

export function excludeMedicationsWithAllergyRisk(
    medications: Medication[],
    allergyRiskByMedicationId: Map<number, MedicationAllergyRisk>
): Medication[] {
    return medications.filter((medication) => {
        if (!medication.id) {
            return true;
        }

        const risk = allergyRiskByMedicationId.get(medication.id);
        return !(risk?.hasMedicationRisk || risk?.hasGroupRisk);
    });
}

export function filterMedicationsForAge(
    medications: Medication[],
    patientAgeMonths: number
): Medication[] {
    const resolvePediatricRules = (value: unknown): PediatricDosingRule[] => {
        if (Array.isArray(value)) {
            return value as PediatricDosingRule[];
        }

        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? (parsed as PediatricDosingRule[]) : [];
            } catch {
                return [];
            }
        }

        return [];
    };

    return medications.filter((medication) => {
        const rules = resolvePediatricRules(medication.pediatricDosing);
        if (rules.length === 0) {
            return false;
        }

        return rules.some((rule) => {
            const minAgeMonths = rule.minAgeMonths != null ? rule.minAgeMonths : 0;
            const maxAgeMonths = rule.maxAgeMonths != null ? rule.maxAgeMonths : 999;
            return patientAgeMonths >= minAgeMonths && patientAgeMonths <= maxAgeMonths;
        });
    });
}