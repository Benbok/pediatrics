import React from 'react';
import { X, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import type { ToastModel } from '../../validators/toast.validator';

interface ToastProps {
    toast: ToastModel;
    onClose: (toastId: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
    const icon = toast.type === 'success'
        ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        : toast.type === 'error'
            ? <AlertCircle className="w-5 h-5 text-red-500" />
            : toast.type === 'warning'
                ? <AlertTriangle className="w-5 h-5 text-yellow-500" />
                : <Info className="w-5 h-5 text-blue-500" />;

    const border = toast.type === 'success'
        ? 'border-emerald-200 dark:border-emerald-900'
        : toast.type === 'error'
            ? 'border-red-200 dark:border-red-900'
            : toast.type === 'warning'
                ? 'border-yellow-200 dark:border-yellow-900'
                : 'border-blue-200 dark:border-blue-900';

    return (
        <div className={`w-[360px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border ${border} overflow-hidden`}>
            <div className="p-4 flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {toast.message}
                    </div>
                </div>
                <button
                    onClick={() => onClose(toast.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
