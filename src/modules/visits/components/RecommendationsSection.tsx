import React, { useState, useCallback } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { AutoResizeTextarea } from '../../../components/ui/AutoResizeTextarea';
import {
    FileSignature,
    Save,
    FileText,
    BookOpen,
    Plus,
    Pencil,
    Trash2,
    Check,
    X
} from 'lucide-react';

interface RecommendationsSectionProps {
    items: string[];
    onChange: (items: string[]) => void;
    onOpenTemplateSelector: () => void;
    onOpenSaveTemplate: () => void;
    onOpenBrowser?: () => void;
    disabled?: boolean;
}

export const RecommendationsSection: React.FC<RecommendationsSectionProps> = ({
    items,
    onChange,
    onOpenTemplateSelector,
    onOpenSaveTemplate,
    onOpenBrowser,
    disabled = false,
}) => {
    const [newItemText, setNewItemText] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingText, setEditingText] = useState('');

    const handleAddItem = useCallback(() => {
        const trimmed = newItemText.trim();
        if (trimmed && !disabled) {
            onChange([...items, trimmed]);
            setNewItemText('');
        }
    }, [newItemText, items, onChange, disabled]);

    const handleRemoveItem = useCallback((index: number) => {
        if (!disabled) {
            onChange(items.filter((_, i) => i !== index));
        }
    }, [items, onChange, disabled]);

    const handleStartEdit = useCallback((index: number) => {
        if (!disabled) {
            setEditingIndex(index);
            setEditingText(items[index]);
        }
    }, [items, disabled]);

    const handleCancelEdit = useCallback(() => {
        setEditingIndex(null);
        setEditingText('');
    }, []);

    const handleSaveEdit = useCallback(() => {
        const trimmed = editingText.trim();
        if (trimmed && editingIndex !== null && !disabled) {
            const newItems = [...items];
            newItems[editingIndex] = trimmed;
            onChange(newItems);
        }
        handleCancelEdit();
    }, [editingText, editingIndex, items, onChange, disabled, handleCancelEdit]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleAddItem();
        }
    }, [handleAddItem]);

    const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    }, [handleSaveEdit, handleCancelEdit]);

    return (
        <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileSignature className="w-5 h-5 text-indigo-500" />
                    Рекомендации
                </h2>
                <div className="flex gap-2">
                    {onOpenBrowser && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onOpenBrowser}
                            className="text-xs"
                            title="Открыть справочник рекомендаций"
                            disabled={disabled}
                        >
                            <BookOpen className="w-3 h-3 mr-1" />
                            Справочник
                        </Button>
                    )}
                    {items.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onOpenSaveTemplate}
                            className="text-xs"
                            title="Сохранить текущие рекомендации как шаблон"
                            disabled={disabled}
                        >
                            <Save className="w-3 h-3 mr-1" />
                            Сохранить шаблон
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onOpenTemplateSelector}
                        className="text-xs"
                        title="Выбрать сохраненный шаблон"
                        disabled={disabled}
                    >
                        <FileText className="w-3 h-3 mr-1" />
                        Выбрать шаблон
                    </Button>
                </div>
            </div>

            {/* Items List */}
            <div className="space-y-2 mb-4">
                {items.map((item, idx) => (
                    <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-start gap-3 group transition-all"
                    >
                        {editingIndex === idx ? (
                            // Edit mode
                            <>
                                <FileSignature className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-2" />
                                <AutoResizeTextarea
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    onKeyDown={handleEditKeyDown}
                                    rows={3}
                                    className="flex-1 resize-y bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    autoFocus
                                />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSaveEdit}
                                    className="text-green-500 hover:text-green-600 p-1"
                                    title="Сохранить"
                                >
                                    <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="text-slate-400 hover:text-slate-600 p-1"
                                    title="Отмена"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </>
                        ) : (
                            // Display mode
                            <>
                                <FileSignature className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                <span className="flex-1 text-sm text-slate-800 dark:text-white whitespace-pre-wrap">
                                    {item}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStartEdit(idx)}
                                    className="text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    title="Редактировать"
                                    disabled={disabled}
                                >
                                    <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(idx)}
                                    className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    title="Удалить"
                                    disabled={disabled}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </>
                        )}
                    </div>
                ))}

                {items.length === 0 && (
                    <div className="text-center py-6 text-slate-400 italic">
                        Добавьте рекомендации или загрузите шаблон
                    </div>
                )}
            </div>

            {/* Add new item */}
            <div className="flex items-end gap-2">
                <AutoResizeTextarea
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Введите рекомендацию..."
                    rows={3}
                    className="flex-1 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    disabled={disabled}
                />
                <Button
                    variant="primary"
                    onClick={handleAddItem}
                    disabled={!newItemText.trim() || disabled}
                    className="px-4"
                    title="Добавить рекомендацию"
                >
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
        </Card>
    );
};
