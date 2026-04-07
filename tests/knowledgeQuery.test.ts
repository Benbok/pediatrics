import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeQueryRequestSchema } from '../src/validators/knowledgeQuery.validator';

// ─── Validator tests ──────────────────────────────────────────────────────────

describe('KnowledgeQueryRequestSchema', () => {
    it('rejects query shorter than 3 characters', () => {
        const result = KnowledgeQueryRequestSchema.safeParse({ query: 'аб' });
        expect(result.success).toBe(false);
    });

    it('accepts query of exactly 3 characters', () => {
        const result = KnowledgeQueryRequestSchema.safeParse({ query: 'abc' });
        expect(result.success).toBe(true);
    });

    it('accepts a normal clinical query', () => {
        const result = KnowledgeQueryRequestSchema.safeParse({
            query: 'Какие антибиотики при пневмонии у детей до 5 лет?',
        });
        expect(result.success).toBe(true);
    });

    it('accepts query of exactly 500 characters', () => {
        const result = KnowledgeQueryRequestSchema.safeParse({ query: 'а'.repeat(500) });
        expect(result.success).toBe(true);
    });

    it('rejects query longer than 500 characters', () => {
        const result = KnowledgeQueryRequestSchema.safeParse({ query: 'а'.repeat(501) });
        expect(result.success).toBe(false);
    });

    it('trims whitespace and still validates', () => {
        const result = KnowledgeQueryRequestSchema.safeParse({ query: '   abc   ' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.query).toBe('abc');
        }
    });

    it('rejects missing query field', () => {
        const result = KnowledgeQueryRequestSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});

// ─── Service tests ────────────────────────────────────────────────────────────

describe('knowledgeQueryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws ZodError for query shorter than 3 characters', async () => {
        const { knowledgeQueryService } = await import('../src/services/knowledgeQuery.service');
        await expect(knowledgeQueryService.query('аб')).rejects.toThrow();
    });

    it('calls electronAPI.queryKnowledge with trimmed query', async () => {
        const mockResponse = {
            success: true,
            answer: 'Тестовый ответ',
            sources: [],
            disclaimer: 'Дисклеймер',
            searchedAt: new Date().toISOString(),
            noAiKey: false,
        };

        const mockQueryKnowledge = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('window', {
            electronAPI: { queryKnowledge: mockQueryKnowledge },
        });

        const { knowledgeQueryService } = await import('../src/services/knowledgeQuery.service');
        const result = await knowledgeQueryService.query('  Антибиотики при пневмонии  ');

        expect(mockQueryKnowledge).toHaveBeenCalledWith({ query: 'Антибиотики при пневмонии' });
        expect(result.success).toBe(true);
        expect(result.answer).toBe('Тестовый ответ');
    });

    it('returns answer=null when noAiKey=true', async () => {
        const mockResponse = {
            success: true,
            answer: null,
            sources: [{ type: 'disease', name: 'Пневмония', id: 1 }],
            disclaimer: 'Дисклеймер',
            searchedAt: new Date().toISOString(),
            noAiKey: true,
        };

        const mockQueryKnowledge = vi.fn().mockResolvedValue(mockResponse);
        vi.stubGlobal('window', {
            electronAPI: { queryKnowledge: mockQueryKnowledge },
        });

        const { knowledgeQueryService } = await import('../src/services/knowledgeQuery.service');
        const result = await knowledgeQueryService.query('Лечение пневмонии');

        expect(result.noAiKey).toBe(true);
        expect(result.answer).toBeNull();
        expect(result.sources).toHaveLength(1);
    });
});
