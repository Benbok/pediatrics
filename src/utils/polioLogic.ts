import { PolioRiskFactor } from '../types';

/**
 * Get human-readable label for Polio risk factors
 */
export const getPolioRiskFactorLabel = (factor: PolioRiskFactor): string => {
    switch (factor) {
        case PolioRiskFactor.IMMUNODEFICIENCY:
            return 'Иммунодефицитные состояния или злокачественные новообразования';
        case PolioRiskFactor.HIV_EXPOSURE:
            return 'Дети, рожденные от матерей с ВИЧ, или дети с ВИЧ';
        case PolioRiskFactor.NEURO_DISEASE:
            return 'Болезни нервной системы';
        case PolioRiskFactor.INTESTINAL_ANOMALY:
            return 'Аномалии развития кишечника';
        case PolioRiskFactor.PREMATURE_LOW_WEIGHT:
            return 'Недоношенные и маловесные дети';
        case PolioRiskFactor.INSTITUTIONALIZED:
            return 'Дети, находящиеся в домах ребенка (интернатах)';
        case PolioRiskFactor.ONCOLOGY:
            return 'Онкологические заболевания (злокачественные новообразования)';
        default:
            return factor;
    }
};
