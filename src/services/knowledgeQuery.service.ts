import { KnowledgeQueryRequestSchema } from '../validators/knowledgeQuery.validator';
import { KnowledgeCachedEntry, KnowledgeQueryResponse } from '../types';

export const knowledgeQueryService = {
    async query(rawQuery: string): Promise<KnowledgeQueryResponse> {
        const { query } = KnowledgeQueryRequestSchema.parse({ query: rawQuery });
        const result = await window.electronAPI!.queryKnowledge({ query });
        return result;
    },

    async getLastCached(): Promise<KnowledgeCachedEntry | null> {
        return await window.electronAPI!.getLastKnowledgeQuery();
    },
};
