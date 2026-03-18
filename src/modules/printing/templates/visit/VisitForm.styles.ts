export const visitFormStyles = `
/* Стили для печатной формы приема 025/у-04 */

.visit-form-print {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.4;
    color: #000;
    background: #fff;
    padding: 15mm;
    max-width: 210mm;
    margin: 0 auto;
}

/* Шапка документа */
.header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 2px solid #000;
}

.header-left {
    text-align: left;
}

.header-right {
    text-align: right;
}

.clinic-name {
    font-weight: bold;
    font-size: 14pt;
    margin-bottom: 4px;
}

.clinic-address,
.clinic-phone {
    font-size: 10pt;
    color: #333;
}

.form-number {
    font-weight: bold;
    font-size: 10pt;
    margin-bottom: 4px;
}

.form-title {
    font-weight: bold;
    font-size: 16pt;
    text-transform: uppercase;
}

.form-subtitle {
    font-size: 12pt;
    font-style: italic;
}

/* Информация о визите */
.visit-info {
    margin-bottom: 15px;
    padding: 10px;
    background: #f8f8f8;
    border: 1px solid #ddd;
}

/* Секции */
.section {
    margin-bottom: 15px;
    page-break-inside: avoid;
}

.section-title {
    font-weight: bold;
    font-size: 13pt;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #999;
    text-transform: uppercase;
}

.section-content {
    padding-left: 10px;
    white-space: pre-wrap;
}

/* Ряды информации */
.info-row {
    margin-bottom: 5px;
}

.info-row .label {
    font-weight: bold;
    margin-right: 8px;
}

.info-row .value {
    font-weight: normal;
}

/* Данные пациента */
.patient-info {
    padding: 10px;
    background: #f5f5f5;
    border: 1px solid #ddd;
}

/* Антропометрия */
.anthropometry {
    display: flex;
    gap: 30px;
}

.anthro-item {
    display: inline-block;
}

.anthro-item .label {
    font-weight: bold;
}

/* Диагнозы */
.diagnoses {
    padding: 10px;
    background: #fafafa;
    border: 1px solid #ddd;
}

.diagnosis {
    margin-bottom: 8px;
}

.diagnosis.primary {
    font-weight: bold;
}

.diagnosis-label {
    font-weight: bold;
    margin-right: 8px;
}

.diagnosis-code {
    font-family: 'Courier New', monospace;
    background: #eee;
    padding: 2px 6px;
    margin-right: 10px;
    font-weight: bold;
}

.diagnosis-name {
    font-weight: normal;
}

.diagnosis-group {
    margin-top: 10px;
    padding-left: 15px;
}

.diagnosis-group .diagnosis-label {
    display: block;
    margin-bottom: 5px;
    font-style: italic;
}

/* Таблица назначений */
.prescriptions-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
}

.prescriptions-table th,
.prescriptions-table td {
    border: 1px solid #000;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
}

.prescriptions-table th {
    background: #f0f0f0;
    font-weight: bold;
    text-align: center;
}

.prescriptions-table td:first-child {
    text-align: center;
    width: 30px;
}

.dose-detail {
    font-size: 10pt;
    color: #555;
    margin-top: 4px;
}

/* Диагностические исследования */
.tests-group {
    margin-bottom: 10px;
}

.tests-subtitle {
    font-weight: bold;
    font-style: italic;
    margin-bottom: 5px;
}

.tests-list {
    margin: 0;
    padding-left: 25px;
}

.tests-list li {
    margin-bottom: 4px;
}

/* Рекомендации */
.recommendations-list {
    margin: 0;
    padding-left: 25px;
}

.recommendations-list li {
    margin-bottom: 8px;
    page-break-inside: avoid;
}

/* Подвал */
.footer {
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #999;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
}

.signature-block {
    text-align: center;
}

.signature-line {
    width: 150px;
    border-bottom: 1px solid #000;
    margin-bottom: 5px;
}

.signature-label {
    font-size: 10pt;
    color: #555;
}

.doctor-name {
    font-weight: bold;
    text-align: center;
}

.print-date {
    font-size: 10pt;
    color: #555;
    text-align: right;
}

/* Печатные стили */
@media print {
    .visit-form-print {
        padding: 0;
        margin: 0;
    }

    .section {
        page-break-inside: avoid;
    }

    .prescriptions-table {
        page-break-inside: avoid;
    }

    .footer {
        page-break-inside: avoid;
    }
}
`;

