import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface ErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
    errors?: string[];
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
    isOpen,
    onClose,
    title = 'Ошибка валидации',
    message,
    errors = [],
}) => {
    if (!isOpen) return null;

    // Парсим ошибки из строки message, если они там в виде списка
    const parseErrors = (errorMessage: string): string[] => {
        if (errorMessage.includes(',')) {
            return errorMessage.split(',').map(e => e.trim());
        }
        return [errorMessage];
    };

    const errorList = errors.length > 0 ? errors : parseErrors(message);

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 bg-red-50 dark:bg-red-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-2xl">
                            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                {title}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Обнаружены ошибки при сохранении данных
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-4">
                        {errorList.length === 1 ? (
                            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl">
                                <p className="text-slate-900 dark:text-slate-100 font-medium">
                                    {errorList[0]}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                                    Необходимо исправить следующие ошибки:
                                </p>
                                <ul className="space-y-2">
                                    {errorList.map((error, index) => (
                                        <li 
                                            key={index}
                                            className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl"
                                        >
                                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-full text-xs font-bold mt-0.5">
                                                {index + 1}
                                            </span>
                                            <span className="text-slate-900 dark:text-slate-100 flex-1">
                                                {error}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <Button
                        variant="primary"
                        onClick={onClose}
                        className="min-w-[120px]"
                    >
                        Понятно
                    </Button>
                </div>
            </div>
        </div>
    );
};
