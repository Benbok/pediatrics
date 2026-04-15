import React from 'react';
import { PrintTemplateProps } from '../../types';
import { 
    VisitFormPrintData, 
    parseDiagnosis, 
    parseDiagnosesArray, 
    parsePrescriptions,
    parseDiagnosticTests 
} from './types';
import { formatDate, formatFullName, calculateAge } from '../../utils/formatters';
import { getRouteLabel } from '../../../../utils/routeOfAdmin';
import {
    AllergyStatusData,
    BirthData,
    FeedingData,
    HeredityData,
    InfectiousDiseasesData,
} from '../../../../types';

function parseJsonField<T>(value: T | string | null | undefined): T | null {
    if (!value) return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }
    return value as T;
}

function hasText(value?: string | null): boolean {
    return Boolean(value && value.trim());
}

/**
 * Компонент печатной формы приема (025/у)
 */
export const VisitForm: React.FC<PrintTemplateProps<VisitFormPrintData>> = ({
    data,
    metadata,
}) => {
    const { visit, child, doctorName, recommendations, clinicInfo } = data;

    // Парсим данные
    const primaryDiagnosis = parseDiagnosis(visit.primaryDiagnosis);
    const complications = parseDiagnosesArray(visit.complications);
    const comorbidities = parseDiagnosesArray(visit.comorbidities);
    const prescriptions = parsePrescriptions(visit.prescriptions);
    const laboratoryTests = parseDiagnosticTests(visit.laboratoryTests ?? null);
    const instrumentalTests = parseDiagnosticTests(visit.instrumentalTests ?? null);

    const heredityData = parseJsonField<HeredityData>(visit.heredityData);
    const birthData = parseJsonField<BirthData>(visit.birthData);
    const feedingData = parseJsonField<FeedingData>(visit.feedingData);
    const infectiousDiseasesData = parseJsonField<InfectiousDiseasesData>(visit.infectiousDiseasesData);
    const allergyStatusData = parseJsonField<AllergyStatusData>(visit.allergyStatusData);

    // Форматируем дату приема
    const visitDateFormatted = visit.visitDate 
        ? formatDate(new Date(visit.visitDate), 'full')
        : formatDate(new Date(), 'full');

    // Получаем возраст пациента
    const patientAge = child.birthDate 
        ? calculateAge(new Date(child.birthDate), 'full')
        : '';

    // Полное имя пациента
    const patientFullName = formatFullName(child.surname, child.name, child.patronymic, 'full');

    // Тип визита
    const visitTypeHeaderLabels: Record<string, string> = {
        primary: 'Первичный осмотр',
        followup: 'Повторный прием',
        consultation: 'Консультативный приём',
        emergency: 'Экстренный и неотложный приём',
        urgent: 'Экстренный и неотложный приём',
    };
    const visitTypeLabel = visitTypeHeaderLabels[visit.visitType || ''] || 'Прием';
    const visitHeaderMeta = [
        `Дата приема: ${visitDateFormatted}`,
        visit.visitTime ? `Время: ${visit.visitTime}` : null,
    ].filter(Boolean).join('   ');

    const heredityItems = [
        heredityData?.tuberculosis
            ? `Туберкулез${hasText(heredityData.tuberculosisDetails) ? `: ${heredityData.tuberculosisDetails}` : ''}`
            : null,
        heredityData?.diabetes
            ? `Диабет${hasText(heredityData.diabetesDetails) ? `: ${heredityData.diabetesDetails}` : ''}`
            : null,
        heredityData?.hypertension
            ? `Гипертоническая болезнь${hasText(heredityData.hypertensionDetails) ? `: ${heredityData.hypertensionDetails}` : ''}`
            : null,
        heredityData?.oncology
            ? `Онкологические заболевания${hasText(heredityData.oncologyDetails) ? `: ${heredityData.oncologyDetails}` : ''}`
            : null,
        heredityData?.allergies
            ? `Аллергические заболевания${hasText(heredityData.allergiesDetails) ? `: ${heredityData.allergiesDetails}` : ''}`
            : null,
        hasText(heredityData?.other) ? `Прочие: ${heredityData?.other}` : null,
    ].filter(Boolean) as string[];

    const birthItems = [
        hasText(birthData?.pregnancyCourse) ? `Течение беременности: ${birthData?.pregnancyCourse}` : null,
        hasText(birthData?.obstetricalHistory) ? `Акушерский анамнез: ${birthData?.obstetricalHistory}` : null,
        birthData?.deliveryMethod === 'natural'
            ? 'Способ родоразрешения: Естественные роды'
            : birthData?.deliveryMethod === 'cesarean'
                ? 'Способ родоразрешения: Кесарево сечение'
                : null,
        birthData?.gestationalAge !== undefined && birthData?.gestationalAge !== null
            ? `Длительность беременности: ${birthData.gestationalAge} недель`
            : null,
        birthData?.birthWeight !== undefined && birthData?.birthWeight !== null
            ? `Масса при рождении: ${birthData.birthWeight} г`
            : null,
        birthData?.birthHeight !== undefined && birthData?.birthHeight !== null
            ? `Рост при рождении: ${birthData.birthHeight} см`
            : null,
        birthData?.apgarScore !== undefined && birthData?.apgarScore !== null
            ? `Оценка по шкале Апгар: ${birthData.apgarScore}`
            : null,
        birthData?.neonatalComplications === true
            ? `Период новорожденности: были осложнения${hasText(birthData.neonatalComplicationsDetails) ? ` (${birthData.neonatalComplicationsDetails})` : ''}`
            : birthData?.neonatalComplications === false
                ? 'Период новорожденности: осложнений не было'
                : null,
    ].filter(Boolean) as string[];

    const breastfeedingLabel = feedingData?.breastfeeding === 'yes'
        ? 'Да'
        : feedingData?.breastfeeding === 'no'
            ? 'Нет'
            : feedingData?.breastfeeding === 'mixed'
                ? 'Смешанное'
                : null;

    const feedingItems = [
        breastfeedingLabel ? `Грудное вскармливание: ${breastfeedingLabel}` : null,
        hasText(feedingData?.breastfeedingFrom) ? `Грудное вскармливание с: ${feedingData?.breastfeedingFrom}` : null,
        hasText(feedingData?.breastfeedingTo) ? `Грудное вскармливание по: ${feedingData?.breastfeedingTo}` : null,
        hasText(feedingData?.formulaName) ? `Молочная смесь: ${feedingData?.formulaName}` : null,
        feedingData?.complementaryFoodAge !== undefined && feedingData?.complementaryFoodAge !== null
            ? `Прикорм введен в возрасте: ${feedingData.complementaryFoodAge} мес`
            : null,
        hasText(feedingData?.nutritionFeatures) ? `Особенности питания: ${feedingData?.nutritionFeatures}` : null,
    ].filter(Boolean) as string[];

    const infectiousDiseaseMap: Array<{ key: keyof InfectiousDiseasesData; label: string }> = [
        { key: 'measles', label: 'Корь' },
        { key: 'chickenpox', label: 'Ветряная оспа' },
        { key: 'rubella', label: 'Краснуха' },
        { key: 'pertussis', label: 'Коклюш' },
        { key: 'scarletFever', label: 'Скарлатина' },
    ];

    const infectiousItems: string[] = [];
    for (const disease of infectiousDiseaseMap) {
        const entry = infectiousDiseasesData?.[disease.key];
        if (entry && typeof entry === 'object' && 'had' in entry && entry.had) {
            const age = 'ageYears' in entry && typeof entry.ageYears === 'number' ? ` (в ${entry.ageYears} лет)` : '';
            infectiousItems.push(`${disease.label}${age}`);
        }
    }
    if (infectiousDiseasesData?.tonsillitis?.had) {
        const perYear = typeof infectiousDiseasesData.tonsillitis.perYear === 'number'
            ? ` (${infectiousDiseasesData.tonsillitis.perYear} раз/год)`
            : '';
        infectiousItems.push(`Ангина${perYear}`);
    }
    if (hasText(infectiousDiseasesData?.other)) {
        infectiousItems.push(`Прочие: ${infectiousDiseasesData?.other}`);
    }

    const allergyItems = [
        hasText(allergyStatusData?.food) ? `Пищевая аллергия: ${allergyStatusData?.food}` : null,
        hasText(allergyStatusData?.medication) ? `Лекарственная аллергия: ${allergyStatusData?.medication}` : null,
        hasText(allergyStatusData?.materials) ? `Аллергия на материалы: ${allergyStatusData?.materials}` : null,
        hasText(allergyStatusData?.insectBites) ? `Реакции на укусы насекомых: ${allergyStatusData?.insectBites}` : null,
        hasText(allergyStatusData?.seasonal) ? `Сезонные аллергии: ${allergyStatusData?.seasonal}` : null,
    ].filter(Boolean) as string[];

    const hasLifeAnamnesis =
        heredityItems.length > 0 ||
        birthItems.length > 0 ||
        feedingItems.length > 0 ||
        infectiousItems.length > 0 ||
        allergyItems.length > 0;

    const doctorDisplayName = (doctorName ?? '').trim() || '—';

    const formatDiagnosesSentence = (items: Array<{ nameRu?: string | null }>): string => {
        const normalized = items
            .map((item) => (item.nameRu ?? '').trim())
            .filter(Boolean)
            .map((item) => item.replace(/[.;:,\s]+$/g, ''));

        return normalized.length > 0 ? `${normalized.join('. ')}.` : '';
    };

    return (
        <div className="visit-form-print">
            {/* Шапка документа */}
            <div className="header">
                <div className="header-left">
                    {clinicInfo && (
                        <>
                            <div className="clinic-name">{clinicInfo.name}</div>
                            {clinicInfo.legalName && <div className="clinic-address">{clinicInfo.legalName}</div>}
                            {clinicInfo.department && <div className="clinic-address">{clinicInfo.department}</div>}
                            {clinicInfo.address && <div className="clinic-address">{clinicInfo.address}</div>}
                            {clinicInfo.phone && <div className="clinic-phone">Тел: {clinicInfo.phone}</div>}
                            {clinicInfo.email && <div className="clinic-phone">Email: {clinicInfo.email}</div>}
                            {clinicInfo.website && <div className="clinic-phone">Сайт: {clinicInfo.website}</div>}
                            {(clinicInfo.inn || clinicInfo.ogrn) && (
                                <div className="clinic-phone">
                                    {clinicInfo.inn ? `ИНН: ${clinicInfo.inn}` : ''}
                                    {clinicInfo.inn && clinicInfo.ogrn ? ' | ' : ''}
                                    {clinicInfo.ogrn ? `ОГРН: ${clinicInfo.ogrn}` : ''}
                                </div>
                            )}
                            {clinicInfo.chiefDoctor && <div className="clinic-phone">Главный врач: {clinicInfo.chiefDoctor}</div>}
                        </>
                    )}
                </div>
                <div className="header-right">
                    <div className="form-number">ФОРМА № 025/у</div>
                    <div className="form-title">{visitTypeLabel}</div>
                    <div className="form-subtitle">{visitHeaderMeta}</div>
                </div>
            </div>

            {/* Данные пациента */}
            <div className="section">
                <div className="section-title">Данные пациента</div>
                <div className="patient-info">
                    <div className="info-row">
                        <span className="label">ФИО:</span>
                        <span className="value">{patientFullName}</span>
                    </div>
                    <div className="info-row">
                        <span className="label">Дата рождения:</span>
                        <span className="value">
                            {child.birthDate ? formatDate(new Date(child.birthDate), 'short') : '—'}
                        </span>
                        <span className="label" style={{ marginLeft: '2rem' }}>Возраст:</span>
                        <span className="value">{patientAge || '—'}</span>
                    </div>
                </div>
            </div>

            {/* Антропометрия */}
            {(visit.currentWeight || visit.currentHeight) && (
                <div className="section">
                    <div className="section-title">Антропометрия</div>
                    <div className="anthropometry">
                        {visit.currentWeight && (
                            <span className="anthro-item">
                                <span className="label">Вес:</span> {visit.currentWeight} кг
                            </span>
                        )}
                        {visit.currentHeight && (
                            <span className="anthro-item">
                                <span className="label">Рост:</span> {visit.currentHeight} см
                            </span>
                        )}
                        {visit.bmi && (
                            <span className="anthro-item">
                                <span className="label">ИМТ:</span> {visit.bmi.toFixed(1)}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Анамнез жизни */}
            {hasLifeAnamnesis && (
                <div className="section">
                    <div className="section-title">Анамнез жизни</div>
                    <div className="section-content">
                        {heredityItems.length > 0 && (
                            <>
                                <p><strong>Наследственность:</strong></p>
                                <ul>
                                    {heredityItems.map((item, index) => (
                                        <li key={`heredity-${index}`}>{item}</li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {birthItems.length > 0 && (
                            <>
                                <p><strong>Сведения о беременности и родах:</strong></p>
                                <ul>
                                    {birthItems.map((item, index) => (
                                        <li key={`birth-${index}`}>{item}</li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {feedingItems.length > 0 && (
                            <>
                                <p><strong>Вскармливание:</strong></p>
                                <ul>
                                    {feedingItems.map((item, index) => (
                                        <li key={`feeding-${index}`}>{item}</li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {infectiousItems.length > 0 && (
                            <>
                                <p><strong>Перенесенные инфекционные заболевания:</strong></p>
                                <ul>
                                    {infectiousItems.map((item, index) => (
                                        <li key={`infectious-${index}`}>{item}</li>
                                    ))}
                                </ul>
                            </>
                        )}

                        {allergyItems.length > 0 && (
                            <>
                                <p><strong>Аллергический статус:</strong></p>
                                <ul>
                                    {allergyItems.map((item, index) => (
                                        <li key={`allergy-${index}`}>{item}</li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Жалобы */}
            {visit.complaints && (
                <div className="section">
                    <div className="section-title">Жалобы</div>
                    <div className="section-content">{visit.complaints}</div>
                </div>
            )}

            {/* Анамнез заболевания */}
            {(visit.diseaseOnset || visit.diseaseCourse || visit.treatmentBeforeVisit) && (
                <div className="section">
                    <div className="section-title">Анамнез заболевания</div>
                    <div className="section-content anamnesis-disease-content">
                        {visit.diseaseOnset && (
                            <p>Начало заболевания: {visit.diseaseOnset}</p>
                        )}
                        {visit.diseaseCourse && (
                            <p>Течение: {visit.diseaseCourse}</p>
                        )}
                        {visit.treatmentBeforeVisit && (
                            <p>Лечение до обращения: {visit.treatmentBeforeVisit}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Объективный осмотр */}
            {visit.physicalExam && (
                <div className="section">
                    <div className="section-title">Объективный осмотр</div>
                    <div className="section-content">{visit.physicalExam}</div>
                </div>
            )}

            {/* Диагнозы */}
            <div className="section">
                <div className="section-title">Диагноз</div>
                <div className="diagnoses">
                    {primaryDiagnosis && (
                        <div className="diagnosis primary">
                            <span className="diagnosis-label">Основной:</span>
                            {primaryDiagnosis.code && <span className="diagnosis-code">{primaryDiagnosis.code}</span>}
                            <span className="diagnosis-name">{primaryDiagnosis.nameRu}</span>
                        </div>
                    )}
                    {complications.length > 0 && (
                        <div className="diagnosis-group">
                            <div className="diagnosis">
                                <span className="diagnosis-label">Осложнение:</span>
                                <span className="diagnosis-name">{formatDiagnosesSentence(complications)}</span>
                            </div>
                        </div>
                    )}
                    {comorbidities.length > 0 && (
                        <div className="diagnosis-group">
                            <div className="diagnosis">
                                <span className="diagnosis-label">Сопутствующий:</span>
                                <span className="diagnosis-name">{formatDiagnosesSentence(comorbidities)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Назначения */}
            {prescriptions.length > 0 && (
                <div className="section">
                    <div className="section-title">Назначения</div>
                    <table className="prescriptions-table">
                        <thead>
                            <tr>
                                <th>№</th>
                                <th>Препарат</th>
                                <th>Дозировка</th>
                                <th>Способ</th>
                                <th>Длительность</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prescriptions.map((p, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td>{p.name}</td>
                                    <td>
                                        {p.dosing}
                                        {p.singleDoseMg && p.timesPerDay && (
                                            <div className="dose-detail">
                                                {p.singleDoseMg} мг × {p.timesPerDay} р/день
                                            </div>
                                        )}
                                    </td>
                                    <td>{p.routeOfAdmin ? getRouteLabel(p.routeOfAdmin) : '—'}</td>
                                    <td>{p.duration || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Диагностические исследования */}
            {(laboratoryTests.length > 0 || instrumentalTests.length > 0) && (
                <div className="section">
                    <div className="section-title">Диагностические исследования</div>
                    {laboratoryTests.length > 0 && (
                        <div className="tests-group">
                            <div className="tests-subtitle">Лабораторные:</div>
                            <ul className="tests-list">
                                {laboratoryTests.map((t, i) => (
                                    <li key={i}>{t.test}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {instrumentalTests.length > 0 && (
                        <div className="tests-group">
                            <div className="tests-subtitle">Инструментальные:</div>
                            <ul className="tests-list">
                                {instrumentalTests.map((t, i) => (
                                    <li key={i}>{t.test}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Рекомендации */}
            {recommendations && recommendations.length > 0 && (
                <div className="section">
                    <div className="section-title">Рекомендации</div>
                    <ol className="recommendations-list">
                        {recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                        ))}
                    </ol>
                </div>
            )}

            {/* Дата следующего визита */}
            {visit.nextVisitDate && (
                <div className="section">
                    <div className="info-row">
                        <span className="label">Дата следующего визита:</span>
                        <span className="value">
                            {formatDate(new Date(visit.nextVisitDate), 'short')}
                        </span>
                    </div>
                </div>
            )}

            {/* Подпись врача */}
            <div className="footer">
                <div className="info-row">
                    <span className="label">Врач:</span>
                    <span className="value">{doctorDisplayName}</span>
                </div>
                <div className="info-row">
                    <span className="label">Подпись:</span>
                    <span className="signature-line" aria-hidden="true"></span>
                </div>
            </div>
        </div>
    );
};
