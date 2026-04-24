import { describe, expect, it } from 'vitest';
import type { Medication, PediatricDosingRule } from '../src/types';
import {
    excludeMedicationsWithAllergyRisk,
    filterMedicationsForAge,
    sortMedicationsByFavoriteThenName,
} from '../src/modules/visits/utils/medicationSort';

function medication(nameRu: string, isFavorite: boolean): Medication {
    return {
        nameRu,
        activeSubstance: nameRu,
        icd10Codes: [],
        forms: [],
        pediatricDosing: [],
        contraindications: '',
        indications: [],
        isFavorite,
    };
}

describe('sortMedicationsByFavoriteThenName', () => {
    it('puts favorites before non-favorites', () => {
        const input = [
            medication('Бромгексин', false),
            medication('Амброксол', true),
            medication('Ацетилцистеин', false),
            medication('Беродуал', true),
        ];

        const result = sortMedicationsByFavoriteThenName(input);

        expect(result.map((item) => item.nameRu)).toEqual([
            'Амброксол',
            'Беродуал',
            'Ацетилцистеин',
            'Бромгексин',
        ]);
    });

    it('keeps alphabetical order inside each favorite bucket', () => {
        const input = [
            medication('Цефиксим', true),
            medication('Амоксициллин', true),
            medication('Кларитромицин', true),
            medication('Флуконазол', false),
            medication('Азитромицин', false),
        ];

        const result = sortMedicationsByFavoriteThenName(input);

        expect(result.map((item) => item.nameRu)).toEqual([
            'Амоксициллин',
            'Кларитромицин',
            'Цефиксим',
            'Азитромицин',
            'Флуконазол',
        ]);
    });
});

describe('excludeMedicationsWithAllergyRisk', () => {
    it('removes medications with medication or group allergy risk', () => {
        const ambroxol = medication('Амброксол', false);
        const bromhexine = medication('Бромгексин', false);
        const acetylcysteine = medication('Ацетилцистеин', false);

        ambroxol.id = 1;
        bromhexine.id = 2;
        acetylcysteine.id = 3;

        const riskMap = new Map<number, { hasMedicationRisk: boolean; hasGroupRisk: boolean }>([
            [1, { hasMedicationRisk: true, hasGroupRisk: false }],
            [2, { hasMedicationRisk: false, hasGroupRisk: true }],
            [3, { hasMedicationRisk: false, hasGroupRisk: false }],
        ]);

        const result = excludeMedicationsWithAllergyRisk(
            [ambroxol, bromhexine, acetylcysteine],
            riskMap
        );

        expect(result.map((item) => item.nameRu)).toEqual(['Ацетилцистеин']);
    });
});

describe('filterMedicationsForAge', () => {
    it('keeps only medications with dosing rules matching age range', () => {
        const infantOnly = medication('Инфант', false);
        infantOnly.pediatricDosing = [{ minAgeMonths: 0, maxAgeMonths: 12 } satisfies PediatricDosingRule];

        const teenOnly = medication('Подросток', false);
        teenOnly.pediatricDosing = [{ minAgeMonths: 144, maxAgeMonths: 216 } satisfies PediatricDosingRule];

        const noRules = medication('Без правил', false);
        noRules.pediatricDosing = [];

        const result = filterMedicationsForAge([infantOnly, teenOnly, noRules], 10);

        expect(result.map((item) => item.nameRu)).toEqual(['Инфант']);
    });

    it('treats missing min/max bounds as open interval', () => {
        const noUpperBound = medication('Без верхней границы', false);
        noUpperBound.pediatricDosing = [{ minAgeMonths: 24, maxAgeMonths: null } satisfies PediatricDosingRule];

        const noLowerBound = medication('Без нижней границы', false);
        noLowerBound.pediatricDosing = [{ minAgeMonths: null, maxAgeMonths: 36 } satisfies PediatricDosingRule];

        const result = filterMedicationsForAge([noUpperBound, noLowerBound], 30);

        expect(result.map((item) => item.nameRu)).toEqual([
            'Без верхней границы',
            'Без нижней границы',
        ]);
    });

    it('supports pediatric dosing stored as JSON string', () => {
        const stringRules = medication('Строковые правила', false);
        stringRules.pediatricDosing = '[{"minAgeMonths":12,"maxAgeMonths":36}]' as unknown as Medication['pediatricDosing'];

        const result = filterMedicationsForAge([stringRules], 24);

        expect(result.map((item) => item.nameRu)).toEqual(['Строковые правила']);
    });
});