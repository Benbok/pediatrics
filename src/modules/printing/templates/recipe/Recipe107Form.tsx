import React from 'react';
import { PrintTemplateProps } from '../../types';
import { Recipe107PrintData } from './types';

/** Вспомогательная функция: форматирует дату в "«ДД» месяц ГГГГ г." для бланка */
function formatRecipeDate(dateStr: string): { day: string; month: string; year: string } {
    const months = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    // Поддерживаем форматы: ДД.ММ.ГГГГ и ГГГГ-ММ-ДД
    let day: number, month: number, year: number;
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
    } else {
        const parts = dateStr.split('.');
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
    }
    return {
        day: String(day).padStart(2, '0'),
        month: months[month - 1] ?? '',
        year: String(year),
    };
}

/** Описание срока действия рецепта */
function formatValidity(
    period: Recipe107PrintData['validityPeriod'],
    customDays?: number,
): { label: string; custom: string } {
    if (period === '60days') return { label: '60 дней', custom: '' };
    if (period === '1year') return { label: 'до 1 года', custom: '' };
    if (period === 'custom' && customDays) return { label: '', custom: String(customDays) };
    return { label: '60 дней', custom: '' };
}

/**
 * Один блок Rp./D.S. на бланке
 */
const RpBlock: React.FC<{
    item: Recipe107PrintData['items'][number] | null;
    isEmpty?: boolean;
}> = ({ item, isEmpty }) => (
    <div className={isEmpty ? 'rp-block rp-block-empty' : 'rp-block'}>
        <div className="rp-price-row">руб.|коп.| Rp.</div>
        <div className="rp-line">{item?.rpLine ?? ''}</div>
        <div className="ds-line">{item?.dsLine ?? ''}</div>
    </div>
);

/**
 * Компонент шаблона рецептурного бланка 107-1/у
 * A4 альбомный: один лист = два одинаковых рецепта рядом, разделённых пунктиром.
 */
export const Recipe107Form: React.FC<PrintTemplateProps<Recipe107PrintData>> = ({ data }) => {
    const { issueDate, patient, doctor, clinic, items, validityPeriod, customValidityDays, isPreferential } = data;

    const date = formatRecipeDate(issueDate);
    const validity = formatValidity(validityPeriod, customValidityDays);

    // Левая колонка — позиции 1-3, правая — 4-6 (или пустые блоки)
    type Slot = Recipe107PrintData['items'][number] | null;
    const leftSlots: Slot[] = [items[0] ?? null, items[1] ?? null, items[2] ?? null];
    const rightSlots: Slot[] = [items[3] ?? null, items[4] ?? null, items[5] ?? null];

    /** Содержимое одной половины бланка */
    const RecipeColumn = ({ slots }: { slots: Slot[] }) => (
        <div className="recipe-page">
            {/* ── Верхняя шапка ── */}
            <div className="recipe-header">
                <div className="recipe-header-left">
                    <div>Министерство здравоохранения</div>
                    <div>Российской Федерации</div>
                    {isPreferential && (
                        <div className="medical-docs-label" style={{ marginTop: '1mm' }}>
                            Льготный рецепт
                        </div>
                    )}
                </div>
                <div className="recipe-header-right">
                    <div>Код формы по ОКУД</div>
                    {clinic.okudCode ? <div><strong>{clinic.okudCode}</strong></div> : <div>___________</div>}
                    <div>Код учреждения по ОКПО</div>
                    {clinic.okpoCode ? <div><strong>{clinic.okpoCode}</strong></div> : <div>___________</div>}
                    <div style={{ marginTop: '1mm' }} className="form-title">Медицинская документация</div>
                    <div className="form-title">Форма № 107-1/у</div>
                    <div>Утверждена приказом МЗ РФ</div>
                    <div>от 24 ноября 2021 г. № 1094н</div>
                </div>
            </div>

            {/* ── Штамп медицинской организации ── */}
            <div className="org-stamp-block">
                <div className="stamp-label">Наименование (штамп) медицинской организации</div>
                <div>{clinic.organizationStamp}</div>
            </div>

            {/* ── Штамп ИП (если указан) ── */}
            {clinic.ipStamp && (
                <div className="ip-stamp-block">
                    <div className="stamp-label">
                        Наименование (штамп) индивидуального предпринимателя
                    </div>
                    <div>{clinic.ipStamp}</div>
                </div>
            )}

            <hr className="divider" />

            {/* ── Заголовок «РЕЦЕПТ» ── */}
            <div className="recipe-title-block">
                <div className="recipe-title">РЕЦЕПТ</div>
                <div className="recipe-subtitle">(взрослый, детский – нужное подчеркнуть)</div>
                <div className="recipe-date-line">
                    «<span className="date-filled">{date.day}</span>»{' '}
                    <span className="date-filled">{date.month}</span>{' '}
                    {date.year}&nbsp;г.
                </div>
            </div>

            <hr className="divider" />

            {/* ── Данные пациента ── */}
            <div className="field-line">
                <span className="field-label">
                    Фамилия, инициалы имени и отчества пациента&nbsp;
                </span>
                <span className="field-value">{patient.fullName}</span>
            </div>
            <div className="field-line">
                <span className="field-label">Дата рождения&nbsp;</span>
                <span className="field-value">{patient.birthDate}</span>
                {patient.ageText && (
                    <span style={{ marginLeft: '3mm', fontStyle: 'italic', fontSize: '7.5pt' }}>
                        ({patient.ageText})
                    </span>
                )}
            </div>

            {/* ── ФИО врача ── */}
            <div className="field-line">
                <span className="field-label">
                    Фамилия, инициалы имени и отчества лечащего врача (фельдшера, акушерки)&nbsp;
                </span>
                <span className="field-value">{doctor.fullName}</span>
            </div>

            <hr className="divider" />

            {/* ── До трёх блоков Rp. ── */}
            {slots.map((slot, idx) => (
                <RpBlock key={idx} item={slot} isEmpty={slot === null} />
            ))}

            {/* ── Подпись врача + М.П. ── */}
            <div className="recipe-footer">
                <hr className="divider" />
                <div className="signature-row">
                    <div className="signature-block">
                        <div>Подпись и печать лечащего врача</div>
                        <div style={{ fontSize: '6.5pt' }}>(подпись фельдшера, акушерки)</div>
                        <div style={{ marginTop: '5mm', borderTop: '1px solid #000', width: '50mm' }} />
                    </div>
                    <div className="stamp-placeholder">М.П.</div>
                </div>

                {/* ── Срок действия ── */}
                <div className="validity-block">
                    Рецепт действителен в течение{' '}
                    {validity.label ? (
                        <span className="validity-underline">{validity.label}</span>
                    ) : (
                        <>
                            <span>60 дней, до 1 года (</span>
                            <span className="validity-underline">{validity.custom}</span>
                            <span>)</span>
                        </>
                    )}
                    <br />
                    <span className="validity-hint">(нужное подчеркнуть)</span>
                    <span style={{ marginLeft: '8mm', fontSize: '6.5pt' }}>
                        (указать количество дней)
                    </span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="recipe-sheet">
            {/* Левая половина: препараты 1-3 */}
            <RecipeColumn slots={leftSlots} />
            {/* Вертикальный пунктирный разделитель */}
            <div className="recipe-sheet-divider" />
            {/* Правая половина: препараты 4-6 (пустая, если ≤3 препаратов) */}
            <RecipeColumn slots={rightSlots} />
        </div>
    );
};
