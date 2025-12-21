import { PneumoRiskFactor } from '../types';

/**
 * Get human-readable label for Pneumococcal risk factors
 */
export const getPneumoRiskFactorLabel = (factor: PneumoRiskFactor): string => {
    switch (factor) {
        case PneumoRiskFactor.ASPLENIA:
            return 'Аспления (отсутствие селезенки)';
        case PneumoRiskFactor.HIV:
            return 'ВИЧ-инфекция';
        case PneumoRiskFactor.COCHLEAR:
            return 'Кохлеарная имплантация';
        case PneumoRiskFactor.CHRONIC_LUNG:
            return 'Хронические болезни легких (астма, муковисцидоз)';
        case PneumoRiskFactor.CHRONIC_HEART:
            return 'Хронические болезни сердца';
        case PneumoRiskFactor.CHRONIC_KIDNEY:
            return 'Хронические болезни почек';
        case PneumoRiskFactor.DIABETES:
            return 'Сахарный диабет';
        case PneumoRiskFactor.PREMATURE:
            return 'Недоношенность';
        default:
            return factor;
    }
};

/**
 * Returns special instructions for Pneumococcal vaccination if risk factors exist
 */
export const getPneumoSpecificInstructions = (factors?: PneumoRiskFactor[]): string | null => {
    if (!factors || factors.length === 0) return null;
    return 'Ребенку из группы риска показана расширенная защита: курс ПКВ13 + 1 доза ППВ23 (Пневмовакс 23) через 8 недель после завершения ПКВ13, но не ранее 2 лет.';
};
