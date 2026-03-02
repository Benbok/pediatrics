import React from 'react';
import { Toast } from './Toast';
import { useToast } from '../../context/ToastContext';

export const ToastContainer: React.FC = () => {
    const { toasts, dismissToast } = useToast();

    if (!toasts.length) return null;

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
            {toasts.map(t => (
                <div key={t.id} className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <Toast toast={t} onClose={dismissToast} />
                </div>
            ))}
        </div>
    );
};
