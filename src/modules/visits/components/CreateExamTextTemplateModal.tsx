import React, { useState, useEffect } from 'react';
import { X, FileText, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ExamTextTemplate } from '../../../types';
import { examTextTemplateService } from '../services/examTextTemplateService';
import { logger } from '../../../services/logger';

interface CreateExamTextTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    systemKey: string;
    systemLabel: string;
    initialText: string;
    userId: number;
    templateId?: number | null; // Для редактирования существующего шаблона
}

export const CreateExamTextTemplateModal: React.FC<CreateExamTextTemplateModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    systemKey,
    systemLabel,
    initialText,
    userId,
    templateId,
}) => {
    const [name, setName] = useState('');
    const [text, setText] = useState(initialText);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isEditMode = !!templateId;

    // Загружаем данные шаблона при редактировании
    useEffect(() => {
        if (isOpen && templateId) {
            loadTemplate();
        } else if (isOpen && !templateId) {
            // Сброс для создания нового
            setName('');
            setText(initialText);
        }
    }, [isOpen, templateId]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadTemplate = async () => {
        if (!templateId) return;
        
        setIsLoading(true);
        setError(null);
        try {
            const template = await examTextTemplateService.getById(templateId);
            if (template) {
                setName(template.name || '');
                setText(template.text);
            }
        } catch (err: any) {
            logger.error('[CreateExamTextTemplateModal] Failed to load template', { error: err, templateId });
            setError('Не удалось загрузить шаблон');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!text.trim()) {
            setError('Текст шаблона не может быть пустым');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const template: ExamTextTemplate = {
                id: templateId || undefined,
                name: name.trim() || null,
                systemKey: systemKey,
                text: text.trim(),
                tags: [],
                isPublic: false,
                createdById: userId,
            };

            await examTextTemplateService.upsert(template);
            onSuccess();
            handleClose();
        } catch (err: any) {
            logger.error('[CreateExamTextTemplateModal] Failed to save template', { error: err });
            setError(err.message || 'Не удалось сохранить шаблон');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setName('');
        setText(initialText);
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
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 bg-primary-50 dark:bg-primary-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-2xl">
                            <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                {isEditMode ? 'Редактировать шаблон текста' : 'Сохранить как шаблон текста'}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Система: {systemLabel}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-2 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl">
                                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                                </div>
                            )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Название (опционально)
                        </label>
                        <Input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Например: Норма у детей 5-10 лет"
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Текст шаблона *
                        </label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Текст шаблона..."
                            rows={8}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 text-slate-900 dark:text-white font-mono"
                        />
                    </div>
                        </>
                    )}
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
                        disabled={isSaving || isLoading || !text.trim()}
                    >
                        {isSaving ? 'Сохранение...' : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                {isEditMode ? 'Сохранить изменения' : 'Сохранить'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
