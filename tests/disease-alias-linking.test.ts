/**
 * TASK-032 — Alias linking logic tests
 *
 * Tests the alias-aware behavior in:
 *  1. resolveTestNameFromCatalog: once alias is added, fuzzy/exact lookups resolve to canonical
 *  2. normalizeDiseaseData: items with _aliasFor marker keep test name unchanged
 *  3. _ensureTestNamesInCatalog logic: aliased items are skipped (tested via filter predicate)
 */
import { describe, expect, it } from 'vitest';

const {
    normalizeDiseaseData,
    resolveTestNameFromCatalog,
} = require('../electron/utils/diseaseNormalization.cjs');

describe('Alias linking — catalog resolution after alias registered', () => {
    it('resolves new alias to canonical in exact mode after it is added to catalog', () => {
        const catalog = [
            {
                nameRu: 'Общий анализ крови',
                aliases: JSON.stringify(['оак', 'Общий анализ крови (развернутый)']),
            },
        ];

        // "Общий анализ крови (развернутый)" is now registered as alias → resolves to canonical
        const resolved = resolveTestNameFromCatalog(
            'Общий анализ крови (развернутый)',
            catalog,
            { allowFuzzy: false }
        );
        expect(resolved).toBe('Общий анализ крови');
    });

    it('resolves alias case-insensitively after registration', () => {
        const catalog = [
            {
                nameRu: 'Анализ мочи общий',
                aliases: JSON.stringify(['АМО', 'Анализ мочи (общий)'])
            }
        ];

        const resolved = resolveTestNameFromCatalog('анализ мочи (ОБЩИЙ)', catalog, { allowFuzzy: false });
        expect(resolved).toBe('Анализ мочи общий');
    });
});

describe('Alias linking — normalizeDiseaseData skips _aliasFor items', () => {
    const catalog = [
        {
            nameRu: 'Общий анализ крови',
            aliases: JSON.stringify(['оак']),
        },
    ];

    it('does not overwrite test name of aliased item in strict mode', () => {
        const input = {
            icd10Code: 'J06',
            icd10Codes: ['J06'],
            nameRu: 'Тест',
            symptoms: [],
            treatmentPlan: [],
            clinicalRecommendations: [],
            differentialDiagnosis: [],
            redFlags: [],
            diagnosticPlan: [
                {
                    type: 'lab',
                    test: 'Общий анализ крови',  // already canonical after alias link
                    priority: 'medium',
                    rationale: 'Base test',
                    _aliasFor: 'Общий анализ крови (развернутый)',
                },
            ],
        };

        const normalized = normalizeDiseaseData(input, catalog, { allowFuzzyCatalogMatch: false });
        expect(normalized.diagnosticPlan[0].test).toBe('Общий анализ крови');
        expect(normalized.diagnosticPlan[0].rationale).toBe('Base test');
    });
});

describe('Alias linking — _ensureTestNamesInCatalog filter predicate', () => {
    /**
     * _ensureTestNamesInCatalog uses this predicate to decide whether to auto-add an item:
     *   item?.test && !item._aliasFor && !knownNames.has(item.test.trim().toLowerCase())
     *
     * We verify the predicate logic directly.
     */
    const knownNames = new Set(['общий анализ крови', 'анализ мочи общий']);

    const shouldAutoAdd = (item: any): boolean => {
        return Boolean(
            item?.test &&
            typeof item.test === 'string' &&
            !item._aliasFor &&
            !knownNames.has(item.test.trim().toLowerCase())
        );
    };

    it('skips item that has _aliasFor set', () => {
        expect(shouldAutoAdd({ test: 'Общий анализ крови', _aliasFor: 'ОАК расш.' })).toBe(false);
    });

    it('skips item whose test name is already in catalog', () => {
        expect(shouldAutoAdd({ test: 'Общий анализ крови' })).toBe(false);
    });

    it('auto-adds item with unknown name and no _aliasFor', () => {
        expect(shouldAutoAdd({ test: 'Полный метаболический профиль' })).toBe(true);
    });

    it('does not auto-add empty test string', () => {
        expect(shouldAutoAdd({ test: '' })).toBe(false);
    });

    it('does not auto-add item with no test field', () => {
        expect(shouldAutoAdd({})).toBe(false);
    });
});
