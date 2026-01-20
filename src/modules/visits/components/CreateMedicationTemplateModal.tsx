import React, { useState } from 'react';
import { X, Pill, Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { MedicationTemplate } from '../../../types';
import { medicationTemplateService } from '../services/medicationTemplateService';
import { logger } from '../../../services/logger';

interface CreateMedicationTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    prescriptions: any[];
    userId: number;
}

export const CreateMedicationTemplateModal: React.FC<CreateMedicationTemplateModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    prescriptions,
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

        if (prescriptions.length === 0) {
            setError('Добавьте хотя бы один препарат');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            // Преобразуем prescriptions в формат MedicationTemplateItem[]
            const items = prescriptions.map(p => ({
                medicationId: p.medicationId,
                preferredRoute: null,
                defaultDuration: p.duration || '5-7 дней',
                overrideInstruction: p.dosing || null,
                overrideSingleDoseMg: p.singleDoseMg || null,
                overrideTimesPerDay: p.timesPerDay || null,
                notes: null,
            }));

            const template: MedicationTemplate = {
                name: name.trim(),
                description: description.trim() || null,
                items: items,
                isPublic: false,
                createdById: userId,
            };

            await medicationTemplateService.upsert(template);
            onSuccess();
            handleClose();
        } catch (err: any) {
            logger.error('[CreateMedicationTemplateModal] Failed to save template', { error: err });
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
                <div className="p-6 border-b dark:border-slate-800 bg-primary-50 dark:bg-primary-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-2xl">
                            <Pill className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                Сохранить как шаблон назначений
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Сохраните текущие назначения для повторного использования
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
                            placeholder="Например: ОРВИ стандартная схема"
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
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 text-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                            Препаратов в шаблоне: {prescriptions.length}
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {prescriptions.map((p, idx) => (
                                <div key={idx} className="text-xs text-slate-600 dark:text-slate-400">
                                    {idx + 1}. {p.name}
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
