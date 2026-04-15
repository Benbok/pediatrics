import type { AllergyStatusData } from '../../../types';

const MIN_TERM_LENGTH = 3;
const MIN_TERM_LENGTH_FOR_WORD_MATCH = 6;
const MIN_WORD_LENGTH_FOR_WORD_MATCH = 4;

export interface MedicationAllergyRisk {
    hasMedicationRisk: boolean;
    hasGroupRisk: boolean;
    matchedMedicationTerms: string[];
    matchedGroupTerms: string[];
}

function normalizeText(value: string): string {
    return value
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-zа-я0-9\s-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function hasTokenMatch(target: string, token: string): boolean {
    if (!target || !token || token.length < MIN_TERM_LENGTH) return false;
    if (target.includes(token)) return true;

    if (token.length >= MIN_TERM_LENGTH_FOR_WORD_MATCH) {
        const tokenWords = token.split(' ').filter((word) => word.length >= MIN_WORD_LENGTH_FOR_WORD_MATCH);
        return tokenWords.some((word) => target.includes(word));
    }

    return false;
}

export function extractMedicationAllergyTerms(allergyMedicationText?: string | null): string[] {
    if (!allergyMedicationText) return [];

    const fragments = allergyMedicationText
        .split(/[,;\n|/]+|\sи\s/gi)
        .map((part) => normalizeText(part))
        .filter((part) => part.length >= MIN_TERM_LENGTH);

    return Array.from(new Set(fragments));
}

export function parseMedicationAllergyFromAnamnesis(
    value?: AllergyStatusData | string | null
): string | null {
    if (!value) return null;

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value) as AllergyStatusData;
            const medication = (parsed?.medication ?? '').trim();
            return medication.length > 0 ? medication : null;
        } catch {
            return null;
        }
    }

    const medication = (value.medication ?? '').trim();
    return medication.length > 0 ? medication : null;
}

export function getMedicationAllergyRiskForMedication(
    medication: {
        nameRu?: string | null;
        activeSubstance?: string | null;
        clinicalPharmGroup?: string | null;
    },
    allergyTerms: string[]
): MedicationAllergyRisk {
    if (allergyTerms.length === 0) {
        return {
            hasMedicationRisk: false,
            hasGroupRisk: false,
            matchedMedicationTerms: [],
            matchedGroupTerms: [],
        };
    }

    const medicationIndex = normalizeText([
        medication.nameRu ?? '',
        medication.activeSubstance ?? '',
    ].join(' '));
    const groupIndex = normalizeText(medication.clinicalPharmGroup ?? '');

    const matchedMedicationTerms = allergyTerms.filter((term) => hasTokenMatch(medicationIndex, term));
    const matchedGroupTerms = allergyTerms.filter((term) => hasTokenMatch(groupIndex, term));

    const hasMedicationRisk = matchedMedicationTerms.length > 0;
    const hasGroupRisk = matchedGroupTerms.length > 0 || (hasMedicationRisk && Boolean(groupIndex));

    return {
        hasMedicationRisk,
        hasGroupRisk,
        matchedMedicationTerms,
        matchedGroupTerms,
    };
}