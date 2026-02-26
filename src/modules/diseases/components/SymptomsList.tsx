import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { X, ChevronDown, Pencil, Check } from 'lucide-react';
import { CategorizedSymptom, SymptomCategory } from '../../../types';
import { clsx } from 'clsx';

interface SymptomsListProps {
    symptoms: CategorizedSymptom[];
    onRemove?: (symptom: CategorizedSymptom) => void;
    onCategoryChange?: (symptomText: string, category: SymptomCategory) => void;
    onUpdate?: (oldText: string, newText: string, newCategory: SymptomCategory) => void;
    onError?: (message: string) => void;
    editable?: boolean;
}

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
    other: {
        label: 'Другое',
        color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700',
        icon: '📋',
    },
};

const CATEGORIES: SymptomCategory[] = ['clinical', 'physical', 'other'];

export const SymptomsList: React.FC<SymptomsListProps> = ({
    symptoms,
    onRemove,
    onCategoryChange,
    onUpdate,
    onError,
    editable = false,
}) => {
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [dropdownAnchor, setDropdownAnchor] = useState<DOMRect | null>(null);
    const [editingSymptom, setEditingSymptom] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [editCategory, setEditCategory] = useState<SymptomCategory>('other');

    const closeDropdown = () => {
        setActiveDropdown(null);
        setDropdownAnchor(null);
    };

    useEffect(() => {
        if (!activeDropdown) return;
        const onScroll = () => closeDropdown();
        window.addEventListener('scroll', onScroll, true);
        return () => window.removeEventListener('scroll', onScroll, true);
    }, [activeDropdown]);

    const startEdit = (symptom: CategorizedSymptom) => {
        setEditingSymptom(symptom.text);
        setEditText(symptom.text);
        setEditCategory(symptom.category);
        closeDropdown();
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
    };

    const groupedSymptoms = symptoms.reduce(
        (acc, symptom) => {
            const category = symptom.category || 'other';
            if (!acc[category]) acc[category] = [];
            acc[category].push(symptom);
            return acc;
        },
        {} as Record<SymptomCategory, CategorizedSymptom[]>
    );

    return (
        <div className="space-y-6">
            {CATEGORIES.map((category) => {
                const categorySymptoms = groupedSymptoms[category] || [];
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
                                <div key={`${symptom.text}-${idx}`} className="relative" data-symptom-dropdown-anchor>
                                    {editingSymptom === symptom.text ? (
                                        <div className="flex items-center gap-2 p-2 rounded-xl border-2 border-primary-500 bg-white dark:bg-slate-900 shadow-lg">
                                            <Input
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        saveEdit(symptom.text);
                                                    } else if (e.key === 'Escape') {
                                                        cancelEdit();
                                                    }
                                                }}
                                                className="h-8 min-w-[200px]"
                                                autoFocus
                                            />
                                            <select
                                                value={editCategory}
                                                onChange={(e) => setEditCategory(e.target.value as SymptomCategory)}
                                                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                                            >
                                                <option value="other">Другое</option>
                                                <option value="clinical">Клинические</option>
                                                <option value="physical">Физикальные</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => saveEdit(symptom.text)}
                                                className="p-1 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg transition-colors text-green-600"
                                                title="Сохранить"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={cancelEdit}
                                                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-600"
                                                title="Отменить"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <Badge
                                            className={clsx(
                                                'pl-3 pr-1 py-1.5 rounded-xl flex items-center gap-2 group border shadow-sm',
                                                config.color
                                            )}
                                        >
                                            <span>{symptom.text}</span>
                                            {editable && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(symptom)}
                                                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                                        title="Редактировать"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            if (activeDropdown === symptom.text) {
                                                                closeDropdown();
                                                                return;
                                                            }
                                                            const anchor = (e.currentTarget as HTMLElement).closest('[data-symptom-dropdown-anchor]') as HTMLElement;
                                                            setDropdownAnchor(anchor?.getBoundingClientRect() ?? null);
                                                            setActiveDropdown(symptom.text);
                                                        }}
                                                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                                        title="Изменить категорию"
                                                    >
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onRemove?.(symptom)}
                                                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                                        title="Удалить"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </Badge>
                                    )}

                                    {editable && activeDropdown === symptom.text && dropdownAnchor &&
                                        createPortal(
                                            <>
                                                <div
                                                    className="fixed inset-0 z-[100]"
                                                    onClick={closeDropdown}
                                                    aria-hidden
                                                />
                                                <div
                                                    className="fixed z-[101] bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden min-w-[180px]"
                                                    style={{
                                                        top: dropdownAnchor.bottom + 4,
                                                        left: dropdownAnchor.left,
                                                    }}
                                                >
                                                    {CATEGORIES.map((cat) => (
                                                        <button
                                                            key={cat}
                                                            type="button"
                                                            onClick={() => {
                                                                onCategoryChange?.(symptom.text, cat);
                                                                closeDropdown();
                                                            }}
                                                            className={clsx(
                                                                'w-full px-4 py-2 text-left text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2',
                                                                symptom.category === cat && 'bg-slate-100 dark:bg-slate-700'
                                                            )}
                                                        >
                                                            <span>{CATEGORY_CONFIG[cat].icon}</span>
                                                            <span>{CATEGORY_CONFIG[cat].label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>,
                                            document.body
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
