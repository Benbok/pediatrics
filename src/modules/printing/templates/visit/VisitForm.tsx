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
import './VisitForm.css';

/**
 * Компонент печатной формы приема (025/у-04)
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
    const laboratoryTests = parseDiagnosticTests((visit as any).laboratoryTests);
    const instrumentalTests = parseDiagnosticTests((visit as any).instrumentalTests);

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
    const visitTypeLabels: Record<string, string> = {
        primary: 'Первичный',
        followup: 'Повторный',
        consultation: 'Консультация',
        emergency: 'Экстренный',
        urgent: 'Неотложный',
    };
    const visitTypeLabel = visitTypeLabels[visit.visitType || ''] || visit.visitType || '—';

    return (
        <div className="visit-form-print">
            {/* Шапка документа */}
            <div className="header">
                <div className="header-left">
                    {clinicInfo && (
                        <>
                            <div className="clinic-name">{clinicInfo.name}</div>
                            <div className="clinic-address">{clinicInfo.address}</div>
                            {clinicInfo.phone && <div className="clinic-phone">Тел: {clinicInfo.phone}</div>}
                        </>
                    )}
                </div>
                <div className="header-right">
                    <div className="form-number">ФОРМА № 025/у-04</div>
                    <div className="form-title">МЕДИЦИНСКАЯ КАРТА</div>
                    <div className="form-subtitle">амбулаторного больного</div>
                </div>
            </div>

            {/* Информация о приеме */}
            <div className="visit-info">
                <div className="info-row">
                    <span className="label">Дата приема:</span>
                    <span className="value">{visitDateFormatted}</span>
                    {visit.visitTime && (
                        <>
                            <span className="label" style={{ marginLeft: '2rem' }}>Время:</span>
                            <span className="value">{visit.visitTime}</span>
                        </>
                    )}
                </div>
                <div className="info-row">
                    <span className="label">Тип приема:</span>
                    <span className="value">{visitTypeLabel}</span>
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

            {/* Жалобы */}
            {visit.complaints && (
                <div className="section">
                    <div className="section-title">Жалобы</div>
                    <div className="section-content">{visit.complaints}</div>
                </div>
            )}

            {/* Анамнез заболевания */}
            {((visit as any).diseaseOnset || (visit as any).diseaseCourse || (visit as any).treatmentBeforeVisit) && (
                <div className="section">
                    <div className="section-title">Анамнез заболевания</div>
                    <div className="section-content">
                        {(visit as any).diseaseOnset && (
                            <p><strong>Начало заболевания:</strong> {(visit as any).diseaseOnset}</p>
                        )}
                        {(visit as any).diseaseCourse && (
                            <p><strong>Течение:</strong> {(visit as any).diseaseCourse}</p>
                        )}
                        {(visit as any).treatmentBeforeVisit && (
                            <p><strong>Лечение до обращения:</strong> {(visit as any).treatmentBeforeVisit}</p>
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
                            <span className="diagnosis-label">Осложнения:</span>
                            {complications.map((c, i) => (
                                <div key={i} className="diagnosis">
                                    {c.code && <span className="diagnosis-code">{c.code}</span>}
                                    <span className="diagnosis-name">{c.nameRu}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {comorbidities.length > 0 && (
                        <div className="diagnosis-group">
                            <span className="diagnosis-label">Сопутствующие:</span>
                            {comorbidities.map((c, i) => (
                                <div key={i} className="diagnosis">
                                    {c.code && <span className="diagnosis-code">{c.code}</span>}
                                    <span className="diagnosis-name">{c.nameRu}</span>
                                </div>
                            ))}
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
            {(visit as any).nextVisitDate && (
                <div className="section">
                    <div className="info-row">
                        <span className="label">Дата следующего визита:</span>
                        <span className="value">
                            {formatDate(new Date((visit as any).nextVisitDate), 'short')}
                        </span>
                    </div>
                </div>
            )}

            {/* Подпись врача */}
            <div className="footer">
                <div className="signature-block">
                    <div className="signature-line"></div>
                    <div className="signature-label">Подпись врача</div>
                </div>
                <div className="doctor-name">{doctorName}</div>
                <div className="print-date">
                    Дата печати: {formatDate(new Date(), 'short')}
                </div>
            </div>
        </div>
    );
};
