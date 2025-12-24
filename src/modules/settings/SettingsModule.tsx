import React, { useState, useEffect } from 'react';
import { Key, Check, X, AlertCircle, Loader } from 'lucide-react';
import { getCurrentApiKey, setApiKey, validateApiKey } from '../../services/geminiService';

export const SettingsModule: React.FC = () => {
    const [apiKey, setLocalApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSaved, setIsSaved] = useState(false);

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
        // Base URL is saved logic is now implicitly handled by validateApiKey if run, 
        // but explicit save here is good practice if user skips verify
        if (baseUrl) {
            localStorage.setItem('gemini_base_url', baseUrl);
        } else {
            localStorage.removeItem('gemini_base_url');
        }

        // Force re-init with new settings
        // Ideally setApiKey should handle this, but for complete safety:
        setApiKey(apiKey);

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

    return (
        <div className="max-w-4xl mx-auto">
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
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Если API заблокирован в вашем регионе, укажите адрес прокси (например, OpenAI-compatible endpoint).
                        </p>
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

                    {/* Info Alert */}
                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={18} />
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                            <p className="font-medium mb-1">О безопасности:</p>
                            <p>
                                API ключ и URL прокси сохраняются локально в браузере.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
