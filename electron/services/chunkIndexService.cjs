const { prisma } = require('../prisma-client.cjs');
const { logger } = require('../logger.cjs');
const { cosineSimilarity } = require('./embeddingService.cjs');

function safeJsonParse(value, fallback = null) {
    if (!value || typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
        return JSON.parse(trimmed);
    } catch (_) {
        return fallback;
    }
}

const ChunkIndexService = {
    _loaded: false,
    _chunksByDisease: new Map(), // diseaseId -> [{ id, guidelineId, type, pageStart, pageEnd, sectionTitle, text, embedding }]

    isLoaded() {
        return this._loaded;
    },

    clear() {
        this._chunksByDisease.clear();
        this._loaded = false;
    },

    /**
     * Rebuild FTS5 virtual table from scratch.
     * Drops triggers & FTS table, recreates FTS, populates from guideline_chunks.
     * Safe to call multiple times (idempotent).
     */
    async rebuildFts() {
        const start = Date.now();
        try {
            // Check if FTS is up-to-date by comparing rowcount with source table
            const [ftsRows, srcRows] = await Promise.all([
                prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM guideline_chunks_fts').catch(() => [{ cnt: -1 }]),
                prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM guideline_chunks'),
            ]);
            const ftsCnt = Number(ftsRows[0]?.cnt ?? -1);
            const srcCnt = Number(srcRows[0]?.cnt ?? 0);

            if (ftsCnt === srcCnt && srcCnt > 0) {
                logger.info(`[ChunkIndexService] FTS up-to-date (${srcCnt} rows), skipping rebuild`);
                return;
            }

            // Drop triggers first
            await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS guideline_chunks_ai');
            await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS guideline_chunks_ad');
            await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS guideline_chunks_au');

            // Drop and recreate FTS table
            await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS guideline_chunks_fts');
            await prisma.$executeRawUnsafe(`
                CREATE VIRTUAL TABLE guideline_chunks_fts USING fts5(
                    text,
                    chunk_id UNINDEXED,
                    disease_id UNINDEXED,
                    guideline_id UNINDEXED,
                    type UNINDEXED
                )
            `);

            // Populate from existing data
            await prisma.$executeRawUnsafe(`
                INSERT INTO guideline_chunks_fts(rowid, text, chunk_id, disease_id, guideline_id, type)
                SELECT id, text, id, disease_id, guideline_id, type FROM guideline_chunks
            `);

            const duration = Date.now() - start;
            logger.info(`[ChunkIndexService] FTS rebuilt in ${duration}ms`);
        } catch (error) {
            logger.error('[ChunkIndexService] FTS rebuild failed:', error.message);
        }
    },

    totalChunks() {
        let total = 0;
        for (const chunks of this._chunksByDisease.values()) {
            total += chunks.length;
        }
        return total;
    },

    async loadOnStartup() {
        const startedAt = Date.now();
        this._chunksByDisease.clear();

        const chunks = await prisma.guidelineChunk.findMany({
            select: {
                id: true,
                diseaseId: true,
                guidelineId: true,
                type: true,
                pageStart: true,
                pageEnd: true,
                sectionTitle: true,
                text: true,
                embeddingJson: true,
            },
            where: {
                embeddingJson: {
                    not: null,
                },
            },
        });

        for (const row of chunks) {
            const embedding = safeJsonParse(row.embeddingJson, null);
            if (!Array.isArray(embedding) || embedding.length === 0) continue;

            const diseaseId = Number(row.diseaseId);
            const arr = this._chunksByDisease.get(diseaseId) || [];
            arr.push({
                id: row.id,
                guidelineId: row.guidelineId,
                type: row.type,
                pageStart: row.pageStart,
                pageEnd: row.pageEnd,
                sectionTitle: row.sectionTitle,
                text: row.text,
                embedding,
            });
            this._chunksByDisease.set(diseaseId, arr);
        }

        this._loaded = true;
        const duration = Date.now() - startedAt;
        logger.info(`[ChunkIndexService] Loaded ${this.totalChunks()} chunks with embeddings in ${duration}ms`);
    },

    /**
     * Update index entries for a single guideline.
     * Pass `chunks` as array of rows from DB (same shape as loadOnStartup select).
     */
    updateForGuideline(diseaseId, chunks) {
        const did = Number(diseaseId);
        // Remove existing chunks for disease+guideline(s) is handled by full reload of that guideline's chunks.
        // For simplicity, we rebuild the disease bucket if guidelineId set is present.
        const next = [];
        for (const row of (chunks || [])) {
            const embedding = safeJsonParse(row.embeddingJson, null);
            if (!Array.isArray(embedding) || embedding.length === 0) continue;
            next.push({
                id: row.id,
                guidelineId: row.guidelineId,
                type: row.type,
                pageStart: row.pageStart,
                pageEnd: row.pageEnd,
                sectionTitle: row.sectionTitle,
                text: row.text,
                embedding,
            });
        }
        if (next.length === 0) {
            this._chunksByDisease.delete(did);
        } else {
            this._chunksByDisease.set(did, next);
        }
    },

    /**
     * Semantic search by query embedding.
     * Returns array sorted by similarity desc.
     */
    searchByEmbedding(queryEmbedding, diseaseFilterSet = null) {
        if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];

        const results = [];
        for (const [diseaseId, chunks] of this._chunksByDisease.entries()) {
            if (diseaseFilterSet && !diseaseFilterSet.has(diseaseId)) continue;

            let bestSim = -Infinity;
            let bestChunk = null;

            for (const chunk of chunks) {
                const sim = cosineSimilarity(queryEmbedding, chunk.embedding);
                if (sim > bestSim) {
                    bestSim = sim;
                    bestChunk = chunk;
                }
            }

            if (bestChunk) {
                results.push({
                    diseaseId,
                    similarity: bestSim,
                    chunk: bestChunk,
                });
            }
        }

        results.sort((a, b) => b.similarity - a.similarity);
        return results;
    },
};

module.exports = { ChunkIndexService };
