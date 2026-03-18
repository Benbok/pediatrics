module.exports = {
    // Chunking settings for clinical knowledge preprocessing
    CHUNK_SIZE: 700,
    CHUNK_OVERLAP: 100,

    // Phase 1 prefiltering thresholds
    PREFILTER_TOKEN_MIN_LEN: 3,
    PREFILTER_SCORE_THRESHOLD: 0.1,

    // Hybrid merge weights (must sum to 1.0)
    MERGE_SYMPTOM_WEIGHT: 0.4,
    MERGE_CHUNK_WEIGHT: 0.6,

    // Candidate limits for two-phase ranking pipeline
    MAX_CANDIDATES_BEFORE_RANK: 15,
    MAX_CANDIDATES_FOR_AI_RANK: 8,
    EVIDENCE_CHUNKS_PER_DISEASE: 2,

    // Full-text search cap per request
    FTS_LIMIT: 60,

    // Basic vital-sign thresholds used for contextual scoring
    ABNORMAL_VITALS: {
        temperatureC: 37.5,
        oxygenSaturation: 95,
    },

    // Fallback analysis constants (Task 2)
    MAX_FALLBACK_CONFIDENCE: 0.4,        // Maximum confidence for fallback analysis (40%)
    MIN_FALLBACK_MATCHES: 2,             // Minimum symptom matches required
    MAX_FALLBACK_SUGGESTIONS: 3,         // Maximum suggestions in fallback mode
};
