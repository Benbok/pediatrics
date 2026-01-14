import React, { useState, useEffect } from 'react';
import { Key, Check, X, AlertCircle, Loader, Shield, Database, RefreshCw, RotateCcw, Zap, Trash2 } from 'lucide-react';
import { getCurrentApiKey, setApiKey, validateApiKey } from '../../services/geminiService';
import { apiKeyService, PoolStatus } from '../../services/apiKeyService';

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

    // API Key Pool State
    const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
    const [isLoadingPool, setIsLoadingPool] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isReloading, setIsReloading] = useState(false);

    // Cache State
    const [cacheStats, setCacheStats] = useState<any>(null);
    const [isLoadingCache, setIsLoadingCache] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState(false);

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

        // Load pool status
        loadPoolStatus();
        
        // Load cache stats
        loadCacheStats();
    }, []);

    const loadPoolStatus = async () => {
        setIsLoadingPool(true);
        try {
            const status = await apiKeyService.getPoolStatus();
            setPoolStatus(status);
        } catch (error: any) {
            console.error('Failed to load pool status:', error);
        } finally {
            setIsLoadingPool(false);
        }
    };

    const handleResetKey = async (keyIndex: number) => {
        try {
            await apiKeyService.resetKey(keyIndex);
            await loadPoolStatus();
        } catch (error: any) {
            console.error('Failed to reset key:', error);
        }
    };

    const handleResetAll = async () => {
        setIsResetting(true);
        try {
            await apiKeyService.resetAllKeys();
            await loadPoolStatus();
        } catch (error: any) {
            console.error('Failed to reset all keys:', error);
        } finally {
            setIsResetting(false);
        }
    };

    const handleReloadFromEnv = async () => {
        setIsReloading(true);
        try {
            const result = await apiKeyService.reloadKeysFromEnv();
            if (result.success) {
                await loadPoolStatus();
            }
        } catch (error: any) {
            console.error('Failed to reload keys:', error);
        } finally {
            setIsReloading(false);
        }
    };

    const loadCacheStats = async () => {
        setIsLoadingCache(true);
        try {
            const stats = await window.electronAPI.getCacheStats();
            setCacheStats(stats);
        } catch (error: any) {
            console.error('Failed to load cache stats:', error);
        } finally {
            setIsLoadingCache(false);
        }
    };

    const handleClearAllCache = async () => {
        if (!window.confirm('Вы уверены, что хотите очистить весь кеш? Это может временно замедлить работу приложения.')) {
            return;
        }

        setIsClearingCache(true);
        try {
            await window.electronAPI.clearAllCache();
            await loadCacheStats();
        } catch (error: any) {
            console.error('Failed to clear cache:', error);
        } finally {
            setIsClearingCache(false);
        }
    };

    const handleClearNamespace = async (namespace: string) => {
        setIsClearingCache(true);
        try {
            await window.electronAPI.clearCacheNamespace(namespace);
            await loadCacheStats();
        } catch (error: any) {
            console.error('Failed to clear cache namespace:', error);
        } finally {
            setIsClearingCache(false);
        }
    };

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

            {/* API Key Pool Status Section */}
            <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <Key className="text-green-600 dark:text-green-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Статус пула API ключей</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Мониторинг и управление пулом ключей Gemini
                        </p>
                    </div>
                </div>

                {isLoadingPool ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader className="animate-spin text-slate-400" size={24} />
                    </div>
                ) : poolStatus ? (
                    <div className="space-y-4">
                        {/* Health Indicator */}
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                                poolStatus.active >= 5 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : poolStatus.active >= 2
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                                {poolStatus.active >= 5 ? '🟢 Отлично' : poolStatus.active >= 2 ? '🟡 Внимание' : '🔴 Критично'}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    Здоровье пула: {poolStatus.active >= 5 ? 'Отлично' : poolStatus.active >= 2 ? 'Внимание' : 'Критично'}
                                </p>
                            </div>
                        </div>

                        {/* Statistics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Всего ключей</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{poolStatus.total}</p>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                                <p className="text-xs text-green-600 dark:text-green-400 mb-1">Рабочих</p>
                                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{poolStatus.active}</p>
                            </div>
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
                                <p className="text-xs text-red-600 dark:text-red-400 mb-1">Провалившихся</p>
                                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{poolStatus.failed}</p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Текущий</p>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">#{poolStatus.currentKeyIndex}</p>
                            </div>
                        </div>

                        {/* Warning if low */}
                        {poolStatus.needsAttention && (
                            <div className="flex items-start gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                <AlertCircle className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" size={20} />
                                <div>
                                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                                        ⚠️ КРИТИЧНО: Осталось {poolStatus.active} рабочих ключей!
                                    </p>
                                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                                        Проверьте .env.local файл и добавьте новые ключи (переменная GEMINI_API_KEYS).
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Keys List */}
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ключи:</p>
                            <div className="flex flex-wrap gap-2">
                                {poolStatus.keys.map((key) => (
                                    <div
                                        key={key.index}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border flex items-center gap-2 ${
                                            key.index === poolStatus.currentKeyIndex
                                                ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                                                : key.status === 'active'
                                                ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                                                : 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                                        }`}
                                    >
                                        <span>[{key.index}]</span>
                                        {key.index === poolStatus.currentKeyIndex && <span>✓</span>}
                                        {key.status === 'active' ? '🟢' : '🔴'}
                                        {key.status === 'failed' && (
                                            <button
                                                onClick={() => handleResetKey(key.index)}
                                                className="ml-1 text-xs hover:underline"
                                                title="Сбросить статус"
                                            >
                                                <RotateCcw size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                🔴 = Failed | 🟢 = Active | ✓ = Current
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleResetAll}
                                disabled={isResetting}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 
                                    rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors
                                    disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {isResetting ? (
                                    <>
                                        <Loader className="animate-spin" size={16} />
                                        Сброс...
                                    </>
                                ) : (
                                    <>
                                        <RotateCcw size={16} />
                                        Сбросить все
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleReloadFromEnv}
                                disabled={isReloading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 
                                    rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors
                                    disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {isReloading ? (
                                    <>
                                        <Loader className="animate-spin" size={16} />
                                        Загрузка...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={16} />
                                        Перезагрузить из .env
                                    </>
                                )}
                            </button>
                            <button
                                onClick={loadPoolStatus}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 
                                    rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
                            >
                                <RefreshCw size={16} />
                                Обновить
                            </button>
                        </div>

                        {/* Info */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                ⚠️ Для добавления ключей отредактируйте файл <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">.env.local</code> (переменная <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">GEMINI_API_KEYS</code>)
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        Не удалось загрузить статус пула
                    </div>
                )}
            </div>

            {/* Cache Performance Section */}
            <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <Zap className="text-purple-600 dark:text-purple-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Производительность кеша</h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Мониторинг и управление системой кеширования
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={loadCacheStats}
                        disabled={isLoadingCache}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 
                            rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={16} className={isLoadingCache ? 'animate-spin' : ''} />
                        Обновить
                    </button>
                </div>

                {isLoadingCache && !cacheStats ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader className="animate-spin text-slate-400" size={24} />
                    </div>
                ) : cacheStats ? (
                    <div className="space-y-4">
                        {/* Overall Statistics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Hit Rate</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{cacheStats.stats.hitRate}</p>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                                <p className="text-xs text-green-600 dark:text-green-400 mb-1">Hits</p>
                                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{cacheStats.stats.hits.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Misses</p>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{cacheStats.stats.misses.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                                <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Размер</p>
                                <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{cacheStats.totalSize.toLocaleString()}</p>
                                <p className="text-xs text-purple-500 dark:text-purple-500 mt-1">/ {cacheStats.maxSize.toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Namespace Details */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Детали по namespace:</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {Object.entries(cacheStats.namespaces).map(([namespace, stats]: [string, any]) => (
                                    <div key={namespace} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                                                {namespace}
                                            </span>
                                            <button
                                                onClick={() => handleClearNamespace(namespace)}
                                                disabled={isClearingCache}
                                                className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                                                title="Очистить namespace"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500 dark:text-slate-400">Записей: {stats.size}</span>
                                            {stats.expired > 0 && (
                                                <span className="text-yellow-600 dark:text-yellow-400">Устаревших: {stats.expired}</span>
                                            )}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                            TTL: {Math.round(stats.ttl / 1000)}с
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Очистка кеша</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Очистка кеша заставит приложение перезагрузить данные из базы данных
                                </p>
                            </div>
                            <button
                                onClick={handleClearAllCache}
                                disabled={isClearingCache}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 
                                    rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium
                                    disabled:opacity-50 disabled:cursor-not-allowed border border-red-200 dark:border-red-800"
                            >
                                {isClearingCache ? (
                                    <Loader className="animate-spin" size={16} />
                                ) : (
                                    <Trash2 size={16} />
                                )}
                                Очистить весь кеш
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        Не удалось загрузить статистику кеша
                    </div>
                )}
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
