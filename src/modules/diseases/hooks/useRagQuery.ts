import { useState, useRef, useCallback } from 'react';
import { RagSource, RagQueryResult } from '../../../types';

interface RagState {
    answer: string;
    sources: RagSource[];
    loading: boolean;
    streaming: boolean;
    error: string | null;
    reindexProgress: { done: number; total: number } | null;
    reindexing: boolean;
}

const INITIAL_STATE: RagState = {
    answer: '',
    sources: [],
    loading: false,
    streaming: false,
    error: null,
    reindexProgress: null,
    reindexing: false,
};

export function useRagQuery(diseaseId: number) {
    const [state, setState] = useState<RagState>(INITIAL_STATE);
    const cleanupRef = useRef<Array<() => void>>([]);

    const cleanup = useCallback(() => {
        cleanupRef.current.forEach(fn => fn());
        cleanupRef.current = [];
        window.electronAPI?.rag?.removeListeners();
    }, []);

    const sendQuery = useCallback(async (query: string) => {
        if (!query.trim()) return;
        cleanup();
        setState({ ...INITIAL_STATE, loading: true });
        try {
            const result: RagQueryResult = await window.electronAPI!.rag!.query({ query, diseaseId });
            if (result.ok) {
                setState({ ...INITIAL_STATE, answer: result.answer ?? '', sources: result.sources ?? [] });
            } else {
                setState({ ...INITIAL_STATE, error: result.error ?? 'Неизвестная ошибка' });
            }
        } catch (err: any) {
            setState({ ...INITIAL_STATE, error: err?.message ?? 'Ошибка запроса' });
        }
    }, [diseaseId, cleanup]);

    const sendQueryStream = useCallback((query: string) => {
        if (!query.trim()) return;
        cleanup();
        setState({ ...INITIAL_STATE, streaming: true });

        let buffer = '';

        const offToken = window.electronAPI!.rag!.onToken((_: any, token: string) => {
            buffer += token;
            setState(prev => ({ ...prev, answer: buffer }));
        });

        const offDone = window.electronAPI!.rag!.onDone((_: any, data: { sources: RagSource[]; context: string }) => {
            setState(prev => ({ ...prev, streaming: false, sources: data.sources }));
            cleanup();
        });

        const offError = window.electronAPI!.rag!.onError((_: any, error: string) => {
            setState(prev => ({ ...prev, streaming: false, error }));
            cleanup();
        });

        cleanupRef.current = [offToken, offDone, offError];

        window.electronAPI!.rag!.stream({ query, diseaseId });
    }, [diseaseId, cleanup]);

    const abortStream = useCallback(() => {
        cleanup();
        setState(prev => ({ ...prev, streaming: false }));
    }, [cleanup]);

    const reindex = useCallback(async () => {
        setState(prev => ({ ...prev, reindexing: true, reindexProgress: null }));

        const offProgress = window.electronAPI!.rag!.onReindexProgress(
            (_: any, data: { done: number; total: number }) => {
                setState(prev => ({ ...prev, reindexProgress: data }));
            }
        );
        cleanupRef.current.push(offProgress);

        try {
            const result = await window.electronAPI!.rag!.reindex({ diseaseId });
            setState(prev => ({
                ...prev,
                reindexing: false,
                reindexProgress: null,
                error: result.ok ? null : (result.error ?? 'Ошибка переиндексации'),
            }));
        } catch (err: any) {
            setState(prev => ({ ...prev, reindexing: false, reindexProgress: null, error: err?.message ?? 'Ошибка' }));
        } finally {
            offProgress();
            cleanupRef.current = cleanupRef.current.filter(fn => fn !== offProgress);
        }
    }, [diseaseId]);

    const reset = useCallback(() => {
        cleanup();
        setState(INITIAL_STATE);
    }, [cleanup]);

    return {
        ...state,
        sendQuery,
        sendQueryStream,
        abortStream,
        reindex,
        reset,
    };
}
