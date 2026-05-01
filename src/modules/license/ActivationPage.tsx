import React, { useState, useEffect, useCallback } from 'react';
import { ShieldX, Copy, CheckCheck, Upload, AlertCircle, Loader2, KeyRound, HardDrive, FolderOpen } from 'lucide-react';

interface ActivationPageProps {
    /** Вызывается после успешной активации — App.tsx убирает экран */
    onActivated: () => void;
}

type ActivationStatus = 'checking' | 'unlicensed' | 'importing' | 'error'
    | 'portable_missing' | 'portable_mismatch' | 'portable_tamper' | 'portable_invalid';

export const ActivationPage: React.FC<ActivationPageProps> = ({ onActivated }) => {
    const [status, setStatus] = useState<ActivationStatus>('checking');
    const [machineId, setMachineId] = useState<string>('');
    const [machineIdFull, setMachineIdFull] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [portableDeviceDisplayId, setPortableDeviceDisplayId] = useState<string>('');
    const [copied, setCopied] = useState(false);

    const checkLicense = useCallback(async () => {
        setStatus('checking');
        try {
            const result = await window.electronAPI.checkLicense();
            if (result.valid) {
                onActivated();
                return;
            }

            // Portable mode — specific error screens, no machine ID needed
            if (result.isPortable) {
                setErrorMessage(result.reason || 'Ошибка portable-режима');
                if (result.portableDeviceDisplayId) {
                    setPortableDeviceDisplayId(result.portableDeviceDisplayId);
                }
                const errorCode = (result as any).errorCode as string | undefined;
                if (errorCode === 'LICENSE_MISSING') {
                    setStatus('portable_missing');
                } else if (errorCode === 'DEVICE_MISMATCH') {
                    setStatus('portable_mismatch');
                } else if (errorCode === 'STATE_TAMPER') {
                    setStatus('portable_tamper');
                } else {
                    setStatus('portable_invalid');
                }
                return;
            }

            // Standard mode — load fingerprint for display
            const fpResult = await window.electronAPI.getLicenseFingerprint();
            setMachineId(fpResult.display || 'ОШИБКА');
            setMachineIdFull(fpResult.fingerprint || '');
            setErrorMessage(result.reason || 'Лицензия не найдена');
            setStatus('unlicensed');
        } catch (err) {
            setErrorMessage('Внутренняя ошибка проверки лицензии');
            setStatus('error');
        }
    }, [onActivated]);

    useEffect(() => {
        checkLicense();
    }, [checkLicense]);

    const handleCopyMachineId = async () => {
        const textToCopy = machineIdFull || machineId;
        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // Clipboard может быть недоступен в Electron без разрешения
        }
    };

    const handleImport = async () => {
        setStatus('importing');
        setErrorMessage('');
        try {
            const result = await window.electronAPI.importLicense();
            if (result.success) {
                // Re-check to confirm
                const check = await window.electronAPI.checkLicense();
                if (check.valid) {
                    onActivated();
                } else {
                    setErrorMessage(check.reason || 'Лицензия не прошла проверку после импорта');
                    setStatus('unlicensed');
                }
            } else {
                setErrorMessage(result.reason || 'Импорт не выполнен');
                setStatus('unlicensed');
            }
        } catch (err) {
            setErrorMessage('Ошибка при импорте файла лицензии');
            setStatus('unlicensed');
        }
    };

    // ── Loading / Checking ───────────────────────────────────────────────────

    if (status === 'checking') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Проверка лицензии...</span>
                </div>
            </div>
        );
    }

    // ── Importing ────────────────────────────────────────────────────────────

    if (status === 'importing') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Проверка лицензионного файла...</span>
                </div>
            </div>
        );
    }

    // ── Portable: лицензия не найдена ────────────────────────────────────────

    if (status === 'portable_missing') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
                <div className="max-w-md w-full text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30 mb-6">
                        <HardDrive className="w-10 h-10 text-white" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">PediAssist — Portable</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">Файл лицензии не найден</p>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-left">
                        <div className="flex items-start gap-3 mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800 dark:text-amber-300">
                                Поместите файл <strong>portable-license.json</strong> в папку <strong>data\</strong> на этом диске
                            </p>
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-sm text-slate-700 dark:text-slate-300">
                            <FolderOpen className="w-4 h-4 flex-shrink-0 text-slate-400" />
                            <span className="break-all">data\portable-license.json</span>
                        </div>
                        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                            Сгенерируйте лицензию командой:<br />
                            <span className="font-mono">node tools/generate-license.cjs --portable --drive &lt;буква&gt;:</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Portable: несоответствие диска ───────────────────────────────────────

    if (status === 'portable_mismatch') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
                <div className="max-w-md w-full text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500 rounded-2xl shadow-lg shadow-red-500/30 mb-6">
                        <ShieldX className="w-10 h-10 text-white" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">PediAssist — Portable</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">Лицензия не соответствует диску</p>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-left">
                        <div className="flex items-start gap-3 mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800 dark:text-red-300">{errorMessage}</p>
                        </div>
                        {portableDeviceDisplayId && (
                            <div className="mt-3">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider font-semibold">Device ID текущего диска</p>
                                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-sm text-slate-700 dark:text-slate-300 break-all select-all">
                                    {portableDeviceDisplayId}
                                </div>
                                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                                    Пересоздайте лицензию для этого диска командой --portable --drive
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Portable: tamper / generic invalid ───────────────────────────────────

    if (status === 'portable_tamper' || status === 'portable_invalid') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
                <div className="max-w-md w-full text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500 rounded-2xl shadow-lg shadow-red-500/30 mb-6">
                        <ShieldX className="w-10 h-10 text-white" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">PediAssist — Portable</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">
                        {status === 'portable_tamper' ? 'Нарушение целостности' : 'Ошибка лицензии'}
                    </p>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800 dark:text-red-300 text-left">{errorMessage}</p>
                        </div>
                        {status === 'portable_tamper' && (
                            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                                Для восстановления пересоздайте portable-лицензию с помощью CLI-инструмента.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Unlicensed / Error ───────────────────────────────────────────────────

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            <div className="max-w-lg w-full">

                {/* Header */}
                <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/30 mb-6">
                        <KeyRound className="w-10 h-10 text-white" strokeWidth={2} />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                        PediAssist
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                        Активация приложения
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 animate-in fade-in zoom-in-95 duration-500">

                    {/* Status icon */}
                    <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <ShieldX className="w-6 h-6 text-amber-600 flex-shrink-0" />
                        <div>
                            <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                                Приложение не активировано
                            </p>
                            <p className="text-amber-700 dark:text-amber-400 text-sm mt-0.5">
                                {errorMessage}
                            </p>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-4 mb-6">
                        <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                            Как активировать:
                        </h2>
                        <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">1</span>
                                <span>Скопируйте ваш <strong className="text-slate-800 dark:text-slate-200">Machine ID</strong> ниже и отправьте разработчику</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">2</span>
                                <span>Разработчик создаст файл <strong className="text-slate-800 dark:text-slate-200">license.json</strong> под ваш компьютер</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">3</span>
                                <span>Нажмите <strong className="text-slate-800 dark:text-slate-200">«Импорт лицензии»</strong> и выберите полученный файл</span>
                            </li>
                        </ol>
                    </div>

                    {/* Machine ID display */}
                    <div className="mb-6">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Ваш Machine ID
                        </label>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3 font-mono text-sm text-slate-800 dark:text-slate-200 select-all break-all">
                                {machineId || 'Загрузка...'}
                            </div>
                            <button
                                onClick={handleCopyMachineId}
                                disabled={!machineId}
                                className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900 text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
                                title="Скопировать Machine ID"
                            >
                                {copied
                                    ? <CheckCheck className="w-5 h-5 text-green-600" />
                                    : <Copy className="w-5 h-5" />
                                }
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                            Нажмите на иконку копирования для точного копирования полного ID
                        </p>
                    </div>

                    {/* Import button */}
                    <button
                        onClick={handleImport}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-colors shadow-md shadow-blue-600/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <Upload className="w-5 h-5" />
                        Импорт лицензии (license.json)
                    </button>

                    {/* Error message */}
                    {status === 'error' && (
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center mt-6 text-xs text-slate-400 dark:text-slate-600">
                    PediAssist v2.0 · Лицензионная защита активна
                </p>
            </div>
        </div>
    );
};
