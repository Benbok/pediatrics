import { calculateAgeInCalendarMonths, formatAgeLabel } from '../../../utils/ageUtils';

/**
 * Форматирует дату в строку для отображения в документах
 * 
 * @param date - Дата для форматирования (Date, строка или timestamp)
 * @param format - Формат ('short' | 'long' | 'full')
 * @returns Отформатированная строка даты
 */
export function formatDate(
    date: Date | string | number,
    format: 'short' | 'long' | 'full' = 'short'
): string {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

    if (isNaN(d.getTime())) {
        return '';
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    switch (format) {
        case 'short':
            return `${day}.${month}.${year}`;

        case 'long':
            const monthNames = [
                'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
            ];
            return `${day} ${monthNames[d.getMonth()]} ${year}`;

        case 'full':
            const monthNamesFull = [
                'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
            ];
            return `«${day}» ${monthNamesFull[d.getMonth()]} ${year} г.`;

        default:
            return `${day}.${month}.${year}`;
    }
}

/**
 * Форматирует имя (ФИО) в различных форматах
 * 
 * @param surname - Фамилия
 * @param name - Имя
 * @param patronymic - Отчество (опционально)
 * @param format - Формат ('full' | 'short' | 'initials')
 * @returns Отформатированное имя
 */
export function formatFullName(
    surname: string,
    name: string,
    patronymic?: string,
    format: 'full' | 'short' | 'initials' = 'full'
): string {
    switch (format) {
        case 'full':
            return patronymic
                ? `${surname} ${name} ${patronymic}`
                : `${surname} ${name}`;

        case 'short':
            const patronymicInitial = patronymic ? ` ${patronymic[0]}.` : '';
            return `${surname} ${name[0]}.${patronymicInitial}`;

        case 'initials':
            const p = patronymic ? ` ${patronymic[0]}.` : '';
            return `${surname} ${name[0]}.${p}`;

        default:
            return `${surname} ${name}`;
    }
}

/**
 * Преобразует вес из граммов в килограммы с форматированием
 * 
 * @param grams - Вес в граммах
 * @returns Отформатированная строка (например, "3.5 кг")
 */
export function formatWeight(grams: number): string {
    const kg = grams / 1000;
    return `${kg.toFixed(1)} кг`;
}

/**
 * Вычисляет возраст на основе даты рождения
 * 
 * Использует общие функции из ageUtils для расчета и форматирования.
 * 
 * @param birthDate - Дата рождения
 * @param format - Формат ('years' | 'months' | 'full')
 * @returns Возраст в указанном формате
 */
export function calculateAge(
    birthDate: Date | string,
    format: 'years' | 'months' | 'full' = 'full'
): string {
    const now = new Date();
    const ageInMonths = calculateAgeInCalendarMonths(birthDate, now);

    // Используем formatAgeLabel для форматирования
    if (format === 'full') {
        return formatAgeLabel(ageInMonths, 'full');
    }
    
    if (format === 'months') {
        return formatAgeLabel(ageInMonths, 'short');
    }
    
    // Для 'years' форматируем отдельно
    const years = Math.floor(ageInMonths / 12);
    const yearWord = years % 10 === 1 && years % 100 !== 11 ? 'год' :
                     [2, 3, 4].includes(years % 10) && ![12, 13, 14].includes(years % 100) ? 'года' : 'лет';
    return `${years} ${yearWord}`;
}

/**
 * Безопасно получает значение или возвращает прочерк
 */
export function valueOrDash(value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }
    return String(value);
}

/**
 * Форматирует номер документа
 */
export function formatDocumentNumber(number: string | number): string {
    const numStr = String(number);
    return numStr.padStart(6, '0');
}

/**
 * Генерирует номер сертификата на основе даты и ID
 */
export function generateCertificateNumber(id: number, date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const idPart = String(id).padStart(5, '0');
    return `${year}${month}-${idPart}`;
}
