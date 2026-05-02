/**
 * Типы данных для печатной формы рецепта 107-1/у
 * Приказ МЗ РФ № 1094н от 24.11.2021
 *
 * Изолированы от других модулей — только данные для рендера бланка.
 */

/**
 * Один блок назначения (Rp./D.S.) в рецепте
 */
export interface RecipeItem {
    /** Строка Rp. на латинском: название, дозировка, форма, количество */
    rpLine: string;
    /** Строка D.S.: инструкция по применению на русском */
    dsLine: string;
}

/**
 * Срок действия рецепта
 */
export type RecipeValidity = '60days' | '1year' | 'custom';

/**
 * Данные клиники / учреждения для штампа рецепта
 */
export interface RecipeClinicInfo {
    /** Наименование (штамп) медицинской организации */
    organizationStamp: string;
    /** Наименование (штамп) индивидуального предпринимателя (опционально) */
    ipStamp?: string;
    /** Код формы по ОКУД */
    okudCode?: string;
    /** Код учреждения по ОКПО */
    okpoCode?: string;
}

/**
 * Данные пациента для рецепта
 */
export interface RecipePatientInfo {
    /** Фамилия, инициалы имени и отчества */
    fullName: string;
    /** Дата рождения в формате ДД.ММ.ГГГГ */
    birthDate: string;
    /** Возраст прописью (например «7 лет, 3 месяца») */
    ageText?: string;
}

/**
 * Данные врача для рецепта
 */
export interface RecipeDoctorInfo {
    /** Фамилия, инициалы имени и отчества */
    fullName: string;
}

/**
 * Полные данные для печати рецептурного бланка 107-1/у
 * Один экземпляр = один лист A4 альбомный (до 6 позиций Rp.: 3 левая колонка + 3 правая)
 */
export interface Recipe107PrintData {
    /** Дата выписки рецепта в формате ДД.ММ.ГГГГ */
    issueDate: string;
    /** Информация о пациенте */
    patient: RecipePatientInfo;
    /** Информация о враче */
    doctor: RecipeDoctorInfo;
    /** Информация о клинике/учреждении */
    clinic: RecipeClinicInfo;
    /** Позиции рецепта (1–3 штуки на страницу) */
    items: RecipeItem[];
    /** Срок действия рецепта */
    validityPeriod: RecipeValidity;
    /** Количество дней при validityPeriod === 'custom' */
    customValidityDays?: number;
    /** Льготный рецепт */
    isPreferential: boolean;
}

/**
 * Type guard для Recipe107PrintData
 */
export function isRecipe107PrintData(data: unknown): data is Recipe107PrintData {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    return (
        typeof d.issueDate === 'string' &&
        typeof d.patient === 'object' && d.patient !== null &&
        typeof d.doctor === 'object' && d.doctor !== null &&
        typeof d.clinic === 'object' && d.clinic !== null &&
        Array.isArray(d.items) &&
        d.items.length >= 1 &&
        d.items.length <= 3 &&
        typeof d.validityPeriod === 'string' &&
        typeof d.isPreferential === 'boolean'
    );
}
