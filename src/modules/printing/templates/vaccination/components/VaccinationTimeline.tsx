import React from 'react';
import { PlannedVaccination, PlannedVaccinationStatus } from '../types';
import { formatDate } from '../../../utils/formatters';
import '../VaccinationCertificate.css';

interface VaccinationTimelineProps {
    plannedVaccinations: PlannedVaccination[];
}

/**
 * Получает иконку статуса
 */
function getStatusIcon(status: PlannedVaccinationStatus): string {
    switch (status) {
        case 'planned':
            return '⏰';
        case 'due_now':
            return '🔔';
        case 'overdue':
            return '❗';
        default:
            return '📅';
    }
}

/**
 * Получает CSS класс для статуса
 */
function getStatusClass(status: PlannedVaccinationStatus): string {
    switch (status) {
        case 'planned':
            return 'status-planned';
        case 'due_now':
            return 'status-due';
        case 'overdue':
            return 'status-overdue';
        default:
            return '';
    }
}

/**
 * Получает текст статуса
 */
function getStatusText(status: PlannedVaccinationStatus): string {
    switch (status) {
        case 'planned':
            return 'Запланировано';
        case 'due_now':
            return 'Сейчас';
        case 'overdue':
            return 'Просрочено';
        default:
            return '';
    }
}

/**
 * График плановых прививок
 */
export const VaccinationTimeline: React.FC<VaccinationTimelineProps> = ({
    plannedVaccinations,
}) => {
    if (plannedVaccinations.length === 0) {
        return (
            <div className="timeline-empty">
                <p>Нет запланированных прививок</p>
            </div>
        );
    }

    // Разделяем на обязательные и рекомендованные
    const required = plannedVaccinations.filter(v => v.isRequired);
    const recommended = plannedVaccinations.filter(v => !v.isRequired);

    // Сортируем по дате
    const sortByDate = (a: PlannedVaccination, b: PlannedVaccination) => {
        return new Date(a.recommendedDate).getTime() - new Date(b.recommendedDate).getTime();
    };

    required.sort(sortByDate);
    recommended.sort(sortByDate);

    return (
        <div className="vaccination-timeline">
            <h2 className="timeline-title">График профилактических прививок</h2>

            {/* Легенда */}
            <div className="timeline-legend avoid-break">
                <div className="legend-item">
                    <span className="legend-icon">⏰</span>
                    <span className="legend-text">Запланировано</span>
                </div>
                <div className="legend-item">
                    <span className="legend-icon">🔔</span>
                    <span className="legend-text">Сейчас</span>
                </div>
                <div className="legend-item">
                    <span className="legend-icon">❗</span>
                    <span className="legend-text">Просрочено</span>
                </div>
            </div>

            {/* Обязательные прививки */}
            {required.length > 0 && (
                <div className="timeline-section avoid-break">
                    <h3 className="section-title">Обязательные прививки</h3>
                    <div className="timeline-items">
                        {required.map((vac, idx) => (
                            <div
                                key={`required-${vac.vaccineId}-${idx}`}
                                className={`timeline-item ${getStatusClass(vac.status)}`}
                            >
                                <div className="timeline-item-header">
                                    <span className="timeline-icon">{getStatusIcon(vac.status)}</span>
                                    <span className="timeline-vaccine-name">{vac.vaccineName}</span>
                                    <span className="timeline-status">{getStatusText(vac.status)}</span>
                                </div>
                                <div className="timeline-item-body">
                                    <div className="timeline-date">
                                        <strong>Дата:</strong> {formatDate(vac.recommendedDate)}
                                        {vac.ageInMonths !== undefined && (
                                            <span className="timeline-age"> ({vac.ageInMonths} мес.)</span>
                                        )}
                                    </div>
                                    {vac.description && (
                                        <div className="timeline-description">{vac.description}</div>
                                    )}
                                    {vac.alertMessage && (
                                        <div className="timeline-alert">{vac.alertMessage}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Рекомендованные прививки */}
            {recommended.length > 0 && (
                <div className="timeline-section avoid-break">
                    <h3 className="section-title">Рекомендованные прививки</h3>
                    <div className="timeline-items">
                        {recommended.map((vac, idx) => (
                            <div
                                key={`recommended-${vac.vaccineId}-${idx}`}
                                className={`timeline-item ${getStatusClass(vac.status)} recommended`}
                            >
                                <div className="timeline-item-header">
                                    <span className="timeline-icon">{getStatusIcon(vac.status)}</span>
                                    <span className="timeline-vaccine-name">{vac.vaccineName}</span>
                                    <span className="timeline-status">{getStatusText(vac.status)}</span>
                                </div>
                                <div className="timeline-item-body">
                                    <div className="timeline-date">
                                        <strong>Дата:</strong> {formatDate(vac.recommendedDate)}
                                        {vac.ageInMonths !== undefined && (
                                            <span className="timeline-age"> ({vac.ageInMonths} мес.)</span>
                                        )}
                                    </div>
                                    {vac.description && (
                                        <div className="timeline-description">{vac.description}</div>
                                    )}
                                    {vac.alertMessage && (
                                        <div className="timeline-alert">{vac.alertMessage}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
