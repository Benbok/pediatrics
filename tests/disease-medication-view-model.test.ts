import { describe, expect, it } from 'vitest';
import type { Medication } from '../src/types';
import {
    buildDiseaseMedicationViewModel,
    FALLBACK_DISEASE_MEDICATION_GROUP,
    getDiseaseMedicationGroupName,
} from '../src/modules/diseases/utils/diseaseMedicationViewModel';

const medications: Medication[] = [
    {
        id: 1,
        nameRu: 'Амоксициллин',
        activeSubstance: 'Amoxicillin',
        icd10Codes: ['J20.5'],
        forms: [],
        pediatricDosing: [],
        contraindications: 'Нет',
        indications: [],
        clinicalPharmGroup: 'Пенициллины',
        isFavorite: true,
    },
    {
        id: 2,
        nameRu: 'Ибупрофен',
        activeSubstance: 'Ibuprofen',
        icd10Codes: ['J20.5'],
        forms: [],
        pediatricDosing: [],
        contraindications: 'Нет',
        indications: [],
        clinicalPharmGroup: 'НПВС',
    },
    {
        id: 3,
        nameRu: 'Нурофен',
        activeSubstance: 'Ibuprofen',
        icd10Codes: ['J20.5'],
        forms: [],
        pediatricDosing: [],
        contraindications: 'Нет',
        indications: [],
        pharmTherapyGroup: 'НПВС',
    },
    {
        id: 4,
        nameRu: 'Парацетамол',
        activeSubstance: 'Paracetamol',
        icd10Codes: ['J20.5'],
        forms: [],
        pediatricDosing: [],
        contraindications: 'Нет',
        indications: [],
    },
];

describe('diseaseMedicationViewModel', () => {
    it('returns fallback group when medication has no pharmacological group', () => {
        expect(getDiseaseMedicationGroupName(medications[3])).toBe(FALLBACK_DISEASE_MEDICATION_GROUP);
    });

    it('filters by medication name and active substance', () => {
        const byName = buildDiseaseMedicationViewModel(medications, {
            searchQuery: 'нуро',
            selectedGroup: null,
            favoritesOnly: false,
        });
        expect(byName.filteredItems.map((item) => item.nameRu)).toEqual(['Нурофен']);

        const bySubstance = buildDiseaseMedicationViewModel(medications, {
            searchQuery: 'ibuprofen',
            selectedGroup: null,
            favoritesOnly: false,
        });
        expect(bySubstance.filteredItems.map((item) => item.nameRu)).toEqual(['Ибупрофен', 'Нурофен']);
    });

    it('applies selected group filter', () => {
        const result = buildDiseaseMedicationViewModel(medications, {
            searchQuery: '',
            selectedGroup: 'НПВС',
            favoritesOnly: false,
        });

        expect(result.groups).toHaveLength(1);
        expect(result.groups[0].name).toBe('НПВС');
        expect(result.filteredItems.map((item) => item.nameRu)).toEqual(['Ибупрофен', 'Нурофен']);
    });

    it('applies favorites filter', () => {
        const result = buildDiseaseMedicationViewModel(medications, {
            searchQuery: '',
            selectedGroup: null,
            favoritesOnly: true,
        });

        expect(result.filteredItems.map((item) => item.nameRu)).toEqual(['Амоксициллин']);
    });

    it('sorts groups alphabetically and keeps fallback group last', () => {
        const result = buildDiseaseMedicationViewModel(medications, {
            searchQuery: '',
            selectedGroup: null,
            favoritesOnly: false,
        });

        expect(result.groups.map((group) => group.name)).toEqual(['НПВС', 'Пенициллины', FALLBACK_DISEASE_MEDICATION_GROUP]);
    });
});