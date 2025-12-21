/**
 * Адаптер для преобразования данных вакцинации в формат для печати
 * 
 * Этот файл является ЧАСТЬЮ модуля vaccination, НЕ частью модуля printing.
 * Он знает о внутренних типах обоих модулей и выполняет преобразование.  
 */

import { ChildProfile, AugmentedVaccine, VaccineStatus } from '../../../types';
import { VaccinationCertificateData, CompletedVaccination, PlannedVaccination } from '../../printing/templates/vaccination/types';
import { generateCertificateNumber } from '../../printing/utils/formatters';

/**
 * Преобразует данные модуля вакцинации в формат для печати сертификата
 * 
 * @param child - Профиль ребенка
 * @param vaccines - Augmented вакцины с расчетами
 * @returns Данные для печати сертификата
 */
export function createVaccinationCertificateData(
    child: ChildProfile,
    vaccines: AugmentedVaccine[]
): VaccinationCertificateData {
    // Преобразуем данные пациента
    const patient = {
        fullName: [child.surname, child.name, child.patronymic].filter(Boolean).join(' '),
        surname: child.surname,
        name: child.name,
        patronymic: child.patronymic,
        birthDate: child.birthDate,
        gender: child.gender,
        birthWeight: child.birthWeight || undefined,
    };

    // Фильтруем выполненные прививки
    const completedVaccinations: CompletedVaccination[] = vaccines
        .filter(v => v.status === VaccineStatus.COMPLETED && v.userRecord?.completedDate)
        .map(v => ({
            vaccineName: v.name,
            vaccineId: v.id,
            completedDate: v.userRecord!.completedDate!,
            vaccineBrand: v.userRecord!.vaccineBrand,
            series: v.userRecord!.series,
            dose: v.userRecord!.dose,
            clinic: undefined,
            doctorSignature: undefined,
            notes: v.userRecord!.notes,
            doseNumber: extractDoseNumber(v.id),
            expiryDate: v.userRecord!.expiryDate,
            manufacturer: v.userRecord!.manufacturer,
        }));

    // Фильтруем плановые прививки (не выполненные)
    const plannedVaccinations: PlannedVaccination[] = vaccines
        .filter(v =>
            v.status !== VaccineStatus.COMPLETED &&
            v.status !== VaccineStatus.SKIPPED &&
            v.status !== VaccineStatus.MISSED
        )
        .map(v => {
            const ageInMonths = v.ageMonthStart;

            return {
                vaccineName: v.name,
                vaccineId: v.id,
                recommendedDate: v.dueDate.toISOString(),
                status: getPlannedStatus(v.status),
                description: v.description,
                isRequired: !v.isCustom, // Пользовательские вакцины считаем рекомендованными
                ageInMonths,
                alertMessage: v.alertMessage,
            };
        });

    // Генерируем номер сертификата
    const certificateNumber = generateCertificateNumber(child.id);

    return {
        patient,
        completedVaccinations,
        plannedVaccinations,
        certificateNumber,
        issueDate: new Date().toISOString(),
        issuedBy: 'Педиатрическая клиника', // Можно сделать настраиваемым
        groupByVaccineType: true,
    };
}

/**
 * Преобразуем статус вакцины в статус плановой прививки
 */
function getPlannedStatus(status: VaccineStatus): 'planned' | 'due_now' | 'overdue' {
    switch (status) {
        case VaccineStatus.DUE_NOW:
            return 'due_now';
        case VaccineStatus.OVERDUE:
            return 'overdue';
        default:
            return 'planned';
    }
}

/**
 * Извлекает номер дозы из ID вакцины (если возможно)
 * Например: hepb-v1 -> V1, dtp-r1 -> R1
 */
function extractDoseNumber(vaccineId: string): string | undefined {
    const match = vaccineId.match(/-(v\d+|r\d+)$/i);
    if (match) {
        return match[1].toUpperCase();
    }
    return undefined;
}
