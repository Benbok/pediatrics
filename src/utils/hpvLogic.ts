import { HpvRiskFactor } from '../types';

export const getHpvRiskFactorLabel = (factor: HpvRiskFactor): string => {
    switch (factor) {
        case HpvRiskFactor.REGION_MOSCOW:
            return 'Проживание в Москве (Бесплатно для девочек 12-13 лет)';
        default:
            return factor;
    }
};
