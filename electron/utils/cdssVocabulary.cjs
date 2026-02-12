const fs = require('fs');
const path = require('path');
const { logger } = require('../logger.cjs');

let cachedVocabulary = null;

function loadVocabulary() {
    if (cachedVocabulary !== null) return cachedVocabulary;

    try {
        const vocabPath = path.join(__dirname, '..', 'constants', 'cdssVocabulary.json');
        const raw = fs.readFileSync(vocabPath, 'utf8');
        cachedVocabulary = JSON.parse(raw);
        return cachedVocabulary;
    } catch (error) {
        logger.warn('[CDSSVocabulary] Failed to load vocabulary:', error.message);
        cachedVocabulary = { symptoms: [], contraindications: [] };
        return cachedVocabulary;
    }
}

function invalidateVocabularyCache() {
    cachedVocabulary = null;
}

function normalizeText(value) {
    if (!value) return '';
    return String(value).toLowerCase().trim();
}

function buildVariantMap(entries) {
    const map = new Map();
    entries.forEach(entry => {
        const canonical = normalizeText(entry.canonical);
        if (canonical) {
            map.set(canonical, entry.canonical);
        }
        (entry.variants || []).forEach(variant => {
            const key = normalizeText(variant);
            if (key) {
                map.set(key, entry.canonical);
            }
        });
    });
    return map;
}

function normalizeTerms(terms, category) {
    const vocabulary = loadVocabulary();
    const entries = vocabulary[category] || [];
    const map = buildVariantMap(entries);

    return terms
        .map(term => map.get(normalizeText(term)) || term)
        .filter(term => term && String(term).trim().length > 0);
}

function normalizeSymptoms(symptoms) {
    if (!Array.isArray(symptoms)) return [];
    const vocabulary = loadVocabulary();
    const entries = vocabulary.symptoms || [];
    const map = buildVariantMap(entries);

    const normalized = symptoms
        .map(symptom => {
            const raw = String(symptom || '').trim();
            if (!raw) return null;
            const normalizedRaw = normalizeText(raw);

            if (map.has(normalizedRaw)) {
                return map.get(normalizedRaw);
            }

            for (const [variant, canonical] of map.entries()) {
                if (variant && normalizedRaw.includes(variant)) {
                    return canonical;
                }
            }

            return raw;
        })
        .filter(Boolean);

    const unique = Array.from(new Set(normalized.map(item => item.trim())));
    return unique;
}

function normalizeContraindicationsText(text) {
    if (!text || typeof text !== 'string') return text;

    const vocabulary = loadVocabulary();
    const entries = vocabulary.contraindications || [];
    const map = buildVariantMap(entries);
    let normalized = text;

    map.forEach((canonical, variant) => {
        if (!variant) return;
        const regex = new RegExp(`\\b${variant}\\b`, 'gi');
        normalized = normalized.replace(regex, canonical);
    });

    return normalized;
}

function getCanonicalSet(category) {
    const vocabulary = loadVocabulary();
    const entries = vocabulary[category] || [];
    return new Set(entries.map(entry => normalizeText(entry.canonical)).filter(Boolean));
}

let cachedVersion = null;

function getVersion() {
    if (cachedVersion !== null) return cachedVersion;
    try {
        const versionFile = path.join(__dirname, '..', 'constants', 'vocabularyVersion.json');
        const raw = fs.readFileSync(versionFile, 'utf8');
        cachedVersion = JSON.parse(raw).version;
    } catch {
        cachedVersion = 1;
    }
    return cachedVersion;
}

function invalidateVersionCache() {
    cachedVersion = null;
}

module.exports = {
    loadVocabulary,
    normalizeText,
    normalizeSymptoms,
    normalizeContraindicationsText,
    getCanonicalSet,
    getVersion,
    invalidateVersionCache,
    invalidateVocabularyCache
};
