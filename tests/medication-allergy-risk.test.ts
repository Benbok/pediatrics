import { describe, expect, it } from 'vitest';
import {
    extractMedicationAllergyTerms,
    getMedicationAllergyRiskForMedication,
    parseMedicationAllergyFromAnamnesis,
} from '../src/modules/visits/services/medicationAllergyRisk.service';

describe('Medication allergy risk matching', () => {
    it('extracts normalized allergy terms from free text', () => {
        const terms = extractMedicationAllergyTerms('Амоксициллин, ПЕНИЦИЛЛИНЫ; цефалоспорины');

        expect(terms).toEqual(['амоксициллин', 'пенициллины', 'цефалоспорины']);
    });

    it('parses medication allergy from anamnesis json string', () => {
        const value = parseMedicationAllergyFromAnamnesis(
            JSON.stringify({ medication: 'Амоксициллин' })
        );

        expect(value).toBe('Амоксициллин');
    });

    it('detects direct medication risk by active substance', () => {
        const risk = getMedicationAllergyRiskForMedication(
            {
                nameRu: 'Амоксиклав',
                activeSubstance: 'Амоксициллин + клавулановая кислота',
                clinicalPharmGroup: 'Пенициллины',
            },
            ['амоксициллин']
        );

        expect(risk.hasMedicationRisk).toBe(true);
        expect(risk.hasGroupRisk).toBe(true);
        expect(risk.matchedMedicationTerms).toContain('амоксициллин');
    });

    it('detects group risk when allergy term matches clinical group', () => {
        const risk = getMedicationAllergyRiskForMedication(
            {
                nameRu: 'Цефтриаксон',
                activeSubstance: 'Цефтриаксон',
                clinicalPharmGroup: 'Цефалоспорины III поколения',
            },
            ['цефалоспорины']
        );

        expect(risk.hasMedicationRisk).toBe(false);
        expect(risk.hasGroupRisk).toBe(true);
        expect(risk.matchedGroupTerms).toContain('цефалоспорины');
    });

    it('returns no risk when terms do not match', () => {
        const risk = getMedicationAllergyRiskForMedication(
            {
                nameRu: 'Парацетамол',
                activeSubstance: 'Парацетамол',
                clinicalPharmGroup: 'НПВС',
            },
            ['амоксициллин']
        );

        expect(risk.hasMedicationRisk).toBe(false);
        expect(risk.hasGroupRisk).toBe(false);
    });
});