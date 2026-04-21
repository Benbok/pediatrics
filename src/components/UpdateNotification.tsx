import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X, ArrowUpCircle, CheckCircle2 } from 'lucide-react';

type UpdateState =
    | { status: 'idle' }
    | { status: 'available'; version: string; releaseNotes: string | null }
    | { status: 'downloading'; percent: number; bytesPerSecond: number }
    | { status: 'downloaded'; version: string }
    | { status: 'error'; message: string };

export const UpdateNotification: React.FC = () => {
    const [state, setState] = useState<UpdateState>({ status: 'idle' });

    useEffect(() => {
        if (!window.electronAPI?.updater) return;

        const cleanups: Array<() => void> = [];

        const c1 = window.electronAPI.updater.onUpdateAvailable((_event: any, info: { version: string; releaseNotes: string | null }) => {
            setState({ status: 'available', version: info.version, releaseNotes: info.releaseNotes });
        });

        const c2 = window.electronAPI.updater.onDownloadProgress((_event: any, progress: { percent: number; bytesPerSecond: number }) => {
            setState({ status: 'downloading', percent: progress.percent, bytesPerSecond: progress.bytesPerSecond });
        });

        const c3 = window.electronAPI.updater.onUpdateDownloaded((_event: any, info: { version: string }) => {
            setState({ status: 'downloaded', version: info.version });
        });

        const c4 = window.electronAPI.updater.onError((_event: any, err: { message: string }) => {
            setState({ status: 'error', message: err.message });
        });

        if (c1) cleanups.push(c1);
        if (c2) cleanups.push(c2);
        if (c3) cleanups.push(c3);
        if (c4) cleanups.push(c4);

        return () => {
            cleanups.forEach((fn) => fn());
        };
    }, []);

    const handleDownload = () => {
        window.electronAPI.updater.downloadUpdate();
    };

    const handleInstall = () => {
        window.electronAPI.updater.installAndRestart();
    };

    const handleDismiss = () => {
        setState({ status: 'idle' });
    };

    if (state.status === 'idle') return null;

    // ── Доступно обновление ──────────────────────────────────────────
    if (state.status === 'available') {
        return (
            <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full">
                <div className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-xl shadow-xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex-shrink-0">
                            <ArrowUpCircle className="text-blue-600 dark:text-blue-400" size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Доступно обновление v{state.version}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Скачать и установить в фоне?
                            </p>
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                    <Download size={13} />
                                    Скачать
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs transition-colors"
                                >
                                    Позже
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Идёт загрузка ────────────────────────────────────────────────
    if (state.status === 'downloading') {
        const speedKb = Math.round(state.bytesPerSecond / 1024);
        return (
            <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full">
                <div className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-xl shadow-xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex-shrink-0 animate-spin">
                            <RefreshCw className="text-blue-600 dark:text-blue-400" size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Загрузка обновления... {state.percent}%
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {speedKb} КБ/с
                            </p>
                            <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                    style={{ width: `${state.percent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Загружено, готово к установке ────────────────────────────────
    if (state.status === 'downloaded') {
        return (
            <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full">
                <div className="bg-white dark:bg-slate-800 border border-green-200 dark:border-green-700 rounded-xl shadow-xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg flex-shrink-0">
                            <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Обновление v{state.version} готово
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Перезапустить приложение для установки?
                            </p>
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={handleInstall}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                    <RefreshCw size={13} />
                                    Перезапустить
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs transition-colors"
                                >
                                    Позже
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Ошибка ───────────────────────────────────────────────────────
    if (state.status === 'error') {
        return (
            <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full">
                <div className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 rounded-xl shadow-xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                                Ошибка обновления
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">
                                {state.message}
                            </p>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0"
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
