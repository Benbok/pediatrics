import { describe, expect, it } from 'vitest';

const {
    normalizeDiseaseData,
    resolveTestNameFromCatalog,
} = require('../electron/utils/diseaseNormalization.cjs');

describe('Disease test name resolution', () => {
    const catalog = [
        {
            nameRu: 'Анализ кала',
            aliases: JSON.stringify(['копрограмма', 'анализ кала']),
        },
        {
            nameRu: 'Общий анализ крови',
            aliases: JSON.stringify(['оак']),
        },
    ];

    it('does not replace custom test name in strict mode (upsert scenario)', () => {
        const input = {
            icd10Code: 'J18',
            icd10Codes: ['J18'],
            nameRu: 'Тестовое заболевание',
            symptoms: [],
            treatmentPlan: [],
            clinicalRecommendations: [],
            differentialDiagnosis: [],
            redFlags: [],
            diagnosticPlan: [
                {
                    type: 'lab',
                    test: 'Общий анализ крови (развернутый)',
                    priority: 'high',
                    rationale: 'Проверка лейкоцитов',
                },
            ],
        };

        const normalized = normalizeDiseaseData(input, catalog, {
            allowFuzzyCatalogMatch: false,
        });

        expect(normalized.diagnosticPlan[0].test).toBe('Общий анализ крови (развернутый)');
        expect(normalized.diagnosticPlan[0].rationale).toBe('Проверка лейкоцитов');
    });

    it('keeps exact alias replacement in strict mode', () => {
        const resolved = resolveTestNameFromCatalog('оак', catalog, { allowFuzzy: false });
        expect(resolved).toBe('Общий анализ крови');
    });

    it('keeps fuzzy behavior available when explicitly enabled', () => {
        const resolved = resolveTestNameFromCatalog('копрограммаа', catalog, { allowFuzzy: true });
        expect(resolved).toBe('Анализ кала');
    });
});
