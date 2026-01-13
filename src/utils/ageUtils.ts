/**
 * Утилиты для расчета возраста ребенка
 * 
 * Этот модуль содержит общие функции для расчета возраста в различных единицах
 * (месяцы, недели) и форматирования возраста для отображения.
 * 
 * @module ageUtils
 */

/**
 * Константы для расчета возраста
 */
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30.44; // Среднее количество дней в месяце

/**
 * Вычисляет возраст ребенка в месяцах на конкретную дату
 * 
 * Используется для точного расчета возраста на момент события (например, прививки).
 * 
 * @param birthDate - Дата рождения (Date или строка в формате ISO)
 * @param targetDate - Целевая дата для расчета возраста (по умолчанию текущая дата)
 * @returns Возраст в месяцах (целое число, округленное вниз)
 * 
 * @example
 * ```typescript
 * const age = calculateAgeInMonths('2023-01-01', new Date('2023-04-01'));
 * // Возвращает: 3
 * ```
 */
export function calculateAgeInMonths(
    birthDate: Date | string,
    targetDate: Date = new Date()
): number {
    const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
    const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
    
    if (isNaN(birth.getTime()) || isNaN(target.getTime())) {
        throw new Error('Invalid date provided to calculateAgeInMonths');
    }
    
    const diffTime = Math.abs(target.getTime() - birth.getTime());
    return Math.floor(diffTime / (MS_PER_DAY * DAYS_PER_MONTH));
}

/**
 * Вычисляет возраст ребенка в неделях на конкретную дату
 * 
 * Используется для расчета возраста в неделях (важно для новорожденных).
 * 
 * @param birthDate - Дата рождения (Date или строка в формате ISO)
 * @param targetDate - Целевая дата для расчета возраста (по умолчанию текущая дата)
 * @returns Возраст в неделях (целое число, округленное вверх)
 * 
 * @example
 * ```typescript
 * const age = calculateAgeInWeeks('2023-01-01', new Date('2023-01-15'));
 * // Возвращает: 2
 * ```
 */
export function calculateAgeInWeeks(
    birthDate: Date | string,
    targetDate: Date = new Date()
): number {
    const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
    const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
    
    if (isNaN(birth.getTime()) || isNaN(target.getTime())) {
        throw new Error('Invalid date provided to calculateAgeInWeeks');
    }
    
    const diffTime = Math.abs(target.getTime() - birth.getTime());
    return Math.ceil(diffTime / (MS_PER_DAY * DAYS_PER_WEEK));
}

/**
 * Алиас для calculateAgeInMonths
 * 
 * Сохранен для обратной совместимости с существующим кодом.
 * 
 * @deprecated Используйте calculateAgeInMonths вместо этой функции
 */
export function calculateAgeAtDate(
    birthDate: Date | string,
    targetDate: Date
): number {
    return calculateAgeInMonths(birthDate, targetDate);
}

/**
 * Вычисляет возраст в месяцах используя календарные месяцы
 * 
 * Альтернативный метод расчета, который учитывает календарные месяцы
 * (разница в годах * 12 + разница в месяцах).
 * 
 * @param birthDate - Дата рождения (Date или строка в формате ISO)
 * @param targetDate - Целевая дата для расчета возраста (по умолчанию текущая дата)
 * @returns Возраст в календарных месяцах
 * 
 * @example
 * ```typescript
 * const age = calculateAgeInCalendarMonths('2023-01-15', new Date('2023-04-10'));
 * // Возвращает: 2 (январь -> апрель, но 10 < 15, поэтому 2 месяца)
 * ```
 */
export function calculateAgeInCalendarMonths(
    birthDate: Date | string,
    targetDate: Date = new Date()
): number {
    const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
    const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
    
    if (isNaN(birth.getTime()) || isNaN(target.getTime())) {
        throw new Error('Invalid date provided to calculateAgeInCalendarMonths');
    }
    
    const yearDiff = target.getFullYear() - birth.getFullYear();
    const monthDiff = target.getMonth() - birth.getMonth();
    const dayDiff = target.getDate() - birth.getDate();
    
    // Если день рождения еще не наступил в этом месяце, вычитаем месяц
    const months = yearDiff * 12 + monthDiff + (dayDiff < 0 ? -1 : 0);
    
    return Math.max(0, months);
}

/**
 * Получает правильное склонение слова "год"
 * 
 * @param years - Количество лет
 * @returns Правильно склоненное слово "год/года/лет"
 */
function getYearWord(years: number): string {
    if (years % 10 === 1 && years % 100 !== 11) {
        return 'год';
    }
    if ([2, 3, 4].includes(years % 10) && ![12, 13, 14].includes(years % 100)) {
        return 'года';
    }
    return 'лет';
}

/**
 * Получает правильное склонение слова "месяц"
 * 
 * @param months - Количество месяцев
 * @returns Правильно склоненное слово "месяц/месяца/месяцев"
 */
function getMonthWord(months: number): string {
    if (months % 10 === 1 && months % 100 !== 11) {
        return 'месяц';
    }
    if ([2, 3, 4].includes(months % 10) && ![12, 13, 14].includes(months % 100)) {
        return 'месяца';
    }
    return 'месяцев';
}

/**
 * Форматирует возраст для отображения в виде строки
 * 
 * @param ageInMonths - Возраст в месяцах
 * @param format - Формат отображения ('short' | 'full')
 * @returns Отформатированная строка возраста
 * 
 * @example
 * ```typescript
 * formatAgeLabel(15, 'short'); // "15 мес"
 * formatAgeLabel(15, 'full');  // "1 год 3 мес"
 * ```
 */
export function formatAgeLabel(
    ageInMonths: number,
    format: 'short' | 'full' = 'short'
): string {
    if (ageInMonths < 12) {
        return `${ageInMonths} ${getMonthWord(ageInMonths)}`;
    }
    
    const years = Math.floor(ageInMonths / 12);
    const remainingMonths = ageInMonths % 12;
    
    if (format === 'short') {
        const yearStr = getYearWord(years);
        return remainingMonths > 0 
            ? `${years} ${yearStr} ${remainingMonths} мес` 
            : `${years} ${yearStr}`;
    }
    
    // Full format
    const yearStr = getYearWord(years);
    if (remainingMonths === 0) {
        return `${years} ${yearStr}`;
    }
    return `${years} ${yearStr} ${remainingMonths} ${getMonthWord(remainingMonths)}`;
}

/**
 * Вычисляет и форматирует возраст на основе даты рождения
 * 
 * Удобная функция, которая объединяет расчет и форматирование.
 * 
 * @param birthDate - Дата рождения (Date или строка в формате ISO)
 * @param targetDate - Целевая дата для расчета (по умолчанию текущая дата)
 * @param format - Формат отображения ('short' | 'full')
 * @returns Отформатированная строка возраста
 * 
 * @example
 * ```typescript
 * getFormattedAge('2023-01-01', new Date('2024-01-15'), 'full');
 * // Возвращает: "1 год 0 мес"
 * ```
 */
export function getFormattedAge(
    birthDate: Date | string,
    targetDate: Date = new Date(),
    format: 'short' | 'full' = 'full'
): string {
    const ageInMonths = calculateAgeInCalendarMonths(birthDate, targetDate);
    return formatAgeLabel(ageInMonths, format);
}
