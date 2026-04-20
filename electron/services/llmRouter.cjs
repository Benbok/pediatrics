'use strict';

/**
 * llmRouter.cjs
 *
 * Returns the appropriate LLM provider (local or Gemini) for a given feature
 * based on the persisted routing preference in aiRoutingStore.
 *
 * API:
 *   getProvider(featureId) → Promise<localLlmService | geminiLlmAdapter>
 *   abortAll()             → aborts both providers (use for llm:abort IPC)
 */

const localLlmService = require('./localLlmService.cjs');
const geminiLlmAdapter = require('./geminiLlmAdapter.cjs');
const aiRoutingStore   = require('./aiRoutingStore.cjs');

/**
 * Returns the LLM provider configured for featureId.
 * Falls back to local on any error.
 *
 * @param {string} featureId  e.g. 'refine-field' | 'rag'
 * @returns {Promise<object>} provider with generate/healthCheck/abort interface
 */
async function getProvider(featureId) {
    try {
        const provider = await aiRoutingStore.get(featureId);
        return provider === 'gemini' ? geminiLlmAdapter : localLlmService;
    } catch {
        return localLlmService;
    }
}

/**
 * Health-checks the configured provider for a feature.
 * Returns { available, provider, reason?, endpoint? }
 *
 * @param {string} featureId
 * @returns {Promise<{available: boolean, provider: string, reason?: string, endpoint?: string, models?: string[]}>}
 */
async function checkFeatureHealth(featureId) {
    let configuredProvider = 'local';
    try { configuredProvider = await aiRoutingStore.get(featureId); } catch {}

    try {
        const llm = configuredProvider === 'gemini' ? geminiLlmAdapter : localLlmService;
        const health = await llm.healthCheck();
        return {
            available: Boolean(health.available),
            provider: configuredProvider,
            endpoint: health.endpoint,
            models: health.models,
        };
    } catch (err) {
        return { available: false, provider: configuredProvider, reason: err.message };
    }
}

/**
 * Abort active generation in both providers.
 * Call this from the llm:abort IPC handler.
 */
function abortAll() {
    localLlmService.abort();
    geminiLlmAdapter.abort();
}

module.exports = { getProvider, checkFeatureHealth, abortAll };
