import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    normalizeAssistantMode,
    runAssistantQuery,
    runAssistantQueryStream,
} from '../electron/services/diseaseAssistantModeService.cjs';

const ragQueryMock = vi.fn();
const ragQueryStreamMock = vi.fn();
const localGenerateMock = vi.fn();

const deps = {
    ragPipelineService: {
        ragQuery: ragQueryMock,
        ragQueryStream: ragQueryStreamMock,
    },
    localLlmService: {
        generate: localGenerateMock,
    },
};

describe('diseaseAssistantModeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('normalizes mode to rag by default', async () => {
        expect(normalizeAssistantMode(undefined)).toBe('rag');
        expect(normalizeAssistantMode('unknown')).toBe('rag');
        expect(normalizeAssistantMode('direct')).toBe('direct');
    });

    it('routes rag mode query to ragPipelineService', async () => {
        ragQueryMock.mockResolvedValue({ answer: 'RAG answer', sources: [{ id: 1 }], context: 'ctx' });

        const result = await runAssistantQuery({
            query: 'какой препарат выбрать?',
            diseaseId: 10,
            history: [{ q: 'q1', a: 'a1' }],
            mode: 'rag',
        }, deps);

        expect(ragQueryMock).toHaveBeenCalledTimes(1);
        expect(localGenerateMock).not.toHaveBeenCalled();
        expect(result.mode).toBe('rag');
        expect(result.answer).toBe('RAG answer');
    });

    it('runs direct mode query through localLlmService without RAG sources', async () => {
        localGenerateMock.mockImplementation(async (_messages: any, _options: any, onToken: (token: string) => void) => {
            onToken('Прямой');
            onToken(' ответ');
            return { status: 'completed' };
        });

        const result = await runAssistantQuery({
            query: 'чем опасна бронхиальная астма?',
            diseaseId: 11,
            history: [{ q: 'анамнез?', a: 'краткий ответ' }],
            mode: 'direct',
        }, deps);

        expect(ragQueryMock).not.toHaveBeenCalled();
        expect(localGenerateMock).toHaveBeenCalledTimes(1);
        expect(result.mode).toBe('direct');
        expect(result.answer).toBe('Прямой ответ');
        expect(result.sources).toEqual([]);
        expect(result.context).toBe('');
    });

    it('streams direct mode tokens via onToken callback', async () => {
        const tokens: string[] = [];
        localGenerateMock.mockImplementation(async (_messages: any, _options: any, onToken: (token: string) => void) => {
            onToken('A');
            onToken('B');
            return { status: 'completed' };
        });

        const result = await runAssistantQueryStream({
            query: 'что мониторировать?',
            diseaseId: 12,
            mode: 'direct',
            onToken: (t: string) => tokens.push(t),
        }, deps);

        expect(tokens.join('')).toBe('AB');
        expect(result.mode).toBe('direct');
        expect(result.sources).toEqual([]);
        expect(result.context).toBe('');
    });

    it('throws on direct mode LLM error', async () => {
        localGenerateMock.mockResolvedValue({ status: 'error', error: 'LM Studio offline' });

        await expect(runAssistantQuery({
            query: 'тест',
            diseaseId: 1,
            mode: 'direct',
        }, deps)).rejects.toThrow('LM Studio offline');
    });
});
