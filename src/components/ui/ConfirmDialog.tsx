import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    /** When false, only the confirm (OK) button is shown — for notifications */
    showCancel?: boolean;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title = 'Подтверждение',
    message,
    confirmText = 'OK',
    cancelText = 'Отмена',
    showCancel = true,
    variant = 'info',
    onConfirm,
    onCancel
}) => {
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Небольшая задержка для запуска анимации после монтирования
            requestAnimationFrame(() => {
                setIsAnimating(true);
            });
        } else {
            setIsAnimating(false);
        }
    }, [isOpen]);

    const variantStyles = {
        danger: 'text-red-600 dark:text-red-400',
        warning: 'text-yellow-600 dark:text-yellow-400',
        info: 'text-blue-600 dark:text-blue-400'
    };

    if (!isOpen) return null;

    return (
        <div 
            className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ease-out ${
                isAnimating ? 'bg-black bg-opacity-50' : 'bg-black bg-opacity-0'
            }`}
            onClick={onCancel}
        >
            <div 
                className={`bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full mx-4 border border-slate-200 dark:border-slate-800 transform transition-all duration-300 ease-out ${
                    isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className={`w-5 h-5 ${variantStyles[variant]}`} />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <span className="text-xl">×</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">{message}</p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-800">
                    {showCancel && (
                        <Button
                            variant="secondary"
                            onClick={onCancel}
                            className="rounded-xl"
                        >
                            {cancelText}
                        </Button>
                    )}
                    <Button
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        onClick={onConfirm}
                        className="rounded-xl"
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};
