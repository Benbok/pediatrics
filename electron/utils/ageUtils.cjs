/**
 * Утилиты для расчета возраста ребенка (CommonJS версия для Electron)
 * 
 * Этот модуль содержит общие функции для расчета возраста в различных единицах
 * (месяцы, недели) для использования в Electron main process.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_MONTH = 30.44; // Среднее количество дней в месяце

/**
 * Вычисляет возраст ребенка в месяцах на конкретную дату
 * 
 * @param {string|Date} birthDate - Дата рождения
 * @param {string|Date} targetDate - Целевая дата для расчета возраста
 * @returns {number} Возраст в месяцах (целое число, округленное вниз)
 */
function calculateAgeInMonths(birthDate, targetDate) {
    const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
    const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    
    if (isNaN(birth.getTime()) || isNaN(target.getTime())) {
        throw new Error('Invalid date provided to calculateAgeInMonths');
    }
    
    const diffTime = Math.abs(target.getTime() - birth.getTime());
    return Math.floor(diffTime / (MS_PER_DAY * DAYS_PER_MONTH));
}

/**
 * Алиас для calculateAgeInMonths (для обратной совместимости)
 * 
 * @deprecated Используйте calculateAgeInMonths
 */
function calculateAgeAtDate(birthDate, targetDate) {
    return calculateAgeInMonths(birthDate, targetDate);
}

module.exports = {
    calculateAgeInMonths,
    calculateAgeAtDate
};
