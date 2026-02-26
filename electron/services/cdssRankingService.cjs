const { logger, logDegradation } = require('../logger.cjs');

const { MAX_CANDIDATES_FOR_AI_RANK } = require('../config/cdssConfig.cjs');

async function rankDiagnosesWithContext(symptoms, candidates, patientContext = {}, clinicalQuery = '') {
    const canRank = Boolean(process.env.VITE_GEMINI_API_KEY);
    if (!canRank) {
        logDegradation('rank', 'NoAI');
        return candidates.slice(0, MAX_CANDIDATES_FOR_AI_RANK).map((c, idx) => ({
            diseaseId: c.disease.id,
            confidence: Math.max(0.1, 1 - idx * 0.08),
            reasoning: 'FTS/semantic ranking (AI недоступен)',
            matchedSymptoms: Array.isArray(symptoms) ? symptoms : [],
        }));
    }

    try {
        const { rankDiagnoses } = require('./cdssService.cjs');

        const diseasesForPrompt = candidates.slice(0, MAX_CANDIDATES_FOR_AI_RANK).map(c => {
            const ev = (c.evidence || []).map(e => `${e.type || 'other'}:${e.chunkId}`).join(', ');
            return {
                ...c.disease,
                _cdssEvidence: ev,
                _cdssClinicalQuery: clinicalQuery,
            };
        });

        const ranked = await rankDiagnoses(symptoms, diseasesForPrompt, {
            ...patientContext,
            clinicalQuery,
        });

        logDegradation('rank', 'AI');
        return ranked;
    } catch (error) {
        logger.warn('[CDSSRankingService] AI ranking failed:', error.message);
        logDegradation('rank', 'Fallback');
        return candidates.slice(0, MAX_CANDIDATES_FOR_AI_RANK).map((c, idx) => ({
            diseaseId: c.disease.id,
            confidence: Math.max(0.1, 1 - idx * 0.08),
            reasoning: 'Fallback ranking (AI ошибка)',
            matchedSymptoms: Array.isArray(symptoms) ? symptoms : [],
        }));
    }
}

module.exports = {
    rankDiagnosesWithContext,
};
