import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { X, Check } from 'lucide-react';
import { CategorizedSymptom, SymptomCategory } from '../../../types';
import { clsx } from 'clsx';
import { PrettySelect, type SelectOption } from './PrettySelect';

interface SymptomsListProps {
    symptoms: CategorizedSymptom[];
    onRemove?: (symptom: CategorizedSymptom) => void;
    onCategoryChange?: (symptomText: string, category: SymptomCategory) => void;
    onUpdate?: (oldText: string, newText: string, newCategory: SymptomCategory) => void;
    onError?: (message: string) => void;
    editable?: boolean;
    showQuickFilters?: boolean;
}

type SymptomsFilter = 'all' | SymptomCategory;

const CATEGORY_CONFIG: Record<SymptomCategory, { label: string; color: string; icon: string }> = {
    clinical: {
        label: 'Клинические критерии',
        color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
        icon: '💬',
    },
    physical: {
        label: 'Физикальные критерии',
        color: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800',
        icon: '🩺',
    },
    laboratory: {
        label: 'Лабораторные критерии',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
        icon: '🧪',
    },
    other: {
        label: 'Другое',
        color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700',
        icon: '📋',
    },
};

const CATEGORIES: SymptomCategory[] = ['clinical', 'physical', 'laboratory', 'other'];
const CATEGORY_OPTIONS: Array<SelectOption<SymptomCategory>> = [
    { value: 'clinical', label: 'Клинические критерии' },
    { value: 'physical', label: 'Физикальные критерии' },
    { value: 'laboratory', label: 'Лабораторные критерии' },
    { value: 'other', label: 'Другое' },
];

export const SymptomsList: React.FC<SymptomsListProps> = ({
    symptoms,
    onRemove,
    onCategoryChange,
    onUpdate,
    onError,
    editable = false,
    showQuickFilters = false,
}) => {
    const [editingSymptom, setEditingSymptom] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [editCategory, setEditCategory] = useState<SymptomCategory>('other');
    const [activeFilter, setActiveFilter] = useState<SymptomsFilter>('all');
    const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (!editingSymptom || !editTextareaRef.current) return;

        editTextareaRef.current.style.height = '0px';
        editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
    }, [editingSymptom, editText]);

    const startEdit = (symptom: CategorizedSymptom) => {
        setEditingSymptom(symptom.text);
        setEditText(symptom.text);
        setEditCategory(symptom.category);
    };

    const saveEdit = (oldText: string) => {
        try {
            if (!editText.trim()) {
                onError?.('Текст симптома не может быть пустым');
                return;
            }
            onUpdate?.(oldText, editText.trim(), editCategory);
            setEditingSymptom(null);
        } catch {
            onError?.('Не удалось сохранить изменения');
        }
    };

    const cancelEdit = () => {
        setEditingSymptom(null);
        setEditText('');
        setEditCategory('other');
    };

    const groupedSymptoms = useMemo(
        () => symptoms.reduce(
            (acc, symptom) => {
                const category = symptom.category || 'other';
                if (!acc[category]) acc[category] = [];
                acc[category].push(symptom);
                return acc;
            },
            {} as Record<SymptomCategory, CategorizedSymptom[]>
        ),
        [symptoms]
    );

    const availableCategories = useMemo(
        () => CATEGORIES.filter((category) => (groupedSymptoms[category] || []).length > 0),
        [groupedSymptoms]
    );

    useEffect(() => {
        if (activeFilter === 'all') return;
        if (!availableCategories.includes(activeFilter)) {
            setActiveFilter('all');
        }
    }, [activeFilter, availableCategories]);

    const visibleSymptoms = useMemo(() => {
        if (activeFilter === 'all') return symptoms;
        return symptoms.filter((symptom) => (symptom.category || 'other') === activeFilter);
    }, [activeFilter, symptoms]);

    const visibleGroupedSymptoms = useMemo(
        () => visibleSymptoms.reduce(
            (acc, symptom) => {
                const category = symptom.category || 'other';
                if (!acc[category]) acc[category] = [];
                acc[category].push(symptom);
                return acc;
            },
            {} as Record<SymptomCategory, CategorizedSymptom[]>
        ),
        [visibleSymptoms]
    );

    return (
        <div className="space-y-6">
            {showQuickFilters && symptoms.length > 0 && availableCategories.length > 1 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.18em]">
                            Быстрый фильтр критериев
                        </h3>
                        <span className="text-xs text-slate-400">
                            Показано: {visibleSymptoms.length} из {symptoms.length}
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveFilter('all')}
                            className={clsx(
                                'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                                activeFilter === 'all'
                                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white'
                            )}
                            aria-pressed={activeFilter === 'all'}
                        >
                            <span>Все критерии</span>
                            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{symptoms.length}</span>
                        </button>

                        {availableCategories.map((category) => {
                            const config = CATEGORY_CONFIG[category];
                            const count = groupedSymptoms[category]?.length || 0;

                            return (
                                <button
                                    key={category}
                                    type="button"
                                    onClick={() => setActiveFilter(category)}
                                    className={clsx(
                                        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                                        activeFilter === category
                                            ? config.color
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white'
                                    )}
                                    aria-pressed={activeFilter === category}
                                >
                                    <span>{config.icon}</span>
                                    <span>{config.label}</span>
                                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {CATEGORIES.map((category) => {
                const categorySymptoms = visibleGroupedSymptoms[category] || [];
                if (categorySymptoms.length === 0) return null;

                const config = CATEGORY_CONFIG[category];

                return (
                    <div key={category} className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{config.icon}</span>
                            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                {config.label} ({categorySymptoms.length})
                            </h3>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {categorySymptoms.map((symptom, idx) => (
                                <div
                                    key={`${symptom.text}-${idx}`}
                                    className={clsx('relative min-w-0', editingSymptom === symptom.text && 'basis-full')}
                                >
                                    {editingSymptom === symptom.text ? (
                                        <div className="w-full rounded-2xl border-2 border-primary-500/70 bg-white dark:bg-slate-900 shadow-lg p-4 space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                                                    Формулировка критерия
                                                </label>
                                                <textarea
                                                    ref={editTextareaRef}
                                                    rows={3}
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                                            e.preventDefault();
                                                            saveEdit(symptom.text);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            cancelEdit();
                                                        }
                                                    }}
                                                    className="w-full min-h-[96px] resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-100 leading-6 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                    placeholder="Введите формулировку симптома или критерия"
                                                    autoFocus
                                                />
                                                <p className="text-xs text-slate-400">
                                                    `Ctrl+Enter` или `Cmd+Enter` сохранить, `Escape` отменить
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,280px)_auto] gap-3 items-end">
                                                <div className="space-y-2 min-w-0">
                                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                                                        Тип критерия
                                                    </label>
                                                    <PrettySelect
                                                        value={editCategory}
                                                        onChange={(value) => setEditCategory(value)}
                                                        options={CATEGORY_OPTIONS}
                                                        buttonClassName="h-11 rounded-xl px-4 font-medium"
                                                        useFixedPanel
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2 md:justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => saveEdit(symptom.text)}
                                                        className="inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white transition-colors"
                                                        title="Сохранить"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                        <span>Сохранить</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelEdit}
                                                        className="inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                                                        title="Отменить"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        <span>Отменить</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <Badge
                                            className={clsx(
                                                'max-w-full pl-3 pr-1 py-1.5 rounded-xl flex items-start gap-2 group border shadow-sm',
                                                editable && 'cursor-pointer hover:shadow-md hover:-translate-y-px transition-all',
                                                config.color
                                            )}
                                            onClick={editable ? () => startEdit(symptom) : undefined}
                                            onKeyDown={editable ? (event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    startEdit(symptom);
                                                }
                                            } : undefined}
                                            role={editable ? 'button' : undefined}
                                            tabIndex={editable ? 0 : undefined}
                                            aria-label={editable ? `Редактировать симптом ${symptom.text}` : undefined}
                                        >
                                            <span className="max-w-[min(100%,40rem)] whitespace-normal break-words leading-snug" title={symptom.text}>
                                                {symptom.text}
                                            </span>
                                            {editable && (
                                                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onRemove?.(symptom);
                                                        }}
                                                        onKeyDown={(event) => event.stopPropagation()}
                                                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                                        title="Удалить"
                                                        aria-label={`Удалить симптом ${symptom.text}`}
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {symptoms.length === 0 && (
                <p className="text-sm text-slate-400 italic">Симптомы еще не добавлены</p>
            )}
        </div>
    );
};
