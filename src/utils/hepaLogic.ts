import { HepARiskFactor } from '../types';

/**
 * Get human-readable label for Hepatitis A risk factors
 */
export const getHepARiskFactorLabel = (factor: HepARiskFactor): string => {
    switch (factor) {
        case HepARiskFactor.REGION_MOSCOW:
            return 'Проживание в Москве (Бесплатно по календарю)';
        case HepARiskFactor.TRAVEL_SOUTH:
            return 'Поездки на юг / Азию / Турция (Рекомендовано)';
        case HepARiskFactor.CONTACT:
            return 'Контакт с гепатитом А (Экстренно)';
        case HepARiskFactor.OCCUPATIONAL:
            return 'Профессиональный риск (Общепит, Вода, Воспитатели)';
        default:
            return factor;
    }
};
