import React from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface DeleteTemplateConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    templateName: string;
    isDeleting?: boolean;
}

export const DeleteTemplateConfirmModal: React.FC<DeleteTemplateConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    templateName,
    isDeleting = false,
}) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 bg-red-50 dark:bg-red-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-2xl">
                            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                Удалить шаблон?
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Это действие нельзя отменить
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        disabled={isDeleting}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                            Вы уверены, что хотите удалить шаблон <strong className="font-semibold text-slate-900 dark:text-white">"{templateName}"</strong>?
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Все данные шаблона будут безвозвратно удалены. Это действие нельзя отменить.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="min-w-[120px]"
                        disabled={isDeleting}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="danger"
                        onClick={onConfirm}
                        className="min-w-[120px]"
                        disabled={isDeleting}
                        isLoading={isDeleting}
                        leftIcon={<Trash2 className="w-4 h-4" />}
                    >
                        {isDeleting ? 'Удаление...' : 'Удалить'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
