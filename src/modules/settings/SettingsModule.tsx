import React, { useState, useEffect, useCallback } from 'react';
import { Key, Check, X, AlertCircle, Loader, Shield, Database, RefreshCw, RotateCcw, Zap, Trash2, Plus, FlaskConical, Stethoscope, Tag } from 'lucide-react';
import { getCurrentApiKey, setApiKey, validateApiKey } from '../../services/geminiService';
import { apiKeyService, PoolStatus } from '../../services/apiKeyService';
import { vaccinationService } from '../../services/vaccination.service';
import { PrettySelect, type SelectOption } from '../diseases/components/PrettySelect';
import { diseaseService } from '../diseases/services/diseaseService';
import { VaccineCatalogEntry, DiagnosticCatalogEntry } from '../../types';

const diagnosticTypeOptions: SelectOption<'lab' | 'instrumental'>[] = [
    { value: 'lab', label: 'Лабораторный' },
    { value: 'instrumental', label: 'Инструментальный' },
];

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

    // Global Vaccine Catalog State
    const [vaccineCatalog, setVaccineCatalog] = useState<VaccineCatalogEntry[]>([]);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
    const [isSavingCatalog, setIsSavingCatalog] = useState(false);
        const [vaccineCatalogError, setVaccineCatalogError] = useState('');
    const [catalogInfo, setCatalogInfo] = useState('');
        const [vaccineCatalogSearch, setVaccineCatalogSearch] = useState('');
    const [isSyncingBaseline, setIsSyncingBaseline] = useState(false);
    const [planMonths, setPlanMonths] = useState('');
    const [planIntervals, setPlanIntervals] = useState('');
    const [singleDoseMonth, setSingleDoseMonth] = useState('');
    const [catalogForm, setCatalogForm] = useState<VaccineCatalogEntry>({
        vaccineId: '',
        name: '',
        disease: '',
        ageMonthStart: 0,
        description: '',
        isLive: false,
        isRecommended: false,
        availableBrands: []
    });
    const [brandDraft, setBrandDraft] = useState({ name: '', country: '', description: '' });
    const [activeTab, setActiveTab] = useState<'api' | 'catalog' | 'cache' | 'security' | 'diseases'>('api');

    // Diagnostic catalog CRUD state
    const [catalogEntries, setCatalogEntries] = useState<DiagnosticCatalogEntry[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogError, setCatalogError] = useState<string | null>(null);
    // New entry form
    const [newEntryName, setNewEntryName] = useState('');
    const [newEntryType, setNewEntryType] = useState<'lab' | 'instrumental'>('lab');
    const [newEntryAliasInput, setNewEntryAliasInput] = useState('');
    const [newEntryAliases, setNewEntryAliases] = useState<string[]>([]);
    const [isCreatingEntry, setIsCreatingEntry] = useState(false);
    // Edit state: id -> { nameRu, type, aliases, aliasInput }
    const [editingEntries, setEditingEntries] = useState<Record<number, { nameRu: string; type: 'lab' | 'instrumental'; aliases: string[]; aliasInput: string }>>({});
    const [savingEntryIds, setSavingEntryIds] = useState<Set<number>>(new Set());
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

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

        // Load vaccine catalog
        loadVaccineCatalog();
    }, []);

    // Load diagnostic catalog when tab is opened
    useEffect(() => {
        if (activeTab === 'diseases') {
            loadCatalogEntries(catalogSearch);
        }
    }, [activeTab]);

    const loadCatalogEntries = useCallback(async (search?: string) => {
        setCatalogLoading(true);
        setCatalogError(null);
        try {
            const entries = await diseaseService.listDiagnosticCatalogEntries(search);
            setCatalogEntries(entries);
        } catch (e: any) {
            setCatalogError(e.message || 'Ошибка загрузки каталога');
        } finally {
            setCatalogLoading(false);
        }
    }, []);

    const loadVaccineCatalog = async () => {
        setIsLoadingCatalog(true);
        try {
            const seedResult = await vaccinationService.ensureBaselineCatalogSeeded(false);
            const data = await vaccinationService.getVaccineCatalog();
            setVaccineCatalog(data);
                setVaccineCatalogError('');
            if (seedResult.inserted > 0) {
                setCatalogInfo(`Каталог дополнен базовым календарём: добавлено ${seedResult.inserted} записей.`);
            }
        } catch (error: any) {
                setVaccineCatalogError(error.message || 'Не удалось загрузить каталог вакцин');
        } finally {
            setIsLoadingCatalog(false);
        }
    };

    const handleSyncBaselineCatalog = async () => {
        setIsSyncingBaseline(true);
            setVaccineCatalogError('');
        setCatalogInfo('');
        try {
            const result = await vaccinationService.ensureBaselineCatalogSeeded(true);
            const refreshed = await vaccinationService.getVaccineCatalog();
            setVaccineCatalog(refreshed);
            setCatalogInfo(`Синхронизация завершена: добавлено ${result.inserted}, обновлено ${result.updated}.`);
        } catch (error: any) {
                setVaccineCatalogError(error.message || 'Не удалось синхронизировать базовый календарь');
        } finally {
            setIsSyncingBaseline(false);
        }
    };

    const resetCatalogForm = () => {
        setCatalogForm({
            vaccineId: '',
            name: '',
            disease: '',
            ageMonthStart: 0,
            description: '',
            isLive: false,
            isRecommended: false,
            availableBrands: []
        });
        setBrandDraft({ name: '', country: '', description: '' });
        setPlanMonths('');
        setPlanIntervals('');
        setSingleDoseMonth('');
            setVaccineCatalogError('');
        setCatalogInfo('Поля формы очищены.');
    };

    const generateVaccineId = (name: string) => {
        const slug = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const base = slug || 'vaccine';
        const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        return `${base}-${suffix}`;
    };

    const handleCatalogSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!catalogForm.name.trim() || !catalogForm.disease.trim()) {
                setVaccineCatalogError('Заполните название и заболевание');
            return;
        }

        const parsedMonths = planMonths
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
            .map((value) => Number(value));

        const parsedIntervals = planIntervals
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
            .map((value) => Number(value));

        const parsedSingleDoseMonth = Number(singleDoseMonth);
        const monthsToSave = parsedMonths.length
            ? parsedMonths
            : (singleDoseMonth.trim() ? [parsedSingleDoseMonth] : []);

        if (!monthsToSave.length) {
              setVaccineCatalogError('Укажите план доз или возраст первой дозы');
            return;
        }

        if (monthsToSave.some((value) => Number.isNaN(value) || value < 0 || value > 240)) {
              setVaccineCatalogError('План доз должен содержать месяцы от 0 до 240, через запятую (дробные разрешены)');
            return;
        }

        if (parsedIntervals.some((value) => Number.isNaN(value) || !Number.isInteger(value) || value < 0 || value > 3650)) {
              setVaccineCatalogError('Интервалы доз должны быть целыми днями от 0 до 3650, через запятую');
            return;
        }

        if (parsedIntervals.length > 0 && parsedIntervals.length !== monthsToSave.length) {
              setVaccineCatalogError('Количество интервалов должно совпадать с количеством доз');
            return;
        }

        setIsSavingCatalog(true);
        try {
            const vaccineId = catalogForm.vaccineId?.trim() || generateVaccineId(catalogForm.name);
            const baseEntry: VaccineCatalogEntry = {
                ...catalogForm,
                vaccineId,
                name: catalogForm.name.trim(),
                disease: catalogForm.disease.trim(),
                ageMonthStart: monthsToSave[0],
                description: catalogForm.description?.trim() || null,
                isDeleted: false,
            };

            const refreshedCatalog = await vaccinationService.upsertVaccinePlan(baseEntry, monthsToSave, parsedIntervals);
            setVaccineCatalog(refreshedCatalog);

            resetCatalogForm();
                setVaccineCatalogError('');
            setCatalogInfo('Запись плана сохранена.');
        } catch (error: any) {
                setVaccineCatalogError(error.message || 'Не удалось сохранить запись каталога');
        } finally {
            setIsSavingCatalog(false);
        }
    };

    const handleCatalogEdit = (entry: VaccineCatalogEntry) => {
        setCatalogForm({
            ...entry,
            description: entry.description || '',
            availableBrands: entry.availableBrands || []
        });
        setBrandDraft({ name: '', country: '', description: '' });
        setPlanMonths(String(entry.ageMonthStart ?? 0));
        setPlanIntervals(entry.minIntervalDays != null ? String(entry.minIntervalDays) : '');
        setSingleDoseMonth(String(entry.ageMonthStart ?? ''));
    };

    const handleCatalogToggleDeleted = async (entry: VaccineCatalogEntry) => {
        try {
            const updated = await vaccinationService.setVaccineCatalogEntryDeleted(entry.vaccineId, !entry.isDeleted);
            setVaccineCatalog(prev => prev.map(item => item.vaccineId === updated.vaccineId ? updated : item));
        } catch (error: any) {
                setVaccineCatalogError(error.message || 'Не удалось изменить статус записи');
        }
    };

    const handleAddBrand = () => {
        const name = brandDraft.name.trim();
        const country = brandDraft.country.trim();
        const description = brandDraft.description.trim();

        if (!name || !country) {
              setVaccineCatalogError('Для препарата заполните название и страну');
            return;
        }

        setCatalogForm(prev => ({
            ...prev,
            availableBrands: [
                ...(prev.availableBrands || []),
                {
                    name,
                    country,
                    description: description || undefined,
                },
            ],
        }));

        setBrandDraft({ name: '', country: '', description: '' });
    setVaccineCatalogError('');
    };

    const handleBrandChange = (index: number, field: 'name' | 'country' | 'description', value: string) => {
        setCatalogForm(prev => {
            const brands = [...(prev.availableBrands || [])];
            const current = brands[index] || { name: '', country: '', description: '' };
            brands[index] = {
                ...current,
                [field]: value,
            };
            return {
                ...prev,
                availableBrands: brands,
            };
        });
    };

    const handleRemoveBrand = (index: number) => {
        setCatalogForm(prev => ({
            ...prev,
            availableBrands: (prev.availableBrands || []).filter((_, idx) => idx !== index),
        }));
    };

    const normalizedVaccineCatalogSearch = vaccineCatalogSearch.trim().toLowerCase();
    const filteredVaccineCatalog = vaccineCatalog.filter((entry) => {
        if (!normalizedVaccineCatalogSearch) return true;

        const haystack = [
            entry.vaccineId,
            entry.name,
            entry.disease,
            ...(entry.availableBrands || []).flatMap((brand) => [brand.name, brand.country, brand.description || ''])
        ]
            .join(' ')
            .toLowerCase();

        return haystack.includes(normalizedVaccineCatalogSearch);
    });

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

    // ---- Diagnostic Catalog CRUD handlers ----

    const handleCatalogSearch = (v: string) => {
        setCatalogSearch(v);
        loadCatalogEntries(v);
    };

    const handleCreateEntry = async () => {
        const name = newEntryName.trim();
        if (!name) return;
        setIsCreatingEntry(true);
        setCatalogError(null);
        try {
            const allAliases = newEntryAliasInput.trim()
                ? [...newEntryAliases, newEntryAliasInput.trim()]
                : newEntryAliases;
            await diseaseService.createDiagnosticCatalogEntry(name, newEntryType, allAliases);
            setNewEntryName('');
            setNewEntryType('lab');
            setNewEntryAliases([]);
            setNewEntryAliasInput('');
            await loadCatalogEntries(catalogSearch);
        } catch (e: any) {
            setCatalogError(e.message || 'Не удалось создать запись');
        } finally {
            setIsCreatingEntry(false);
        }
    };

    const startEditing = (entry: DiagnosticCatalogEntry) => {
        let aliases: string[] = [];
        try { aliases = JSON.parse(entry.aliases || '[]'); } catch (_) {}
        setEditingEntries(prev => ({
            ...prev,
            [entry.id]: { nameRu: entry.nameRu, type: entry.type as 'lab' | 'instrumental', aliases, aliasInput: '' }
        }));
    };

    const cancelEditing = (id: number) => {
        setEditingEntries(prev => { const n = { ...prev }; delete n[id]; return n; });
    };

    const saveEntry = async (id: number) => {
        const draft = editingEntries[id];
        if (!draft) return;
        const allAliases = draft.aliasInput.trim()
            ? [...draft.aliases, draft.aliasInput.trim()]
            : draft.aliases;
        setSavingEntryIds(prev => new Set(prev).add(id));
        setCatalogError(null);
        try {
            await diseaseService.updateDiagnosticCatalogEntry(id, {
                nameRu: draft.nameRu,
                type: draft.type,
                aliases: allAliases,
            });
            cancelEditing(id);
            await loadCatalogEntries(catalogSearch);
        } catch (e: any) {
            setCatalogError(e.message || 'Не удалось сохранить запись');
        } finally {
            setSavingEntryIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        }
    };

    const handleDeleteEntry = async (id: number) => {
        setDeletingId(id);
        setCatalogError(null);
        try {
            await diseaseService.deleteDiagnosticCatalogEntry(id);
            setDeleteConfirmId(null);
            await loadCatalogEntries(catalogSearch);
        } catch (e: any) {
            setCatalogError(e.message || 'Не удалось удалить запись');
        } finally {
            setDeletingId(null);
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

            <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    <button
                        onClick={() => setActiveTab('api')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'api'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        Gemini API и пул ключей
                    </button>
                    <button
                        onClick={() => setActiveTab('catalog')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'catalog'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        Каталог вакцин
                    </button>
                    <button
                        onClick={() => setActiveTab('diseases')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'diseases'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        Модуль болезни
                    </button>
                    <button
                        onClick={() => setActiveTab('cache')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'cache'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        Производительность кеша
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'security'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        Безопасность и Данные
                    </button>
                </div>
            </div>

            {activeTab === 'api' && (
            <>
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
            </>
            )}

            {activeTab === 'catalog' && (
            <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Каталог вакцин</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Глобальный справочник для всей базы: добавление, редактирование и деактивация
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={resetCatalogForm}
                            disabled={isLoadingCatalog}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm disabled:opacity-50"
                        >
                            <RefreshCw size={16} />
                            Очистить
                        </button>
                        <button
                            onClick={handleSyncBaselineCatalog}
                            disabled={isSyncingBaseline}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm disabled:opacity-50"
                        >
                            {isSyncingBaseline ? <Loader size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                            Синхр. базовый календарь
                        </button>
                    </div>
                </div>

                <form onSubmit={handleCatalogSave} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <input
                        value={catalogForm.name}
                        onChange={(e) => setCatalogForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Название вакцины"
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <input
                        value={catalogForm.disease}
                        onChange={(e) => setCatalogForm(prev => ({ ...prev, disease: e.target.value }))}
                        placeholder="Заболевание"
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Возраст первой дозы (мес.)
                        </label>
                        <input
                            type="number"
                            min={0}
                            max={240}
                            step="0.1"
                            value={singleDoseMonth}
                            onChange={(e) => setSingleDoseMonth(e.target.value)}
                            placeholder="Например: 0, 2, 4.5"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Используется только если поле «План доз» не заполнено.
                        </p>
                    </div>
                    <textarea
                        value={catalogForm.description || ''}
                        onChange={(e) => setCatalogForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Описание (опционально)"
                        rows={3}
                        className="md:col-span-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />

                    <input
                        value={planMonths}
                        onChange={(e) => setPlanMonths(e.target.value)}
                        placeholder="План доз (месяцы через запятую, напр. 0,2,6)"
                        className="md:col-span-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />

                    <input
                        value={planIntervals}
                        onChange={(e) => setPlanIntervals(e.target.value)}
                        placeholder="Интервалы доз (дни через запятую, напр. 0,60,120)"
                        className="md:col-span-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />

                    <div className="md:col-span-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Препараты вакцин</p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                            <input
                                value={brandDraft.name}
                                onChange={(e) => setBrandDraft(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Название препарата"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <input
                                value={brandDraft.country}
                                onChange={(e) => setBrandDraft(prev => ({ ...prev, country: e.target.value }))}
                                placeholder="Страна"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <input
                                value={brandDraft.description}
                                onChange={(e) => setBrandDraft(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Описание (опционально)"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleAddBrand}
                            className="mb-3 px-3 py-2 text-sm rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
                        >
                            Добавить препарат
                        </button>

                        <div className="space-y-2">
                            {(catalogForm.availableBrands || []).map((brand, index) => (
                                <div key={`${brand.name}-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                                    <input
                                        value={brand.name || ''}
                                        onChange={(e) => handleBrandChange(index, 'name', e.target.value)}
                                        placeholder="Название"
                                        className="md:col-span-4 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    />
                                    <input
                                        value={brand.country || ''}
                                        onChange={(e) => handleBrandChange(index, 'country', e.target.value)}
                                        placeholder="Страна"
                                        className="md:col-span-3 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    />
                                    <input
                                        value={brand.description || ''}
                                        onChange={(e) => handleBrandChange(index, 'description', e.target.value)}
                                        placeholder="Описание"
                                        className="md:col-span-4 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveBrand(index)}
                                        className="md:col-span-1 px-2 py-2 text-xs rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                                        title="Удалить препарат"
                                    >
                                        Удалить
                                    </button>
                                </div>
                            ))}
                            {!catalogForm.availableBrands?.length && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">Пока нет добавленных препаратов для этой вакцины.</p>
                            )}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={Boolean(catalogForm.isLive)}
                            onChange={(e) => setCatalogForm(prev => ({ ...prev, isLive: e.target.checked }))}
                        />
                        Живая вакцина
                    </label>

                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={Boolean(catalogForm.isRecommended)}
                            onChange={(e) => setCatalogForm(prev => ({ ...prev, isRecommended: e.target.checked }))}
                        />
                        Рекомендованная
                    </label>

                    <button
                        type="submit"
                        disabled={isSavingCatalog}
                        className="md:col-span-2 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {isSavingCatalog ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
                        Сохранить в каталог
                    </button>
                </form>

                {vaccineCatalogError && (
                    <div className="mb-3 text-sm text-red-600 dark:text-red-400">{vaccineCatalogError}</div>
                )}
                {catalogInfo && (
                    <div className="mb-3 text-sm text-green-600 dark:text-green-400">{catalogInfo}</div>
                )}

                <input
                    value={vaccineCatalogSearch}
                    onChange={(e) => setVaccineCatalogSearch(e.target.value)}
                    placeholder="Поиск по названию, ID, заболеванию или препарату"
                    className="mb-3 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />

                {isLoadingCatalog ? (
                    <div className="py-4 text-slate-500 dark:text-slate-400 text-sm">Загрузка каталога...</div>
                ) : (
                    <div className="space-y-2 max-h-72 overflow-auto pr-1">
                        {filteredVaccineCatalog.map((entry) => (
                            <div key={entry.vaccineId} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {entry.name} <span className="text-slate-500">({entry.vaccineId})</span>
                                        </p>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">
                                            {entry.disease} • с {entry.ageMonthStart} мес. {entry.isDeleted ? '• деактивирована' : ''}
                                        </p>
                                        {!!entry.availableBrands?.length && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                Препараты: {entry.availableBrands.map((brand) => brand.name).join(', ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleCatalogEdit(entry)}
                                            className="text-xs px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                        >
                                            Редактировать
                                        </button>
                                        <button
                                            onClick={() => handleCatalogToggleDeleted(entry)}
                                            className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                        >
                                            {entry.isDeleted ? 'Восстановить' : 'Деактивировать'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {!filteredVaccineCatalog.length && (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                {vaccineCatalog.length
                                    ? 'Ничего не найдено по вашему запросу.'
                                    : 'Пока нет пользовательских записей каталога.'}
                            </div>
                        )}
                    </div>
                )}
            </div>
            )}

            {activeTab === 'diseases' && (
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <FlaskConical className="text-emerald-600 dark:text-emerald-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Каталог диагностических тестов</h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Управление каноническими именами и псевдонимами тестов</p>
                        </div>
                    </div>

                    {/* Create new entry */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Новое исследование</p>
                        <div className="flex gap-2 flex-wrap">
                            <input
                                type="text"
                                value={newEntryName}
                                onChange={e => setNewEntryName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateEntry()}
                                placeholder="Название (канонический)"
                                className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                            />
                            <div className="w-full sm:w-[240px]">
                                <PrettySelect
                                    value={newEntryType}
                                    onChange={setNewEntryType}
                                    options={diagnosticTypeOptions}
                                    buttonClassName="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm min-h-[42px]"
                                    panelClassName="rounded-xl"
                                    useFixedPanel
                                />
                            </div>
                        </div>
                        {/* Aliases input for new entry */}
                        <div className="flex flex-wrap gap-1 items-center">
                            {newEntryAliases.map((a, i) => (
                                <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-full">
                                    <Tag size={10} />
                                    {a}
                                    <button type="button" onClick={() => setNewEntryAliases(prev => prev.filter((_, idx) => idx !== i))}>
                                        <X size={10} className="hover:text-red-500" />
                                    </button>
                                </span>
                            ))}
                            <input
                                type="text"
                                value={newEntryAliasInput}
                                onChange={e => setNewEntryAliasInput(e.target.value)}
                                onKeyDown={e => {
                                    if ((e.key === 'Enter' || e.key === ',') && newEntryAliasInput.trim()) {
                                        e.preventDefault();
                                        setNewEntryAliases(prev => [...prev, newEntryAliasInput.trim()]);
                                        setNewEntryAliasInput('');
                                    }
                                }}
                                placeholder="Псевдоним (Enter — добавить)"
                                className="flex-1 min-w-[180px] px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleCreateEntry}
                            disabled={isCreatingEntry || !newEntryName.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {isCreatingEntry ? <Loader className="animate-spin" size={14} /> : <Plus size={14} />}
                            Создать
                        </button>
                    </div>
                </div>

                {/* Search + list */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex gap-3 mb-4">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={catalogSearch}
                                onChange={e => handleCatalogSearch(e.target.value)}
                                placeholder="Поиск по названию или псевдониму..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm pr-10"
                            />
                            {catalogSearch && (
                                <button
                                    type="button"
                                    onClick={() => handleCatalogSearch('')}
                                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    title="Очистить поиск"
                                    aria-label="Очистить поиск"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => loadCatalogEntries(catalogSearch)}
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Обновить"
                        >
                            <RefreshCw size={16} className={catalogLoading ? 'animate-spin text-blue-500' : 'text-slate-500'} />
                        </button>
                    </div>

                    {catalogError && (
                        <div className="mb-3 flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                            <AlertCircle size={16} />
                            {catalogError}
                        </div>
                    )}

                    {catalogLoading && catalogEntries.length === 0 ? (
                        <div className="flex items-center justify-center py-10 text-slate-400">
                            <Loader className="animate-spin mr-2" size={20} /> Загрузка...
                        </div>
                    ) : catalogEntries.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-6">Нет записей</p>
                    ) : (
                        <div className="space-y-2">
                            {catalogEntries.map(entry => {
                                const editing = editingEntries[entry.id];
                                let displayAliases: string[] = [];
                                try { displayAliases = JSON.parse(entry.aliases || '[]'); } catch (_) {}
                                return (
                                    <div key={entry.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                        {editing ? (
                                            // ---- Edit mode ----
                                            <div className="space-y-2">
                                                <div className="flex gap-2 flex-wrap">
                                                    <input
                                                        type="text"
                                                        value={editing.nameRu}
                                                        onChange={e => setEditingEntries(prev => ({ ...prev, [entry.id]: { ...prev[entry.id], nameRu: e.target.value } }))}
                                                        className="flex-1 min-w-[180px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold"
                                                    />
                                                    <div className="w-full sm:w-[220px]">
                                                        <PrettySelect
                                                            value={editing.type}
                                                            onChange={(value) => setEditingEntries(prev => ({ ...prev, [entry.id]: { ...prev[entry.id], type: value } }))}
                                                            options={diagnosticTypeOptions}
                                                            buttonClassName="rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs min-h-[38px]"
                                                            panelClassName="rounded-xl"
                                                            useFixedPanel
                                                        />
                                                    </div>
                                                </div>
                                                {/* Aliases editor */}
                                                <div className="flex flex-wrap gap-1 items-center">
                                                    {editing.aliases.map((a, i) => (
                                                        <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                                                            <Tag size={10} />
                                                            {a}
                                                            <button type="button" onClick={() => setEditingEntries(prev => ({ ...prev, [entry.id]: { ...prev[entry.id], aliases: prev[entry.id].aliases.filter((_, idx) => idx !== i) } }))}>
                                                                <X size={10} className="hover:text-red-500" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                    <input
                                                        type="text"
                                                        value={editing.aliasInput}
                                                        onChange={e => setEditingEntries(prev => ({ ...prev, [entry.id]: { ...prev[entry.id], aliasInput: e.target.value } }))}
                                                        onKeyDown={e => {
                                                            if ((e.key === 'Enter' || e.key === ',') && editing.aliasInput.trim()) {
                                                                e.preventDefault();
                                                                setEditingEntries(prev => ({
                                                                    ...prev,
                                                                    [entry.id]: { ...prev[entry.id], aliases: [...prev[entry.id].aliases, editing.aliasInput.trim()], aliasInput: '' }
                                                                }));
                                                            }
                                                        }}
                                                        placeholder="Псевдоним (Enter)"
                                                        className="flex-1 min-w-[150px] px-3 py-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => saveEntry(entry.id)}
                                                        disabled={savingEntryIds.has(entry.id)}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                                                    >
                                                        {savingEntryIds.has(entry.id) ? <Loader className="animate-spin" size={12} /> : <Check size={12} />}
                                                        Сохранить
                                                    </button>
                                                    <button type="button" onClick={() => cancelEditing(entry.id)} className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700">
                                                        Отмена
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            // ---- View mode ----
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{entry.nameRu}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.type === 'lab' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'}`}>
                                                            {entry.type === 'lab' ? <><FlaskConical size={10} className="inline mr-1" />Лаб.</> : <><Stethoscope size={10} className="inline mr-1" />Инстр.</>}
                                                        </span>
                                                        {entry.isStandard && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">Стандарт</span>}
                                                    </div>
                                                    {displayAliases.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {displayAliases.map((a, i) => (
                                                                <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-full">
                                                                    <Tag size={9} />
                                                                    {a}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button type="button" onClick={() => startEditing(entry)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Редактировать">
                                                        <RefreshCw size={14} />
                                                    </button>
                                                    {deleteConfirmId === entry.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteEntry(entry.id)}
                                                                disabled={deletingId === entry.id}
                                                                className="px-2 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                                                            >
                                                                {deletingId === entry.id ? <Loader className="animate-spin" size={12} /> : 'Удалить'}
                                                            </button>
                                                            <button type="button" onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-700 border border-slate-200 dark:border-slate-700">
                                                                Отмена
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button type="button" onClick={() => setDeleteConfirmId(entry.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Удалить">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            )}

            {activeTab === 'cache' && (
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
            )}

            {activeTab === 'security' && (
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
            )}
        </div>
    );
};
