export type NormalizedRouteOfAdmin =
  | 'oral'
  | 'rectal'
  | 'iv_bolus'
  | 'iv_infusion'
  | 'iv_slow'
  | 'im'
  | 'sc'
  | 'sublingual'
  | 'topical'
  | 'inhalation'
  | 'intranasal'
  | 'transdermal'
  | null;

const ROUTE_ALIASES: Array<{ tokens: string[]; value: NormalizedRouteOfAdmin }> = [
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
  { tokens: ['transdermal', 'трансдермально'], value: 'transdermal' }
];

const normalizeText = (value?: string | null) => (value ? String(value).toLowerCase().trim() : '');

const hasAnyToken = (text: string, tokens: string[]) => tokens.some(token => text.includes(token));

export const normalizeRouteOfAdmin = (value?: string | null): NormalizedRouteOfAdmin => {
  if (!value) return null;
  const text = normalizeText(value);
  if (!text) return null;

  if (text.includes('parenteral') || text.includes('парент')) {
    return null;
  }

  const hasIv = hasAnyToken(text, ['iv', 'в/в', 'внутривенно']);
  const hasIm = hasAnyToken(text, ['im', 'в/м', 'внутримышечно']);
  if (hasIv && hasIm) return null;

  for (const entry of ROUTE_ALIASES) {
    if (hasAnyToken(text, entry.tokens)) {
      return entry.value;
    }
  }

  return null;
};

export const normalizeMedicationRoutes = <T extends { routeOfAdmin?: string | null; pediatricDosing?: any[]; adultDosing?: any[] }>(
  medicationData: T
): T => {
  if (!medicationData || typeof medicationData !== 'object') return medicationData;

  const normalizeRules = (rules?: any[]) => {
    if (!Array.isArray(rules)) return rules;
    return rules.map(rule => {
      if (!rule || typeof rule !== 'object') return rule;
      return { ...rule, routeOfAdmin: normalizeRouteOfAdmin(rule.routeOfAdmin) };
    });
  };

  return {
    ...medicationData,
    routeOfAdmin: normalizeRouteOfAdmin(medicationData.routeOfAdmin),
    pediatricDosing: normalizeRules(medicationData.pediatricDosing),
    adultDosing: normalizeRules(medicationData.adultDosing)
  };
};
