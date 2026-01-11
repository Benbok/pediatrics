import React, { useState, useEffect } from 'react';
import { Key, Check, X, AlertCircle, Loader, Shield, Database } from 'lucide-react';
import { getCurrentApiKey, setApiKey, validateApiKey } from '../../services/geminiService';

export const SettingsModule: React.FC = () => {
    const [apiKey, setLocalApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSaved, setIsSaved] = useState(false);

    // Backup State
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [backupResult, setBackupResult] = useState<{ success?: boolean; path?: string; error?: string } | null>(null);

    useEffect(() => {
        // Load current API key and base URL on mount
        const currentKey = getCurrentApiKey();
        if (currentKey) {
            setLocalApiKey(currentKey);
            setIsSaved(true);
        }

        const currentBaseUrl = localStorage.getItem('gemini_base_url');
        if (currentBaseUrl) {
            setBaseUrl(currentBaseUrl);
        }
    }, []);

    const handleVerify = async () => {
        if (!apiKey.trim()) {
            setErrorMessage('Введите API ключ');
            setVerificationStatus('error');
            return;
        }

        setIsVerifying(true);
        setVerificationStatus('idle');
        setErrorMessage('');

        const result = await validateApiKey(apiKey, baseUrl);

        setIsVerifying(false);

        if (result.valid) {
            setVerificationStatus('success');
            setErrorMessage('');
        } else {
            setVerificationStatus('error');
            setErrorMessage(result.error || 'Ошибка проверки');
        }
    };

    const handleSave = () => {
        if (!apiKey.trim()) {
            setErrorMessage('Введите API ключ');
            setVerificationStatus('error');
            return;
        }

        setApiKey(apiKey);
        if (baseUrl) {
            localStorage.setItem('gemini_base_url', baseUrl);
        } else {
            localStorage.removeItem('gemini_base_url');
        }

        setIsSaved(true);
        setVerificationStatus('success');
        setErrorMessage('');
    };

    const handleKeyChange = (value: string) => {
        setLocalApiKey(value);
        setIsSaved(false);
        setVerificationStatus('idle');
        setErrorMessage('');
    };

    const handleBaseUrlChange = (value: string) => {
        setBaseUrl(value);
        setIsSaved(false);
        setVerificationStatus('idle');
        setErrorMessage('');
    };

    const handleCreateBackup = async () => {
        setIsBackingUp(true);
        setBackupResult(null);
        try {
            const result = await window.electronAPI.createBackup();
            setBackupResult(result);
            if (result.success) {
                setTimeout(() => setBackupResult(null), 5000);
            }
        } catch (error: any) {
            setBackupResult({ success: false, error: error.message });
        } finally {
            setIsBackingUp(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Настройки</h1>
                <p className="text-slate-600 dark:text-slate-400">
                    Управляйте параметрами приложения и интеграциями
                </p>
            </div>

            {/* API Settings Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Key className="text-blue-600 dark:text-blue-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Gemini API</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Ключ для интеграции с AI-консультантом по вакцинации
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* API Key Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            API ключ
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => handleKeyChange(e.target.value)}
                            placeholder="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX"
                            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg 
                       bg-white dark:bg-slate-900 text-slate-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-slate-400"
                        />
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Получить ключ можно на{' '}
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Google AI Studio
                            </a>
                        </p>
                    </div>

                    {/* Base URL Input (Optional) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Base URL / Proxy (Опционально)
                        </label>
                        <input
                            type="text"
                            value={baseUrl}
                            onChange={(e) => handleBaseUrlChange(e.target.value)}
                            placeholder="https://apitheia.ru.tuna.am/v1"
                            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg 
                       bg-white dark:bg-slate-900 text-slate-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-slate-400"
                        />
                    </div>

                    {/* Status Messages */}
                    {verificationStatus === 'success' && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <Check className="text-green-600 dark:text-green-400" size={20} />
                            <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                                {isSaved ? 'Настройки сохранены и проверены' : 'Настройки корректны'}
                            </p>
                        </div>
                    )}

                    {verificationStatus === 'error' && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <X className="text-red-600 dark:text-red-400" size={20} />
                            <p className="text-sm text-red-700 dark:text-red-300 font-medium">{errorMessage}</p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleVerify}
                            disabled={isVerifying || !apiKey.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 
                       rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isVerifying ? (
                                <>
                                    <Loader className="animate-spin" size={18} />
                                    Проверка...
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={18} />
                                    Проверить
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={!apiKey.trim() || isSaved}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg 
                       hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Check size={18} />
                            {isSaved ? 'Сохранено' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Database & Security Section */}
            <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <Shield className="text-indigo-600 dark:text-indigo-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Безопасность и Данные</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Резервное копирование и защита персональных данных
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex gap-3 items-start">
                            <Database className="text-slate-400 mt-1" size={20} />
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Резервное копирование</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Система автоматически создает бэкапы ежедневно. <br />
                                    Вы также можете создать копию вручную.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                            <button
                                onClick={handleCreateBackup}
                                disabled={isBackingUp}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 
                                     rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors
                                     disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                            >
                                {isBackingUp ? <Loader className="animate-spin" size={16} /> : <Database size={16} />}
                                Создать копию сейчас
                            </button>

                            {backupResult?.success && (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                    ✓ Копия создана успешно
                                </span>
                            )}
                            {backupResult?.error && (
                                <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                    Ошибка: {backupResult.error}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        <Shield className="text-indigo-600 dark:text-indigo-400 mt-1 flex-shrink-0" size={20} />
                        <div>
                            <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Защита данных (152-ФЗ)</h3>
                            <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80 mt-1 leading-relaxed">
                                Все персональные данные пациентов (ФИО, дата рождения) шифруются алгоритмом AES-256-GCM
                                перед сохранением в базу данных. Доступ к данным возможен только после авторизации врача.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
