import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ToastModel, ToastType } from '../validators/toast.validator';
import { createToast } from '../services/toastService';
import { TOAST_CONSTANTS } from '../constants';

interface ToastContextValue {
    toasts: ToastModel[];
    showToast: (message: string, type: ToastType, durationMs?: number) => string;
    dismissToast: (toastId: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastModel[]>([]);
    const timersRef = useRef<Map<string, number>>(new Map());

    const dismissToast = useCallback((toastId: string) => {
        const t = timersRef.current.get(toastId);
        if (t) {
            window.clearTimeout(t);
            timersRef.current.delete(toastId);
        }
        setToasts(prev => prev.filter(x => x.id !== toastId));
    }, []);

    const showToast = useCallback((message: string, type: ToastType, durationMs?: number) => {
        const toast = createToast(message, type, durationMs);

        setToasts(prev => {
            const next = [toast, ...prev];
            return next.slice(0, TOAST_CONSTANTS.MAX_TOASTS);
        });

        const ms = toast.durationMs ?? TOAST_CONSTANTS.DEFAULT_DURATION;
        const timer = window.setTimeout(() => {
            dismissToast(toast.id);
        }, ms);
        timersRef.current.set(toast.id, timer);

        return toast.id;
    }, [dismissToast]);

    // Global listener for batch upload completion
    useEffect(() => {
        const handleBatchFinished = (event: any, data: any) => {
            // Handle both possible data formats
            const eventData = data || event;
            const { batchId, totalFiles, successCount, errorCount } = eventData;
            
            // Validate data before showing toast
            if (typeof totalFiles !== 'number' || typeof successCount !== 'number' || typeof errorCount !== 'number') {
                return;
            }
            
            if (errorCount > 0 && successCount === 0) {
                // All failed
                showToast(`Ошибка загрузки ${totalFiles} файл(ов)`, 'error');
            } else if (errorCount > 0) {
                // Mixed results
                showToast(`Загружено ${successCount} из ${totalFiles} файлов (${errorCount} ошибок)`, 'warning');
            } else {
                // All success
                showToast(`✅ Успешно загружено ${successCount} файл(ов)`, 'success');
            }
        };

        let unsubscribe: (() => void) | null = null;
        
        if (window.electronAPI?.onUploadBatchFinished) {
            unsubscribe = window.electronAPI.onUploadBatchFinished(handleBatchFinished);
        }

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [showToast]);

    const value = useMemo<ToastContextValue>(() => ({
        toasts,
        showToast,
        dismissToast,
    }), [toasts, showToast, dismissToast]);

    return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return ctx;
}
