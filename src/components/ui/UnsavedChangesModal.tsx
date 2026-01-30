import React from 'react';
import { X, AlertTriangle, Save, Trash2 } from 'lucide-react';
import { Button } from './Button';

export type UnsavedChangesResult = 'save' | 'discard' | 'cancel';

interface UnsavedChangesModalProps {
    isOpen: boolean;
    onClose: (result: UnsavedChangesResult) => void;
    title?: string;
    message?: string;
    patientName?: string;
    lastSavedTime?: string;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
    isOpen,
    onClose,
    title = 'Несохраненные изменения',
    message,
    patientName,
    lastSavedTime,
}) => {
    if (!isOpen) return null;

    const defaultMessage = patientName 
        ? `Форма приема пациента "${patientName}" содержит несохраненные изменения.`
        : 'У вас есть несохраненные изменения в форме.';

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        >
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 bg-amber-50 dark:bg-amber-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-2xl">
                            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                                {title}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Что сделать с изменениями?
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => onClose('cancel')}
                        className="p-2 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-slate-700 dark:text-slate-300 mb-4">
                        {message || defaultMessage}
                    </p>
                    
                    {lastSavedTime && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Последнее автосохранение: {lastSavedTime}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => onClose('cancel')}
                        className="order-3 sm:order-1"
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => onClose('discard')}
                        className="order-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Закрыть без сохранения
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => onClose('save')}
                        className="order-1 sm:order-3"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Сохранить черновик
                    </Button>
                </div>
            </div>
        </div>
    );
};
