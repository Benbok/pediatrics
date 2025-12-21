import { MeningoRiskFactor } from '../types';

/**
 * Get human-readable label for Meningococcal risk factors
 */
export const getMeningoRiskFactorLabel = (factor: MeningoRiskFactor): string => {
    switch (factor) {
        case MeningoRiskFactor.DORMITORY:
            return 'Проживание в общежитии / тесный контакт в коллективе';
        case MeningoRiskFactor.ENDEMIC_TRAVEL:
            return 'Поездки в эндемичные зоны (Африка, паломничество)';
        default:
            return factor;
    }
};
