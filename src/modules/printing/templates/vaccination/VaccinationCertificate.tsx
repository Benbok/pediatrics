import React from 'react';
import { PrintTemplateProps } from '../../types';
import { VaccinationCertificateData } from './types';
import { formatDate, formatFullName, formatWeight, calculateAge, valueOrDash } from '../../utils/formatters';
import { CompletedVaccinationsTable } from './components/CompletedVaccinationsTable';
import { VaccinationTimeline } from './components/VaccinationTimeline';
import './VaccinationCertificate.css';

/**
 * Компонент сертификата профилактических прививок (Форма 156/У-93)
 * 
 * Этот компонент полностью изолирован и работает только с переданными данными.
 * Он не зависит от других модулей приложения.
 */
export const VaccinationCertificate: React.FC<PrintTemplateProps<VaccinationCertificateData>> = ({
    data,
    metadata,
    options,
}) => {
    const { patient, completedVaccinations, plannedVaccinations, certificateNumber, issueDate, issuedBy } = data;

    return (
        <div className="vaccination-certificate print-content">
            {/* Страница 1: Титульный лист */}
            <div className="certificate-page page-1">
                {/* Заголовок */}
                <header className="certificate-header">
                    <div className="header-badge">
                        <div className="medical-cross">✚</div>
                    </div>
                    <h1 className="certificate-title">
                        СЕРТИФИКАТ<br />
                        ПРОФИЛАКТИЧЕСКИХ ПРИВИВОК
                    </h1>
                    <div className="form-number">Форма № 156/У-93</div>
                    {certificateNumber && (
                        <div className="certificate-number">
                            Сертификат № {certificateNumber}
                        </div>
                    )}
                </header>

                {/* Данные пациента */}
                <section className="patient-info avoid-break">
                    <h2 className="section-title">Сведения о пациенте</h2>

                    <div className="info-grid">
                        <div className="info-row">
                            <span className="info-label">Фамилия, Имя, Отчество:</span>
                            <span className="info-value">
                                {formatFullName(patient.surname, patient.name, patient.patronymic, 'full')}
                            </span>
                        </div>

                        <div className="info-row">
                            <span className="info-label">Дата рождения:</span>
                            <span className="info-value">{formatDate(patient.birthDate, 'long')}</span>
                        </div>

                        <div className="info-row">
                            <span className="info-label">Возраст:</span>
                            <span className="info-value">{calculateAge(patient.birthDate, 'full')}</span>
                        </div>

                        <div className="info-row">
                            <span className="info-label">Пол:</span>
                            <span className="info-value">
                                {patient.gender === 'male' ? 'Мужской' : 'Женский'}
                            </span>
                        </div>

                        {patient.birthWeight && (
                            <div className="info-row">
                                <span className="info-label">Вес при рождении:</span>
                                <span className="info-value">{formatWeight(patient.birthWeight)}</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* Информация о выдаче */}
                <section className="issue-info avoid-break">
                    <div className="info-row">
                        <span className="info-label">Дата выдачи:</span>
                        <span className="info-value">{formatDate(issueDate, 'full')}</span>
                    </div>
                </section>

                {/* Подпись места для печати (Версия 1) */}
                <div className="signature-block print-only">
                    <div className="stamp-area">
                        <p>М.П.</p>
                    </div>
                    <div className="signature-line">
                        <p>Подпись врача: _______________________</p>
                    </div>
                </div>
            </div>

            {/* Разрыв страницы */}
            <div className="page-break"></div>

            {/* График плановых прививок (Теперь сверху для наглядности) */}
            <div className="certificate-page page-2">
                <VaccinationTimeline plannedVaccinations={plannedVaccinations} />
            </div>

            {/* Разрыв страницы */}
            <div className="page-break"></div>

            {/* Выполненные прививки */}
            <div className="certificate-page page-3">
                <h2 className="page-title">Выполненные прививки</h2>
                <CompletedVaccinationsTable
                    vaccinations={completedVaccinations}
                    groupByType={data.groupByVaccineType}
                />
            </div>

            {/* Футер на каждой странице (только для печати) */}
            <footer className="certificate-footer print-only">
                <div className="footer-content">
                    <div className="footer-left">
                        <p>{patient.surname} {patient.name[0]}.</p>
                    </div>
                    <div className="footer-center">
                        <p>Сертификат № {certificateNumber || '—'}</p>
                    </div>
                    <div className="footer-right">
                        <p>{formatDate(issueDate)}</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};
