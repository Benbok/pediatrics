import { useState, useEffect, useCallback, useRef } from 'react';

export interface LlmStatus {
    /** null = initial check not yet done */
    available: boolean | null;
    checking: boolean;
}

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls the local LLM health endpoint and returns live connection status.
 * Use this hook in any AI-capable component to:
 *   1. Disable send controls when the model is offline.
 *   2. Show a clear status indicator to the user.
 *
 * Scalable: add to any component — polling is per-hook instance, lightweight.
 */
export function useLlmStatus(): LlmStatus {
    const [status, setStatus] = useState<LlmStatus>({ available: null, checking: true });
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cancelledRef = useRef(false);

    const check = useCallback(async () => {
        try {
            const result = await window.electronAPI.llm.healthCheck();
            if (!cancelledRef.current) {
                setStatus({ available: !!result?.available, checking: false });
            }
        } catch {
            if (!cancelledRef.current) {
                setStatus({ available: false, checking: false });
            }
        }
    }, []);

    useEffect(() => {
        cancelledRef.current = false;
        check();
        timerRef.current = setInterval(check, POLL_INTERVAL_MS);
        return () => {
            cancelledRef.current = true;
            if (timerRef.current !== null) clearInterval(timerRef.current);
        };
    }, [check]);

    return status;
}
