export const visitFormStyles = `
/* ============================================================
   Печатная форма приёма — современный строгий стиль
   ============================================================ */

* {
    box-sizing: border-box;
}

.visit-form-print {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #111;
    background: #fff;
    padding: 14mm 18mm;
    max-width: 210mm;
    margin: 0 auto;
}

/* ── ШАПКА ─────────────────────────────────────────────── */

.header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 12px;
    margin-bottom: 18px;
    border-bottom: 3px solid #111;
}

.header-left {
    text-align: left;
    max-width: 60%;
}

.header-right {
    text-align: right;
    flex-shrink: 0;
}

.clinic-name {
    font-weight: 700;
    font-size: 13pt;
    letter-spacing: 0.01em;
    margin-bottom: 3px;
}

.clinic-address,
.clinic-phone {
    font-size: 9pt;
    color: #555;
    margin-top: 1px;
}

.form-number {
    font-size: 8pt;
    color: #777;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 4px;
}

.form-title {
    font-weight: 800;
    font-size: 14pt;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 2px;
}

.form-subtitle {
    font-size: 9.5pt;
    color: #555;
    font-style: normal;
}

/* ── ИНФОРМАЦИЯ О ВИЗИТЕ ────────────────────────────────── */

.visit-info {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 28px;
    margin-bottom: 18px;
    padding: 8px 12px;
    border-left: 4px solid #111;
    background: #f6f6f6;
}

.visit-info .info-row {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    margin-bottom: 0;
}

/* ── СЕКЦИИ ─────────────────────────────────────────────── */

.section {
    margin-bottom: 14px;
    page-break-inside: avoid;
}

.section-title {
    font-weight: 700;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #111;
    background: transparent;
    padding: 4px 0;
    margin-bottom: 8px;
    margin-left: 0;
    border-bottom: 2px solid #111;
}

.section-content {
    padding-left: 12px;
    white-space: pre-wrap;
    font-size: 10.5pt;
}

/* ── СТРОКИ ИНФОРМАЦИИ ──────────────────────────────────── */

.info-row {
    margin-bottom: 4px;
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
}

.info-row .label {
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
}

.info-row .value {
    font-weight: 400;
}

/* ── ДАННЫЕ ПАЦИЕНТА ────────────────────────────────────── */

.patient-info {
    padding: 9px 12px;
    border: 1px solid #ccc;
    border-left: 4px solid #111;
}

.patient-info .info-row {
    margin-bottom: 4px;
}

/* ── АНАМНЕЗ ЖИЗНИ ──────────────────────────────────────── */

.section-content p {
    margin: 6px 0 2px 0;
    font-weight: 600;
}

.anamnesis-disease-content p {
    font-weight: 400;
}

.section-content ul {
    margin: 0 0 8px 0;
    padding-left: 20px;
}

.section-content ul li {
    margin-bottom: 2px;
}

/* ── АНТРОПОМЕТРИЯ ──────────────────────────────────────── */

.anthropometry {
    display: flex;
    gap: 36px;
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-left: 4px solid #111;
}

.anthro-item {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
}

.anthro-item .label {
    font-weight: 600;
}

/* ── ДИАГНОЗЫ ───────────────────────────────────────────── */

.diagnoses {
    border: 1px solid #ccc;
    border-left: 4px solid #111;
    padding: 9px 12px;
}

.diagnosis {
    margin-bottom: 6px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    flex-wrap: wrap;
}

.diagnosis.primary {
    font-weight: 600;
}

.diagnosis-label {
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
}

.diagnosis-code {
    font-family: 'Courier New', monospace;
    font-size: 9pt;
    background: transparent;
    color: #111;
    border: 1px solid #111;
    padding: 1px 6px;
    font-weight: 700;
    white-space: nowrap;
    letter-spacing: 0.04em;
}

.diagnosis-name {
    font-weight: 400;
}

.diagnosis-group {
    margin-top: 8px;
    padding-left: 0;
    border-top: 1px dashed #ccc;
    padding-top: 6px;
}

.diagnosis-group .diagnosis-label {
    display: block;
    margin-bottom: 4px;
    font-style: normal;
}

/* ── ТАБЛИЦА НАЗНАЧЕНИЙ ─────────────────────────────────── */

.prescriptions-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
    font-size: 10.5pt;
}

.prescriptions-table th,
.prescriptions-table td {
    border: 1px solid #bbb;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
}

.prescriptions-table th {
    background: #f0f0f0;
    color: #111;
    font-weight: 700;
    font-size: 8.5pt;
    text-align: center;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.prescriptions-table tr:nth-child(even) td {
    background: #f7f7f7;
}

.prescriptions-table td:first-child {
    text-align: center;
    width: 28px;
    font-weight: 600;
    color: #555;
}

.dose-detail {
    font-size: 9pt;
    color: #666;
    margin-top: 3px;
    font-style: italic;
}

/* ── ДИАГНОСТИЧЕСКИЕ ИССЛЕДОВАНИЯ ───────────────────────── */

.tests-group {
    margin-bottom: 8px;
    padding-left: 12px;
}

.tests-subtitle {
    font-weight: 600;
    margin-bottom: 3px;
}

.tests-list {
    margin: 0;
    padding-left: 20px;
}

.tests-list li {
    margin-bottom: 3px;
}

/* ── РЕКОМЕНДАЦИИ ───────────────────────────────────────── */

.recommendations-list {
    margin: 0;
    padding-left: 22px;
}

.recommendations-list li {
    margin-bottom: 5px;
    page-break-inside: avoid;
}

/* ── ПОДВАЛ ─────────────────────────────────────────────── */

.footer {
    margin-top: 28px;
    padding: 9px 12px;
    border: 1px solid #ccc;
    border-left: 4px solid #111;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
}

.footer .info-row {
    margin-bottom: 0;
}

.signature-line {
    display: inline-block;
    width: 180px;
    border-bottom: 1px solid #111;
    transform: translateY(-2px);
}

/* ── ПЕЧАТНЫЕ СТИЛИ ─────────────────────────────────────── */

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

    .prescriptions-table th {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
}
`;


