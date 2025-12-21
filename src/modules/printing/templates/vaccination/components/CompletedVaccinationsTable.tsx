import React from 'react';
import { CompletedVaccination } from '../types';
import { formatDate, valueOrDash } from '../../../utils/formatters';
import '../VaccinationCertificate.css';

interface CompletedVaccinationsTableProps {
    vaccinations: CompletedVaccination[];
    groupByType?: boolean;
}

/**
 * Группирует вакцинации по типу вакцины
 */
function groupVaccinations(vaccinations: CompletedVaccination[]): Map<string, CompletedVaccination[]> {
    const groups = new Map<string, CompletedVaccination[]>();

    vaccinations.forEach(vac => {
        const existing = groups.get(vac.vaccineName) || [];
        existing.push(vac);
        groups.set(vac.vaccineName, existing);
    });

    return groups;
}

/**
 * Таблица выполненных прививок
 */
export const CompletedVaccinationsTable: React.FC<CompletedVaccinationsTableProps> = ({
    vaccinations,
    groupByType = true,
}) => {
    if (vaccinations.length === 0) {
        return (
            <div className="no-vaccinations">
                <p>Прививки не выполнены</p>
            </div>
        );
    }

    // Сортируем по дате
    const sorted = [...vaccinations].sort((a, b) => {
        return new Date(a.completedDate).getTime() - new Date(b.completedDate).getTime();
    });

    if (groupByType) {
        const grouped = groupVaccinations(sorted);

        return (
            <div className="vaccinations-table-container">
                {Array.from(grouped.entries()).map(([vaccineName, vacs]) => (
                    <div key={vaccineName} className="vaccine-group avoid-break">
                        <h3 className="vaccine-group-title">{vaccineName}</h3>
                        <table className="vaccinations-table">
                            <thead>
                                <tr>
                                    <th>Дата</th>
                                    <th>Доза</th>
                                    <th>Препарат / Производитель</th>
                                    <th>Серия / Срок</th>
                                    <th>Медучреждение</th>
                                    <th>Примечания</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vacs.map((vac, idx) => (
                                    <tr key={`${vac.vaccineId}-${vac.completedDate}-${idx}`}>
                                        <td>{formatDate(vac.completedDate)}</td>
                                        <td>
                                            {vac.doseNumber || valueOrDash(vac.dose)}
                                            {vac.dose && <span className="unit-text mx-0.5">{vac.vaccineId === 'ats-sos' ? 'МЕ' : 'мл'}</span>}
                                        </td>
                                        <td>
                                            {valueOrDash(vac.vaccineBrand)}
                                            {vac.manufacturer && <div className="sub-text">Пр-во: {vac.manufacturer}</div>}
                                        </td>
                                        <td>
                                            {valueOrDash(vac.series)}
                                            {vac.expiryDate && <div className="sub-text">годн. до {formatDate(vac.expiryDate)}</div>}
                                        </td>
                                        <td>{valueOrDash(vac.clinic)}</td>
                                        <td className="notes-cell">{valueOrDash(vac.notes)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        );
    }

    // Без группировки - одна большая таблица
    return (
        <div className="vaccinations-table-container">
            <table className="vaccinations-table">
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Наименование</th>
                        <th>Препарат / Производитель</th>
                        <th>Серия / Срок</th>
                        <th>Доза</th>
                        <th>Медучреждение</th>
                        <th>Примечания</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((vac, idx) => (
                        <tr key={`${vac.vaccineId}-${vac.completedDate}-${idx}`} className="avoid-break">
                            <td>{formatDate(vac.completedDate)}</td>
                            <td>{vac.vaccineName}</td>
                            <td>
                                {valueOrDash(vac.vaccineBrand)}
                                {vac.manufacturer && <div className="sub-text">Пр-во: {vac.manufacturer}</div>}
                            </td>
                            <td>
                                {valueOrDash(vac.series)}
                                {vac.expiryDate && <div className="sub-text">годн. до {formatDate(vac.expiryDate)}</div>}
                            </td>
                            <td>
                                {valueOrDash(vac.dose)}
                                {vac.dose && <span className="unit-text mx-0.5">{vac.vaccineId === 'ats-sos' ? 'МЕ' : 'мл'}</span>}
                            </td>
                            <td>{valueOrDash(vac.clinic)}</td>
                            <td className="notes-cell">{valueOrDash(vac.notes)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
