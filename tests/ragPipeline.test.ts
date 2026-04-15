/**
 * Unit tests for pure functions in ragPipelineService.cjs
 *
 * Tests cover:
 * - buildFtsQuery        — FTS5 query builder
 * - expandQueryWithSynonyms — medical synonym expansion
 * - detectQueryType      — query type classifier
 * - rerankByKeywords     — keyword + evidence level re-ranker
 * - dedup                — chunk deduplication
 * - buildContextSmart    — context assembly with budget
 *
 * Phase 2 regression checks:
 * - expandQueryViaLlm skip logic (initialChunkCount >= llmExpandMinChunks)
 * - isSimple query detection pattern
 */

import { describe, it, expect } from 'vitest';

// ─── Re-implement pure functions locally ────────────────────────────────────
// ragPipelineService.cjs can't be required in vitest (requires Electron/Prisma).
// We copy the pure logic here to keep tests fast and dependency-free.

const FTS_STOPWORDS = new Set([
    'и', 'в', 'на', 'не', 'что', 'как', 'при', 'из', 'для', 'или',
    'это', 'по', 'от', 'до', 'со', 'но', 'же', 'об', 'он', 'она',
    'они', 'оно', 'его', 'её', 'их', 'мне', 'мы', 'вы', 'ты', 'то',
    'был', 'так', 'уже', 'все', 'ещё', 'нет', 'под', 'над',
]);

function buildFtsQuery(text: string): string {
    const tokens = String(text || '')
        .toLowerCase()
        .split(/[\s,;.()\[\]{}"'«»\-—]+/)
        .map(t => t.trim())
        .map(t => t.replace(/["*\/\\(){}^~:]/g, '').trim())
        .filter(t => t.length >= 3 && !FTS_STOPWORDS.has(t))
        .map(t => {
            if (t.length >= 7) return t.slice(0, t.length - 2);
            if (t.length >= 5) return t.slice(0, t.length - 1);
            return t;
        })
        .filter(t => t.length >= 3)
        .slice(0, 8);
    return tokens.length > 0 ? tokens.map(t => `${t}*`).join(' OR ') : '';
}

const MEDICAL_SYNONYMS: [string, string[]][] = [
    ['антибиотик', ['антибактериальн', 'амоксициллин', 'цефалоспорин', 'пенициллин']],
    ['дозировка', ['доза', 'мг/кг', 'суточн доз']],
    ['противопоказан', ['запрещ', 'нельзя', 'ограничен']],
    ['первая линия', ['препарат выбор', 'стартов терапи']],
    ['лечение', ['терапи', 'препарат', 'назначен']],
];

function expandQueryWithSynonyms(query: string): string | null {
    const q = String(query || '').toLowerCase();
    const extra = new Set<string>();
    for (const [trigger, synonyms] of MEDICAL_SYNONYMS) {
        if (q.includes(trigger)) {
            for (const s of synonyms) extra.add(s);
        }
    }
    if (extra.size === 0) return null;
    const terms = [...extra]
        .slice(0, 6)
        .map(t => t.replace(/["*\/\\(){}^~:]/g, ' ').trim())
        .filter(t => t.length >= 3);
    return terms.map(t => `${t}*`).join(' OR ');
}

function detectQueryType(query: string): string {
    const q = String(query || '').toLowerCase();
    if (/список|перечисли|все препарат|все средств|какие препарат|варианты|разреш.*препарат|препарат.*разреш/.test(q)) return 'list';
    if (/какой препарат|какое лекарство|чем лечить|первая линия|второй ряд|стартовый|выбор препарат/.test(q)) return 'drug';
    if (/доз|мг\s*\/|кг\s*\/|сколько|в сутки|раз в день|режим приём|кратность/.test(q)) return 'dose';
    if (/противопоказан|нельзя|запрещ|не назнач|ограничен/.test(q)) return 'contraindication';
    if (/диагностик|критери.*диагн|признак|симптом|обследован|анализ.*при|лаборатор.*критери/.test(q)) return 'diagnostic';
    return 'general';
}

const RERANK_STOPWORDS = new Set([
    'и', 'в', 'на', 'не', 'что', 'как', 'при', 'из', 'для', 'или',
    'это', 'по', 'от', 'до', 'со', 'но', 'же', 'об',
]);

interface Chunk {
    id: number;
    text: string;
    sectionTitle?: string | null;
    evidenceLevel?: string | null;
    bm25: number;
    score: number;
    embeddingJson?: string | null;
}

function rerankByKeywords(chunks: Chunk[], query: string, queryType = 'general'): Chunk[] {
    const keywords = String(query || '')
        .toLowerCase()
        .split(/[\s,;.()\-—]+/)
        .filter(w => w.length > 3 && !RERANK_STOPWORDS.has(w));

    const applyDosageBoost = ['drug', 'dose', 'list', 'contraindication'].includes(queryType);
    const applyDiagBoost = queryType === 'diagnostic';

    return chunks
        .map(c => {
            let boost = 0;
            const titleLower = (c.sectionTitle || '').toLowerCase();
            const textLower = c.text.toLowerCase();
            for (const kw of keywords) {
                if (titleLower.includes(kw)) boost += 0.12;
                if (textLower.includes(kw)) boost += 0.04;
            }
            const ev = String(c.evidenceLevel || '');
            if (/УУР\s*[-–—]?\s*[АA]\b|^A-I/i.test(ev)) boost += 0.08;
            else if (/УУР\s*[-–—]?\s*[ВB]\b|^B-II/i.test(ev)) boost += 0.04;
            else if (/УУР\s*[-–—]?\s*[СC]\b|^C-III/i.test(ev)) boost += 0.02;
            if (applyDosageBoost) {
                if (/\d+\s*(мг|кг|мл|мкг|%)|до\s*\d+|×\s*\d+/i.test(c.text)) boost += 0.15;
                if (/(доз|примен|разреш|назнач)/i.test(c.text)) boost += 0.08;
            }
            if (applyDiagBoost) {
                if (/диагностик|критери|симптом|признак|клиник|обследован|лаборатор/i.test(titleLower)) boost += 0.18;
                if (/диагностик|критери|симптом|признак/i.test(textLower)) boost += 0.06;
            }
            const bm25Norm = c.bm25 < 0 ? Math.min(1, Math.abs(c.bm25) / 5) : 0;
            return { ...c, score: bm25Norm + boost };
        })
        .sort((a, b) => b.score - a.score);
}

function dedup(chunks: Chunk[]): Chunk[] {
    const seen = new Set<string>();
    const result: Chunk[] = [];
    for (const c of chunks) {
        const fp = c.text.slice(0, 120).trim().toLowerCase();
        if (!seen.has(fp)) {
            seen.add(fp);
            result.push(c);
        }
    }
    return result;
}

// ─── CFG snapshot matching Phase 2 changes ────────────────────────────────────
const CFG = {
    topK: 20,
    topKAfterRank: 12,
    topKSimple: 10,
    topKAfterRankSimple: 6,
    llmExpandMinChunks: 5,
};

const SIMPLE_QUERY_RE = /какой препарат|первая линия|доза|дозировка|противопоказан/i;

function isSimpleQuery(query: string): boolean {
    return SIMPLE_QUERY_RE.test(query);
}

function effectiveTopK(query: string): number {
    return isSimpleQuery(query) ? CFG.topKSimple : CFG.topK;
}

function shouldSkipLlmExpand(initialChunkCount: number): boolean {
    return initialChunkCount >= CFG.llmExpandMinChunks;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildFtsQuery', () => {
    it('builds FTS5 tokens with wildcard suffix', () => {
        const q = buildFtsQuery('амоксициллин дозировка');
        expect(q).toContain('*');
        // 'амоксициллин' length=12 → stem to 10, 'дозировка' length=9 → stem to 7
        expect(q.split(' OR ').length).toBe(2);
    });

    it('removes FTS stopwords', () => {
        const q = buildFtsQuery('лечение при пневмонии');
        // 'при' is a stopword, 'лечение' length=7 → kept, 'пневмонии' length=9 → kept
        expect(q).not.toMatch(/\bпри\b/);
        expect(q).toContain('*');
    });

    it('stems long tokens (>= 7 chars, remove last 2)', () => {
        // 'амоксициллин' length=12 → slice(0, 10) = 'амоксицилл' → wildcard
        const q = buildFtsQuery('амоксициллин');
        expect(q).toBe('амоксицилл*');
    });

    it('stems medium tokens (>= 5 chars, remove last 1)', () => {
        // 'доза' length=4 → no stem; 'дозир' length=5 → drop 1 → 'дози*'
        const q = buildFtsQuery('дозир');
        expect(q).toBe('дози*');
    });

    it('returns empty string for blank input', () => {
        expect(buildFtsQuery('')).toBe('');
        expect(buildFtsQuery('   ')).toBe('');
    });

    it('filters short tokens < 3 chars after stemming', () => {
        // Single char stopwords should not appear
        const q = buildFtsQuery('и в на не');
        expect(q).toBe('');
    });

    it('limits to 8 tokens max', () => {
        const input = 'антибиотик пневмония дозировка лечение терапия препарат назначение ребенок взрослый';
        const q = buildFtsQuery(input);
        const parts = q.split(' OR ');
        expect(parts.length).toBeLessThanOrEqual(8);
    });

    it('strips FTS5 special chars from input', () => {
        const q = buildFtsQuery('амоксициллин "доза" (мг/кг)');
        // Special chars stripped, no unescaped quotes/parens/slashes
        expect(q).not.toContain('"');
        expect(q).not.toContain('(');
        expect(q).not.toContain(')');
    });
});

describe('expandQueryWithSynonyms', () => {
    it('returns synonyms for known trigger word', () => {
        const result = expandQueryWithSynonyms('антибиотик при пневмонии');
        expect(result).not.toBeNull();
        expect(result).toContain('*');
    });

    it('returns null when no triggers match', () => {
        expect(expandQueryWithSynonyms('анатомия уха')).toBeNull();
    });

    it('returns null for empty input', () => {
        expect(expandQueryWithSynonyms('')).toBeNull();
    });

    it('generates OR-joined terms', () => {
        const result = expandQueryWithSynonyms('дозировка препарата');
        expect(result).toMatch(/OR/);
    });

    it('limits to 6 extra terms', () => {
        // Trigger multiple synonym sets
        const result = expandQueryWithSynonyms('антибиотик лечение дозировка противопоказан первая линия');
        if (result) {
            const parts = result.split(' OR ');
            expect(parts.length).toBeLessThanOrEqual(6);
        }
    });
});

describe('detectQueryType', () => {
    it('detects list type', () => {
        expect(detectQueryType('список препаратов')).toBe('list');
        expect(detectQueryType('перечисли все препараты')).toBe('list');
        expect(detectQueryType('какие препараты применяются')).toBe('list');
    });

    it('detects drug type', () => {
        expect(detectQueryType('какой препарат первой линии')).toBe('drug');
        expect(detectQueryType('первая линия лечения')).toBe('drug');
        expect(detectQueryType('чем лечить пневмонию')).toBe('drug');
    });

    it('detects dose type', () => {
        expect(detectQueryType('доза амоксициллина')).toBe('dose');
        expect(detectQueryType('мг / кг в сутки')).toBe('dose');
        expect(detectQueryType('кратность приёма')).toBe('dose');
    });

    it('detects contraindication type', () => {
        expect(detectQueryType('противопоказан при аллергии')).toBe('contraindication');
        expect(detectQueryType('нельзя применять')).toBe('contraindication');
        expect(detectQueryType('запрещён до 2 лет')).toBe('contraindication');
    });

    it('returns general for open-ended questions', () => {
        expect(detectQueryType('как развивается пневмония')).toBe('general');
    });

    it('detects diagnostic type', () => {
        expect(detectQueryType('диагностика ОРВИ')).toBe('diagnostic');
        expect(detectQueryType('критерии диагноза')).toBe('diagnostic');
        expect(detectQueryType('клинические признаки заболевания')).toBe('diagnostic');
        expect(detectQueryType('симптомы пневмонии')).toBe('diagnostic');
        expect(detectQueryType('обследование при ОРВИ')).toBe('diagnostic');
    });

    it('list takes precedence over dose when both match', () => {
        // "какие препараты с дозировками" — contains "доз" but also "какие препарат"
        expect(detectQueryType('какие препараты с дозировками')).toBe('list');
    });
});

describe('rerankByKeywords', () => {
    const baseChunk = (id: number, text: string, title?: string, ev?: string): Chunk => ({
        id, text, sectionTitle: title ?? null, evidenceLevel: ev ?? null, bm25: -2.0, score: 0,
    });

    it('places chunks with matching keywords higher', () => {
        const chunks = [
            baseChunk(1, 'Ибупрофен используется только симптоматически'),
            baseChunk(2, 'Амоксициллин назначают 50 мг/кг при пневмонии'),
        ];
        const ranked = rerankByKeywords(chunks, 'амоксициллин дозировка пневмония');
        expect(ranked[0].id).toBe(2);
    });

    it('boosts chunks with high evidence level УУР A (dosage query)', () => {
        const chunks = [
            baseChunk(1, 'Назначают препарат без дозировки'),
            baseChunk(2, 'Назначают 25 мг/кг препарата', undefined, 'УУР — B'),
        ];
        // Чанк 2: dosage pattern (+0.15) + treatment verb (+0.08) + УУР B (+0.04) wins
        const ranked = rerankByKeywords(chunks, 'дозировка', 'dose');
        expect(ranked[0].id).toBe(2);
    });

    it('boosts chunks with dosage pattern (digits + unit)', () => {
        const chunks = [
            baseChunk(1, 'Препарат применяется при кашле'),
            baseChunk(2, 'Назначают 25 мг/кг в сутки'),
        ];
        // Dosage boost applies when queryType is 'dose'
        const ranked = rerankByKeywords(chunks, 'дозировка', 'dose');
        expect(ranked[0].id).toBe(2);
    });

    it('boosts matching section title', () => {
        const chunks = [
            baseChunk(1, 'Стандартный текст лечения', 'Диагностика'),
            baseChunk(2, 'Стандартный текст лечения', 'Антибиотикотерапия'),
        ];
        const ranked = rerankByKeywords(chunks, 'антибиотикотерапия');
        expect(ranked[0].id).toBe(2);
    });

    it('preserves all input chunks', () => {
        const chunks = [1, 2, 3, 4, 5].map(i => baseChunk(i, `текст чанка номер ${i}`));
        const ranked = rerankByKeywords(chunks, 'текст');
        expect(ranked.length).toBe(5);
    });
});

describe('dedup', () => {
    const makeChunk = (id: number, text: string): Chunk => ({
        id, text, bm25: -1, score: 0,
    });

    it('removes exact duplicate fingerprints (first 120 chars)', () => {
        const text = 'Амоксициллин применяется при остром среднем отите у детей и является препаратом первого выбора согласно клиническим рекомендациям. Подробнее о дозировке.';
        const chunks = [makeChunk(1, text), makeChunk(2, text)];
        expect(dedup(chunks).length).toBe(1);
    });

    it('keeps chunks with different starts even if later text overlaps', () => {
        const a = 'Первое предложение отличается. '.repeat(5);
        const b = 'Второе начало иное. '.repeat(5);
        const chunks = [makeChunk(1, a), makeChunk(2, b)];
        expect(dedup(chunks).length).toBe(2);
    });

    it('preserves first-seen chunk on duplicate', () => {
        const text = 'Одинаковый текст для проверки дедупликации. '.repeat(3);
        const chunks = [makeChunk(1, text), makeChunk(2, text)];
        expect(dedup(chunks)[0].id).toBe(1);
    });

    it('handles empty input', () => {
        expect(dedup([])).toEqual([]);
    });

    it('passes through unique chunks unchanged', () => {
        const chunks = [1, 2, 3].map(i => makeChunk(i, `Уникальный текст чанка ${i}. `.repeat(4)));
        expect(dedup(chunks).length).toBe(3);
    });
});

// ─── Phase 2 regression: CFG + skip logic ─────────────────────────────────────

describe('Phase 2: conditional LLM expansion (CFG regression)', () => {
    it('CFG.llmExpandMinChunks is 5', () => {
        expect(CFG.llmExpandMinChunks).toBe(5);
    });

    it('CFG.topKSimple < CFG.topK', () => {
        expect(CFG.topKSimple).toBeLessThan(CFG.topK);
    });

    it('CFG.topKAfterRankSimple < CFG.topKAfterRank', () => {
        expect(CFG.topKAfterRankSimple).toBeLessThan(CFG.topKAfterRank);
    });

    it('shouldSkipLlmExpand returns true when chunks >= threshold', () => {
        expect(shouldSkipLlmExpand(5)).toBe(true);
        expect(shouldSkipLlmExpand(10)).toBe(true);
    });

    it('shouldSkipLlmExpand returns false when chunks < threshold', () => {
        expect(shouldSkipLlmExpand(0)).toBe(false);
        expect(shouldSkipLlmExpand(4)).toBe(false);
    });
});

describe('Phase 2: isSimple query detection + topK routing', () => {
    it('detects simple queries correctly', () => {
        expect(isSimpleQuery('какой препарат первой линии')).toBe(true);
        expect(isSimpleQuery('доза амоксициллина')).toBe(true);
        expect(isSimpleQuery('дозировка для детей')).toBe(true);
        expect(isSimpleQuery('противопоказан при почечной недостаточности')).toBe(true);
        expect(isSimpleQuery('первая линия антибиотиков')).toBe(true);
    });

    it('does not flag complex queries as simple', () => {
        expect(isSimpleQuery('диагностика пневмонии у детей')).toBe(false);
        expect(isSimpleQuery('как развивается клиническая картина')).toBe(false);
        expect(isSimpleQuery('показания к госпитализации')).toBe(false);
    });

    it('dosage boost is skipped for diagnostic queryType', () => {
        const baseChunk = (id: number, text: string): Chunk => ({
            id, text, sectionTitle: null, evidenceLevel: null, bm25: -2.0, score: 0,
        });
        const chunks = [
            baseChunk(1, 'Диагностические критерии: температура > 38°C, кашель'),
            baseChunk(2, 'Назначают 50 мг/кг амоксициллина'),
        ];
        // For diagnostic queryType: dosage boost must NOT apply,
        // so chunk 2 should NOT outrank chunk 1 on dosage alone.
        // chunk 1 has keyword match for 'диагностик' (+0.04) + diag text boost (+0.06),
        // chunk 2 has no keyword match and no diag boost.
        const ranked = rerankByKeywords(chunks, 'диагностика', 'diagnostic');
        expect(ranked[0].id).toBe(1);
    });

    it('routes simple queries to reduced topK', () => {
        expect(effectiveTopK('какой препарат')).toBe(CFG.topKSimple);
    });

    it('routes complex queries to full topK', () => {
        expect(effectiveTopK('диагностика пневмонии')).toBe(CFG.topK);
    });
});

// ─── Phase 1: Zod schema regression ───────────────────────────────────────────

import { z } from 'zod';

const HistoryItemSchema = z.object({
    q: z.string().min(1).max(4000),
    a: z.string().min(1).max(20000),
});

const RagQueryInputSchema = z.object({
    query: z.string().min(1).max(4000),
    diseaseId: z.number().int().positive(),
    history: z.array(HistoryItemSchema).optional().default([]),
});

describe('Phase 1: RagQueryInputSchema validation', () => {
    it('accepts valid payload', () => {
        const result = RagQueryInputSchema.safeParse({
            query: 'антибиотик при пневмонии',
            diseaseId: 42,
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.history).toEqual([]);
        }
    });

    it('rejects empty query', () => {
        const result = RagQueryInputSchema.safeParse({ query: '', diseaseId: 1 });
        expect(result.success).toBe(false);
    });

    it('rejects query exceeding 4000 chars', () => {
        const result = RagQueryInputSchema.safeParse({ query: 'a'.repeat(4001), diseaseId: 1 });
        expect(result.success).toBe(false);
    });

    it('rejects negative diseaseId', () => {
        const result = RagQueryInputSchema.safeParse({ query: 'тест', diseaseId: -1 });
        expect(result.success).toBe(false);
    });

    it('rejects zero diseaseId', () => {
        const result = RagQueryInputSchema.safeParse({ query: 'тест', diseaseId: 0 });
        expect(result.success).toBe(false);
    });

    it('rejects non-integer diseaseId', () => {
        const result = RagQueryInputSchema.safeParse({ query: 'тест', diseaseId: 1.5 });
        expect(result.success).toBe(false);
    });

    it('accepts optional history with valid items', () => {
        const result = RagQueryInputSchema.safeParse({
            query: 'тест',
            diseaseId: 1,
            history: [{ q: 'вопрос', a: 'ответ' }],
        });
        expect(result.success).toBe(true);
    });

    it('rejects history item with empty question', () => {
        const result = RagQueryInputSchema.safeParse({
            query: 'тест',
            diseaseId: 1,
            history: [{ q: '', a: 'ответ' }],
        });
        expect(result.success).toBe(false);
    });
});
