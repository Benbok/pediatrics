import { Visit, DiagnosisSuggestion, MedicationRecommendation, ChildProfile } from '../../../types';
import { VisitSchema, AnalyzeVisitSchema } from '../../../validators/visit.validator';
import { logger } from '../../../services/logger';
import { calculateAgeInMonths } from '../../../utils/ageUtils';

/**
 * Данные пациента для расчета дозировки
 */
export interface PatientDoseParams {
    weight: number;
    ageMonths: number;
    height?: number | null;
}

/**
 * Результат валидации данных пациента
 */
export interface PatientValidationResult {
    isValid: boolean;
    params?: PatientDoseParams;
    errors: string[];
}

export const visitService = {
    /**
     * Fetch all visits for a specific child
     */
    async getVisits(childId: number): Promise<Visit[]> {
        try {
            return await window.electronAPI.getVisits(childId);
        } catch (error) {
            logger.error('[VisitService] Failed to fetch visits', { error, childId });
            throw error;
        }
    },

    /**
     * Fetch a single visit by ID
     */
    async getVisit(id: number): Promise<Visit> {
        try {
            return await window.electronAPI.getVisit(id);
        } catch (error) {
            logger.error('[VisitService] Failed to fetch visit details', { error, visitId: id });
            throw error;
        }
    },

    /**
     * Create or update a visit
     */
    async upsertVisit(data: Visit): Promise<Visit> {
        // Validate data using Zod
        const validation = VisitSchema.safeParse(data);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.upsertVisit(validation.data as Visit);
        } catch (error: any) {
            logger.error('[VisitService] Failed to save visit', { error, visitData: data });
            throw new Error(error.message || 'Ошибка при сохранении посещения');
        }
    },

    /**
     * Delete a visit
     */
    async deleteVisit(id: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteVisit(id);
        } catch (error) {
            logger.error('[VisitService] Failed to delete visit', { error, visitId: id });
            throw error;
        }
    },

    /**
     * Analyze visit complaints for CDSS suggestions
     */
    async analyzeVisit(visitId: number): Promise<DiagnosisSuggestion[]> {
        // Validate visitId
        const validation = AnalyzeVisitSchema.safeParse({ visitId });
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.analyzeVisit(validation.data.visitId);
        } catch (error: any) {
            logger.error('[VisitService] Visit analysis failed', { error, visitId });
            throw new Error(error.message || 'Ошибка при анализе посещения');
        }
    },

    /**
     * Get medications for a specific diagnosis with calculated doses
     */
    async getMedicationsForDiagnosis(diseaseId: number, childId: number): Promise<MedicationRecommendation[]> {
        // Validate IDs
        if (!diseaseId || diseaseId < 1) {
            throw new Error('ID заболевания должен быть больше 0');
        }
        if (!childId || childId < 1) {
            throw new Error('ID пациента должен быть больше 0');
        }

        try {
            return await window.electronAPI.getMedicationsForDiagnosis({ diseaseId, childId });
        } catch (error: any) {
            logger.error('[VisitService] Failed to get medications for diagnosis', { error, diseaseId, childId });
            throw new Error(error.message || 'Ошибка при получении препаратов для диагноза');
        }
    },

    /**
     * Get medications by ICD code via DiseaseMedication links
     * Used when diagnosis is selected directly from ICD directory (without diseaseId)
     */
    async getMedicationsByIcdCode(icdCode: string, childId: number): Promise<MedicationRecommendation[]> {
        // Validate inputs
        if (!icdCode || icdCode.trim() === '') {
            throw new Error('Код МКБ обязателен');
        }
        if (!childId || childId < 1) {
            throw new Error('ID пациента должен быть больше 0');
        }

        try {
            return await window.electronAPI.getMedicationsByIcdCode({ icdCode, childId });
        } catch (error: any) {
            logger.error('[VisitService] Failed to get medications by ICD code', { error, icdCode, childId });
            throw new Error(error.message || 'Ошибка при получении препаратов по коду МКБ');
        }
    },

    /**
     * Get diagnostic tests by ICD code
     * Searches all diseases with matching ICD code and collects their diagnosticPlan
     */
    async getDiagnosticsByIcdCode(icdCode: string): Promise<import('../../../types').DiagnosticRecommendation[]> {
        // Validate input
        if (!icdCode || icdCode.trim() === '') {
            throw new Error('Код МКБ обязателен');
        }

        try {
            return await window.electronAPI.getDiagnosticsByIcdCode(icdCode);
        } catch (error: any) {
            logger.error('[VisitService] Failed to get diagnostics by ICD code', { error, icdCode });
            throw new Error(error.message || 'Ошибка при получении диагностических исследований по коду МКБ');
        }
    },

    /**
     * Check if medication is already in prescriptions list
     * Business logic helper - validates duplicate medications
     */
    checkDuplicateMedication(prescriptions: any[], medicationId: number): { isDuplicate: boolean; errorMessage?: string } {
        if (!prescriptions || !Array.isArray(prescriptions)) {
            return { isDuplicate: false };
        }

        const existing = prescriptions.find((p: any) => p.medicationId === medicationId);
        
        if (existing) {
            return {
                isDuplicate: true,
                errorMessage: `Препарат уже добавлен в назначения`
            };
        }

        return { isDuplicate: false };
    },

    /**
     * Валидация данных пациента для расчета дозировки
     * 
     * Проверяет наличие обязательных полей:
     * - Вес (из антропометрии или вес при рождении)
     * - Дата рождения (для расчета возраста)
     * 
     * @param child - Профиль ребенка
     * @param currentWeight - Текущий вес из антропометрии (может быть null)
     * @param visitDate - Дата приема для расчета возраста
     * @param currentHeight - Текущий рост (опционально)
     * @returns Результат валидации с параметрами или ошибками
     */
    validatePatientForDosing(
        child: ChildProfile | null,
        currentWeight: number | null | undefined,
        visitDate: string | Date | null | undefined,
        currentHeight?: number | null
    ): PatientValidationResult {
        const errors: string[] = [];

        // Проверка наличия данных ребенка
        if (!child) {
            return {
                isValid: false,
                errors: ['Данные пациента не загружены']
            };
        }

        // Проверка даты рождения
        if (!child.birthDate) {
            errors.push('Не указана дата рождения пациента');
        }

        // Проверяем вес из Антропометрии (обязательное поле для расчета дозировки)
        if (!currentWeight || currentWeight <= 0) {
            errors.push('Укажите вес пациента в разделе "Антропометрия" для расчета дозировки');
        }

        // Если есть критические ошибки, возвращаем их
        if (errors.length > 0) {
            logger.warn('[VisitService] Patient validation failed for dosing', { errors });
            return {
                isValid: false,
                errors
            };
        }

        // Рассчитываем возраст на дату приема
        const visitDateObj = visitDate ? new Date(visitDate) : new Date();
        const ageMonths = calculateAgeInMonths(child.birthDate!, visitDateObj);

        return {
            isValid: true,
            params: {
                weight: currentWeight!,
                ageMonths,
                height: currentHeight || null
            },
            errors: []
        };
    },

    /**
     * Получение параметров пациента для расчета дозировки с валидацией
     * Выбрасывает ошибку если данные невалидны
     * 
     * @throws Error если данные невалидны
     */
    getPatientDoseParamsOrThrow(
        child: ChildProfile | null,
        currentWeight: number | null | undefined,
        visitDate: string | Date | null | undefined,
        currentHeight?: number | null
    ): PatientDoseParams {
        const validation = this.validatePatientForDosing(child, currentWeight, visitDate, currentHeight);
        
        if (!validation.isValid || !validation.params) {
            throw new Error(validation.errors.join('. '));
        }

        return validation.params;
    }
};
