import { useState, useEffect, useCallback, useRef } from 'react';

export interface RagAiStatus {
    /** null = initial check not yet done */
    available: boolean | null;
    provider: 'local' | 'gemini';
    checking: boolean;
}

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls the RAG feature health endpoint (routing-aware).
 * Returns the active provider ('local' or 'gemini') and availability.
 * When Gemini is configured and the API key is valid, available = true
 * even if LM Studio is offline.
 */
export function useRagAiStatus(): RagAiStatus {
    const [status, setStatus] = useState<RagAiStatus>({ available: null, provider: 'local', checking: true });
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cancelledRef = useRef(false);

    const check = useCallback(async () => {
        try {
            const result = await window.electronAPI.llm.checkFeature('rag');
            if (!cancelledRef.current) {
                setStatus({
                    available: !!result?.available,
                    provider: (result?.provider as 'local' | 'gemini') ?? 'local',
                    checking: false,
                });
            }
        } catch {
            if (!cancelledRef.current) {
                setStatus({ available: false, provider: 'local', checking: false });
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
