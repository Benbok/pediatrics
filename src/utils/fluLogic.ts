import { FluRiskFactor } from '../types';

/**
 * Get human-readable label for Influenza risk factors
 */
export const getFluRiskFactorLabel = (factor: FluRiskFactor): string => {
    switch (factor) {
        case FluRiskFactor.STUDENT:
            return 'Школьник / Студент (Высокая скученность)';
        case FluRiskFactor.CHRONIC:
            return 'Хронические заболевания (Астма, Диабет, Пороки сердца)';
        default:
            return factor;
    }
};
