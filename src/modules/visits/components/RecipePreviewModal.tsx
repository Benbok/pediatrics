import React, { useState, useMemo, useEffect } from 'react';
import { X, FileText, Printer, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ChildProfile, getFullName } from '../../../types';
import type { User } from '../../../types';
import { printService } from '../../printing';
import { Recipe107PrintData, RecipeItem, RecipeValidity } from '../../printing/templates/recipe/types';
import { organizationService } from '../../../services/organization.service';
import { getFormattedAge } from '../../../utils/ageUtils';
import { logger } from '../../../services/logger';

/** Константа: максимальное число Rp. на одной странице 107-1/у */
const MAX_RP_PER_PAGE = 6; // A4 альбомный: 3 слева + 3 справа

interface RecipePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Назначения из Visit.prescriptions */
    prescriptions: any[];
    /** Данные пациента */
    child: ChildProfile;
    /** Текущий пользователь (врач) */
    currentUser: User | null;
    /** Дата приема в формате ГГГГ-ММ-ДД */
    visitDate: string;
    /** Уже есть льготный рецепт в визите */
    defaultPreferential?: boolean;
}

/**
 * Форматирует дату из ГГГГ-ММ-ДД в ДД.ММ.ГГГГ для бланка
 */
function formatDateForRecipe(isoDate: string): string {
    if (!isoDate) return '';
    // Поддерживаем ISO YYYY-MM-DD
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return isoDate;
}

/**
 * Формирует строку Rp. из данных назначения
 * Формат: "Rp. {название} {концентрация/форма выпуска}"
 * Например: "Rp. Аугментин 200 мг+28.5 мг/5 мл"
 */
function buildRpLine(prescription: any): string {
    const name = prescription.name || 'Препарат';
    const concentration = prescription.formConcentration;
    if (concentration) {
        return `Rp. ${name} ${concentration}`;
    }
    return `Rp. ${name}`;
}

/**
 * Формирует строку D.S. из данных назначения
 * Формат: "D.S. {название}: {dosing}. Длительность: {duration}"
 * Например: "D.S. Аугментин: с 2 месяцев. Расчет по амоксициллину 20-45 мг/кг/сут в 2 приема. Длительность: 7 дней"
 */
/** Карта перевода английских типов форм выпуска в русские */
const FORM_TYPE_RU: Record<string, string> = {
    tablet:      'Таблетки',
    tablets:     'Таблетки',
    capsule:     'Капсулы',
    capsules:    'Капсулы',
    suspension:  'Суспензия',
    solution:    'Раствор',
    drops:       'Капли',
    injection:   'Раствор для инъекций',
    suppository: 'Суппозитории',
    suppositories: 'Суппозитории',
    powder:      'Порошок',
    granules:    'Гранулы',
    syrup:       'Сироп',
    gel:         'Гель',
    cream:       'Крем',
    ointment:    'Мазь',
    spray:       'Спрей',
    aerosol:     'Аэрозоль',
    patch:       'Пластырь',
};

function buildDsLine(prescription: any): string {
    // Форма выпуска: переводим английский ключ в русское название
    const rawFormType = (prescription.formType || '').trim();
    const formType = FORM_TYPE_RU[rawFormType.toLowerCase()] ?? rawFormType;
    const name = prescription.name || '';
    const prefix = formType || name;
    const ds = (prescription.dosing || '').trim();
    const duration = (prescription.duration || '').trim();

    const namePrefix = prefix ? `${prefix}: ` : '';

    if (ds && duration) {
        // Не дублируем длительность, если она уже есть в dosing
        const hasDuration = ds.toLowerCase().includes('длительн') || ds.includes(duration);
        if (hasDuration) {
            return `D.S. ${namePrefix}${ds}`;
        }
        return `D.S. ${namePrefix}${ds}. Длительность: ${duration}`;
    }
    if (ds) return `D.S. ${namePrefix}${ds}`;
    if (duration) return `D.S. ${namePrefix}Длительность: ${duration}`;
    return `D.S. ${namePrefix}`.trimEnd();
}

/**
 * Разбивает массив назначений на страницы по MAX_RP_PER_PAGE элементов
 */
function chunkPrescriptions<T>(items: T[], size: number): T[][] {
    const pages: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        pages.push(items.slice(i, i + size));
    }
    return pages;
}

/**
 * Модальное окно для создания и печати рецептурного бланка 107-1/у
 */
export const RecipePreviewModal: React.FC<RecipePreviewModalProps> = ({
    isOpen,
    onClose,
    prescriptions,
    child,
    currentUser,
    visitDate,
    defaultPreferential = false,
}) => {
    // Индексы выбранных назначений
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [validityPeriod, setValidityPeriod] = useState<RecipeValidity>('60days');
    const [customDays, setCustomDays] = useState<string>('');
    const [isPreferential, setIsPreferential] = useState(defaultPreferential);
    const [isPrinting, setIsPrinting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [orgName, setOrgName] = useState<string>('Медицинская организация');
    const [orgLoaded, setOrgLoaded] = useState(false);

    // Загружаем профиль организации при открытии
    useEffect(() => {
        if (!isOpen || orgLoaded) return;
        organizationService.getProfile().then(profile => {
            setOrgName(profile.name || 'Медицинская организация');
            setOrgLoaded(true);
        }).catch(err => {
            logger.warn('[RecipePreviewModal] Failed to load org profile', { error: err?.message });
            setOrgLoaded(true);
        });
    }, [isOpen, orgLoaded]);

    // При открытии — выбираем все назначения по умолчанию
    useEffect(() => {
        if (isOpen) {
            setSelectedIndices(new Set(prescriptions.map((_, i) => i)));
            setError(null);
        }
    }, [isOpen, prescriptions]);

    const toggleIndex = (idx: number) => {
        setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIndices.size === prescriptions.length) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(prescriptions.map((_, i) => i)));
        }
    };

    /** Выбранные назначения в порядке их индекса */
    const selectedPrescriptions = useMemo(
        () => prescriptions.filter((_, i) => selectedIndices.has(i)),
        [prescriptions, selectedIndices],
    );

    /** Количество страниц рецепта */
    const pageCount = useMemo(
        () => Math.max(1, Math.ceil(selectedPrescriptions.length / MAX_RP_PER_PAGE)),
        [selectedPrescriptions.length],
    );

    /** Дата выписки рецепта (= дата приёма, форматированная ДД.ММ.ГГГГ) */
    const issueDate = useMemo(() => formatDateForRecipe(visitDate), [visitDate]);

    /** Возраст пациента для рецепта */
    const ageText = useMemo(() => {
        if (!child?.birthDate) return undefined;
        return getFormattedAge(child.birthDate, new Date(visitDate), 'full') || undefined;
    }, [child?.birthDate, visitDate]);

    /** ФИО пациента: Фамилия И.О. */
    const patientFullName = useMemo(() => {
        if (!child) return '';
        const parts = [child.surname, child.name, child.patronymic].filter(Boolean);
        if (parts.length === 1) return parts[0];
        // Фамилия + инициалы
        const [surname, firstName, patronymic] = parts;
        const initials = [
            firstName ? `${firstName[0]}.` : '',
            patronymic ? `${patronymic[0]}.` : '',
        ].filter(Boolean).join('');
        return `${surname} ${initials}`.trim();
    }, [child]);

    /** ФИО врача: Фамилия И.О. */
    const doctorFullName = useMemo(() => getFullName(currentUser) || 'Врач', [currentUser]);

    const handlePrint = async () => {
        if (selectedPrescriptions.length === 0) {
            setError('Выберите хотя бы одно назначение для рецепта');
            return;
        }

        const customDaysNum = validityPeriod === 'custom' ? parseInt(customDays, 10) : undefined;
        if (validityPeriod === 'custom' && (!customDaysNum || customDaysNum < 1 || customDaysNum > 365)) {
            setError('Укажите корректное количество дней (1–365)');
            return;
        }

        setIsPrinting(true);
        setError(null);

        try {
            // Разбиваем назначения по страницам (до 3 на странице)
            const pages = chunkPrescriptions(selectedPrescriptions, MAX_RP_PER_PAGE);

            for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
                const pageItems = pages[pageIdx];

                const items: RecipeItem[] = pageItems.map(p => ({
                    rpLine: buildRpLine(p),
                    dsLine: buildDsLine(p),
                }));

                const printData: Recipe107PrintData = {
                    issueDate,
                    patient: {
                        fullName: patientFullName,
                        birthDate: formatDateForRecipe(child.birthDate),
                        ageText,
                    },
                    doctor: {
                        fullName: doctorFullName,
                    },
                    clinic: {
                        organizationStamp: orgName,
                    },
                    items,
                    validityPeriod,
                    customValidityDays: customDaysNum,
                    isPreferential,
                };

                const result = await printService.print(
                    'recipe-107',
                    printData,
                    {
                        title: `Рецепт 107-1/у — ${patientFullName} — ${issueDate}`,
                        createdAt: new Date(),
                        author: doctorFullName,
                        organization: orgName,
                    },
                );

                if (!result.success) {
                    setError(result.error || 'Ошибка при печати рецепта');
                    logger.error('[RecipePreviewModal] Print failed', { error: result.error, pageIdx });
                    break;
                }
            }

            logger.info('[RecipePreviewModal] Recipe printed', {
                pages: pages.length,
                count: selectedPrescriptions.length,
            });
        } catch (err: any) {
            logger.error('[RecipePreviewModal] Unexpected print error', { error: err?.message });
            setError('Не удалось напечатать рецепт');
        } finally {
            setIsPrinting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Заголовок */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                Рецепт 107-1/у
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Приказ МЗ РФ № 1094н от 24.11.2021
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Содержимое с прокруткой */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Выбор препаратов */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Выберите назначения
                            </h3>
                            <button
                                onClick={toggleAll}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                                {selectedIndices.size === prescriptions.length ? (
                                    <><CheckSquare className="w-3 h-3" /> Снять всё</>
                                ) : (
                                    <><Square className="w-3 h-3" /> Выбрать всё</>
                                )}
                            </button>
                        </div>

                        {prescriptions.length === 0 && (
                            <p className="text-sm text-slate-400 italic py-4 text-center">
                                В приёме нет назначений
                            </p>
                        )}

                        <div className="space-y-2">
                            {prescriptions.map((p, idx) => {
                                const isSelected = selectedIndices.has(idx);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => toggleIndex(idx)}
                                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                            isSelected
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="mt-0.5 flex-shrink-0">
                                                {isSelected ? (
                                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-slate-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                                    {p.name}
                                                </div>
                                                <div className="text-xs text-slate-500 truncate mt-0.5">
                                                    {p.dosing}
                                                    {p.duration ? ` · ${p.duration}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedPrescriptions.length > 0 && (
                            <p className="text-xs text-slate-400 mt-2 text-right">
                                {selectedPrescriptions.length} назн. →{' '}
                                <strong>{pageCount}</strong> лист(а) A4 (до 3+3 Rp. на листе)
                            </p>
                        )}
                    </div>

                    {/* Срок действия */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Срок действия рецепта
                        </h3>
                        <div className="flex gap-2 flex-wrap">
                            {([
                                { value: '60days' as RecipeValidity, label: '60 дней' },
                                { value: '1year' as RecipeValidity, label: 'До 1 года' },
                                { value: 'custom' as RecipeValidity, label: 'Другой' },
                            ] as const).map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setValidityPeriod(opt.value)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                                        validityPeriod === opt.value
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {validityPeriod === 'custom' && (
                            <div className="mt-2 flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={customDays}
                                    onChange={e => setCustomDays(e.target.value)}
                                    placeholder="Кол-во дней"
                                    className="w-36 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-500">дней</span>
                            </div>
                        )}
                    </div>

                    {/* Льготный рецепт */}
                    <div>
                        <button
                            onClick={() => setIsPreferential(prev => !prev)}
                            className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl border-2 transition-all ${
                                isPreferential
                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                            }`}
                        >
                            {isPreferential ? (
                                <CheckSquare className="w-5 h-5 flex-shrink-0" />
                            ) : (
                                <Square className="w-5 h-5 flex-shrink-0" />
                            )}
                            <div className="text-left">
                                <div className="font-semibold text-sm">Льготный рецепт</div>
                                <div className="text-xs opacity-70">
                                    Отметить бланк как льготный
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Ошибка */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl text-sm text-red-700 dark:text-red-400">
                            {error}
                        </div>
                    )}
                </div>

                {/* Кнопки */}
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 flex items-center justify-between gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isPrinting}>
                        Отмена
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handlePrint}
                        isLoading={isPrinting}
                        disabled={selectedPrescriptions.length === 0 || isPrinting}
                        className="flex items-center gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        Распечатать рецепт
                        {pageCount > 1 ? ` (${pageCount} стр.)` : ''}
                    </Button>
                </div>
            </div>
        </div>
    );
};
