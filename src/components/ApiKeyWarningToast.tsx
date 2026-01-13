/**
 * API Key Warning Toast Component
 * 
 * Показывает уведомления о критическом состоянии пула API ключей
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface WarningData {
    remaining: number;
    total: number;
}

export const ApiKeyWarningToast: React.FC = () => {
    const [warning, setWarning] = useState<WarningData | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleLowKeysWarning = (event: any, data: WarningData) => {
            setWarning(data);
            setIsVisible(true);

            // Auto-hide after 10 seconds for warnings, but keep critical visible
            if (data.remaining > 0) {
                setTimeout(() => {
                    setIsVisible(false);
                }, 10000);
            }
        };

        // Subscribe to IPC event
        const cleanup = window.electronAPI.onApiKeysLowWarning(handleLowKeysWarning);

        return () => {
            if (cleanup) cleanup();
        };
    }, []);

    if (!warning || !isVisible) {
        return null;
    }

    const handleClose = () => {
        setIsVisible(false);
    };

    // Emergency: All keys exhausted
    if (warning.remaining === 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="max-w-md w-full mx-4 bg-red-50 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-700 rounded-xl shadow-2xl p-6 animate-pulse">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg flex-shrink-0">
                            <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-red-900 dark:text-red-200 mb-2">
                                🚨 КРИТИЧЕСКАЯ СИТУАЦИЯ
                            </h3>
                            <p className="text-sm text-red-800 dark:text-red-300 mb-4">
                                Все API ключи исчерпаны! AI функции временно недоступны.
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-400">
                                Срочно добавьте новые ключи в файл <code className="px-1 py-0.5 bg-red-100 dark:bg-red-900/50 rounded">.env.local</code>
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Critical: 1 key remaining
    if (warning.remaining === 1) {
        return (
            <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
                <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-700 rounded-xl shadow-xl p-4 animate-pulse">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg flex-shrink-0">
                            <AlertCircle className="text-red-600 dark:text-red-400" size={20} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-red-900 dark:text-red-200 mb-1">
                                КРИТИЧНО: Остался 1 рабочий ключ!
                            </h4>
                            <p className="text-xs text-red-800 dark:text-red-300">
                                Срочно добавьте новые ключи в <code className="px-1 py-0.5 bg-red-100 dark:bg-red-900/50 rounded">.env.local</code>
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors flex-shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Warning: 2 keys remaining
    if (warning.remaining <= 2) {
        return (
            <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-500 dark:border-yellow-700 rounded-xl shadow-lg p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg flex-shrink-0">
                            <AlertCircle className="text-yellow-600 dark:text-yellow-400" size={20} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-yellow-900 dark:text-yellow-200 mb-1">
                                Внимание: Осталось {warning.remaining} рабочих ключа
                            </h4>
                            <p className="text-xs text-yellow-800 dark:text-yellow-300">
                                Рекомендуется проверить настройки и добавить новые ключи
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 transition-colors flex-shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};
