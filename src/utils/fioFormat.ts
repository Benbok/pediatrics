/**
 * Форматирование полей ФИО: первая буква заглавная, пробелы по краям убираются.
 */

/** Первая буква (латиница или кириллица) */
const FIRST_LETTER_REG = /^([a-zA-Zа-яА-ЯёЁ])/;

/** При вводе: убрать ведущие пробелы, первую букву — заглавная */
export function formatFioOnChange(value: string): string {
    const trimmed = value.trimStart();
    if (!trimmed) return trimmed;
    const match = trimmed.match(FIRST_LETTER_REG);
    if (match) {
        return match[1].toUpperCase() + trimmed.slice(1);
    }
    return trimmed;
}

/** При потере фокуса: полный trim и заглавная первая буква */
export function formatFioOnBlur(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    const match = trimmed.match(FIRST_LETTER_REG);
    if (match) {
        return match[1].toUpperCase() + trimmed.slice(1);
    }
    return trimmed;
}
