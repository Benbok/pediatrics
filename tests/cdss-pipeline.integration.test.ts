import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('electron', () => ({
    app: {
        getPath: () => process.cwd(),
    },
}));

const { rankDiagnosesWithContext } = require('../electron/services/cdssRankingService.cjs');
const { MAX_CANDIDATES_FOR_AI_RANK } = require('../electron/config/cdssConfig.cjs');
const cdssLocalLlmSvc = require('../electron/services/cdssLocalLlmService.cjs');

type Candidate = {
    disease: { id: number; nameRu: string };
    normalizedScore: number;
    symptomScore: number;
    chunkScore: number;
    score: number;
    evidence: Array<{ type: string; chunkId: string }>;
};

function makeCandidates(count: number): Candidate[] {
    return Array.from({ length: count }, (_, index) => {
        const rank = index + 1;
        return {
            disease: { id: rank, nameRu: `Disease ${rank}` },
            normalizedScore: Math.max(0.01, 1 - index * 0.05),
            symptomScore: Math.max(0.01, 0.9 - index * 0.04),
            chunkScore: Math.max(0.01, 0.8 - index * 0.03),
            score: Math.max(0.01, 1 - index * 0.05),
            evidence: [{ type: 'chunk', chunkId: `ch_${rank}` }]
        };
    });
}

describe('CDSS Pipeline Integration (No-AI fallback path)', () => {

    beforeEach(() => {
        // Default: local LLM unavailable — exercises fallback path
        vi.spyOn(cdssLocalLlmSvc, 'isLocalLlmAvailable').mockResolvedValue(false);
        vi.spyOn(cdssLocalLlmSvc, 'rankDiagnosesLocal').mockResolvedValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns bounded fallback ranking with phase1 metadata', async () => {
        const symptoms = ['кашель', 'лихорадка'];
        const candidates = makeCandidates(MAX_CANDIDATES_FOR_AI_RANK + 4);

        const result = await rankDiagnosesWithContext(symptoms, candidates, { ageMonths: 24 }, 'кашель и температура 39');

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(MAX_CANDIDATES_FOR_AI_RANK);

        for (const item of result) {
            expect(typeof item.diseaseId).toBe('number');
            expect(typeof item.confidence).toBe('number');
            expect(item.confidence).toBeGreaterThanOrEqual(0.1);
            expect(item.confidence).toBeLessThanOrEqual(1);
            expect(Array.isArray(item.matchedSymptoms)).toBe(true);
            expect(item.matchedSymptoms).toEqual(symptoms);
            expect(typeof item.phase1Score).toBe('number');
            expect(item.rankingFactors).toBeTruthy();
            expect(typeof item.rankingFactors.phase1NormalizedScore).toBe('number');
            expect(typeof item.rankingFactors.phase1SymptomScore).toBe('number');
            expect(typeof item.rankingFactors.phase1ChunkScore).toBe('number');
            expect(item.rankingFactors.aiContribution).toBe(0);
            expect(String(item.reasoning)).toContain('AI недоступен');
        }
    });

    it('keeps deterministic confidence decay by rank in fallback mode', async () => {
        const candidates = makeCandidates(6);
        const result = await rankDiagnosesWithContext(['кашель'], candidates, {}, 'кашель');

        expect(result.length).toBe(6);
        expect(result[0].confidence).toBeCloseTo(1, 5);
        expect(result[1].confidence).toBeCloseTo(0.92, 5);
        expect(result[2].confidence).toBeCloseTo(0.84, 5);

        for (let index = 1; index < result.length; index += 1) {
            expect(result[index].confidence).toBeLessThanOrEqual(result[index - 1].confidence);
        }
    });

    it('returns empty result for empty candidate set', async () => {
        const result = await rankDiagnosesWithContext(['кашель'], [], {}, 'кашель');
        expect(result).toEqual([]);
    });

    it('uses AI ranking when local LLM is available and preserves phase1 factors', async () => {
        vi.spyOn(cdssLocalLlmSvc, 'isLocalLlmAvailable').mockResolvedValue(true);
        vi.spyOn(cdssLocalLlmSvc, 'rankDiagnosesLocal').mockResolvedValue([
            {
                diseaseId: 2,
                confidence: 0.91,
                reasoning: 'AI ranked Disease 2 as most probable',
                matchedSymptoms: ['кашель', 'лихорадка']
            },
            {
                diseaseId: 1,
                confidence: 0.82,
                reasoning: 'AI ranked Disease 1 second',
                matchedSymptoms: ['кашель']
            }
        ]);

        const candidates = makeCandidates(4);
        const result = await rankDiagnosesWithContext(['кашель', 'лихорадка'], candidates, { ageMonths: 60 }, 'кашель и лихорадка');

        expect(result.length).toBe(2);
        expect(result[0].diseaseId).toBe(2);
        expect(result[0].confidence).toBeCloseTo(0.91, 5);
        expect(result[0].phase1Score).toBeCloseTo(candidates[1].normalizedScore, 5);
        expect(result[0].rankingFactors.aiConfidence).toBeCloseTo(0.91, 5);
        expect(result[0].rankingFactors.aiContribution).toBeCloseTo(0.91, 5);
        expect(result[1].diseaseId).toBe(1);
        expect(result[1].phase1Score).toBeCloseTo(candidates[0].normalizedScore, 5);
    });

    it('falls back to phase1 ranking when local LLM ranking throws an error', async () => {
        vi.spyOn(cdssLocalLlmSvc, 'isLocalLlmAvailable').mockResolvedValue(true);
        vi.spyOn(cdssLocalLlmSvc, 'rankDiagnosesLocal').mockRejectedValue(new Error('AI service unavailable'));

        const candidates = makeCandidates(5);
        const result = await rankDiagnosesWithContext(['кашель'], candidates, {}, 'кашель');

        expect(result.length).toBe(5);
        expect(result[0].diseaseId).toBe(1);
        expect(String(result[0].reasoning)).toContain('AI ошибка');
        expect(result[0].rankingFactors.aiContribution).toBe(0);
        expect(result[0].rankingFactors.error).toContain('AI service unavailable');
    });
});
