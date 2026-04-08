/**
 * Module-level singleton store for KnowledgeQueryWidget.
 *
 * Lives outside React so the in-flight IPC call and its result survive
 * component unmount (tab navigation).  The widget subscribes on mount and
 * unsubscribes on unmount; on re-mount it finds the same state.
 */

import { knowledgeQueryService } from '../../../services/knowledgeQuery.service';
import { KnowledgeQueryResponse } from '../../../types';

export type WidgetState = 'idle' | 'loading' | 'answer' | 'error';

interface StoreState {
    widgetState: WidgetState;
    submittedQuery: string;
    result: KnowledgeQueryResponse | null;
    error: string | null;
    /** Timestamp (Date.now()) when the current query was submitted. */
    startedAtMs: number | null;
}

const _s: StoreState = {
    widgetState: 'idle',
    submittedQuery: '',
    result: null,
    error: null,
    startedAtMs: null,
};

// Monotonically increasing token: cancel() increments it so in-flight
// requests can detect they've been superseded and discard their result.
let _cancelToken = 0;

const _listeners = new Set<() => void>();

function notify() {
    _listeners.forEach(cb => cb());
}

export const knowledgeQueryStore = {
    /** Snapshot of current state (safe to hold in component). */
    getState(): Readonly<StoreState> {
        return _s;
    },

    /** Subscribe to any state change. Returns unsubscribe function. */
    subscribe(cb: () => void): () => void {
        _listeners.add(cb);
        return () => _listeners.delete(cb);
    },

    /** Start a query. No-op if already loading. */
    async startQuery(query: string): Promise<void> {
        if (_s.widgetState === 'loading') return;

        _s.widgetState = 'loading';
        _s.submittedQuery = query;
        _s.result = null;
        _s.error = null;
        _s.startedAtMs = Date.now();
        notify();

        const myToken = ++_cancelToken;

        try {
            const response = await knowledgeQueryService.query(query);
            // If cancel() was called while IPC was in-flight — discard result
            if (_cancelToken !== myToken) return;
            if (!response.success) {
                _s.widgetState = 'error';
                _s.error = response.error ?? 'Неизвестная ошибка';
            } else {
                _s.widgetState = 'answer';
                _s.result = response;
            }
        } catch (err: unknown) {
            if (_cancelToken !== myToken) return;
            _s.widgetState = 'error';
            _s.error = err instanceof Error ? err.message : 'Ошибка при выполнении запроса';
        } finally {
            // Only clean up state if this request is still the active one
            if (_cancelToken === myToken) {
                _s.startedAtMs = null;
                notify();
            }
        }
    },

    /** Cancel the in-flight request. IPC continues on backend but result is discarded. */
    cancel(): void {
        if (_s.widgetState !== 'loading') return;
        _cancelToken++;
        _s.widgetState = 'idle';
        _s.submittedQuery = '';
        _s.result = null;
        _s.error = null;
        _s.startedAtMs = null;
        notify();
    },

    /** Reset to idle. No-op while loading (use cancel() instead). */
    reset(): void {
        if (_s.widgetState === 'loading') return;
        _s.widgetState = 'idle';
        _s.submittedQuery = '';
        _s.result = null;
        _s.error = null;
        _s.startedAtMs = null;
        notify();
    },

    /** Pre-populate from cache (call once on first idle mount). */
    restoreFromCache(query: string, response: KnowledgeQueryResponse): void {
        if (_s.widgetState !== 'idle') return;
        _s.submittedQuery = query;
        _s.result = response;
        _s.widgetState = 'answer';
        notify();
    },
};
