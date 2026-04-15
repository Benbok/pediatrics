/**
 * CDSS Local LLM Service — TASK-057
 * Replaces Gemini API calls for parseComplaints and rankDiagnoses with LM Studio.
 * Falls back to keyword-based scoring when LLM is unavailable.
 */

'use strict';

const { logger, logDegradation } = require('../logger.cjs');
const { generate, healthCheck } = require('./localLlmService.cjs');
const { normalizeSymptoms } = require('../utils/cdssVocabulary.cjs');
const { MAX_CANDIDATES_FOR_AI_RANK } = require('../config/cdssConfig.cjs');

// ── Health-check cache (30 s TTL) ──────────────────────────────────────────

let _llmAvailableCache = null;   // boolean | null
let _llmCacheTimestamp = 0;
const LLM_CACHE_TTL_MS = 30_000;

/**
 * Returns whether the local LLM is reachable.
 * Result is cached for 30 seconds to avoid hammering healthCheck on every CDSS call.
 * @returns {Promise<boolean>}
 */
async function isLocalLlmAvailable() {
    const now = Date.now();
    if (_llmAvailableCache !== null && now - _llmCacheTimestamp < LLM_CACHE_TTL_MS) {
        return _llmAvailableCache;
    }
    try {
        const result = await healthCheck();
        _llmAvailableCache = result.available === true;
    } catch {
        _llmAvailableCache = false;
    }
    _llmCacheTimestamp = Date.now();
    return _llmAvailableCache;
}

// ── JSON extraction helper ─────────────────────────────────────────────────

/**
 * Extracts the first JSON object/array from a raw LLM response string.
 * Strips markdown fences and <think>...</think> blocks if present.
 * Looks for JSON array-of-objects pattern ([{) to avoid matching inline brackets
 * in preamble text produced by reasoning models.
 * Uses bracket-depth counting to correctly handle ] or } inside string values.
 * @param {string} raw
 * @returns {string}
 */
function _extractJson(raw) {
    let text = raw.trim();
    // Strip <think>...</think> blocks produced by reasoning models
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // Strip markdown fences
    if (text.startsWith('```json')) {
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (text.startsWith('```')) {
        text = text.replace(/```\n?/g, '').trim();
    }

    // Prefer JSON array-of-objects [ { ... } ] over any bare [
    const arrayOfObjectsIdx = text.search(/\[\s*\{/);
    const objStart = text.indexOf('{');
    const arrStart = text.indexOf('[');

    let start, openChar, closeChar;
    if (arrayOfObjectsIdx !== -1) {
        // Most reliable: found array-of-objects pattern
        start = arrayOfObjectsIdx; openChar = '['; closeChar = ']';
    } else if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
        start = arrStart; openChar = '['; closeChar = ']';
    } else if (objStart !== -1) {
        start = objStart; openChar = '{'; closeChar = '}';
    } else {
        return text;
    }

    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === openChar) depth++;
        if (ch === closeChar) { depth--; if (depth === 0) return text.slice(start, i + 1); }
    }
    // JSON was truncated — return from start to end anyway and let JSON.parse report the error
    return text.slice(start);
}

// ── Token collector helper ─────────────────────────────────────────────────

/**
 * Calls localLlmService.generate() and collects all streamed tokens into a string.
 * Respects a per-call timeout via options.timeoutMs.
 * @param {Array<{role:string, content:string}>} messages
 * @param {object} options
 * @returns {Promise<string>}
 */
async function _collectTokens(messages, options) {
    let accumulated = '';
    const result = await generate(messages, options, (token) => {
        accumulated += token;
    });
    if (result.status === 'error') {
        throw new Error(result.error || 'LLM generation error');
    }
    return accumulated;
}

// ── Fallback ranking (keyword-based) ───────────────────────────────────────

/**
 * Pure keyword overlap ranking used when LLM is unavailable.
 * Caps confidence at 0.9.
 * @param {string[]} symptoms
 * @param {Array<object>} diseases
 * @returns {Array<{diseaseId:number, confidence:number, reasoning:string, matchedSymptoms:string[]}>}
 */
function _fallbackRanking(symptoms, diseases) {
    // Normalized canonical forms (via vocabulary)
    const patientNorm = normalizeSymptoms(symptoms).map((s) => s.toLowerCase().trim());
    // Raw lowercased forms (no vocabulary lookup) for broad substring matching
    const patientRaw  = symptoms.map((s) => String(s || '').toLowerCase().trim());

    return diseases
        .map((d) => {
            const rawArr = Array.isArray(d.symptoms)
                ? d.symptoms
                : (() => { try { return JSON.parse(d.symptoms || '[]'); } catch { return []; } })();
            const diseaseNorm = normalizeSymptoms(rawArr).map((s) => s.toLowerCase().trim());
            const diseaseRaw  = rawArr.map((s) => String(s || '').toLowerCase().trim());

            // Match by:
            // 1. Raw substring: "температура" ⊂ "Температура тела > 38°C" (case-insensitive)
            // 2. Normalized canonical equality/substring: "лихорадка" == "лихорадка"
            const matchedSet = new Set();
            patientRaw.forEach((pt, i) => {
                if (!pt) return;
                const pn = patientNorm[i] || pt;
                if (diseaseRaw.some((dt) => dt.includes(pt) || pt.includes(dt))) {
                    matchedSet.add(pt);
                } else if (pn && diseaseNorm.some((dn) => dn === pn || dn.includes(pn) || pn.includes(dn))) {
                    matchedSet.add(pt);
                }
            });

            const confidence = Math.min(0.9, matchedSet.size / Math.max(symptoms.length, 1));
            return {
                diseaseId: d.id,
                confidence,
                reasoning: `Совпало ${matchedSet.size} из ${symptoms.length} симптомов (словарь)`,
                matchedSymptoms: [...matchedSet],
            };
        })
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
}

// ── parseComplaintsLocal ────────────────────────────────────────────────────

/**
 * Extracts structured symptoms from a combined clinical text using the local LLM.
 * If LLM is unavailable or fails, falls back to comma-split.
 *
 * @param {string} complaintsText  - Full clinical text (complaints + anamnesis + exam).
 * @param {number} ageMonths       - Patient age in months.
 * @param {number|null} weight     - Patient weight in kg (optional).
 * @returns {Promise<{symptoms: string[], severity: 'low'|'medium'|'high', fallback?: boolean}>}
 */
async function parseComplaintsLocal(complaintsText, ageMonths, weight = null) {
    if (!complaintsText || complaintsText.trim().length === 0) {
        throw new Error('Жалобы не могут быть пустыми');
    }

    const available = await isLocalLlmAvailable();
    if (!available) {
        logger.warn('[CDSSLocalLLM] LLM недоступна, parseComplaints → fallback split');
        logDegradation('parse', 'Fallback');
        return _splitFallback(complaintsText);
    }

    const prompt = `Ты — медицинский ассистент. Извлеки из клинического текста список симптомов.

Клинический текст: "${complaintsText.slice(0, 2000)}"
Возраст ребёнка: ${ageMonths} мес.${weight ? `\nВес: ${weight} кг` : ''}

Верни ТОЛЬКО валидный JSON (без markdown и пояснений):
{"symptoms":["симптом1","симптом2"],"severity":"low|medium|high"}

Симптомы — краткие медицинские термины на русском (например: "температура", "кашель", "одышка").`;

    try {
        const raw = await _collectTokens(
            [{ role: 'user', content: prompt }],
            { maxTokens: 200, temperature: 0.15, timeoutMs: 15_000, stop: ['\n\n'] }
        );

        const parsed = JSON.parse(_extractJson(raw));

        if (!Array.isArray(parsed.symptoms) || parsed.symptoms.length === 0) {
            throw new Error('symptoms array missing or empty');
        }
        if (!['low', 'medium', 'high'].includes(parsed.severity)) {
            parsed.severity = 'medium';
        }

        logger.info(`[CDSSLocalLLM] parseComplaints: ${parsed.symptoms.length} symptoms, severity=${parsed.severity}`);
        logDegradation('parse', 'LocalLLM');
        return parsed;

    } catch (err) {
        logger.warn(`[CDSSLocalLLM] parseComplaints LLM failed: ${err.message} — fallback split`);
        logDegradation('parse', 'Fallback');
        return _splitFallback(complaintsText);
    }
}

/**
 * @private
 */
function _splitFallback(text) {
    const raw = text.split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length > 2 && s.length < 80);
    return { symptoms: raw.slice(0, 15), severity: 'medium', fallback: true };
}

// ── rankDiagnosesLocal ──────────────────────────────────────────────────────

/**
 * Ranks disease candidates using the local LLM.
 * Falls back to keyword overlap scoring if LLM is unavailable or fails.
 *
 * @param {string[]} symptoms            - Extracted symptom list.
 * @param {Array<object>} diseases       - Disease candidate objects (from CDSSSearchService).
 * @param {object} patientContext        - {ageMonths, weight, height, temperature, vitalSigns, clinicalQuery}
 * @returns {Promise<Array<{diseaseId:number, confidence:number, reasoning:string, matchedSymptoms:string[]}>>}
 */
async function rankDiagnosesLocal(symptoms, diseases, patientContext = {}) {
    if (!symptoms || symptoms.length === 0 || !diseases || diseases.length === 0) {
        return [];
    }

    const available = await isLocalLlmAvailable();
    if (!available) {
        logger.warn('[CDSSLocalLLM] LLM недоступна, rankDiagnoses → fallback');
        logDegradation('rank', 'Fallback');
        return _fallbackRanking(symptoms, diseases.slice(0, MAX_CANDIDATES_FOR_AI_RANK));
    }

    // Compact representation to save context tokens
    const candidates = diseases.slice(0, MAX_CANDIDATES_FOR_AI_RANK).map((d) => {
        const raw = Array.isArray(d.symptoms)
            ? d.symptoms
            : (() => { try { return JSON.parse(d.symptoms || '[]'); } catch { return []; } })();
        return {
            id: d.id,
            name: d.nameRu,
            icd10: d.icd10Code || '',
            symptoms: raw.slice(0, 5),
        };
    });

    const ageText = patientContext.ageMonths ? `${patientContext.ageMonths} мес.` : 'не указан';

    const prompt = `Ты — педиатрический CDSS. Оцени вероятность каждого диагноза для ребёнка.

Симптомы: ${symptoms.join(', ')}
Возраст: ${ageText}${patientContext.weight ? `\nВес: ${patientContext.weight} кг` : ''}${patientContext.temperature ? `\nТемпература: ${patientContext.temperature} °C` : ''}

Кандидаты (JSON):
${JSON.stringify(candidates)}

Верни ТОЛЬКО валидный JSON-массив (без markdown и пояснений). Для каждого кандидата:
[{"diseaseId":<число>,"confidence":<0.0-1.0>,"reasoning":"<кратко на рус>","matchedSymptoms":["..."]}]

ВАЖНО: diseaseId — целое число из поля "id" кандидата.`;

    let rawResponse = '';
    try {
        rawResponse = await _collectTokens(
            [
                { role: 'system', content: 'You are a medical assistant. Respond ONLY with a valid JSON array. No explanations, no markdown, no preamble.' },
                { role: 'user', content: prompt },
            ],
            { maxTokens: 1500, temperature: 0.2, timeoutMs: 40_000 }
        );

        const rankings = JSON.parse(_extractJson(rawResponse));

        if (!Array.isArray(rankings)) {
            throw new Error('Expected JSON array');
        }

        const validated = rankings
            .map((r) => ({
                diseaseId: Number(r.diseaseId),
                confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0)),
                reasoning: r.reasoning || 'Нет объяснения',
                matchedSymptoms: Array.isArray(r.matchedSymptoms) ? r.matchedSymptoms : [],
            }))
            .filter((r) => r.diseaseId && !isNaN(r.diseaseId))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5);

        logger.info(`[CDSSLocalLLM] rankDiagnoses: ${validated.length} results (from ${rankings.length} raw)`);
        logDegradation('rank', 'LocalLLM');
        return validated;

    } catch (err) {
        logger.warn(`[CDSSLocalLLM] rankDiagnoses LLM failed: ${err.message} — fallback`);
        logger.warn(`[CDSSLocalLLM] rankDiagnoses raw response: ${String(rawResponse).slice(0, 500) || '<empty>'}`);
        logDegradation('rank', 'Fallback');
        return _fallbackRanking(symptoms, diseases.slice(0, MAX_CANDIDATES_FOR_AI_RANK));
    }
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    isLocalLlmAvailable,
    parseComplaintsLocal,
    rankDiagnosesLocal,
};
