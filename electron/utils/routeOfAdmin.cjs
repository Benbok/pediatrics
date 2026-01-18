const { logger } = require('../logger.cjs');

const ROUTE_ALIASES = [
    { tokens: ['per os', 'peroral', 'p.o', 'po', 'oral', 'by mouth', 'os'], value: 'oral' },
    { tokens: ['rectal', 'per rectum', 'pr', 'per rect'], value: 'rectal' },
    { tokens: ['intravenous', 'iv', 'в/в', 'в/в.', 'внутривенно', 'intravenous infusion', 'капельно', 'инфуз'], value: 'iv_infusion' },
    { tokens: ['iv bolus', 'bolus', 'струйно', 'струйно', 'iv_bolus'], value: 'iv_bolus' },
    { tokens: ['iv slow', 'медленно', 'iv_slow'], value: 'iv_slow' },
    { tokens: ['intramuscular', 'im', 'в/м', 'в/м.', 'внутримышечно'], value: 'im' },
    { tokens: ['subcutaneous', 'sc', 's/c', 'п/к', 'п/к.', 'подкожно'], value: 'sc' },
    { tokens: ['sublingual', 'подъязычно'], value: 'sublingual' },
    { tokens: ['topical', 'наружно', 'местно', 'local'], value: 'topical' },
    { tokens: ['inhalation', 'ингаляционно', 'ингаляц'], value: 'inhalation' },
    { tokens: ['intranasal', 'интраназально'], value: 'intranasal' },
    { tokens: ['transdermal', 'трансдермально'], value: 'transdermal' }
];

function normalizeText(value) {
    if (!value) return '';
    return String(value).toLowerCase().trim();
}

function hasAnyToken(text, tokens) {
    return tokens.some(token => text.includes(token));
}

function normalizeRouteOfAdmin(value) {
    if (!value) return null;
    const text = normalizeText(value);
    if (!text) return null;

    // Ambiguous or unsupported values
    if (text.includes('parenteral') || text.includes('парент')) {
        return null;
    }

    const hasIv = hasAnyToken(text, ['iv', 'в/в', 'внутривенно']);
    const hasIm = hasAnyToken(text, ['im', 'в/м', 'внутримышечно']);
    if (hasIv && hasIm) {
        return null;
    }

    for (const entry of ROUTE_ALIASES) {
        if (hasAnyToken(text, entry.tokens)) {
            return entry.value;
        }
    }

    logger.info('[RouteOfAdmin] Unknown routeOfAdmin value, keeping null:', value);
    return null;
}

function normalizeMedicationRoutes(medicationData) {
    if (!medicationData || typeof medicationData !== 'object') return medicationData;

    const normalizeRules = (rules) => {
        if (!Array.isArray(rules)) return rules;
        return rules.map(rule => {
            if (!rule || typeof rule !== 'object') return rule;
            const normalizedRoute = normalizeRouteOfAdmin(rule.routeOfAdmin);
            return {
                ...rule,
                routeOfAdmin: normalizedRoute
            };
        });
    };

    return {
        ...medicationData,
        routeOfAdmin: normalizeRouteOfAdmin(medicationData.routeOfAdmin),
        pediatricDosing: normalizeRules(medicationData.pediatricDosing),
        adultDosing: normalizeRules(medicationData.adultDosing)
    };
}

module.exports = {
    normalizeRouteOfAdmin,
    normalizeMedicationRoutes
};
