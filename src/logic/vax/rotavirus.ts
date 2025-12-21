import { VaccineStatus } from '../../types';
import { VaxRule } from './rules';

/**
 * Rotavirus Rules
 * 1. First dose strictly before 15 weeks.
 * 2. Course completion strictly before 8 months.
 */
export const rotavirusRules: VaxRule = (vaccine, context) => {
    if (!vaccine.id.startsWith('rota')) return null;

    const { ageInWeeks, ageInMonths, today } = context;
    const dueDate = vaccine.dueDate;
    const record = vaccine.userRecord;

    if (record?.isCompleted) return null;

    if (vaccine.id === 'rota-1' && ageInWeeks > 15) {
        return {
            status: VaccineStatus.MISSED,
            alertMessage: "Слишком поздно для начала вакцинации (строго до 15 недель)."
        };
    }

    if (ageInMonths >= 8) {
        return {
            status: VaccineStatus.MISSED,
            alertMessage: "Слишком поздно. Курс должен быть завершен до 8 месяцев."
        };
    }

    return null;
};
