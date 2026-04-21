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

.body-content {
    font-size: 10pt;
    line-height: 1.35;
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

.body-content .section {
    margin-bottom: 14px;
    page-break-inside: avoid;
}

.body-content .section-title {
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

.body-content .section-content {
    padding-left: 12px;
    white-space: pre-wrap;
    font-size: 10.5pt;
}

/* ── СТРОКИ ИНФОРМАЦИИ ──────────────────────────────────── */

.body-content .info-row {
    margin-bottom: 4px;
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
}

.body-content .info-row .label {
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
}

.body-content .info-row .value {
    font-weight: 400;
}

/* ── ДАННЫЕ ПАЦИЕНТА ────────────────────────────────────── */

.body-content .patient-info {
    padding: 9px 12px;
    border: 1px solid #ccc;
    border-left: 4px solid #111;
}

.body-content .patient-info .info-row {
    margin-bottom: 4px;
}

/* ── АНАМНЕЗ ЖИЗНИ ──────────────────────────────────────── */

.body-content .section-content p {
    margin: 6px 0 2px 0;
    font-weight: 600;
}

.body-content .anamnesis-disease-content p {
    font-weight: 400;
}

.body-content .section-content ul {
    margin: 0 0 8px 0;
    padding-left: 20px;
}

.body-content .section-content ul li {
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

.body-content .diagnoses {
    border: 1px solid #ccc;
    border-left: 4px solid #111;
    padding: 9px 12px;
}

.body-content .diagnosis {
    margin-bottom: 6px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    flex-wrap: wrap;
}

.body-content .diagnosis.primary {
    font-weight: 600;
}

.body-content .diagnosis-label {
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
}

.body-content .diagnosis-code {
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

.body-content .diagnosis-name {
    font-weight: 400;
}

.body-content .diagnosis-group {
    margin-top: 8px;
    padding-left: 0;
    border-top: 1px dashed #ccc;
    padding-top: 6px;
}

.body-content .diagnosis-group .diagnosis-label {
    display: block;
    margin-bottom: 4px;
    font-style: normal;
}

/* ── ТАБЛИЦА НАЗНАЧЕНИЙ ─────────────────────────────────── */

.body-content .prescriptions-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
    font-size: 10.5pt;
}

.body-content .prescriptions-table th,
.body-content .prescriptions-table td {
    border: 1px solid #bbb;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
}

.body-content .prescriptions-table th {
    background: #f0f0f0;
    color: #111;
    font-weight: 700;
    font-size: 8.5pt;
    text-align: center;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.body-content .prescriptions-table tr:nth-child(even) td {
    background: #f7f7f7;
}

.body-content .prescriptions-table td:first-child {
    text-align: center;
    width: 28px;
    font-weight: 600;
    color: #555;
}

.body-content .dose-detail {
    font-size: 9pt;
    color: #666;
    margin-top: 3px;
    font-style: italic;
}

/* ── ДИАГНОСТИЧЕСКИЕ ИССЛЕДОВАНИЯ ───────────────────────── */

.body-content .tests-group {
    margin-bottom: 8px;
    padding-left: 12px;
}

.body-content .tests-subtitle {
    font-weight: 600;
    margin-bottom: 3px;
}

.body-content .tests-list {
    margin: 0;
    padding-left: 20px;
}

.body-content .tests-list li {
    margin-bottom: 3px;
}

/* ── РЕКОМЕНДАЦИИ ───────────────────────────────────────── */

.body-content .recommendations-list {
    margin: 0;
    padding-left: 22px;
}

.body-content .recommendations-list li {
    margin-bottom: 5px;
    page-break-inside: avoid;
}

/* ── ПОДВАЛ ─────────────────────────────────────────────── */

.body-content .footer {
    margin-top: 28px;
    padding: 9px 12px;
    border: 1px solid #ccc;
    border-left: 4px solid #111;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
}

.body-content .footer .info-row {
    margin-bottom: 0;
}

.body-content .signature-line {
    display: inline-block;
    width: 180px;
    border-bottom: 1px solid #111;
    transform: translateY(-2px);
}

.body-content .section {
    margin-bottom: 8px;
}

.body-content .section-title {
    font-size: 8pt;
    letter-spacing: 0.08em;
    padding: 2px 0;
    margin-bottom: 4px;
    border-bottom: 1px solid #111;
}

.body-content .section-content {
    padding-left: 6px;
    font-size: 9.5pt;
}

.body-content .info-row {
    margin-bottom: 2px;
    gap: 4px;
}

.body-content .patient-info {
    padding: 6px 8px;
    border-left-width: 3px;
}

.body-content .section-content p {
    margin: 3px 0 1px 0;
}

.body-content .section-content ul {
    margin: 0 0 4px 0;
    padding-left: 16px;
}

.body-content .section-content ul li {
    margin-bottom: 1px;
}

.body-content .diagnoses {
    padding: 6px 8px;
    border-left-width: 3px;
}

.body-content .diagnosis {
    margin-bottom: 3px;
    gap: 5px;
}

.body-content .diagnosis-group {
    margin-top: 4px;
    padding-top: 4px;
}

.body-content .prescriptions-table {
    margin-top: 4px;
    font-size: 9pt;
}

.body-content .prescriptions-table th,
.body-content .prescriptions-table td {
    padding: 3px 5px;
}

.body-content .prescriptions-table th {
    font-size: 7.5pt;
}

.body-content .dose-detail {
    font-size: 8pt;
    margin-top: 1px;
}

.body-content .tests-group {
    margin-bottom: 4px;
    padding-left: 6px;
}

.body-content .tests-subtitle {
    margin-bottom: 1px;
}

.body-content .tests-list {
    padding-left: 16px;
}

.body-content .tests-list li {
    margin-bottom: 1px;
}

.body-content .recommendations-list {
    padding-left: 18px;
}

.body-content .recommendations-list li {
    margin-bottom: 2px;
}

.body-content .footer {
    margin-top: 12px;
    padding: 6px 8px;
    gap: 10px;
    border-left-width: 3px;
}

.body-content .signature-line {
    width: 140px;
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


