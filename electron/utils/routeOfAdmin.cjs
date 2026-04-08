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

function normalizeRouteOfAdmin(value, instructionText = '') {
    if (!value) return null;
    const text = normalizeText(value);
    if (!text) return null;

    // Проверяем, не является ли это "parenteral" (неоднозначное значение)
    const isParenteral = text.includes('parenteral') || text.includes('парент');
    
    if (isParenteral) {
        // Если это parenteral, пытаемся определить из инструкции или контекста
        const instruction = normalizeText(instructionText);
        
        // Проверяем инструкцию на наличие указаний о пути введения
        const hasIv = hasAnyToken(instruction, ['iv', 'в/в', 'внутривенно', 'капельно', 'инфузия', 'infusion']);
        const hasIm = hasAnyToken(instruction, ['im', 'в/м', 'внутримышечно']);
        
        if (hasIv && !hasIm) {
            // Если в инструкции четко указано внутривенно
            return 'iv_infusion';
        } else if (hasIm && !hasIv) {
            // Если в инструкции четко указано внутримышечно
            return 'im';
        } else if (hasIv && hasIm) {
            // Оба указаны - используем iv_bolus как более распространенный вариант для парентерального введения
            logger.info('[RouteOfAdmin] Both IV and IM mentioned in instruction for parenteral, defaulting to iv_bolus');
            return 'iv_bolus';
        } else {
            // Для parenteral без уточнений в инструкции, используем iv_bolus по умолчанию
            // так как парентеральное введение чаще всего означает внутривенное болюсное введение
            logger.info('[RouteOfAdmin] Parenteral route without clear indication, defaulting to iv_bolus');
            return 'iv_bolus';
        }
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

    // Собираем все инструкции для лучшего определения пути введения
    const allInstructions = [];
    if (medicationData.pediatricDosing && Array.isArray(medicationData.pediatricDosing)) {
        medicationData.pediatricDosing.forEach(rule => {
            if (rule.instruction) allInstructions.push(rule.instruction);
        });
    }
    const combinedInstructions = allInstructions.join(' ');

    const normalizeRules = (rules) => {
        if (!Array.isArray(rules)) return rules;
        return rules.map(rule => {
            if (!rule || typeof rule !== 'object') return rule;
            // Передаем инструкцию правила для более точного определения
            const normalizedRoute = normalizeRouteOfAdmin(rule.routeOfAdmin, rule.instruction || combinedInstructions);
            
            // Если routeOfAdmin на уровне правила null, но на верхнем уровне есть более конкретный путь,
            // используем его как fallback (но только если это не parenteral)
            if (!normalizedRoute && medicationData.routeOfAdmin && 
                !normalizeText(medicationData.routeOfAdmin).includes('parenteral')) {
                const topLevelRoute = normalizeRouteOfAdmin(medicationData.routeOfAdmin, combinedInstructions);
                if (topLevelRoute) {
                    return {
                        ...rule,
                        routeOfAdmin: topLevelRoute
                    };
                }
            }
            
            return {
                ...rule,
                routeOfAdmin: normalizedRoute
            };
        });
    };

    // Нормализуем верхнеуровневый routeOfAdmin с учетом всех инструкций
    const normalizedTopLevelRoute = normalizeRouteOfAdmin(medicationData.routeOfAdmin, combinedInstructions);
    
    // Если верхнеуровневый routeOfAdmin null (например, был "parenteral"),
    // пытаемся взять путь из правил дозирования
    let finalRouteOfAdmin = normalizedTopLevelRoute;
    if (!finalRouteOfAdmin) {
        // Ищем первый не-null routeOfAdmin в правилах
        const allRules = [
            ...(medicationData.pediatricDosing || [])
        ];
        for (const rule of allRules) {
            if (rule && rule.routeOfAdmin && typeof rule.routeOfAdmin === 'string') {
                const ruleRoute = normalizeRouteOfAdmin(rule.routeOfAdmin, rule.instruction || '');
                if (ruleRoute) {
                    finalRouteOfAdmin = ruleRoute;
                    logger.info(`[RouteOfAdmin] Using route from dosing rule as top-level route: ${ruleRoute}`);
                    break;
                }
            }
        }
    }

    return {
        ...medicationData,
        routeOfAdmin: finalRouteOfAdmin,
        pediatricDosing: normalizeRules(medicationData.pediatricDosing)
    };
}

module.exports = {
    normalizeRouteOfAdmin,
    normalizeMedicationRoutes
};
