import { VaricellaRiskFactor } from '../types';

/**
 * Get human-readable label for Varicella risk factors
 */
export const getVaricellaRiskFactorLabel = (factor: VaricellaRiskFactor): string => {
    switch (factor) {
        case VaricellaRiskFactor.CONTACT:
            return 'Был контакт с заболевшим (Экстренная профилактика)';
        default:
            return factor;
    }
};
