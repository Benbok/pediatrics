/**
 * Типы данных для сертификата профилактических прививок
 * 
 * Эти типы полностью изолированы от других модулей приложения.
 * Они определяют структуру данных, которые должны быть переданы
 * в шаблон сертификата для печати.
 */

/**
 * Данные пациента для сертификата
 */
export interface VaccinationCertificatePatient {
    /** Полное имя (ФИО) */
    fullName: string;
    /** Фамилия */
    surname: string;
    /** Имя */
    name: string;
    /** Отчество */
    patronymic?: string;
    /** Дата рождения (ISO строка) */
    birthDate: string;
    /** Пол */
    gender: 'male' | 'female';
    /** Вес при рождении в граммах */
    birthWeight?: number;
}

/**
 * Выполненная прививка
 */
export interface CompletedVaccination {
    /** Название вакцины */
    vaccineName: string;
    /** ID вакцины */
    vaccineId: string;
    /** Дата выполнения (ISO строка) */
    completedDate: string;
    /** Торговое название препарата */
    vaccineBrand?: string;
    /** Серия препарата */
    series?: string;
    /** Доза */
    dose?: string;
    /** Медицинское учреждение */
    clinic?: string;
    /** Подпись врача */
    doctorSignature?: string;
    /** Примечания */
    notes?: string;
    /** Номер дозы в серии (например, V1, V2, R1) */
    doseNumber?: string;
    /** Срок годности */
    expiryDate?: string;
    /** Производитель */
    manufacturer?: string;
}

/**
 * Статус запланированной прививки
 */
export type PlannedVaccinationStatus = 'planned' | 'due_now' | 'overdue';

/**
 * Запланированная прививка
 */
export interface PlannedVaccination {
    /** Название вакцины */
    vaccineName: string;
    /** ID вакцины */
    vaccineId: string;
    /** Рекомендуемая дата (ISO строка) */
    recommendedDate: string;
    /** Статус */
    status: PlannedVaccinationStatus;
    /** Описание */
    description?: string;
    /** Обязательная (true) или рекомендованная (false) */
    isRequired: boolean;
    /** Возраст для вакцинации (для отображения на графике) */
    ageInMonths?: number;
    /** Предупреждающее сообщение */
    alertMessage?: string;
}

/**
 * Группа вакцин (для группировки в таблице)
 */
export interface VaccinationGroup {
    /** Название группы */
    groupName: string;
    /** Вакцины в группе */
    vaccinations: CompletedVaccination[];
}

/**
 * Полные данные для сертификата прививок
 */
export interface VaccinationCertificateData {
    /** Данные пациента */
    patient: VaccinationCertificatePatient;
    /** Выполненные прививки */
    completedVaccinations: CompletedVaccination[];
    /** Запланированные прививки */
    plannedVaccinations: PlannedVaccination[];
    /** Номер сертификата */
    certificateNumber?: string;
    /** Дата выдачи (ISO строка) */
    issueDate: string;
    /** Выдан (медицинское учреждение) */
    issuedBy?: string;
    /** Группировать ли вакцины по типам */
    groupByVaccineType?: boolean;
}

/**
 * Валидирует данные сертификата вакцинации
 */
export function isVaccinationCertificateData(data: unknown): data is VaccinationCertificateData {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    const cert = data as Record<string, unknown>;

    // Проверка обязательных полей
    if (
        !cert.patient ||
        typeof cert.patient !== 'object' ||
        !Array.isArray(cert.completedVaccinations) ||
        !Array.isArray(cert.plannedVaccinations)
    ) {
        return false;
    }

    const patient = cert.patient as Record<string, unknown>;

    // Проверка данных пациента
    if (
        typeof patient.fullName !== 'string' ||
        typeof patient.surname !== 'string' ||
        typeof patient.name !== 'string' ||
        typeof patient.birthDate !== 'string' ||
        (patient.gender !== 'male' && patient.gender !== 'female')
    ) {
        return false;
    }

    return true;
}
