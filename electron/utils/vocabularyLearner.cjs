/**
 * Vocabulary Learner: promotes AI normalization results into the main CDSS vocabulary.
 * Suggestions are stored in cdssVocabularySuggestions.json; at >= 3 occurrences an entry is promoted.
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger.cjs');
const { loadVocabulary, invalidateVersionCache, invalidateVocabularyCache } = require('./cdssVocabulary.cjs');

const SUGGESTIONS_PATH = path.join(__dirname, '..', 'constants', 'cdssVocabularySuggestions.json');
const VOCAB_PATH = path.join(__dirname, '..', 'constants', 'cdssVocabulary.json');
const VERSION_PATH = path.join(__dirname, '..', 'constants', 'vocabularyVersion.json');
const PROMOTE_THRESHOLD = 3;

function loadSuggestions() {
    try {
        const raw = fs.readFileSync(SUGGESTIONS_PATH, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveSuggestions(list) {
    fs.writeFileSync(SUGGESTIONS_PATH, JSON.stringify(list, null, 2), 'utf8');
}

function loadVersion() {
    try {
        const raw = fs.readFileSync(VERSION_PATH, 'utf8');
        return JSON.parse(raw);
    } catch {
        return { version: 1, updated: new Date().toISOString() };
    }
}

function bumpVersion() {
    const current = loadVersion();
    const next = { version: current.version + 1, updated: new Date().toISOString() };
    fs.writeFileSync(VERSION_PATH, JSON.stringify(next, null, 2), 'utf8');
    invalidateVersionCache();
    logger.info('[VocabularyLearner] Vocabulary version bumped to', next.version);
}

/**
 * Add or update suggestions from AI normalizations; promote entries with occurrences >= 3.
 * @param {Array<{ original?: string, canonical?: string, synonyms?: string[] }>} normalizations
 */
async function learnFromAI(normalizations) {
    if (!normalizations || !Array.isArray(normalizations) || normalizations.length === 0) {
        return;
    }
    const suggestions = loadSuggestions();
    const vocab = loadVocabulary();
    const symptomEntries = [...(vocab.symptoms || [])];
    const canonicalsInVocab = new Set(symptomEntries.map((e) => (e.canonical || '').trim().toLowerCase()));

    for (const item of normalizations) {
        const canonical = (item.canonical || '').trim();
        const original = (item.original || '').trim();
        if (!canonical) continue;

        const variants = [original, ...(item.synonyms || [])].map((v) => (v || '').trim()).filter(Boolean);
        const key = canonical.toLowerCase();

        let entry = suggestions.find((s) => (s.canonical || '').toLowerCase() === key);
        if (entry) {
            entry.occurrences = (entry.occurrences || 0) + 1;
            const existingVars = new Set(entry.variants || []);
            variants.forEach((v) => existingVars.add(v));
            entry.variants = [...existingVars];
        } else {
            entry = { canonical, variants: [...new Set(variants)], occurrences: 1 };
            suggestions.push(entry);
        }

        if (entry.occurrences >= PROMOTE_THRESHOLD && !canonicalsInVocab.has(key)) {
            const newEntry = {
                canonical: entry.canonical,
                variants: (entry.variants || []).filter((v) => v.toLowerCase() !== key)
            };
            symptomEntries.push(newEntry);
            canonicalsInVocab.add(key);
            const idx = suggestions.indexOf(entry);
            if (idx !== -1) suggestions.splice(idx, 1);
            logger.info('[VocabularyLearner] Promoted to vocabulary:', entry.canonical);
        }
    }

    saveSuggestions(suggestions);

    const promoted = symptomEntries.length - (vocab.symptoms || []).length;
    if (promoted > 0) {
        vocab.symptoms = symptomEntries;
        fs.writeFileSync(VOCAB_PATH, JSON.stringify(vocab, null, 2), 'utf8');
        invalidateVocabularyCache();
        bumpVersion();
    }
}

module.exports = {
    learnFromAI,
    loadSuggestions,
    PROMOTE_THRESHOLD
};
