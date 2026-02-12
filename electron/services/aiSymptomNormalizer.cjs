/**
 * AI Symptom Normalizer: dictionary-first normalization with optional batch AI enhancement.
 * Uses passive circuit breaker, versioned cache, and async vocabulary learning.
 */

const { logger } = require('../logger.cjs');
const { logDegradation } = require('../logger.cjs');
const { normalizeSymptoms, getVersion } = require('../utils/cdssVocabulary.cjs');

// --- Passive circuit breaker (no pings; 3 consecutive failures -> open 5 min) ---
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 5 * 60 * 1000;

const circuitBreaker = {
    failures: 0,
    lastFailureTime: null,
    isOpen: false,

    isAvailable() {
        if (!this.isOpen) return true;
        if (Date.now() - this.lastFailureTime >= CIRCUIT_OPEN_MS) {
            this.isOpen = false;
            this.failures = 0;
            logger.info('[AISymptomNormalizer] Circuit breaker closed');
            return true;
        }
        return false;
    },

    recordSuccess() {
        this.failures = 0;
    },

    recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= CIRCUIT_FAILURE_THRESHOLD) {
            this.isOpen = true;
            logger.warn('[AISymptomNormalizer] Circuit breaker open for 5 min');
        }
    }
};

/** Versioned cache: key = sorted symptoms + @v + version */
const cache = new Map();
const MAX_CACHE_SIZE = 500;

function getCacheKey(symptoms) {
    const sorted = [...symptoms].filter(Boolean).map(s => String(s).trim()).sort();
    return sorted.join('|') + '@v' + getVersion();
}

/** Force circuit open (for --force-fallback in CLI) or close and reset. */
function setCircuitOpen(open) {
    circuitBreaker.isOpen = !!open;
    if (open) {
        circuitBreaker.failures = CIRCUIT_FAILURE_THRESHOLD;
        circuitBreaker.lastFailureTime = Date.now();
    } else {
        circuitBreaker.failures = 0;
    }
}

/**
 * Batch AI normalization: one Gemini request for all symptoms.
 * Expected AI response: JSON with { "normalizations": [ { "original", "canonical", "synonyms" } ] }
 */
async function callBatchAINormalize(symptoms) {
    const { callGeminiAPI } = require('./cdssService.cjs'); // lazy to avoid circular require
    const prompt = `Нормализуй перечень симптомов к каноническим медицинским формулировкам на русском языке.

Список симптомов: ${symptoms.join(', ')}

Верни ТОЛЬКО валидный JSON без markdown и пояснений:
{
  "normalizations": [
    { "original": "исходный симптом", "canonical": "каноническая форма", "synonyms": ["синоним1", "синоним2"] }
  ]
}

Для каждого симптома укажи одну каноническую форму и при необходимости синонимы.`;
    const raw = await callGeminiAPI(prompt);
    let text = raw.trim();
    if (text.startsWith('```json')) {
        text = text.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim();
    } else if (text.startsWith('```')) {
        text = text.replace(/^```\s*/, '').replace(/\s*```\s*$/, '').trim();
    }
    const parsed = JSON.parse(text);
    const list = parsed.normalizations || parsed;
    if (!Array.isArray(list)) {
        throw new Error('AI response: normalizations array not found');
    }
    return list;
}

/**
 * Merge dictionary-normalized list with AI result: prefer canonical from AI when available.
 */
function mergeResults(dictNormalized, aiNormalizations) {
    const byOriginal = new Map();
    (aiNormalizations || []).forEach((item) => {
        const orig = (item.original || '').trim().toLowerCase();
        const can = (item.canonical || '').trim();
        if (orig && can) byOriginal.set(orig, { canonical: can, synonyms: item.synonyms || [] });
    });

    const result = dictNormalized.map((s) => {
        const key = s.trim().toLowerCase();
        const ai = byOriginal.get(key);
        return ai ? ai.canonical : s.trim();
    });
    return [...new Set(result)].filter(Boolean);
}

/**
 * Normalize symptoms: dictionary first, then optional batch AI; versioned cache; optional vocabulary learning.
 * @param {string[]} symptoms - Raw symptom strings
 * @returns {Promise<{ normalized: string[], source: string, aiUsed: boolean }>}
 */
async function normalizeWithAI(symptoms) {
    if (!symptoms || !Array.isArray(symptoms)) {
        return { normalized: [], source: 'dictionary', aiUsed: false };
    }
    const input = symptoms.map(s => String(s || '').trim()).filter(Boolean);
    if (input.length === 0) {
        return { normalized: [], source: 'dictionary', aiUsed: false };
    }

    // 1. Dictionary always
    const dictNormalized = normalizeSymptoms(input);

    if (!circuitBreaker.isAvailable()) {
        logDegradation('normalize', 'Dictionary');
        return { normalized: dictNormalized, source: 'dictionary', aiUsed: false };
    }

    // 2. Versioned cache
    const cacheKey = getCacheKey(dictNormalized);
    if (cache.has(cacheKey)) {
        return { normalized: cache.get(cacheKey), source: 'cache', aiUsed: false };
    }

    // 3. Batch AI
    try {
        const aiList = await callBatchAINormalize(dictNormalized);
        const enhanced = mergeResults(dictNormalized, aiList);
        circuitBreaker.recordSuccess();

        // 4. Async vocabulary learning (non-blocking)
        try {
            const VocabularyLearner = require('../utils/vocabularyLearner.cjs');
            VocabularyLearner.learnFromAI(aiList).catch((err) => {
                logger.warn('[AISymptomNormalizer] Vocabulary learn failed:', err.message);
            });
        } catch (_) {
            // learner not yet available
        }

        if (cache.size >= MAX_CACHE_SIZE) {
            const firstKey = cache.keys().next().value;
            if (firstKey) cache.delete(firstKey);
        }
        cache.set(cacheKey, enhanced);
        logDegradation('normalize', 'AI');
        return { normalized: enhanced, source: 'ai', aiUsed: true };
    } catch (error) {
        circuitBreaker.recordFailure();
        logger.warn('[AISymptomNormalizer] AI normalization failed, using dictionary:', error.message);
        logDegradation('normalize', 'Dictionary');
        return { normalized: dictNormalized, source: 'dictionary_fallback', aiUsed: false };
    }
}

module.exports = {
    normalizeWithAI,
    setCircuitOpen,
    circuitBreaker,
    getVersion
};
