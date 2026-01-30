import React, { useState } from 'react';
import { X, Microscope, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { DiagnosticTemplate, DiagnosticPlanItem } from '../../../types';
import { diagnosticTemplateService } from '../services/diagnosticTemplateService';
import { logger } from '../../../services/logger';

interface CreateDiagnosticTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    diagnosticItems: DiagnosticPlanItem[];
    userId: number;
}

export const CreateDiagnosticTemplateModal: React.FC<CreateDiagnosticTemplateModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    diagnosticItems,
    userId,
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Название шаблона обязательно');
            return;
        }

        if (diagnosticItems.length === 0) {
            setError('Добавьте хотя бы одно исследование');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const template: DiagnosticTemplate = {
                name: name.trim(),
                description: description.trim() || null,
                items: diagnosticItems,
                isPublic: false,
                createdById: userId,
            };

            await diagnosticTemplateService.upsert(template);
            onSuccess();
            handleClose();
        } catch (err: any) {
            logger.error('[CreateDiagnosticTemplateModal] Failed to save template', { error: err });
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

    const labTests = diagnosticItems.filter(item => item.type === 'lab');
    const instrumentalTests = diagnosticItems.filter(item => item.type === 'instrumental');

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
                <div className="p-6 border-b dark:border-slate-800 bg-blue-50 dark:bg-blue-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl">
                            <Microscope className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                Сохранить как шаблон диагностики
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Сохраните текущий набор исследований для повторного использования
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

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Название шаблона *
                        </label>
                        <Input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Например: Базовое обследование при ОРВИ"
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
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                            Исследований в шаблоне: {diagnosticItems.length}
                        </p>
                        
                        {labTests.length > 0 && (
                            <div className="mb-2">
                                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                                    Лабораторные ({labTests.length}):
                                </p>
                                <div className="space-y-1 max-h-20 overflow-y-auto">
                                    {labTests.map((item, idx) => (
                                        <div key={idx} className="text-xs text-slate-600 dark:text-slate-400 pl-2">
                                            • {item.test}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {instrumentalTests.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">
                                    Инструментальные ({instrumentalTests.length}):
                                </p>
                                <div className="space-y-1 max-h-20 overflow-y-auto">
                                    {instrumentalTests.map((item, idx) => (
                                        <div key={idx} className="text-xs text-slate-600 dark:text-slate-400 pl-2">
                                            • {item.test}
                                        </div>
                                    ))}
                                </div>
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
