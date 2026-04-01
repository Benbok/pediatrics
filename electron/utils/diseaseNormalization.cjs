const { normalizeText, loadVocabulary } = require('./cdssVocabulary.cjs');

const TREATMENT_CATEGORY_MAP = [
    { tokens: ['symptom', 'симптом'], value: 'symptomatic' },
    { tokens: ['etiolog', 'этиолог', 'этиотроп'], value: 'etiologic' },
    { tokens: ['support', 'поддерж', 'поддержива'], value: 'supportive' },
    { tokens: ['other', 'проч', 'другое', 'иное', 'дополн'], value: 'other' }
];

const DIAGNOSTIC_TYPE_MAP = [
    { tokens: ['lab', 'лаборатор'], value: 'lab' },
    { tokens: ['instrument', 'инструмент'], value: 'instrumental' }
];

/**
 * Jaro-Winkler similarity (0 to 1, where 1 is perfect match)
 * Lightweight implementation without external dependencies
 */
function jaroWinkler(s1, s2) {
    let a = s1.toLowerCase();
    let b = s2.toLowerCase();
    
    if (a.length > 254 || b.length > 254) {
        a = a.substring(0, 254);
        b = b.substring(0, 254);
    }
    
    const jaro = jaro_similarity(a, b);
    if (jaro < 0.7) return jaro;
    
    // Find common prefix (up to 4 chars)
    let l = 0;
    for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
        if (a[i] === b[i]) l++;
        else break;
    }
    
    return jaro + (l * 0.1 * (1 - jaro));
}

function jaro_similarity(a, b) {
    const aLen = a.length;
    const bLen = b.length;
    if (aLen === 0 && bLen === 0) return 1;
    if (aLen === 0 || bLen === 0) return 0;
    
    const matchDistance = Math.max(aLen, bLen) / 2 - 1;
    const aMatches = new Array(aLen);
    const bMatches = new Array(bLen);
    let matches = 0;
    let transpositions = 0;
    
    for (let i = 0; i < aLen; i++) {
        const start = Math.max(0, i - matchDistance);
        const end = Math.min(i + matchDistance + 1, bLen);
        
        for (let j = start; j < end; j++) {
            if (bMatches[j] || a[i] !== b[j]) continue;
            aMatches[i] = true;
            bMatches[j] = true;
            matches++;
            break;
        }
    }
    
    if (matches === 0) return 0;
    
    let k = 0;
    for (let i = 0; i < aLen; i++) {
        if (!aMatches[i]) continue;
        while (!bMatches[k]) k++;
        if (a[i] !== b[k]) transpositions++;
        k++;
    }
    
    return (matches / aLen + matches / bLen + (matches - transpositions / 2) / matches) / 3;
}

/**
 * Find the best matching test name from a flat string[] using fuzzy matching (legacy).
 * Returns the canonical name if similarity >= threshold, otherwise returns the input.
 */
function findBestMatchingTestName(inputName, availableTestNames, threshold = 0.92) {
    if (!inputName || !Array.isArray(availableTestNames) || availableTestNames.length === 0) {
        return inputName;
    }
    
    let bestMatch = inputName;
    let bestScore = 0;
    
    for (const candidate of availableTestNames) {
        const score = jaroWinkler(inputName, candidate);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = candidate;
        }
    }
    
    return bestScore >= threshold ? bestMatch : inputName;
}

/**
 * Resolve a test name against DiagnosticTestCatalog using 3-tier lookup:
 *   Tier 1 — exact match on nameRu (case-insensitive)
 *   Tier 2 — exact or fuzzy (>= 0.85) match inside aliases JSON array
 *   Tier 3 — fuzzy match on nameRu (>= 0.92)
 * Returns the canonical nameRu, or the original input if nothing matches.
 *
 * @param {string} inputName
 * @param {Array<{nameRu: string, aliases: string}>} catalogEntries
 */
function resolveTestNameFromCatalog(inputName, catalogEntries) {
    if (!inputName || !Array.isArray(catalogEntries) || catalogEntries.length === 0) {
        return inputName;
    }

    const lower = inputName.toLowerCase().trim();

    // Tier 1: exact match on nameRu
    for (const entry of catalogEntries) {
        if (String(entry.nameRu).toLowerCase().trim() === lower) {
            return entry.nameRu;
        }
    }

    // Tier 2: match against aliases — exact first pass, then fuzzy pass
    for (const entry of catalogEntries) {
        let aliases = [];
        try { aliases = JSON.parse(entry.aliases || '[]'); } catch (_) {}
        for (const alias of aliases) {
            if (typeof alias === 'string' && alias.toLowerCase().trim() === lower) {
                return entry.nameRu;
            }
        }
    }
    for (const entry of catalogEntries) {
        let aliases = [];
        try { aliases = JSON.parse(entry.aliases || '[]'); } catch (_) {}
        for (const alias of aliases) {
            if (typeof alias === 'string' && jaroWinkler(inputName, alias) >= 0.85) {
                return entry.nameRu;
            }
        }
    }

    // Tier 3: fuzzy match on nameRu
    let bestMatch = inputName;
    let bestScore = 0;
    for (const entry of catalogEntries) {
        const score = jaroWinkler(inputName, String(entry.nameRu));
        if (score > bestScore) {
            bestScore = score;
            bestMatch = entry.nameRu;
        }
    }
    return bestScore >= 0.92 ? bestMatch : inputName;
}

function hasAnyToken(text, tokens) {
    return tokens.some(token => text.includes(token));
}

function normalizeTreatmentCategory(category) {
    if (!category) return 'other';
    const text = normalizeText(category);
    const match = TREATMENT_CATEGORY_MAP.find(entry => hasAnyToken(text, entry.tokens));
    return match ? match.value : 'other';
}

function normalizeDiagnosticType(type) {
    if (!type) return null;
    const text = normalizeText(type);
    const match = DIAGNOSTIC_TYPE_MAP.find(entry => hasAnyToken(text, entry.tokens));
    return match ? match.value : null;
}

function normalizeTestName(testName) {
    if (!testName || typeof testName !== 'string') return testName;
    // Trim and collapse multiple spaces into one
    let normalized = testName.trim().replace(/\s+/g, ' ');
    // Capitalize first letter
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return normalized;
}

function normalizeIcd10Codes(data) {
    if (!data) return data;
    const icd10Codes = Array.isArray(data.icd10Codes) ? [...data.icd10Codes] : [];
    const primary = data.icd10Code;

    const uniqueCodes = icd10Codes.filter((code, idx, arr) => code && arr.indexOf(code) === idx);

    if (primary && !uniqueCodes.includes(primary)) {
        uniqueCodes.unshift(primary);
    }

    const ordered = primary
        ? [primary, ...uniqueCodes.filter(code => code !== primary)]
        : uniqueCodes;

    return {
        ...data,
        icd10Codes: ordered
    };
}

function normalizeSymptomsWithPhrases(symptoms) {
    if (!Array.isArray(symptoms)) return [];

    const vocabulary = loadVocabulary();
    const entries = vocabulary.symptoms || [];
    const candidates = entries.flatMap(entry => {
        const canonical = normalizeText(entry.canonical);
        const variants = (entry.variants || []).map(variant => normalizeText(variant));
        return [{ value: entry.canonical, tokens: [canonical, ...variants].filter(Boolean) }];
    });

    const normalized = [];

    symptoms.forEach(symptom => {
        const raw = typeof symptom === 'object' && symptom !== null && typeof symptom.text === 'string'
            ? String(symptom.text || '').trim()
            : String(symptom || '').trim();
        if (!raw) return;
        const text = normalizeText(raw);

        let matched = null;
        for (const candidate of candidates) {
            if (candidate.tokens.some(token => token && text.includes(token))) {
                matched = candidate.value;
                break;
            }
        }

        normalized.push(matched || raw);
    });

    return Array.from(new Set(normalized.map(item => item.trim()).filter(Boolean)));
}

/**
 * Normalize symptoms to CategorizedSymptom[]. Accepts string[] (old) or {text, category}[] (new).
 */
function normalizeSymptomsToCategorized(symptoms) {
    if (!Array.isArray(symptoms)) return [];
    const isNewFormat = symptoms.length > 0 && typeof symptoms[0] === 'object' && symptoms[0] !== null && 'category' in symptoms[0];
    if (isNewFormat) {
        const seen = new Set();
        return symptoms
            .filter(s => s && typeof s.text === 'string' && String(s.text).trim())
            .map(s => {
                const raw = String(s.text).trim();
                const normalizedTexts = normalizeSymptomsWithPhrases([raw]);
                return {
                    text: normalizedTexts[0] != null ? normalizedTexts[0] : raw,
                    category: ['clinical', 'physical', 'laboratory', 'other'].includes(s.category) ? s.category : 'other',
                };
            })
            .filter(item => {
                const key = item.text.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }
    const phraseNormalized = normalizeSymptomsWithPhrases(symptoms);
    return phraseNormalized.map(text => ({ text, category: 'other' }));
}

function normalizeDiseaseData(diseaseData, testNamesOrCatalog) {
    if (!diseaseData || typeof diseaseData !== 'object') return diseaseData;

    // Auto-detect: catalog entries (objects with nameRu) vs legacy flat string[]
    const isCatalog = Array.isArray(testNamesOrCatalog) &&
        testNamesOrCatalog.length > 0 &&
        typeof testNamesOrCatalog[0] === 'object' &&
        testNamesOrCatalog[0] !== null &&
        'nameRu' in testNamesOrCatalog[0];

    const normalizedTreatmentPlan = Array.isArray(diseaseData.treatmentPlan)
        ? diseaseData.treatmentPlan.map(item => {
            if (!item || typeof item !== 'object') return item;
            return {
                ...item,
                category: normalizeTreatmentCategory(item.category)
            };
        })
        : diseaseData.treatmentPlan;

    const normalizedDiagnosticPlan = Array.isArray(diseaseData.diagnosticPlan)
        ? diseaseData.diagnosticPlan.map(item => {
            if (!item || typeof item !== 'object') return item;
            const normalizedType = normalizeDiagnosticType(item.type);
            let testName = normalizeTestName(item.test);

            if (isCatalog) {
                // 3-tier: exact nameRu → alias exact/fuzzy → fuzzy nameRu
                testName = resolveTestNameFromCatalog(testName, testNamesOrCatalog);
            } else if (Array.isArray(testNamesOrCatalog) && testNamesOrCatalog.length > 0) {
                // Legacy: flat string[] — fuzzy only
                testName = findBestMatchingTestName(testName, testNamesOrCatalog);
            }

            return {
                ...item,
                type: normalizedType || item.type,
                test: testName
            };
        })
        : diseaseData.diagnosticPlan;

    const normalizedClinicalRecommendations = Array.isArray(diseaseData.clinicalRecommendations)
        ? diseaseData.clinicalRecommendations
            .filter(item => item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim())
            .map(item => ({
                category: ['regimen', 'nutrition', 'followup', 'activity', 'education', 'other'].includes(item.category) ? item.category : 'other',
                text: item.text.trim(),
                priority: ['low', 'medium', 'high'].includes(item.priority) ? item.priority : 'medium',
            }))
        : [];

    const normalized = {
        ...diseaseData,
        symptoms: normalizeSymptomsToCategorized(diseaseData.symptoms || []),
        diagnosticPlan: normalizedDiagnosticPlan,
        treatmentPlan: normalizedTreatmentPlan,
        clinicalRecommendations: normalizedClinicalRecommendations,
        differentialDiagnosis: diseaseData.differentialDiagnosis || [],
        redFlags: diseaseData.redFlags || []
    };

    return normalizeIcd10Codes(normalized);
}

module.exports = {
    normalizeDiseaseData,
    normalizeTreatmentCategory,
    normalizeDiagnosticType,
    normalizeTestName,
    normalizeSymptomsToCategorized,
    normalizeSymptomsWithPhrases,
    normalizeIcd10Codes,
    findBestMatchingTestName,
    resolveTestNameFromCatalog,
    jaroWinkler
};
