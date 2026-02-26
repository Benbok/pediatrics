/**
 * Unit tests for AI Symptom Normalizer: circuit breaker, dictionary path, and normalizeWithAI contract.
 * Setup injects mock logger so CJS require() gets it (avoids Electron); does not call real Gemini API.
 */
import './setup-ai-normalizer.cjs';

import { describe, it, expect, beforeEach } from 'vitest';
import * as normalizer from '../electron/services/aiSymptomNormalizer.cjs';
import { buildClinicalQuery } from '../electron/services/clinicalQueryBuilder.cjs';
import { CDSSSearchService } from '../electron/services/cdssSearchService.cjs';
import { rankDiagnosesWithContext } from '../electron/services/cdssRankingService.cjs';
import { ChunkIndexService } from '../electron/services/chunkIndexService.cjs';

const { normalizeWithAI, setCircuitOpen, circuitBreaker, getVersion } = normalizer;

describe('AI Symptom Normalizer', () => {
    beforeEach(() => {
        setCircuitOpen(false);

        // reset mocks used by CDSS tests
        (globalThis as any).__mockPrisma = {};
        (globalThis as any).__mockDiseaseService = {};
    });

    describe('normalizeWithAI contract', () => {
        it('returns normalized array and source/aiUsed for empty input', async () => {
            const result = await normalizeWithAI([]);
            expect(result).toEqual({
                normalized: [],
                source: 'dictionary',
                aiUsed: false,
            });
        });

        it('returns object with keys normalized, source, aiUsed for null input', async () => {
            const result = await normalizeWithAI(null as unknown as string[]);
            expect(result).toHaveProperty('normalized');
            expect(result).toHaveProperty('source');
            expect(result).toHaveProperty('aiUsed');
            expect(Array.isArray(result.normalized)).toBe(true);
            expect(result.normalized).toHaveLength(0);
        });

        it('with circuit open returns dictionary-only result (no AI)', async () => {
            setCircuitOpen(true);
            const result = await normalizeWithAI(['температура', 'кашель']);
            expect(result.source).toBe('dictionary');
            expect(result.aiUsed).toBe(false);
            expect(Array.isArray(result.normalized)).toBe(true);
            expect(result.normalized.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('circuit breaker', () => {
        it('setCircuitOpen(true) makes circuit unavailable', () => {
            setCircuitOpen(true);
            expect(circuitBreaker.isAvailable()).toBe(false);
        });

        it('setCircuitOpen(false) makes circuit available', () => {
            setCircuitOpen(true);
            setCircuitOpen(false);
            expect(circuitBreaker.isAvailable()).toBe(true);
        });

        it('recordFailure 3 times opens circuit', () => {
            setCircuitOpen(false);
            expect(circuitBreaker.isAvailable()).toBe(true);
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            expect(circuitBreaker.isAvailable()).toBe(true);
            circuitBreaker.recordFailure();
            expect(circuitBreaker.isAvailable()).toBe(false);
        });

        it('recordSuccess resets failure count', () => {
            setCircuitOpen(false);
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordSuccess();
            circuitBreaker.recordFailure();
            expect(circuitBreaker.isAvailable()).toBe(true);
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            expect(circuitBreaker.isAvailable()).toBe(false);
        });
    });

    describe('getVersion', () => {
        it('returns a number', () => {
            const v = getVersion();
            expect(typeof v).toBe('number');
            expect(v).toBeGreaterThanOrEqual(1);
        });
    });

    describe('CDSS pipeline (new logic)', () => {
        it('clinicalQueryBuilder includes complaints, physical exam, systems and abnormal vitals', () => {
            const q = buildClinicalQuery({
                complaints: 'кашель',
                physicalExam: 'хрипы',
                respiratory: 'одышка',
                temperature: 39,
            });

            expect(q).toContain('кашель');
            expect(q).toContain('хрипы');
            expect(q).toContain('одышка');
            expect(q.toLowerCase()).toContain('температура 39');
        });

        it('cdssSearchService returns merged candidates with evidence from FTS', async () => {
            (globalThis as any).__mockPrisma.clinicalGuideline = {
                findMany: async () => ([
                    {
                        id: 10,
                        diseaseId: 1,
                        complaints: 'кашель температура',
                        physicalExam: null,
                        clinicalPicture: null,
                    },
                ]),
            };

            (globalThis as any).__mockDiseaseService.searchBySymptoms = async () => ([
                { id: 2, nameRu: 'Бронхит' },
                { id: 1, nameRu: 'Пневмония' },
            ]);

            (globalThis as any).__mockPrisma.$queryRawUnsafe = async (_sql: string, _q: string) => ([
                {
                    rowid: 101,
                    chunkId: 101,
                    diseaseId: 1,
                    guidelineId: 10,
                    type: 'complaints',
                    bm25: -2.0,
                },
            ]);

            (globalThis as any).__mockPrisma.disease = {
                findMany: async () => ([
                    { id: 1, nameRu: 'Пневмония', symptoms: '[]', icd10Codes: '[]' },
                    { id: 2, nameRu: 'Бронхит', symptoms: '[]', icd10Codes: '[]' },
                ]),
            };

            const items = await CDSSSearchService.searchByClinicalData('кашель температура 39', ['кашель', 'температура']);
            expect(Array.isArray(items)).toBe(true);
            expect(items.length).toBeGreaterThan(0);

            const pneumonia = items.find(i => i.disease && i.disease.id === 1);
            expect(pneumonia).toBeTruthy();
            expect(Array.isArray(pneumonia!.evidence)).toBe(true);
            expect(pneumonia!.evidence.length).toBeGreaterThan(0);
            expect(pneumonia!.evidence[0]).toHaveProperty('chunkId');
        });

        it('cdssSearchService searches both Disease.symptoms and GuidelineChunk FTS (union of sources)', async () => {
            // Pre-filter doesn't restrict (no tokens matched / empty guideline fields)
            (globalThis as any).__mockPrisma.clinicalGuideline = {
                findMany: async () => ([]),
            };

            // Symptom-search returns ONLY diseaseId=2
            (globalThis as any).__mockDiseaseService.searchBySymptoms = async () => ([
                { id: 2, nameRu: 'Симптомный диагноз' },
            ]);

            // FTS returns ONLY diseaseId=1
            (globalThis as any).__mockPrisma.$queryRawUnsafe = async (_sql: string, _q: string) => ([
                {
                    rowid: 501,
                    chunkId: 501,
                    diseaseId: 1,
                    guidelineId: 99,
                    type: 'clinical_picture',
                    bm25: -1.2,
                },
            ]);

            // DB lookup returns both diseases
            (globalThis as any).__mockPrisma.disease = {
                findMany: async () => ([
                    { id: 1, nameRu: 'Chunk-диагноз', symptoms: '[]', icd10Codes: '[]' },
                    { id: 2, nameRu: 'Symptom-диагноз', symptoms: '[]', icd10Codes: '[]' },
                ]),
            };

            const items = await CDSSSearchService.searchByClinicalData('кашель', ['кашель']);
            const ids = new Set(items.map(i => Number(i.disease?.id)));
            expect(ids.has(1)).toBe(true);
            expect(ids.has(2)).toBe(true);

            const chunkOnly = items.find(i => i.disease && i.disease.id === 1);
            expect(chunkOnly).toBeTruthy();
            expect(Array.isArray(chunkOnly!.evidence)).toBe(true);
            expect(chunkOnly!.evidence.length).toBeGreaterThan(0);

            const symptomOnly = items.find(i => i.disease && i.disease.id === 2);
            expect(symptomOnly).toBeTruthy();
            expect(Array.isArray(symptomOnly!.evidence)).toBe(true);
        });

        it('cdssRankingService returns fallback rankings when AI is unavailable', async () => {
            const prevKey = process.env.VITE_GEMINI_API_KEY;
            delete process.env.VITE_GEMINI_API_KEY;

            const ranked = await rankDiagnosesWithContext(
                ['кашель'],
                [
                    { disease: { id: 1 }, score: 0.9, evidence: [] },
                    { disease: { id: 2 }, score: 0.8, evidence: [] },
                ],
                { ageMonths: 12 },
                'кашель'
            );

            expect(ranked.length).toBeGreaterThan(0);
            expect(ranked[0]).toHaveProperty('diseaseId');
            expect(String(ranked[0].reasoning)).toContain('AI недоступен');

            if (prevKey) process.env.VITE_GEMINI_API_KEY = prevKey;
        });
    });

    describe('FTS maintenance', () => {
        it('ChunkIndexService.rebuildFts executes expected SQL steps', async () => {
            const calls: string[] = [];
            (globalThis as any).__mockPrisma.$executeRawUnsafe = async (sql: string) => {
                calls.push(String(sql).replace(/\s+/g, ' ').trim());
                return 0;
            };

            await ChunkIndexService.rebuildFts();

            const joined = calls.join('\n');
            expect(joined).toContain('DROP TRIGGER IF EXISTS guideline_chunks_ai');
            expect(joined).toContain('DROP TRIGGER IF EXISTS guideline_chunks_ad');
            expect(joined).toContain('DROP TRIGGER IF EXISTS guideline_chunks_au');
            expect(joined).toContain('DROP TABLE IF EXISTS guideline_chunks_fts');
            expect(joined).toContain('CREATE VIRTUAL TABLE guideline_chunks_fts USING fts5');
            expect(joined).toContain('INSERT INTO guideline_chunks_fts');
            expect(joined).toContain('FROM guideline_chunks');
        });
    });
});
