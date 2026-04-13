import { useState, useRef, useCallback, useEffect } from 'react';
import { RagSource, RagQueryResult, RagCachedEntry } from '../../../types';

interface HistoryTurn {
    q: string;
    a: string;
}

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
    /** Накопленная история диалога. Сбрасывается при смене diseaseId или вызове clearHistory() */
    const historyRef = useRef<HistoryTurn[]>([]);
    /** Буфер потокового ответа — нужен для записи в историю после завершения */
    const streamBufferRef = useRef('');
    /** Вопрос текущего стримингового запроса — нужен для записи в историю */
    const pendingQueryRef = useRef('');

    // Сброс истории при смене заболевания
    useEffect(() => {
        historyRef.current = [];
    }, [diseaseId]);

    // Подтягиваем последний кешированный ответ для diseaseId.
    useEffect(() => {
        let cancelled = false;

        const loadCachedAnswer = async () => {
            try {
                const cached: RagCachedEntry | null = await window.electronAPI?.rag?.getLast?.({ diseaseId });
                if (cancelled || !cached || !cached.answer) return;

                setState({
                    ...INITIAL_STATE,
                    answer: cached.answer,
                    sources: Array.isArray(cached.sources) ? cached.sources : [],
                });
            } catch {
                // ignore cache restore errors
            }
        };

        loadCachedAnswer();

        return () => {
            cancelled = true;
        };
    }, [diseaseId]);

    const cleanup = useCallback(() => {
        cleanupRef.current.forEach(fn => fn());
        cleanupRef.current = [];
        window.electronAPI?.rag?.removeListeners();
    }, []);

    const clearHistory = useCallback(() => {
        historyRef.current = [];
    }, []);

    const sendQuery = useCallback(async (query: string) => {
        if (!query.trim()) return;
        cleanup();
        setState({ ...INITIAL_STATE, loading: true });
        try {
            const result: RagQueryResult = await window.electronAPI!.rag!.query({
                query,
                diseaseId,
                history: historyRef.current,
            });
            if (result.ok) {
                const answer = result.answer ?? '';
                setState({ ...INITIAL_STATE, answer, sources: result.sources ?? [] });
                // Записываем в историю
                historyRef.current = [...historyRef.current, { q: query, a: answer }];
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

        streamBufferRef.current = '';
        pendingQueryRef.current = query;

        const offToken = window.electronAPI!.rag!.onToken((_: any, token: string) => {
            streamBufferRef.current += token;
            setState(prev => ({ ...prev, answer: streamBufferRef.current }));
        });

        const offDone = window.electronAPI!.rag!.onDone((_: any, data: { sources: RagSource[]; context: string }) => {
            setState(prev => ({ ...prev, streaming: false, sources: data.sources }));
            // Записываем в историю по завершении стрима
            const completedAnswer = streamBufferRef.current;
            if (completedAnswer && pendingQueryRef.current) {
                historyRef.current = [...historyRef.current, { q: pendingQueryRef.current, a: completedAnswer }];
            }
            cleanup();
        });

        const offError = window.electronAPI!.rag!.onError((_: any, error: string) => {
            setState(prev => ({ ...prev, streaming: false, error }));
            cleanup();
        });

        cleanupRef.current = [offToken, offDone, offError];

        window.electronAPI!.rag!.stream({ query, diseaseId, history: historyRef.current });
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
        clearHistory,
        historyLength: historyRef.current.length,
    };
}
