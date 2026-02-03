/**
 * Типы данных для печатной формы приема (025/у-04)
 * 
 * Эти типы полностью изолированы от других модулей приложения.
 * Они определяют структуру данных для печати формы приема.
 */

import { Visit, ChildProfile, DiagnosticPlanItem } from '../../../../types';

/**
 * Данные назначения для печати
 */
export interface PrintPrescription {
    /** Название препарата */
    name: string;
    /** Дозировка */
    dosing: string;
    /** Длительность */
    duration: string;
    /** Способ введения */
    routeOfAdmin?: string;
    /** Разовая доза в мг */
    singleDoseMg?: number;
    /** Раз в день */
    timesPerDay?: number;
}

/**
 * Данные диагноза для печати
 */
export interface PrintDiagnosis {
    /** Код МКБ-10 */
    code: string;
    /** Название на русском */
    nameRu: string;
}

/**
 * Информация о клинике
 */
export interface ClinicInfo {
    /** Название клиники */
    name: string;
    /** Адрес */
    address: string;
    /** Телефон */
    phone?: string;
}

/**
 * Полные данные для печатной формы приема
 */
export interface VisitFormPrintData {
    /** Данные визита */
    visit: Visit;
    /** Данные пациента */
    child: ChildProfile;
    /** ФИО врача */
    doctorName: string;
    /** Рекомендации (массив текстовых записей) */
    recommendations: string[];
    /** Информация о клинике */
    clinicInfo?: ClinicInfo;
    /** Дата печати */
    printDate?: string;
}

/**
 * Вспомогательная функция для парсинга диагноза
 */
export function parseDiagnosis(diagnosis: string | object | null): PrintDiagnosis | null {
    if (!diagnosis) return null;
    
    if (typeof diagnosis === 'string') {
        try {
            const parsed = JSON.parse(diagnosis);
            return {
                code: parsed.code || '',
                nameRu: parsed.nameRu || '',
            };
        } catch {
            return null;
        }
    }
    
    if (typeof diagnosis === 'object') {
        const d = diagnosis as Record<string, unknown>;
        return {
            code: (d.code as string) || '',
            nameRu: (d.nameRu as string) || '',
        };
    }
    
    return null;
}

/**
 * Вспомогательная функция для парсинга массива диагнозов
 */
export function parseDiagnosesArray(diagnoses: string | object[] | null): PrintDiagnosis[] {
    if (!diagnoses) return [];
    
    if (typeof diagnoses === 'string') {
        try {
            const parsed = JSON.parse(diagnoses);
            if (Array.isArray(parsed)) {
                return parsed.map(d => ({
                    code: d.code || '',
                    nameRu: d.nameRu || '',
                }));
            }
        } catch {
            return [];
        }
    }
    
    if (Array.isArray(diagnoses)) {
        return diagnoses.map(d => ({
            code: (d as any).code || '',
            nameRu: (d as any).nameRu || '',
        }));
    }
    
    return [];
}

/**
 * Вспомогательная функция для парсинга назначений
 */
export function parsePrescriptions(prescriptions: string | object[] | null): PrintPrescription[] {
    if (!prescriptions) return [];
    
    let parsed: any[];
    if (typeof prescriptions === 'string') {
        try {
            parsed = JSON.parse(prescriptions);
        } catch {
            return [];
        }
    } else if (Array.isArray(prescriptions)) {
        parsed = prescriptions;
    } else {
        return [];
    }
    
    return parsed.map(p => ({
        name: p.name || '',
        dosing: p.dosing || '',
        duration: p.duration || '',
        routeOfAdmin: p.routeOfAdmin,
        singleDoseMg: p.singleDoseMg,
        timesPerDay: p.timesPerDay,
    }));
}

/**
 * Вспомогательная функция для парсинга диагностических исследований
 */
export function parseDiagnosticTests(tests: string | DiagnosticPlanItem[] | null): DiagnosticPlanItem[] {
    if (!tests) return [];
    
    if (typeof tests === 'string') {
        try {
            return JSON.parse(tests);
        } catch {
            return [];
        }
    }
    
    if (Array.isArray(tests)) {
        return tests;
    }
    
    return [];
}

/**
 * Валидирует данные формы приема для печати
 */
export function isVisitFormPrintData(data: unknown): data is VisitFormPrintData {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    const printData = data as Record<string, unknown>;

    // Проверка обязательных полей
    if (
        !printData.visit ||
        typeof printData.visit !== 'object' ||
        !printData.child ||
        typeof printData.child !== 'object' ||
        typeof printData.doctorName !== 'string'
    ) {
        return false;
    }

    // Проверка recommendations
    if (printData.recommendations !== undefined && !Array.isArray(printData.recommendations)) {
        return false;
    }

    return true;
}
