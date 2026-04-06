import { Medication } from '../../../types';
import { sanitizeDisplayText } from '../../../utils/textSanitizers';

export interface DiseaseMedicationFilters {
    searchQuery: string;
    selectedGroup: string | null;
    favoritesOnly: boolean;
}

export interface DiseaseMedicationGroup {
    name: string;
    items: Medication[];
}

export interface DiseaseMedicationViewModel {
    availableGroups: string[];
    filteredItems: Medication[];
    groups: DiseaseMedicationGroup[];
}

export const FALLBACK_DISEASE_MEDICATION_GROUP = 'Прочие';

const normalizeText = (value: string | null | undefined): string => {
    return sanitizeDisplayText(value).toLocaleLowerCase('ru');
};

const sortMedicationNames = (left: Medication, right: Medication): number => {
    return normalizeText(left.nameRu).localeCompare(normalizeText(right.nameRu), 'ru');
};

export const getDiseaseMedicationGroupName = (medication: Medication): string => {
    const normalized = sanitizeDisplayText(medication.clinicalPharmGroup || medication.pharmTherapyGroup || FALLBACK_DISEASE_MEDICATION_GROUP);
    return normalized || FALLBACK_DISEASE_MEDICATION_GROUP;
};

export const buildDiseaseMedicationViewModel = (
    medications: Medication[],
    filters: DiseaseMedicationFilters,
): DiseaseMedicationViewModel => {
    const allGroups = Array.from(new Set(medications.map(getDiseaseMedicationGroupName))).sort((left, right) => {
        if (left === FALLBACK_DISEASE_MEDICATION_GROUP) return 1;
        if (right === FALLBACK_DISEASE_MEDICATION_GROUP) return -1;
        return left.localeCompare(right, 'ru');
    });

    const normalizedSearch = normalizeText(filters.searchQuery).trim();

    const filteredItems = medications
        .filter((medication) => {
            if (filters.selectedGroup && getDiseaseMedicationGroupName(medication) !== filters.selectedGroup) {
                return false;
            }

            if (filters.favoritesOnly && !medication.isFavorite) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            const name = normalizeText(medication.nameRu);
            const activeSubstance = normalizeText(medication.activeSubstance);
            return name.includes(normalizedSearch) || activeSubstance.includes(normalizedSearch);
        })
        .sort(sortMedicationNames);

    const grouped = new Map<string, Medication[]>();

    filteredItems.forEach((medication) => {
        const groupName = getDiseaseMedicationGroupName(medication);
        if (!grouped.has(groupName)) {
            grouped.set(groupName, []);
        }
        grouped.get(groupName)?.push(medication);
    });

    const groups = Array.from(grouped.entries())
        .sort(([left], [right]) => {
            if (left === FALLBACK_DISEASE_MEDICATION_GROUP) return 1;
            if (right === FALLBACK_DISEASE_MEDICATION_GROUP) return -1;
            return left.localeCompare(right, 'ru');
        })
        .map(([name, items]) => ({
            name,
            items,
        }));

    return {
        availableGroups: allGroups,
        filteredItems,
        groups,
    };
};