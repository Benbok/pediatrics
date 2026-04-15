/**
 * Unit tests for cdssLocalLlmService.cjs
 *
 * Tests cover pure/isolated logic extracted from the service:
 * - _extractJson: JSON extraction from raw LLM output (with markdown fences)
 * - _splitFallback: comma-split symptom extraction fallback
 * - _fallbackRanking: keyword overlap ranking
 * - parseComplaintsLocal response parsing and validation
 * - rankDiagnosesLocal response parsing and validation
 * - isLocalLlmAvailable cache logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Re-implement pure helpers locally ──────────────────────────────────────
// cdssLocalLlmService.cjs requires Electron modules (localLlmService, logger).
// We copy the pure logic here to keep tests fast and dependency-free.

function _extractJson(raw: string): string {
    let text = raw.trim();
    // Strip <think>...</think> blocks produced by reasoning models
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // Strip markdown fences
    if (text.startsWith('```json')) {
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (text.startsWith('```')) {
        text = text.replace(/```\n?/g, '').trim();
    }
    // Prefer JSON array-of-objects [{ ... }] over any bare [
    const arrayOfObjectsIdx = text.search(/\[\s*\{/);
    const objStart = text.indexOf('{');
    const arrStart = text.indexOf('[');
    let start: number, openChar: string, closeChar: string;
    if (arrayOfObjectsIdx !== -1) {
        start = arrayOfObjectsIdx; openChar = '['; closeChar = ']';
    } else if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
        start = arrStart; openChar = '['; closeChar = ']';
    } else if (objStart !== -1) {
        start = objStart; openChar = '{'; closeChar = '}';
    } else {
        return text;
    }
    let depth = 0, inString = false, escape = false;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === openChar) depth++;
        if (ch === closeChar) { depth--; if (depth === 0) return text.slice(start, i + 1); }
    }
    return text.slice(start);
}

function _splitFallback(text: string): { symptoms: string[]; severity: string; fallback: boolean } {
    const raw = text.split(/[,;\n]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 2 && s.length < 80);
    return { symptoms: raw.slice(0, 15), severity: 'medium', fallback: true };
}

function _fallbackRanking(
    symptoms: string[],
    diseases: Array<{ id: number; nameRu: string; symptoms: string[] | string }>,
    maxResults = 5
) {
    const patientRaw = symptoms.map((s) => String(s || '').toLowerCase().trim());
    return diseases
        .map((d) => {
            const raw: string[] = Array.isArray(d.symptoms)
                ? (d.symptoms as string[])
                : (() => { try { return JSON.parse(d.symptoms as string || '[]'); } catch { return []; } })();
            const diseaseRaw = raw.map((s) => String(s || '').toLowerCase().trim());
            const matchedSet = new Set<string>();
            patientRaw.forEach((pt) => {
                if (!pt) return;
                if (diseaseRaw.some((dt) => dt.includes(pt) || pt.includes(dt))) matchedSet.add(pt);
            });
            const confidence = Math.min(0.9, matchedSet.size / Math.max(symptoms.length, 1));
            return {
                diseaseId: d.id,
                confidence,
                reasoning: `Совпало ${matchedSet.size} из ${symptoms.length} симптомов (словарь)`,
                matchedSymptoms: [...matchedSet],
            };
        })
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxResults);
}

// Validation logic mirroring parseComplaintsLocal
function _validateParseResponse(parsed: unknown): { symptoms: string[]; severity: string } {
    const p = parsed as Record<string, unknown>;
    if (!Array.isArray(p.symptoms) || (p.symptoms as string[]).length === 0) {
        throw new Error('symptoms array missing or empty');
    }
    const severity = ['low', 'medium', 'high'].includes(p.severity as string)
        ? (p.severity as string)
        : 'medium';
    return { symptoms: p.symptoms as string[], severity };
}

// Validation logic mirroring rankDiagnosesLocal
function _validateRankResponse(rankings: unknown[]): Array<{
    diseaseId: number;
    confidence: number;
    reasoning: string;
    matchedSymptoms: string[];
}> {
    return rankings
        .map((r) => {
            const entry = r as Record<string, unknown>;
            return {
                diseaseId: Number(entry.diseaseId),
                confidence: Math.max(0, Math.min(1, Number(entry.confidence) || 0)),
                reasoning: (entry.reasoning as string) || 'Нет объяснения',
                matchedSymptoms: Array.isArray(entry.matchedSymptoms) ? (entry.matchedSymptoms as string[]) : [],
            };
        })
        .filter((r) => r.diseaseId && !isNaN(r.diseaseId))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
}

// Health-check cache logic mirroring isLocalLlmAvailable
function makeLlmAvailabilityCache(ttlMs: number) {
    let _cache: boolean | null = null;
    let _ts = 0;
    return {
        async check(hc: () => Promise<{ available: boolean }>): Promise<boolean> {
            const now = Date.now();
            if (_cache !== null && now - _ts < ttlMs) return _cache;
            try {
                const r = await hc();
                _cache = r.available === true;
            } catch {
                _cache = false;
            }
            _ts = Date.now();
            return _cache!;
        },
        reset() { _cache = null; _ts = 0; },
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('_extractJson', () => {
    it('returns plain JSON object unchanged', () => {
        const input = '{"symptoms":["кашель"],"severity":"low"}';
        expect(_extractJson(input)).toBe(input);
    });

    it('strips ```json markdown fence', () => {
        const raw = '```json\n{"symptoms":["температура"]}\n```';
        const result = _extractJson(raw);
        expect(result).toBe('{"symptoms":["температура"]}');
    });

    it('strips plain ``` fence', () => {
        const raw = '```\n[{"diseaseId":1}]\n```';
        const result = _extractJson(raw);
        expect(result).toBe('[{"diseaseId":1}]');
    });

    it('extracts first JSON array from mixed text', () => {
        const raw = 'Вот ответ:\n[{"diseaseId":42,"confidence":0.8}]\nСпасибо.';
        const result = _extractJson(raw);
        expect(result).toBe('[{"diseaseId":42,"confidence":0.8}]');
    });

    it('skips preamble [ bracket and finds correct JSON array-of-objects', () => {
        // Simulates LLM preamble: "симптомы [кашель, температура] совпадают:\n[{ ... }]"
        const raw = 'симптомы [кашель, температура] совпадают:\n[{"diseaseId":1,"confidence":0.85}]';
        const result = _extractJson(raw);
        expect(result).toBe('[{"diseaseId":1,"confidence":0.85}]');
    });

    it('strips <think>...</think> blocks before extraction', () => {
        const raw = '<think>Let me analyze [кашель] symptoms...</think>[{"diseaseId":7,"confidence":0.9}]';
        const result = _extractJson(raw);
        expect(result).toBe('[{"diseaseId":7,"confidence":0.9}]');
    });

    it('extracts JSON object when no array present', () => {
        const raw = 'Извлечённые данные: {"symptoms":["озноб"],"severity":"high"}';
        const result = _extractJson(raw);
        expect(result).toBe('{"symptoms":["озноб"],"severity":"high"}');
    });

    it('prefers array over object when array comes first', () => {
        const raw = '[{"id":1}] {"other":true}';
        const result = _extractJson(raw);
        expect(result).toBe('[{"id":1}]');
    });
});

describe('_splitFallback', () => {
    it('splits by comma into symptoms', () => {
        const result = _splitFallback('кашель, температура, насморк');
        expect(result.fallback).toBe(true);
        expect(result.severity).toBe('medium');
        expect(result.symptoms).toContain('кашель');
        expect(result.symptoms).toContain('температура');
    });

    it('splits by semicolon', () => {
        const result = _splitFallback('одышка; тахикардия; цианоз');
        expect(result.symptoms.length).toBeGreaterThanOrEqual(2);
    });

    it('filters out tokens shorter than 3 characters', () => {
        const result = _splitFallback('кашель, до, температура');
        expect(result.symptoms).not.toContain('до');
    });

    it('caps at 15 symptoms', () => {
        const many = Array.from({ length: 20 }, (_, i) => `симптом${i}`).join(', ');
        const result = _splitFallback(many);
        expect(result.symptoms.length).toBeLessThanOrEqual(15);
    });

    it('filters out very long tokens (>=80 chars)', () => {
        const long = 'а'.repeat(85);
        const result = _splitFallback(`кашель, ${long}`);
        expect(result.symptoms.every((s) => s.length < 80)).toBe(true);
    });
});

describe('_fallbackRanking', () => {
    const symptoms = ['кашель', 'температура', 'одышка'];
    const diseases = [
        { id: 1, nameRu: 'Пневмония', symptoms: ['кашель', 'температура', 'одышка', 'хрипы'] },
        { id: 2, nameRu: 'ОРВИ', symptoms: ['кашель', 'насморк', 'температура'] },
        { id: 3, nameRu: 'Гастрит', symptoms: ['боль в животе', 'тошнота'] },
    ];

    it('returns disease with most symptom overlap first', () => {
        const result = _fallbackRanking(symptoms, diseases);
        expect(result[0].diseaseId).toBe(1);
    });

    it('confidence is proportional to matches / total symptoms', () => {
        const result = _fallbackRanking(symptoms, diseases);
        const pneu = result.find((r) => r.diseaseId === 1)!;
        const orvi = result.find((r) => r.diseaseId === 2)!;
        expect(pneu.confidence).toBeGreaterThan(orvi.confidence);
    });

    it('caps confidence at 0.9', () => {
        const s = ['кашель'];
        const d = [{ id: 10, nameRu: 'Тест', symptoms: ['кашель'] }];
        const result = _fallbackRanking(s, d);
        expect(result[0].confidence).toBeLessThanOrEqual(0.9);
    });

    it('disease with no matching symptoms gets confidence 0', () => {
        const result = _fallbackRanking(symptoms, diseases);
        const gastrit = result.find((r) => r.diseaseId === 3)!;
        expect(gastrit.confidence).toBe(0);
    });

    it('matches by substring: short patient term found inside long disease term', () => {
        // "температура" should match "Температура тела > 38°C" (real-world DB format)
        const d = [{ id: 20, nameRu: 'Болезнь', symptoms: ['Температура тела > 38°C', 'Кашель влажный'] }];
        const result = _fallbackRanking(['температура', 'кашель'], d);
        expect(result[0].matchedSymptoms.length).toBe(2);
        expect(result[0].confidence).toBeGreaterThan(0);
    });

    it('handles stringified JSON symptoms array', () => {
        const d = [{ id: 5, nameRu: 'Тест', symptoms: '["кашель","температура"]' }];
        const result = _fallbackRanking(['кашель', 'температура'], d);
        expect(result[0].matchedSymptoms.length).toBe(2);
    });

    it('returns max 5 results', () => {
        const manyDiseases = Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            nameRu: `Болезнь ${i}`,
            symptoms: ['кашель'],
        }));
        const result = _fallbackRanking(['кашель'], manyDiseases);
        expect(result.length).toBe(5);
    });
});

describe('parseComplaintsLocal response validation', () => {
    it('accepts valid JSON with symptoms and severity', () => {
        const raw = '{"symptoms":["кашель","температура"],"severity":"high"}';
        const parsed = JSON.parse(_extractJson(raw));
        const validated = _validateParseResponse(parsed);
        expect(validated.symptoms).toEqual(['кашель', 'температура']);
        expect(validated.severity).toBe('high');
    });

    it('defaults severity to medium when missing', () => {
        const raw = '{"symptoms":["кашель"]}';
        const parsed = JSON.parse(_extractJson(raw));
        const validated = _validateParseResponse(parsed);
        expect(validated.severity).toBe('medium');
    });

    it('defaults severity to medium when invalid value', () => {
        const raw = '{"symptoms":["кашель"],"severity":"critical"}';
        const parsed = JSON.parse(_extractJson(raw));
        const validated = _validateParseResponse(parsed);
        expect(validated.severity).toBe('medium');
    });

    it('throws when symptoms array is missing', () => {
        const raw = '{"severity":"low"}';
        const parsed = JSON.parse(_extractJson(raw));
        expect(() => _validateParseResponse(parsed)).toThrow('symptoms array missing or empty');
    });

    it('throws when symptoms array is empty', () => {
        const raw = '{"symptoms":[],"severity":"low"}';
        const parsed = JSON.parse(_extractJson(raw));
        expect(() => _validateParseResponse(parsed)).toThrow('symptoms array missing or empty');
    });

    it('parses response wrapped in markdown fence', () => {
        const raw = '```json\n{"symptoms":["одышка"],"severity":"medium"}\n```';
        const parsed = JSON.parse(_extractJson(raw));
        const validated = _validateParseResponse(parsed);
        expect(validated.symptoms).toEqual(['одышка']);
    });
});

describe('rankDiagnosesLocal response validation', () => {
    it('filters out items with invalid diseaseId', () => {
        const raw = [
            { diseaseId: 42, confidence: 0.8, reasoning: 'ok', matchedSymptoms: ['кашель'] },
            { diseaseId: null, confidence: 0.9, reasoning: 'bad', matchedSymptoms: [] },
            { diseaseId: 'abc', confidence: 0.7, reasoning: 'bad2', matchedSymptoms: [] },
        ];
        const result = _validateRankResponse(raw);
        expect(result.length).toBe(1);
        expect(result[0].diseaseId).toBe(42);
    });

    it('clamps confidence to [0, 1]', () => {
        const raw = [
            { diseaseId: 1, confidence: 1.5, reasoning: 'test', matchedSymptoms: [] },
            { diseaseId: 2, confidence: -0.3, reasoning: 'test2', matchedSymptoms: [] },
        ];
        const result = _validateRankResponse(raw);
        expect(result[0].confidence).toBe(1);
        expect(result[1].confidence).toBe(0);
    });

    it('sorts by confidence descending', () => {
        const raw = [
            { diseaseId: 1, confidence: 0.3, reasoning: 'low', matchedSymptoms: [] },
            { diseaseId: 2, confidence: 0.9, reasoning: 'high', matchedSymptoms: [] },
            { diseaseId: 3, confidence: 0.6, reasoning: 'mid', matchedSymptoms: [] },
        ];
        const result = _validateRankResponse(raw);
        expect(result.map((r) => r.diseaseId)).toEqual([2, 3, 1]);
    });

    it('caps output at 5 results', () => {
        const raw = Array.from({ length: 8 }, (_, i) => ({
            diseaseId: i + 1,
            confidence: 0.5,
            reasoning: 'test',
            matchedSymptoms: [],
        }));
        const result = _validateRankResponse(raw);
        expect(result.length).toBe(5);
    });

    it('defaults reasoning to placeholder when absent', () => {
        const raw = [{ diseaseId: 10, confidence: 0.5 }];
        const result = _validateRankResponse(raw);
        expect(result[0].reasoning).toBe('Нет объяснения');
    });

    it('defaults matchedSymptoms to empty array when absent', () => {
        const raw = [{ diseaseId: 10, confidence: 0.5, matchedSymptoms: undefined }];
        const result = _validateRankResponse(raw);
        expect(result[0].matchedSymptoms).toEqual([]);
    });

    it('parses valid array from markdown fence', () => {
        const raw = '```json\n[{"diseaseId":7,"confidence":0.75,"reasoning":"Х","matchedSymptoms":["кашель"]}]\n```';
        const parsed = JSON.parse(_extractJson(raw));
        const result = _validateRankResponse(parsed);
        expect(result[0].diseaseId).toBe(7);
        expect(result[0].matchedSymptoms).toEqual(['кашель']);
    });
});

describe('isLocalLlmAvailable — cache logic', () => {
    it('returns true when healthCheck resolves available:true', async () => {
        const cache = makeLlmAvailabilityCache(30_000);
        const hc = vi.fn().mockResolvedValue({ available: true });
        const result = await cache.check(hc);
        expect(result).toBe(true);
        expect(hc).toHaveBeenCalledTimes(1);
    });

    it('returns false when healthCheck resolves available:false', async () => {
        const cache = makeLlmAvailabilityCache(30_000);
        const hc = vi.fn().mockResolvedValue({ available: false });
        expect(await cache.check(hc)).toBe(false);
    });

    it('returns false when healthCheck rejects', async () => {
        const cache = makeLlmAvailabilityCache(30_000);
        const hc = vi.fn().mockRejectedValue(new Error('connection refused'));
        expect(await cache.check(hc)).toBe(false);
    });

    it('uses cached result within TTL (does not call healthCheck again)', async () => {
        const cache = makeLlmAvailabilityCache(30_000);
        const hc = vi.fn().mockResolvedValue({ available: true });
        await cache.check(hc);
        await cache.check(hc);
        await cache.check(hc);
        expect(hc).toHaveBeenCalledTimes(1);
    });

    it('re-checks after TTL expires', async () => {
        const cache = makeLlmAvailabilityCache(10); // 10 ms TTL
        const hc = vi.fn().mockResolvedValue({ available: true });
        await cache.check(hc);
        await new Promise((r) => setTimeout(r, 20)); // wait past TTL
        await cache.check(hc);
        expect(hc).toHaveBeenCalledTimes(2);
    });
});
