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
        const raw = String(symptom || '').trim();
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

function normalizeDiseaseData(diseaseData) {
    if (!diseaseData || typeof diseaseData !== 'object') return diseaseData;

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
            return {
                ...item,
                type: normalizedType || item.type
            };
        })
        : diseaseData.diagnosticPlan;

    const normalized = {
        ...diseaseData,
        symptoms: normalizeSymptomsWithPhrases(diseaseData.symptoms || []),
        diagnosticPlan: normalizedDiagnosticPlan,
        treatmentPlan: normalizedTreatmentPlan,
        // Preserve differentialDiagnosis and redFlags arrays
        differentialDiagnosis: diseaseData.differentialDiagnosis || [],
        redFlags: diseaseData.redFlags || []
    };

    return normalizeIcd10Codes(normalized);
}

module.exports = {
    normalizeDiseaseData,
    normalizeTreatmentCategory,
    normalizeDiagnosticType,
    normalizeSymptomsWithPhrases,
    normalizeIcd10Codes
};
