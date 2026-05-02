/**
 * CSS-стили для печатного бланка рецепта 107-1/у
 * A4 альбомный: один лист = 2 рецепта рядом, разделённых пунктиром по центру.
 * Стандарт: Приказ МЗ РФ № 1094н от 24.11.2021
 */
export const recipe107Styles = `
/* ── Reset ── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ── Страница A4 альбомная ── */
@page {
  size: A4 landscape;
  margin: 6mm 8mm 6mm 8mm;
}

body {
  font-family: 'Times New Roman', Times, serif;
  font-size: 9pt;
  color: #000;
  background: #fff;
  /* A4 landscape ≈ 297 × 210 мм; минус поля 8+8 = 281мм */
  width: 281mm;
}

/* ── Обёртка одного листа A4 (два рецепта рядом) ── */
.recipe-sheet {
  display: flex;
  flex-direction: row;
  width: 281mm;
  min-height: 198mm;
  page-break-after: always;
  position: relative;
}

.recipe-sheet:last-child {
  page-break-after: auto;
}

/* ── Левый и правый рецепт ── */
.recipe-page {
  width: 50%;
  min-height: 198mm;
  padding: 4mm 6mm;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ── Вертикальный пунктирный разделитель по центру листа ── */
.recipe-sheet-divider {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1.5px dashed #555;
  transform: translateX(-50%);
  pointer-events: none;
}

/* ── «Линия разреза» — подпись над пунктиром ── */
.recipe-sheet-divider::before {
  content: '✂';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10pt;
  color: #666;
  line-height: 1;
}

/* ── Верхняя шапка (двухколонная) ── */
.recipe-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 7pt;
  margin-bottom: 2mm;
}

.recipe-header-left {
  width: 54%;
  padding-right: 3mm;
}

.recipe-header-right {
  width: 44%;
  text-align: right;
  font-size: 6.5pt;
  line-height: 1.3;
}

.recipe-header-right .form-title {
  font-weight: bold;
  font-size: 7pt;
}

/* ── Метка льготного ── */
.medical-docs-label {
  font-size: 7pt;
  margin-bottom: 1mm;
}

/* ── Штамп организации ── */
.org-stamp-block {
  border: 1px solid #000;
  min-height: 13mm;
  padding: 1.5mm 2mm;
  font-size: 7.5pt;
  line-height: 1.4;
  margin-bottom: 1mm;
  width: 58%;
}

.ip-stamp-block {
  border: 1px solid #000;
  min-height: 11mm;
  padding: 1.5mm 2mm;
  font-size: 7pt;
  line-height: 1.4;
  margin-bottom: 1.5mm;
  width: 58%;
}

.stamp-label {
  font-size: 6pt;
  color: #444;
  margin-bottom: 0.5mm;
}

/* ── Горизонтальный пунктирный разделитель ── */
.divider {
  border: none;
  border-top: 1px dashed #000;
  margin: 1.5mm 0;
  width: 100%;
}

/* ── Заголовок «РЕЦЕПТ» ── */
.recipe-title-block {
  text-align: center;
  margin: 1.5mm 0;
}

.recipe-title {
  font-size: 13pt;
  font-weight: bold;
  letter-spacing: 1px;
}

.recipe-subtitle {
  font-size: 7pt;
  font-style: italic;
}

.recipe-date-line {
  font-size: 9pt;
  margin-top: 1mm;
  text-align: center;
}

.date-filled {
  font-weight: bold;
  text-decoration: underline;
}

/* ── Поля пациента и врача ── */
.field-line {
  font-size: 8pt;
  margin-bottom: 1.5mm;
  border-bottom: 1px solid #000;
  padding-bottom: 0.8mm;
  line-height: 1.4;
}

.field-label {
  font-size: 7pt;
}

.field-value {
  font-weight: bold;
}

/* ── Блоки Rp./D.S. ── */
.rp-block {
  margin-bottom: 1.5mm;
  padding-top: 0.5mm;
}

.rp-price-row {
  font-size: 7pt;
  color: #444;
  margin-bottom: 0.5mm;
}

.rp-line {
  font-size: 8.5pt;
  font-style: italic;
  border-bottom: 1px dotted #999;
  padding-bottom: 0.5mm;
  margin-bottom: 1mm;
  min-height: 6mm;
  line-height: 1.4;
}

.ds-line {
  font-size: 8.5pt;
  font-style: italic;
  border-bottom: 1px dotted #999;
  padding-bottom: 0.5mm;
  min-height: 7mm;
  line-height: 1.4;
}

/* ── Пустой Rp. ── */
.rp-block-empty .rp-line,
.rp-block-empty .ds-line {
  min-height: 6mm;
  border-bottom: 1px dotted #ccc;
}

/* ── Нижняя часть: подпись + срок ── */
.recipe-footer {
  margin-top: auto;
  padding-top: 2mm;
}

.signature-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 1.5mm;
}

.signature-block {
  font-size: 7pt;
  line-height: 1.4;
  width: 65%;
}

.stamp-placeholder {
  width: 30%;
  text-align: right;
  font-size: 9pt;
  font-weight: bold;
}

.validity-block {
  text-align: center;
  font-size: 7pt;
  border-top: 1px solid #000;
  padding-top: 1mm;
  line-height: 1.4;
}

.validity-underline {
  text-decoration: underline;
  font-weight: bold;
}

.validity-hint {
  font-size: 6pt;
  color: #444;
}

/* ── Печать ── */
@media print {
  body {
    background: white;
  }
}
`;
