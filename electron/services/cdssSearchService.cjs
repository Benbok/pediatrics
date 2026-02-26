const { prisma } = require('../prisma-client.cjs');
const { logger, logDegradation } = require('../logger.cjs');
const { generateEmbedding } = require('./embeddingService.cjs');
const { ChunkIndexService } = require('./chunkIndexService.cjs');
const {
    PREFILTER_TOKEN_MIN_LEN,
    PREFILTER_SCORE_THRESHOLD,
    MERGE_SYMPTOM_WEIGHT,
    MERGE_CHUNK_WEIGHT,
    MAX_CANDIDATES_BEFORE_RANK,
    EVIDENCE_CHUNKS_PER_DISEASE,
    FTS_LIMIT,
} = require('../config/cdssConfig.cjs');

function tokenize(text) {
    return String(text || '')
        .toLowerCase()
        .split(/[\s,;.()\[\]{}"'«»]+/)
        .map(t => t.trim())
        .filter(t => t.length >= PREFILTER_TOKEN_MIN_LEN);
}

function normalizeTo01(values) {
    const max = Math.max(...values);
    if (!Number.isFinite(max) || max <= 0) return values.map(() => 0);
    return values.map(v => v / max);
}

function invBm25ToScore(bm25) {
    const x = Number(bm25);
    if (!Number.isFinite(x)) return 0;
    if (x < 0) return 1;
    return 1 / (1 + x);
}

const CDSSSearchService = {
    structuredPreFilter(clinicalQuery, guidelines) {
        const qTokens = tokenize(clinicalQuery);
        if (qTokens.length === 0) return [];

        const results = [];
        for (const g of guidelines) {
            const fieldsText = [g.complaints, g.physicalExam, g.clinicalPicture]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            if (!fieldsText) continue;

            const matched = [];
            for (const t of qTokens) {
                if (fieldsText.includes(t)) matched.push(t);
            }

            const score = matched.length / qTokens.length;
            if (score > PREFILTER_SCORE_THRESHOLD) {
                results.push({
                    diseaseId: Number(g.diseaseId),
                    guidelineId: Number(g.id),
                    preFilterScore: score,
                    matchedTokens: matched,
                });
            }
        }

        results.sort((a, b) => b.preFilterScore - a.preFilterScore);
        return results;
    },

    async _ftsChunkSearch(clinicalQuery, diseaseFilterSet = null) {
        const q = String(clinicalQuery || '').trim();
        if (!q) return { diseaseScores: new Map(), evidenceByDisease: new Map() };

        const rows = await prisma.$queryRawUnsafe(
            `SELECT rowid as rowid, chunk_id as chunkId, disease_id as diseaseId, guideline_id as guidelineId, type as type, bm25(guideline_chunks_fts) as bm25\n` +
            `FROM guideline_chunks_fts\n` +
            `WHERE guideline_chunks_fts MATCH ?\n` +
            `ORDER BY bm25\n` +
            `LIMIT ${Number(FTS_LIMIT)}`,
            q
        );

        const diseaseScores = new Map();
        const evidenceByDisease = new Map();

        for (const r of rows) {
            const diseaseId = Number(r.diseaseId);
            if (diseaseFilterSet && !diseaseFilterSet.has(diseaseId)) continue;

            const s = invBm25ToScore(r.bm25);
            const prev = diseaseScores.get(diseaseId) || 0;
            if (s > prev) diseaseScores.set(diseaseId, s);

            const ev = evidenceByDisease.get(diseaseId) || [];
            if (ev.length < EVIDENCE_CHUNKS_PER_DISEASE) {
                ev.push({
                    chunkId: Number(r.chunkId),
                    guidelineId: Number(r.guidelineId),
                    type: r.type,
                    score: s,
                });
                evidenceByDisease.set(diseaseId, ev);
            }
        }

        return { diseaseScores, evidenceByDisease };
    },

    async _semanticChunkSearch(clinicalQuery, diseaseFilterSet = null) {
        const canEmbed = Boolean(process.env.VITE_GEMINI_API_KEY);
        if (!canEmbed) return { diseaseScores: new Map(), evidenceByDisease: new Map(), used: false };
        if (!ChunkIndexService.isLoaded()) return { diseaseScores: new Map(), evidenceByDisease: new Map(), used: false };

        try {
            const queryEmbedding = await generateEmbedding(String(clinicalQuery || ''));
            const ranked = ChunkIndexService.searchByEmbedding(queryEmbedding, diseaseFilterSet);

            const diseaseScores = new Map();
            const evidenceByDisease = new Map();
            for (const item of ranked.slice(0, 80)) {
                const diseaseId = Number(item.diseaseId);
                const sim = Number(item.similarity);
                if (!Number.isFinite(sim)) continue;

                diseaseScores.set(diseaseId, sim);
                evidenceByDisease.set(diseaseId, [{
                    chunkId: item.chunk.id,
                    guidelineId: item.chunk.guidelineId,
                    type: item.chunk.type,
                    score: sim,
                }]);
            }

            return { diseaseScores, evidenceByDisease, used: true };
        } catch (error) {
            logger.warn('[CDSSSearchService] semantic chunk search failed:', error.message);
            return { diseaseScores: new Map(), evidenceByDisease: new Map(), used: false };
        }
    },

    async searchByClinicalData(clinicalQuery, symptoms) {
        const guidelines = await prisma.clinicalGuideline.findMany({
            select: {
                id: true,
                diseaseId: true,
                complaints: true,
                physicalExam: true,
                clinicalPicture: true,
            },
        });

        const pre = this.structuredPreFilter(clinicalQuery, guidelines);
        const diseaseFilterSet = pre.length > 0 ? new Set(pre.map(r => r.diseaseId)) : null;

        let symptomCandidates = [];
        try {
            const { DiseaseService } = require('../modules/diseases/service.cjs');
            symptomCandidates = await DiseaseService.searchBySymptoms(symptoms);
        } catch (error) {
            logger.warn('[CDSSSearchService] symptom search failed:', error.message);
            symptomCandidates = [];
        }

        const symptomScoreByDisease = new Map();
        for (let i = 0; i < symptomCandidates.length; i++) {
            const d = symptomCandidates[i];
            symptomScoreByDisease.set(Number(d.id), (symptomCandidates.length - i) / symptomCandidates.length);
        }

        let chunkScores;
        let chunkEvidence;
        try {
            const lexical = await this._ftsChunkSearch(clinicalQuery, diseaseFilterSet);
            const semantic = await this._semanticChunkSearch(clinicalQuery, diseaseFilterSet);

            chunkScores = lexical.diseaseScores;
            chunkEvidence = lexical.evidenceByDisease;

            if (semantic.used) {
                for (const [diseaseId, sim] of semantic.diseaseScores.entries()) {
                    const prev = chunkScores.get(diseaseId) || 0;
                    if (sim > prev) {
                        chunkScores.set(diseaseId, sim);
                        chunkEvidence.set(diseaseId, semantic.evidenceByDisease.get(diseaseId) || []);
                    }
                }
            }
        } catch (error) {
            logger.warn('[CDSSSearchService] chunk search failed:', error.message);
            chunkScores = new Map();
            chunkEvidence = new Map();
        }

        const candidateDiseaseIds = new Set([
            ...symptomScoreByDisease.keys(),
            ...chunkScores.keys(),
        ]);

        if (candidateDiseaseIds.size === 0) {
            logDegradation('search', 'Empty');
            return [];
        }

        const diseaseRows = await prisma.disease.findMany({
            where: { id: { in: Array.from(candidateDiseaseIds) } },
        });

        const items = [];
        for (const d of diseaseRows) {
            const diseaseId = Number(d.id);
            const sScore = symptomScoreByDisease.get(diseaseId) || 0;
            const cScore = chunkScores.get(diseaseId) || 0;
            const hasChunks = chunkScores.has(diseaseId);

            const score = hasChunks
                ? (MERGE_SYMPTOM_WEIGHT * sScore + MERGE_CHUNK_WEIGHT * cScore)
                : sScore;

            items.push({
                disease: d,
                score,
                symptomScore: sScore,
                chunkScore: cScore,
                evidence: chunkEvidence.get(diseaseId) || [],
            });
        }

        const normalized = normalizeTo01(items.map(i => i.score));
        for (let i = 0; i < items.length; i++) {
            items[i].normalizedScore = normalized[i];
        }

        items.sort((a, b) => b.normalizedScore - a.normalizedScore);

        if (items.length === 0) {
            logDegradation('search', 'Empty');
            return [];
        }

        logDegradation('search', chunkScores.size > 0 ? 'FTS' : 'Symptoms');

        return items.slice(0, MAX_CANDIDATES_BEFORE_RANK);
    },
};

module.exports = { CDSSSearchService };
