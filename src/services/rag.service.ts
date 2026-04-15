import type {
    RagQueryResult,
    RagReindexResult,
    RagCachedEntry,
    RagMode,
    QaCacheEntry,
    QaTemplate,
} from '../types';

/** Send a non-streaming RAG query and return the full result. */
export async function sendQuery(
    query: string,
    diseaseId: number,
    history?: { q: string; a: string }[],
    mode: RagMode = 'rag'
): Promise<RagQueryResult> {
    return window.electronAPI.rag.query({ query, diseaseId, history, mode });
}

/** Start a streaming RAG query (responses come via onToken/onDone). */
export function sendQueryStream(
    query: string,
    diseaseId: number,
    history?: { q: string; a: string }[],
    mode: RagMode = 'rag'
): void {
    window.electronAPI.rag.stream({ query, diseaseId, history, mode });
}

/** Reindex embeddings for a disease's guideline chunks. */
export async function reindexDisease(diseaseId: number): Promise<RagReindexResult> {
    return window.electronAPI.rag.reindex({ diseaseId });
}

/** Fetch the last cached RAG answer for a disease. */
export async function getLastCached(diseaseId: number, mode: RagMode = 'rag'): Promise<RagCachedEntry | null> {
    return window.electronAPI.rag.getLast({ diseaseId, mode });
}

/** Fetch pre-computed QA cache entries for a disease. */
export async function getQaCache(diseaseId: number): Promise<QaCacheEntry[]> {
    return window.electronAPI.rag.qaList({ diseaseId });
}

/** Trigger background pre-computation of standard QA answers. */
export async function triggerQaPrecompute(
    diseaseId: number
): Promise<{ ok: boolean; error?: string }> {
    return window.electronAPI.rag.qaTrigger({ diseaseId });
}

/** Fetch the list of available QA templates. */
export async function getQaTemplates(): Promise<QaTemplate[]> {
    return window.electronAPI.rag.qaTemplates();
}

/** Compute a single QA cache entry on-demand. */
export async function computeQaCacheEntry(
    diseaseId: number,
    templateId: string
): Promise<QaCacheEntry | null> {
    return window.electronAPI.rag.qaComputeSingle({ diseaseId, templateId });
}

// ─── Module-level chip computation registry ───────────────────────────────────
// Keeps in-flight Promises alive across component unmounts (tab switches).
// Key: `${diseaseId}:${templateId}`, value: the IPC promise chain.
const _chipRegistry = new Map<string, Promise<QaCacheEntry | null>>();

/**
 * Start (or attach to) a chip computation.
 * If this templateId for this diseaseId is already computing — returns the SAME Promise.
 * This makes the computation survive tab switches: component unmounts but Promise lives here.
 */
export function computeChipEntry(
    diseaseId: number,
    templateId: string,
): Promise<QaCacheEntry | null> {
    const key = `${diseaseId}:${templateId}`;
    if (_chipRegistry.has(key)) return _chipRegistry.get(key)!;
    const promise = (window.electronAPI.rag.qaComputeSingle({ diseaseId, templateId }) as Promise<QaCacheEntry | null>)
        .finally(() => _chipRegistry.delete(key));
    _chipRegistry.set(key, promise);
    return promise;
}

/**
 * Returns templateIds currently being computed for a diseaseId.
 * Used on component mount to restore loading spinners after a tab switch.
 */
export function getInProgressChipIds(diseaseId: number): string[] {
    const prefix = `${diseaseId}:`;
    return [..._chipRegistry.keys()]
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));
}
