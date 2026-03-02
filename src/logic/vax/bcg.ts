import { VaccineStatus } from '../../types';
import { VaxRule } from './rules';
import { calculateAgeInMonths } from '../../utils/ageUtils';

/**
 * BCG / BCG-M Rules
 * 1. Absolute weight contraindication (< 2000g)
 * 2. Rule of 2 months: requires Mantoux test if older (на момент прививки БЦЖ)
 * 3. Positive Mantoux: absolute contraindication
 * 4. 30-day interval isolation from ANY other vaccine
 */
export const bcgRules: VaxRule = (vaccine, context) => {
    if (!vaccine.id.startsWith('bcg') && vaccine.id !== 'tuberc-rv') return null;

    const { child, profile, records, today, ageInMonths } = context;
    const dueDate = vaccine.dueDate;
    const record = vaccine.userRecord;

    // 1. Birth weight check
    if ((profile.birthWeight || 0) < 2000) {
        return {
            status: VaccineStatus.SKIPPED,
            alertMessage: "Медотвод: Вес при рождении менее 2000г. Вакцинация БЦЖ противопоказана до набора веса и обследования."
        };
    }

    // Определяем дату прививки БЦЖ: если прививка уже сделана - используем completedDate,
    // иначе используем dueDate (планируемая дата)
    const vaccinationDate = record?.completedDate 
        ? new Date(record.completedDate) 
        : (dueDate || today);
    
    // Вычисляем возраст ребенка НА МОМЕНТ ПРИВИВКИ БЦЖ
    const ageAtVaccination = calculateAgeInMonths(child.birthDate, vaccinationDate);

    // 2. Rule of 2 months for Mantoux (проверяем возраст на момент прививки)
    if (ageAtVaccination >= 2 && !profile.mantouxDate) {
        return {
            status: VaccineStatus.OVERDUE,
            alertMessage: "Внимание: Требуется проба Манту перед вакцинацией (ребенку > 2 мес на момент прививки)."
        };
    }

    // 3. Positive Mantoux check (проверяем возраст на момент прививки)
    if (ageAtVaccination >= 2 && profile.mantouxResult === true) {
        return {
            status: VaccineStatus.SKIPPED,
            alertMessage: "Вакцинация запрещена: Проба Манту положительная. Необходима консультация фтизиатра."
        };
    }

    // 4. Interval check (30 days from ANY other vaccine)
    const targetDate = record?.completedDate ? new Date(record.completedDate) : dueDate;
    const otherRecords = records.filter(r => r.vaccineId !== vaccine.id && r.isCompleted && r.completedDate);

    const conflict = otherRecords.find(r => {
        const rDate = new Date(r.completedDate!);
        const diffDays = Math.abs(targetDate.getTime() - rDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays < 30;
    });

    if (conflict) {
        return {
            alertMessage: `Нарушение интервала! БЦЖ требует 30 дней изоляции. Обнаружена прививка от ${conflict.vaccineId} (${new Date(conflict.completedDate!).toLocaleDateString('ru-RU')}).`
        };
    }

    return null;
};
