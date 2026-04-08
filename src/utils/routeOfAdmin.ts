/**
 * Shared route of administration mappings and utilities
 * Single source of truth for route labels and IV/IM gating
 */

export type RouteOfAdmin = 
    | 'oral'           // Перорально
    | 'rectal'         // Ректально
    | 'iv_bolus'       // В/В болюсно
    | 'iv_infusion'    // В/В капельно
    | 'iv_slow'        // В/В медленно
    | 'im'             // В/М
    | 'sc'             // П/К
    | 'sublingual'     // Сублингвально
    | 'topical'        // Наружно
    | 'inhalation'     // Ингаляционно
    | 'intranasal'     // Интраназально
    | 'transdermal';   // Трансдермально

/**
 * Human-readable labels for route of administration
 */
export const ROUTE_LABELS: Record<RouteOfAdmin, string> = {
    oral: 'Перорально',
    rectal: 'Ректально',
    iv_bolus: 'В/В болюсно',
    iv_infusion: 'В/В капельно',
    iv_slow: 'В/В медленно',
    im: 'В/М',
    sc: 'П/К',
    sublingual: 'Сублингвально',
    topical: 'Наружно',
    inhalation: 'Ингаляционно',
    intranasal: 'Интраназально',
    transdermal: 'Трансдермально',
};

/**
 * Injectable routes that may require dilution
 */
export const INJECTABLE_ROUTES: RouteOfAdmin[] = [
    'iv_bolus',
    'iv_infusion',
    'iv_slow',
    'im',
    'sc',
];

/**
 * Check if route requires dilution (IV or IM only)
 */
export function requiresDilution(route: string | null | undefined): boolean {
    if (!route) return false;
    return route === 'iv_bolus' || 
           route === 'iv_infusion' || 
           route === 'iv_slow' || 
           route === 'im';
}

/**
 * Get human-readable label for route
 */
export function getRouteLabel(route: string | null | undefined): string {
    if (!route) return 'Не указано';
    return ROUTE_LABELS[route as RouteOfAdmin] || route;
}

/**
 * Normalize a single route of administration string
 * This is a simplified version for frontend - detailed normalization happens in backend
 */
function normalizeRouteOfAdmin(
    value: string | null | undefined,
    instructionText?: string | null
): RouteOfAdmin | null {
    if (!value) return null;
    
    const text = value.toLowerCase().trim();
    if (!text) return null;

    // Handle parenteral - default to iv_bolus per user requirement
    if (text.includes('parenteral') || text.includes('парент')) {
        const instruction = instructionText?.toLowerCase() || '';
        const hasIv = ['iv', 'в/в', 'внутривенно', 'капельно', 'инфузия', 'infusion'].some(token => instruction.includes(token));
        const hasIm = ['im', 'в/м', 'внутримышечно'].some(token => instruction.includes(token));
        
        if (hasIv && !hasIm) {
            return 'iv_infusion';
        } else if (hasIm && !hasIv) {
            return 'im';
        } else {
            // Default to iv_bolus for parenteral
            return 'iv_bolus';
        }
    }

    // Route mappings
    const routeMap: Array<{ tokens: string[]; value: RouteOfAdmin }> = [
        { tokens: ['per os', 'peroral', 'p.o', 'po', 'oral', 'by mouth', 'os'], value: 'oral' },
        { tokens: ['rectal', 'per rectum', 'pr', 'per rect'], value: 'rectal' },
        { tokens: ['intravenous', 'iv', 'в/в', 'в/в.', 'внутривенно', 'intravenous infusion', 'капельно', 'инфуз'], value: 'iv_infusion' },
        { tokens: ['iv bolus', 'bolus', 'струйно', 'iv_bolus'], value: 'iv_bolus' },
        { tokens: ['iv slow', 'медленно', 'iv_slow'], value: 'iv_slow' },
        { tokens: ['intramuscular', 'im', 'в/м', 'в/м.', 'внутримышечно'], value: 'im' },
        { tokens: ['subcutaneous', 'sc', 's/c', 'п/к', 'п/к.', 'подкожно'], value: 'sc' },
        { tokens: ['sublingual', 'подъязычно'], value: 'sublingual' },
        { tokens: ['topical', 'наружно', 'местно', 'local'], value: 'topical' },
        { tokens: ['inhalation', 'ингаляционно', 'ингаляц'], value: 'inhalation' },
        { tokens: ['intranasal', 'интраназально'], value: 'intranasal' },
        { tokens: ['transdermal', 'трансдермально'], value: 'transdermal' },
    ];

    for (const entry of routeMap) {
        if (entry.tokens.some(token => text.includes(token))) {
            return entry.value;
        }
    }

    return null;
}

/**
 * Normalize medication routes of administration
 * Normalizes routeOfAdmin at medication level and in pediatricDosing/adultDosing arrays
 */
export function normalizeMedicationRoutes<T extends { 
    routeOfAdmin?: string | null; 
    pediatricDosing?: any[];
}>(medicationData: T): T {
    if (!medicationData || typeof medicationData !== 'object') return medicationData;

    // Collect all instructions for better route determination
    const allInstructions: string[] = [];
    if (medicationData.pediatricDosing && Array.isArray(medicationData.pediatricDosing)) {
        medicationData.pediatricDosing.forEach((rule: any) => {
            if (rule.instruction) allInstructions.push(rule.instruction);
        });
    }
    const combinedInstructions = allInstructions.join(' ');

    const normalizeRules = (rules: any[]) => {
        if (!Array.isArray(rules)) return rules;
        return rules.map(rule => {
            if (!rule || typeof rule !== 'object') return rule;
            // Pass rule instruction for more accurate determination
            const normalizedRoute = normalizeRouteOfAdmin(rule.routeOfAdmin, rule.instruction || combinedInstructions);
            
            // If routeOfAdmin at rule level is null but top level has a more specific route,
            // use it as fallback (but only if it's not parenteral)
            if (!normalizedRoute && medicationData.routeOfAdmin && 
                !medicationData.routeOfAdmin.toLowerCase().includes('parenteral')) {
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

    // Normalize top-level routeOfAdmin considering all instructions
    const normalizedTopLevelRoute = normalizeRouteOfAdmin(medicationData.routeOfAdmin, combinedInstructions);
    
    // If top-level routeOfAdmin is null (e.g., was "parenteral"),
    // try to get route from dosing rules
    let finalRouteOfAdmin = normalizedTopLevelRoute;
    if (!finalRouteOfAdmin) {
        // Find first non-null routeOfAdmin in rules
        const allRules = [
            ...(medicationData.pediatricDosing || [])
        ];
        for (const rule of allRules) {
            if (rule && rule.routeOfAdmin && typeof rule.routeOfAdmin === 'string') {
                const ruleRoute = normalizeRouteOfAdmin(rule.routeOfAdmin, rule.instruction || '');
                if (ruleRoute) {
                    finalRouteOfAdmin = ruleRoute;
                    break;
                }
            }
        }
    }

    return {
        ...medicationData,
        routeOfAdmin: finalRouteOfAdmin,
        pediatricDosing: normalizeRules(medicationData.pediatricDosing || [])
    };
}
