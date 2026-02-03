import React, { useState, useEffect } from 'react';
import { X, FileSignature, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { RecommendationTemplate } from '../../../types';
import { recommendationTemplateService } from '../services/recommendationTemplateService';
import { logger } from '../../../services/logger';

interface CreateRecommendationTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    items: string[];
    userId: number;
    editTemplate?: RecommendationTemplate; // For editing existing template
}

export const CreateRecommendationTemplateModal: React.FC<CreateRecommendationTemplateModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    items,
    userId,
    editTemplate,
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditing = !!editTemplate;

    // Initialize form with edit template values if editing
    useEffect(() => {
        if (isOpen && editTemplate) {
            setName(editTemplate.name);
            setDescription(editTemplate.description || '');
        } else if (!isOpen) {
            setName('');
            setDescription('');
            setError(null);
        }
    }, [isOpen, editTemplate]);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Название шаблона обязательно');
            return;
        }

        const templateItems = isEditing && editTemplate 
            ? recommendationTemplateService.parseItems(editTemplate.items)
            : items;

        if (templateItems.length === 0) {
            setError('Добавьте хотя бы одну рекомендацию');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const template: RecommendationTemplate = {
                id: editTemplate?.id,
                name: name.trim(),
                description: description.trim() || null,
                items: templateItems,
                isPublic: false,
                createdById: userId,
            };

            await recommendationTemplateService.upsert(template);
            onSuccess();
            handleClose();
        } catch (err: any) {
            logger.error('[CreateRecommendationTemplateModal] Failed to save template', { error: err });
            setError(err.message || 'Не удалось сохранить шаблон');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setName('');
        setDescription('');
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    const displayItems = isEditing && editTemplate 
        ? recommendationTemplateService.parseItems(editTemplate.items)
        : items;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={handleClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 bg-indigo-50 dark:bg-indigo-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl">
                            <FileSignature className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                {isEditing ? 'Редактировать шаблон' : 'Сохранить как шаблон'}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {isEditing 
                                    ? 'Измените название или описание шаблона'
                                    : 'Сохраните текущие рекомендации для повторного использования'
                                }
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Название шаблона *
                        </label>
                        <Input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Например: Стандартные рекомендации ОРВИ"
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Описание (опционально)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Краткое описание шаблона..."
                            rows={3}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                            Рекомендаций в шаблоне: {displayItems.length}
                        </p>
                        
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {displayItems.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    className="text-xs text-slate-600 dark:text-slate-400 pl-2 flex items-start gap-1"
                                >
                                    <span className="w-1 h-1 bg-indigo-400 rounded-full flex-shrink-0 mt-1.5" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
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
