import { describe, expect, it } from 'vitest';
import type { DiagnosticRecommendationWithCodes } from '../src/types';
import { sortDiagnosticsByPriority } from '../src/modules/visits/utils/diagnosticPriority';

function createDiagnostic(test: string, priority?: 'low' | 'medium' | 'high'): DiagnosticRecommendationWithCodes {
    return {
        item: {
            type: 'lab',
            test,
            priority,
        },
        sourceDiseaseName: 'Test disease',
        sourceDiseaseId: 1,
        icd10Codes: ['J00'],
    };
}

describe('sortDiagnosticsByPriority', () => {
    it('sorts diagnostics by priority from high to low', () => {
        const input: DiagnosticRecommendationWithCodes[] = [
            createDiagnostic('Gamma', 'low'),
            createDiagnostic('Beta', 'medium'),
            createDiagnostic('Alpha', 'high'),
        ];

        const result = sortDiagnosticsByPriority(input);

        expect(result.map(x => x.item.test)).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('sorts by test name when priorities are equal', () => {
        const input: DiagnosticRecommendationWithCodes[] = [
            createDiagnostic('Билирубин', 'medium'),
            createDiagnostic('АЛТ', 'medium'),
            createDiagnostic('АСТ', 'medium'),
        ];

        const result = sortDiagnosticsByPriority(input);

        expect(result.map(x => x.item.test)).toEqual(['АЛТ', 'АСТ', 'Билирубин']);
    });

    it('puts missing priority after known priorities', () => {
        const input: DiagnosticRecommendationWithCodes[] = [
            createDiagnostic('Без приоритета'),
            createDiagnostic('Высокий', 'high'),
            createDiagnostic('Низкий', 'low'),
        ];

        const result = sortDiagnosticsByPriority(input);

        expect(result.map(x => x.item.test)).toEqual(['Высокий', 'Низкий', 'Без приоритета']);
    });
});
