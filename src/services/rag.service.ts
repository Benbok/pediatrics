import type {
    RagQueryResult,
    RagReindexResult,
    RagCachedEntry,
    QaCacheEntry,
    QaTemplate,
} from '../types';

/** Send a non-streaming RAG query and return the full result. */
export async function sendQuery(
    query: string,
    diseaseId: number,
    history?: { q: string; a: string }[]
): Promise<RagQueryResult> {
    return window.electronAPI.rag.query({ query, diseaseId, history });
}

/** Start a streaming RAG query (responses come via onToken/onDone). */
export function sendQueryStream(
    query: string,
    diseaseId: number,
    history?: { q: string; a: string }[]
): void {
    window.electronAPI.rag.stream({ query, diseaseId, history });
}

/** Reindex embeddings for a disease's guideline chunks. */
export async function reindexDisease(diseaseId: number): Promise<RagReindexResult> {
    return window.electronAPI.rag.reindex({ diseaseId });
}

/** Fetch the last cached RAG answer for a disease. */
export async function getLastCached(diseaseId: number): Promise<RagCachedEntry | null> {
    return window.electronAPI.rag.getLast({ diseaseId });
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
