const { logger, logDegradation } = require('../logger.cjs');

const { MAX_CANDIDATES_FOR_AI_RANK } = require('../config/cdssConfig.cjs');

/**
 * Двухфазный ранкинг диагнозов с детальным логированием
 * Фаза 1: BM25 + эмбеддинги (быстрый фильтр, уже выполнен CDSSSearchService)
 * Фаза 2: Gemini AI (точный ранкинг топ-результатов)
 */
async function rankDiagnosesWithContext(symptoms, candidates, patientContext = {}, clinicalQuery = '') {
    const startTime = Date.now();
    const phase1Count = candidates.length;

    logger.info(`[CDSSRankingService] Starting two-phase ranking for ${phase1Count} candidates`);
    logger.info(`[CDSSRankingService] Phase 1 (Search): ${phase1Count} candidates from BM25/semantic search`);

    // Фаза 1 уже выполнена CDSSSearchService, логируем результаты
    if (candidates.length > 0) {
        const topCandidates = candidates.slice(0, 3).map((c, idx) => ({
            rank: idx + 1,
            diseaseId: c.disease.id,
            name: c.disease.nameRu,
            score: c.score?.toFixed(3),
            normalizedScore: c.normalizedScore?.toFixed(3),
            symptomScore: c.symptomScore?.toFixed(3),
            chunkScore: c.chunkScore?.toFixed(3),
            evidenceCount: c.evidence?.length || 0
        }));
        logger.info(`[CDSSRankingService] Phase 1 top candidates:`, topCandidates);
    }

    const canRank = Boolean(process.env.VITE_GEMINI_API_KEY);
    if (!canRank) {
        logger.warn(`[CDSSRankingService] Phase 2 (AI): SKIPPED - No API key available`);
        logDegradation('rank', 'NoAI');

        const fallbackResults = candidates.slice(0, MAX_CANDIDATES_FOR_AI_RANK).map((c, idx) => {
            const confidence = Math.max(0.1, 1 - idx * 0.08);
            return {
                diseaseId: c.disease.id,
                confidence,
                reasoning: `Phase 1 score: ${c.normalizedScore?.toFixed(3) || 'N/A'} (AI недоступен)`,
                matchedSymptoms: Array.isArray(symptoms) ? symptoms : [],
                phase1Score: c.normalizedScore || 0,
                rankingFactors: {
                    phase1NormalizedScore: c.normalizedScore || 0,
                    phase1SymptomScore: c.symptomScore || 0,
                    phase1ChunkScore: c.chunkScore || 0,
                    aiContribution: 0
                }
            };
        });

        const endTime = Date.now();
        logger.info(`[CDSSRankingService] Completed in ${endTime - startTime}ms - ${fallbackResults.length} results (No AI)`);
        return fallbackResults;
    }

    // Фаза 2: AI ранкинг топ-кандидатов
    const phase2Candidates = candidates.slice(0, MAX_CANDIDATES_FOR_AI_RANK);
    logger.info(`[CDSSRankingService] Phase 2 (AI): Processing ${phase2Candidates.length} top candidates`);

    try {
        const { rankDiagnoses } = require('./cdssService.cjs');

        const diseasesForPrompt = phase2Candidates.map(c => {
            const ev = (c.evidence || []).map(e => `${e.type || 'other'}:${e.chunkId}`).join(', ');
            return {
                ...c.disease,
                _cdssEvidence: ev,
                _cdssClinicalQuery: clinicalQuery,
            };
        });

        const aiStartTime = Date.now();
        const aiRankings = await rankDiagnoses(symptoms, diseasesForPrompt, {
            ...patientContext,
            clinicalQuery,
        });
        const aiEndTime = Date.now();

        logger.info(`[CDSSRankingService] Phase 2 (AI): Completed in ${aiEndTime - aiStartTime}ms`);

        // Объединяем результаты фаз 1 и 2 с детальным логированием
        const finalResults = aiRankings.map(aiResult => {
            const candidate = candidates.find(c => c.disease.id === aiResult.diseaseId);
            const phase1Score = candidate?.normalizedScore || 0;

            return {
                ...aiResult,
                phase1Score,
                rankingFactors: {
                    phase1NormalizedScore: phase1Score,
                    phase1SymptomScore: candidate?.symptomScore || 0,
                    phase1ChunkScore: candidate?.chunkScore || 0,
                    aiConfidence: aiResult.confidence,
                    aiContribution: aiResult.confidence
                }
            };
        });

        // Логируем топ-результатов с факторами ранкинга
        if (finalResults.length > 0) {
            const topResults = finalResults.slice(0, 3).map((r, idx) => ({
                rank: idx + 1,
                diseaseId: r.diseaseId,
                confidence: r.confidence.toFixed(3),
                phase1Score: r.phase1Score.toFixed(3),
                reasoning: r.reasoning,
                matchedSymptomsCount: r.matchedSymptoms?.length || 0,
                rankingFactors: {
                    phase1Normalized: r.rankingFactors.phase1NormalizedScore.toFixed(3),
                    phase1Symptoms: r.rankingFactors.phase1SymptomScore.toFixed(3),
                    phase1Chunks: r.rankingFactors.phase1ChunkScore.toFixed(3),
                    aiConfidence: r.rankingFactors.aiConfidence.toFixed(3)
                }
            }));
            logger.info(`[CDSSRankingService] Final top results:`, topResults);
        }

        logDegradation('rank', 'AI');
        const endTime = Date.now();
        logger.info(`[CDSSRankingService] Two-phase ranking completed in ${endTime - startTime}ms - ${finalResults.length} results`);

        return finalResults;

    } catch (error) {
        logger.warn(`[CDSSRankingService] Phase 2 (AI): FAILED - ${error.message}`);
        logDegradation('rank', 'Fallback');

        const fallbackResults = candidates.slice(0, MAX_CANDIDATES_FOR_AI_RANK).map((c, idx) => {
            const confidence = Math.max(0.1, 1 - idx * 0.08);
            return {
                diseaseId: c.disease.id,
                confidence,
                reasoning: `Phase 1 score: ${c.normalizedScore?.toFixed(3) || 'N/A'} (AI ошибка: ${error.message})`,
                matchedSymptoms: Array.isArray(symptoms) ? symptoms : [],
                phase1Score: c.normalizedScore || 0,
                rankingFactors: {
                    phase1NormalizedScore: c.normalizedScore || 0,
                    phase1SymptomScore: c.symptomScore || 0,
                    phase1ChunkScore: c.chunkScore || 0,
                    aiContribution: 0,
                    error: error.message
                }
            };
        });

        const endTime = Date.now();
        logger.info(`[CDSSRankingService] Completed with fallback in ${endTime - startTime}ms - ${fallbackResults.length} results`);
        return fallbackResults;
    }
}

module.exports = {
    rankDiagnosesWithContext,
};
