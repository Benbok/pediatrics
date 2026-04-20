'use strict';

/**
 * aiRoutingStore.cjs
 *
 * Persists per-feature AI provider preference (local | gemini)
 * to {userData}/ai-routing.json.
 *
 * API:
 *   getAll()          → [{id, label, provider}]
 *   get(featureId)    → 'local' | 'gemini'
 *   set(featureId, provider) → void
 */

const fs = require('fs').promises;
const path = require('path');

// Lazy-loaded to avoid accessing app before ready
function _getRoutingFile() {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'ai-routing.json');
}

/**
 * Feature registry — defines available routable features and their defaults.
 */
const FEATURES = {
    'refine-field': { label: 'Рефайн текста (визиты)', default: 'local' },
    'visit-analysis': { label: 'AI-анализ визита', default: 'local' },
    'rag':          { label: 'Клинические рекомендации (RAG)', default: 'local' },
};

const VALID_PROVIDERS = new Set(['local', 'gemini']);

const DEFAULTS = Object.fromEntries(
    Object.entries(FEATURES).map(([k, v]) => [k, v.default])
);

async function _read() {
    try {
        const raw = await fs.readFile(_getRoutingFile(), 'utf8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...(parsed.routes || {}) };
    } catch {
        return { ...DEFAULTS };
    }
}

async function _write(routes) {
    await fs.writeFile(
        _getRoutingFile(),
        JSON.stringify({ version: 1, routes }, null, 2),
        'utf8'
    );
}

/**
 * Returns full list of features with their current provider.
 * @returns {Promise<Array<{id: string, label: string, provider: string}>>}
 */
async function getAll() {
    const routes = await _read();
    return Object.entries(FEATURES).map(([id, meta]) => ({
        id,
        label: meta.label,
        provider: routes[id] || meta.default,
    }));
}

/**
 * Returns the configured provider for a feature.
 * @param {string} featureId
 * @returns {Promise<'local'|'gemini'>}
 */
async function get(featureId) {
    const routes = await _read();
    return routes[featureId] || FEATURES[featureId]?.default || 'local';
}

/**
 * Sets the provider for a feature.
 * @param {string} featureId
 * @param {'local'|'gemini'} provider
 */
async function set(featureId, provider) {
    if (!FEATURES[featureId]) throw new Error(`Unknown feature: ${featureId}`);
    if (!VALID_PROVIDERS.has(provider)) throw new Error(`Unknown provider: ${provider}`);
    const routes = await _read();
    routes[featureId] = provider;
    await _write(routes);
}

module.exports = { getAll, get, set, FEATURES, VALID_PROVIDERS };
