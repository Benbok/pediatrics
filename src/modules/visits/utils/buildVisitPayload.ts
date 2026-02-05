import type { Visit } from '../../../types';

/**
 * Подготавливает данные формы приёма для отправки на бэкенд (сериализация JSON-полей).
 * Используется в handleSave и при автосохранении черновика.
 */
export function buildVisitPayload(
    formData: Partial<Visit>,
    recommendations: string[],
    status: 'draft' | 'completed'
): Visit {
    const dataToSave = { ...formData, status } as Partial<Visit> & { status: 'draft' | 'completed' };

    if (dataToSave.primaryDiagnosis && typeof dataToSave.primaryDiagnosis === 'object') {
        dataToSave.primaryDiagnosis = JSON.stringify(dataToSave.primaryDiagnosis) as any;
    }
    if (dataToSave.complications && Array.isArray(dataToSave.complications)) {
        dataToSave.complications = JSON.stringify(dataToSave.complications) as any;
    }
    if (dataToSave.comorbidities && Array.isArray(dataToSave.comorbidities)) {
        dataToSave.comorbidities = JSON.stringify(dataToSave.comorbidities) as any;
    }
    if (Array.isArray(dataToSave.laboratoryTests)) {
        dataToSave.laboratoryTests = JSON.stringify(dataToSave.laboratoryTests) as any;
    }
    if (Array.isArray(dataToSave.instrumentalTests)) {
        dataToSave.instrumentalTests = JSON.stringify(dataToSave.instrumentalTests) as any;
    }
    if (Array.isArray(dataToSave.consultationRequests)) {
        dataToSave.consultationRequests = JSON.stringify(dataToSave.consultationRequests) as any;
    }
    dataToSave.recommendations = JSON.stringify(recommendations) as any;

    return dataToSave as Visit;
}
