import React, { useState, useEffect } from 'react';
import { X, Microscope, Save, Plus, Trash2, GripVertical, FlaskConical, FileBarChart } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { DiagnosticTemplate, DiagnosticPlanItem } from '../../../types';
import { diagnosticTemplateService } from '../services/diagnosticTemplateService';
import { logger } from '../../../services/logger';

interface DiagnosticTemplateBatchEditorProps {
    isOpen: boolean;
    onClose: () => void;
    template: DiagnosticTemplate;
    onSave: (updated: DiagnosticTemplate) => void;
    userId: number;
}

export const DiagnosticTemplateBatchEditor: React.FC<DiagnosticTemplateBatchEditorProps> = ({
    isOpen,
    onClose,
    template,
    onSave,
    userId,
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [items, setItems] = useState<DiagnosticPlanItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && template) {
            setName(template.name);
            setDescription(template.description || '');
            setItems(diagnosticTemplateService.parseItems(template.items));
            setError(null);
        }
    }, [isOpen, template]);

    const handleAddItem = () => {
        setItems(prev => [...prev, {
            type: 'lab',
            test: '',
            priority: 'medium',
            rationale: null
        }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: keyof DiagnosticPlanItem, value: any) => {
        setItems(prev => prev.map((item, i) => 
            i === index ? { ...item, [field]: value } : item
        ));
    };

    const handleMoveItem = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= items.length) return;
        
        setItems(prev => {
            const newItems = [...prev];
            const [removed] = newItems.splice(fromIndex, 1);
            newItems.splice(toIndex, 0, removed);
            return newItems;
        });
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Название шаблона обязательно');
            return;
        }

        const validItems = items.filter(item => item.test.trim());
        if (validItems.length === 0) {
            setError('Добавьте хотя бы одно исследование');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const updated: DiagnosticTemplate = {
                ...template,
                name: name.trim(),
                description: description.trim() || null,
                items: validItems,
            };

            await diagnosticTemplateService.upsert(updated);
            onSave(updated);
            handleClose();
        } catch (err: any) {
            logger.error('[DiagnosticTemplateBatchEditor] Failed to save template', { error: err });
            setError(err.message || 'Не удалось сохранить шаблон');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setName('');
        setDescription('');
        setItems([]);
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={handleClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 bg-blue-50 dark:bg-blue-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl">
                            <Microscope className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                Редактировать шаблон диагностики
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Измените содержимое шаблона
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl">
                            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Template Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Название шаблона *
                            </label>
                            <Input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Название шаблона"
                                className="w-full"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Описание
                            </label>
                            <Input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Краткое описание"
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Исследования ({items.length})
                            </h4>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleAddItem}
                                className="text-blue-600"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Добавить
                            </Button>
                        </div>

                        {items.length === 0 ? (
                            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                <p className="text-slate-500 dark:text-slate-400">
                                    Нет исследований. Нажмите "Добавить" для добавления.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {items.map((item, index) => (
                                    <div
                                        key={index}
                                        className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Move handles */}
                                            <div className="flex flex-col gap-1 pt-2">
                                                <button
                                                    onClick={() => handleMoveItem(index, index - 1)}
                                                    disabled={index === 0}
                                                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                                >
                                                    <GripVertical className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="flex-1 space-y-3">
                                                {/* Row 1: Type and Test Name */}
                                                <div className="flex gap-3">
                                                    <div className="w-40">
                                                        <select
                                                            value={item.type}
                                                            onChange={(e) => handleItemChange(index, 'type', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                                        >
                                                            <option value="lab">
                                                                Лабораторное
                                                            </option>
                                                            <option value="instrumental">
                                                                Инструментальное
                                                            </option>
                                                        </select>
                                                    </div>
                                                    <div className="flex-1">
                                                        <Input
                                                            type="text"
                                                            value={item.test}
                                                            onChange={(e) => handleItemChange(index, 'test', e.target.value)}
                                                            placeholder="Название исследования"
                                                            className="w-full"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Row 2: Priority and Rationale */}
                                                <div className="flex gap-3">
                                                    <div className="w-40">
                                                        <select
                                                            value={item.priority || 'medium'}
                                                            onChange={(e) => handleItemChange(index, 'priority', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                                        >
                                                            <option value="high">Высокий</option>
                                                            <option value="medium">Средний</option>
                                                            <option value="low">Низкий</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex-1">
                                                        <Input
                                                            type="text"
                                                            value={item.rationale || ''}
                                                            onChange={(e) => handleItemChange(index, 'rationale', e.target.value || null)}
                                                            placeholder="Обоснование (опционально)"
                                                            className="w-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Delete button */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveItem(index)}
                                                className="text-slate-400 hover:text-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        className="min-w-[120px]"
                        disabled={isSaving}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        className="min-w-[120px]"
                        disabled={isSaving || !name.trim()}
                    >
                        {isSaving ? 'Сохранение...' : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                Сохранить
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
