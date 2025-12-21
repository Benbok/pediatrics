import { TbeRiskFactor } from '../types';

export const getTbeRiskFactorLabel = (factor: TbeRiskFactor): string => {
    switch (factor) {
        case TbeRiskFactor.ENDEMIC_REGION:
            return 'Проживание в эндемичном районе (Сибирь, Урал, Дмитров)';
        case TbeRiskFactor.TRAVEL_FOREST:
            return 'Поездки на дачу, в лес, походы';
        default:
            return factor;
    }
};
