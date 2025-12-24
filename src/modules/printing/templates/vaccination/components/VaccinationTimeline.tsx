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

// Определение возрастных интервалов (столбцов)
const AGE_INTERVALS = [
    { label: '0 дн.', months: 0 },
    { label: '3-5 дн.', months: 0.1 },
    { label: '1 мес.', months: 1 },
    { label: '2 мес.', months: 2 },
    { label: '3 мес.', months: 3 },
    { label: '4.5 мес.', months: 4.5 },
    { label: '6 мес.', months: 6 },
    { label: '12 мес.', months: 12 },
    { label: '15 мес.', months: 15 },
    { label: '18 мес.', months: 18 },
    { label: '20 мес.', months: 20 },
    { label: '6 лет', months: 72 },
    { label: '7 лет', months: 84 },
    { label: '14 лет', months: 168 },
];

/**
 * График плановых прививок (Визуальный календарь)
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

    return (
        <div className="vaccination-timeline">
            <h2 className="timeline-title">Календарь профилактических прививок (План)</h2>

            <div className="timeline-legend avoid-break">
                <div className="legend-item">
                    <span className="legend-icon">⏰</span>
                    <span className="legend-text">Запланировано</span>
                </div>
                <div className="legend-item">
                    <span className="legend-icon">🔔</span>
                    <span className="legend-text">Срок подошел</span>
                </div>
                <div className="legend-item">
                    <span className="legend-icon">❗</span>
                    <span className="legend-text">Просрочено</span>
                </div>
            </div>

            {/* Group cards into rows of 4 for proper page break handling */}
            {(() => {
                // Filter out intervals with no vaccines
                const cardsData = AGE_INTERVALS
                    .map((interval) => {
                        const vaccinesInInterval = plannedVaccinations.filter(v => {
                            const age = v.ageInMonths || 0;
                            if (interval.months === 0) return age === 0;
                            if (interval.months === 0.1) return age > 0 && age < 1;
                            return Math.abs(age - interval.months) < 0.3;
                        });
                        if (vaccinesInInterval.length === 0) return null;
                        return { interval, vaccinesInInterval };
                    })
                    .filter(Boolean) as { interval: { label: string; months: number }; vaccinesInInterval: PlannedVaccination[] }[];

                // Split into rows of 4
                const rows: typeof cardsData[] = [];
                for (let i = 0; i < cardsData.length; i += 4) {
                    rows.push(cardsData.slice(i, i + 4));
                }

                return rows.map((row, rowIndex) => (
                    <div key={`row-${rowIndex}`} className="timeline-row">
                        {row.map(({ interval, vaccinesInInterval }) => (
                            <div key={interval.label} className="month-card">
                                <div className="month-card-header">
                                    <span className="month-label">{interval.label}</span>
                                </div>
                                <div className="month-card-body">
                                    {vaccinesInInterval.map((vac, idx) => (
                                        <div
                                            key={`${vac.vaccineId}-${idx}`}
                                            className={`vaccine-chip ${getStatusClass(vac.status)}`}
                                        >
                                            <div className="chip-header">
                                                <span className="chip-name">{vac.vaccineName}</span>
                                                <span className="chip-icon">{getStatusIcon(vac.status)}</span>
                                            </div>
                                            <div className="chip-date">
                                                {formatDate(vac.recommendedDate)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ));
            })()}

            <p className="sub-text" style={{ marginTop: '15px', textAlign: 'center' }}>
                * Календарь сформирован автоматически на основе текущего профиля пациента.
            </p>
        </div>
    );
};
