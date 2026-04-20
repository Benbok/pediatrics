import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Key, Check, X, AlertCircle, Loader, Shield, Database, RefreshCw, RotateCcw, Zap, Trash2, Plus, FlaskConical, Stethoscope, Tag, Building2, Upload, FileCheck, ChevronDown, ChevronRight, Eye, EyeOff, Pencil, Star } from 'lucide-react';
import { apiKeyService, ApiKeysConnectivityReport, PoolStatus, ApiKeyEntry } from '../../services/apiKeyService';
import { organizationService, getDefaultOrganizationProfile } from '../../services/organization.service';
import { vaccinationService } from '../../services/vaccination.service';
import { PrettySelect, type SelectOption } from '../diseases/components/PrettySelect';
import { diseaseService } from '../diseases/services/diseaseService';
import { VaccineCatalogEntry, DiagnosticCatalogEntry, OrganizationProfile, DbImportTableInfo, DbImportTableSelection, DbImportTableResult, DbImportStrategy } from '../../types';
import { LicenseAdminPanel } from '../license/LicenseAdminPanel';
import { useAuth } from '../../context/AuthContext';

const GEMINI_MODELS: { label: string; value: string }[] = [
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  { label: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite-preview' },
  { label: 'Gemini 2 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 2 Flash Lite', value: 'gemini-2.0-flash-lite' },
  { label: 'Gemini 3 Flash', value: 'gemini-3.0-flash-preview' },
  { label: 'Gemini 3.1 Flash Lite', value: 'gemini-3.1-flash-lite-preview' },
  { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro-preview' },
  { label: 'Gemini 2.5 Flash TTS', value: 'gemini-2.5-flash-preview-tts' },
  { label: 'Gemini 2.5 Pro TTS', value: 'gemini-2.5-pro-preview-tts' },
  { label: 'Gemini 3.1 Flash TTS', value: 'gemini-3.1-flash-preview-tts' },
  { label: 'Gemini 2.5 Flash Native Audio Dialog', value: 'gemini-2.5-flash-exp-native-audio-thinking-dialog' },
  { label: 'Gemini 3 Flash Live', value: 'gemini-3.0-flash-live-preview' },
  { label: 'Gemini Embedding 1', value: 'text-embedding-004' },
  { label: 'Gemini Embedding 2', value: 'gemini-embedding-exp' },
  { label: 'Gemma 3 1B', value: 'gemma-3-1b-it' },
  { label: 'Gemma 3 2B', value: 'gemma-3-2b-it' },
  { label: 'Gemma 3 4B', value: 'gemma-3-4b-it' },
  { label: 'Gemma 3 12B', value: 'gemma-3-12b-it' },
  { label: 'Gemma 3 27B', value: 'gemma-3-27b-it' },
  { label: 'Gemma 4 26B', value: 'gemma-4-26b-it' },
  { label: 'Gemma 4 31B', value: 'gemma-4-31b-it' },
  { label: 'Imagen 4 Generate', value: 'imagen-4.0-generate-preview' },
  { label: 'Imagen 4 Ultra Generate', value: 'imagen-4.0-ultra-generate-preview' },
  { label: 'Imagen 4 Fast Generate', value: 'imagen-4.0-fast-generate-preview' },
  { label: 'Nano Banana (Gemini 2.5 Flash Preview Image)', value: 'gemini-2.5-flash-preview-04-17' },
  { label: 'Nano Banana Pro (Gemini 3 Pro Image)', value: 'gemini-3.0-pro-preview' },
  { label: 'Nano Banana 2 (Gemini 3.1 Flash Image)', value: 'gemini-3.1-flash-preview' },
  { label: 'Veo 3 Generate', value: 'veo-3.0-generate-preview' },
  { label: 'Veo 3 Fast Generate', value: 'veo-3.0-fast-generate-preview' },
  { label: 'Veo 3 Lite Generate', value: 'veo-3.0-lite-generate-preview' },
  { label: 'Lyria 3 Clip', value: 'lyria-3-clip' },
  { label: 'Lyria 3 Pro', value: 'lyria-3-pro' },
  { label: 'Gemini Robotics ER 1.5 Preview', value: 'gemini-robotics-er-1.5-preview' },
  { label: 'Gemini Robotics ER 1.6 Preview', value: 'gemini-robotics-er-1.6-preview' },
  { label: 'Computer Use Preview', value: 'gemini-2.5-pro-preview-computer-use' },
  { label: 'Deep Research Pro Preview', value: 'gemini-deep-research-pro-preview' },
];
import { dbImportService } from '../../services/dbImportService';

const diagnosticTypeOptions: SelectOption<'lab' | 'instrumental'>[] = [
    { value: 'lab', label: 'Лабораторный' },
    { value: 'instrumental', label: 'Инструментальный' },
];

const maskDigitsByGroups = (value: string, groups: number[]): string => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
        return '';
    }

    const parts: string[] = [];
    let cursor = 0;

    for (const group of groups) {
        if (cursor >= digits.length) {
            break;
        }

        const nextPart = digits.slice(cursor, cursor + group);
        if (!nextPart) {
            break;
        }

        parts.push(nextPart);
        cursor += group;
    }

    return parts.join(' ');
};

const maskOrganizationInn = (value: string): string => maskDigitsByGroups(value, [4, 6, 2]).slice(0, 14);

const maskOrganizationOgrn = (value: string): string => maskDigitsByGroups(value, [1, 4, 4, 4]).slice(0, 16);

const maskOrganizationPhone = (value: string): string => {
    let digits = value.replace(/\D/g, '');

    if (!digits) {
        return '';
    }

    if (digits.startsWith('8')) {
        digits = `7${digits.slice(1)}`;
    } else if (digits.startsWith('9')) {
        digits = `7${digits}`;
    } else if (!digits.startsWith('7') && digits.length <= 10) {
        digits = `7${digits}`;
    }

    digits = digits.slice(0, 11);
    const localDigits = digits.startsWith('7') ? digits.slice(1) : digits;

    let masked = '+7';
    if (localDigits.length > 0) {
        masked += ` (${localDigits.slice(0, 3)}`;
    }
    if (localDigits.length >= 3) {
        masked += ')';
    }
    if (localDigits.length > 3) {
        masked += ` ${localDigits.slice(3, 6)}`;
    }
    if (localDigits.length > 6) {
        masked += `-${localDigits.slice(6, 8)}`;
    }
    if (localDigits.length > 8) {
        masked += `-${localDigits.slice(8, 10)}`;
    }

    return masked;
};

const normalizeOrganizationProfile = (profile: OrganizationProfile): OrganizationProfile => ({
    ...profile,
    phone: maskOrganizationPhone(profile.phone || ''),
    inn: maskOrganizationInn(profile.inn || ''),
    ogrn: maskOrganizationOgrn(profile.ogrn || ''),
});

export const SettingsModule: React.FC = () => {
    const { currentUser } = useAuth();
    const isAdmin = Boolean(currentUser?.roles?.includes('admin'));

    // Organization profile state
    const [organizationProfile, setOrganizationProfile] = useState<OrganizationProfile>(getDefaultOrganizationProfile());
    const [isLoadingOrganization, setIsLoadingOrganization] = useState(false);
    const [isSavingOrganization, setIsSavingOrganization] = useState(false);
    const [organizationError, setOrganizationError] = useState('');
    const [organizationInfo, setOrganizationInfo] = useState('');

    // Backup State
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [backupResult, setBackupResult] = useState<{ success?: boolean; path?: string; error?: string } | null>(null);

    // DB Import State
    const [importStep, setImportStep] = useState<'idle' | 'scanning' | 'selecting' | 'importing' | 'done'>('idle');
    const [importFilePath, setImportFilePath] = useState<string | null>(null);
    const [importTables, setImportTables] = useState<DbImportTableInfo[]>([]);
    const [importSelections, setImportSelections] = useState<Record<string, { selected: boolean; strategy: DbImportStrategy }>>({});
    const [importResults, setImportResults] = useState<DbImportTableResult[]>([]);
    const [importError, setImportError] = useState<string>('');

    // API Key Pool State
    const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
    const [isLoadingPool, setIsLoadingPool] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isTestingPool, setIsTestingPool] = useState(false);
    const [testOnlyActiveKeys, setTestOnlyActiveKeys] = useState(true);
    const [poolConnectivityReport, setPoolConnectivityReport] = useState<ApiKeysConnectivityReport | null>(null);
    const [poolConnectivityError, setPoolConnectivityError] = useState('');

    // API Key CRUD state
    const [keysList, setKeysList] = useState<ApiKeyEntry[]>([]);
    const [isLoadingKeys, setIsLoadingKeys] = useState(false);
    const [newKeyValue, setNewKeyValue] = useState('');
    const [newKeyModel, setNewKeyModel] = useState('gemini-2.5-flash');
    const [showNewKeyValue, setShowNewKeyValue] = useState(false);
    const [isAddingKey, setIsAddingKey] = useState(false);
    const [addKeyError, setAddKeyError] = useState('');
    const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
    const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
    const [editingKeyLabel, setEditingKeyLabel] = useState('');
    const [savingLabelId, setSavingLabelId] = useState<string | null>(null);
    const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
    const [editingModelId, setEditingModelId] = useState<string | null>(null);
    const [savingModelId, setSavingModelId] = useState<string | null>(null);
    const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
    const [keyTestResults, setKeyTestResults] = useState<Record<string, { ok: boolean; message: string; latencyMs: number | null }>>({});

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
    const [activeTab, setActiveTab] = useState<'api' | 'catalog' | 'organization' | 'cache' | 'security' | 'diseases' | 'licenses'>('api');

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

    const loadOrganizationProfile = useCallback(async () => {
        setIsLoadingOrganization(true);
        setOrganizationError('');
        try {
            const profile = await organizationService.getProfile();
            setOrganizationProfile(normalizeOrganizationProfile(profile));
        } catch (error: any) {
            setOrganizationError(error.message || 'Не удалось загрузить профиль организации');
        } finally {
            setIsLoadingOrganization(false);
        }
    }, []);

    const handleOrganizationFieldChange = (field: keyof OrganizationProfile, value: string) => {
        let normalizedValue = value;

        if (field === 'phone') {
            normalizedValue = maskOrganizationPhone(value);
        }

        if (field === 'inn') {
            normalizedValue = maskOrganizationInn(value).slice(0, 14);
        }

        if (field === 'ogrn') {
            normalizedValue = maskOrganizationOgrn(value).slice(0, 16);
        }

        setOrganizationProfile(prev => ({
            ...prev,
            [field]: normalizedValue,
        }));
        setOrganizationError('');
        setOrganizationInfo('');
    };

    const handleOrganizationSave = async () => {
        setIsSavingOrganization(true);
        setOrganizationError('');
        setOrganizationInfo('');
        try {
            const saved = await organizationService.upsertProfile({
                ...organizationProfile,
                id: 1,
            });
            setOrganizationProfile(normalizeOrganizationProfile(saved));
            setOrganizationInfo('Профиль организации сохранен.');
        } catch (error: any) {
            setOrganizationError(error.message || 'Не удалось сохранить профиль организации');
        } finally {
            setIsSavingOrganization(false);
        }
    };

    useEffect(() => {
        if (!isAdmin && activeTab === 'licenses') {
            setActiveTab('api');
        }
    }, [isAdmin, activeTab]);

    useEffect(() => {
        // Load pool status and stored keys on mount
        loadPoolStatus();
        loadKeysList();
        
        // Load cache stats
        loadCacheStats();

        // Load vaccine catalog
        loadVaccineCatalog();

        // Load organization profile
        loadOrganizationProfile();
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

    // ── Key CRUD handlers ────────────────────────────────────────────────────

    const loadKeysList = async () => {
        setIsLoadingKeys(true);
        try {
            const list = await apiKeyService.listKeys();
            setKeysList(list);
        } catch (error: any) {
            console.error('Failed to load keys list:', error);
        } finally {
            setIsLoadingKeys(false);
        }
    };

    const handleAddKey = async () => {
        setAddKeyError('');
        if (!newKeyValue.trim()) { setAddKeyError('Вставьте ключ'); return; }
        setIsAddingKey(true);
        try {
            const autoLabel = `Ключ ${keysList.length + 1}`;
            await apiKeyService.addKey(autoLabel, newKeyValue.trim(), newKeyModel);
            setNewKeyValue('');
            setNewKeyModel('gemini-2.5-flash');
            await loadKeysList();
            await loadPoolStatus();
        } catch (error: any) {
            setAddKeyError(error.message || 'Не удалось добавить ключ');
        } finally {
            setIsAddingKey(false);
        }
    };

    const handleSaveModel = async (id: string, model: string) => {
        setSavingModelId(id);
        try {
            await apiKeyService.updateModel(id, model);
            await loadKeysList();
            setEditingModelId(null);
        } catch (error: any) {
            console.error('Failed to update model:', error);
        } finally {
            setSavingModelId(null);
        }
    };

    const handleTestKey = async (id: string) => {
        setTestingKeyId(id);
        setKeyTestResults(prev => { const next = { ...prev }; delete next[id]; return next; });
        try {
            const result = await apiKeyService.testSingleKey(id);
            setKeyTestResults(prev => ({ ...prev, [id]: { ok: result.ok, message: result.message, latencyMs: result.latencyMs } }));
        } catch (error: any) {
            setKeyTestResults(prev => ({ ...prev, [id]: { ok: false, message: error?.message || 'Ошибка', latencyMs: null } }));
        } finally {
            setTestingKeyId(null);
        }
    };

    const handleDeleteKey = async (id: string) => {
        setDeletingKeyId(id);
        try {
            await apiKeyService.deleteKey(id);
            await loadKeysList();
            await loadPoolStatus();
        } catch (error: any) {
            console.error('Failed to delete key:', error);
        } finally {
            setDeletingKeyId(null);
        }
    };

    const handleStartEditLabel = (key: ApiKeyEntry) => {
        setEditingKeyId(key.id);
        setEditingKeyLabel(key.label);
    };

    const handleSaveLabel = async (id: string) => {
        if (!editingKeyLabel.trim()) return;
        setSavingLabelId(id);
        try {
            await apiKeyService.updateKeyLabel(id, editingKeyLabel.trim());
            await loadKeysList();
            setEditingKeyId(null);
        } catch (error: any) {
            console.error('Failed to update label:', error);
        } finally {
            setSavingLabelId(null);
        }
    };

    const handleSetPrimary = async (id: string) => {
        setSettingPrimaryId(id);
        try {
            await apiKeyService.setPrimary(id);
            await loadKeysList();
        } catch (error: any) {
            console.error('Failed to set primary key:', error);
        } finally {
            setSettingPrimaryId(null);
        }
    };

    const handleTestPoolConnectivity = async () => {
        setIsTestingPool(true);
        setPoolConnectivityError('');
        setPoolConnectivityReport(null);

        try {
            const report = await apiKeyService.testConnectivity({
                onlyActive: testOnlyActiveKeys,
                timeoutMs: 12000,
            });
            setPoolConnectivityReport(report);
            await loadPoolStatus();
        } catch (error: any) {
            setPoolConnectivityError(error?.message || 'Не удалось выполнить тест ключей');
        } finally {
            setIsTestingPool(false);
        }
    };

    const getConnectivityBadgeClass = (status: string) => {
        switch (status) {
            case 'ok':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'invalid_key':
            case 'permission':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'network':
            case 'timeout':
            case 'rate_limited':
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            default:
                return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
        }
    };

    const getConnectivityStatusLabel = (status: string) => {
        switch (status) {
            case 'ok': return 'OK';
            case 'invalid_key': return 'Неверный ключ';
            case 'permission': return 'Нет доступа';
            case 'network': return 'Сеть';
            case 'timeout': return 'Таймаут';
            case 'rate_limited': return 'Лимит';
            default: return 'Ошибка';
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

    const handleImportSelectFile = async () => {
        setImportError('');
        setImportResults([]);
        const filePath = await dbImportService.selectDbFile();
        if (!filePath) return;

        setImportStep('scanning');
        setImportFilePath(filePath);
        setImportTables([]);
        setImportSelections({});

        const result = await dbImportService.getTablesFromFile(filePath);
        if (!result.success || !result.tables) {
            setImportError(result.error || 'Не удалось прочитать таблицы из файла');
            setImportStep('idle');
            return;
        }

        const initialSelections: Record<string, { selected: boolean; strategy: DbImportStrategy }> = {};
        for (const t of result.tables) {
            initialSelections[t.name] = { selected: true, strategy: 'merge' };
        }

        setImportTables(result.tables);
        setImportSelections(initialSelections);
        setImportStep('selecting');
    };

    const handleImportExecute = async () => {
        if (!importFilePath) return;

        const selected: DbImportTableSelection[] = Object.entries(importSelections)
            .filter(([, v]) => v.selected)
            .map(([name, v]) => ({ name, strategy: v.strategy }));

        if (selected.length === 0) {
            setImportError('Выберите хотя бы одну таблицу для импорта');
            return;
        }

        setImportStep('importing');
        setImportError('');

        const result = await dbImportService.executeImport(importFilePath, selected);

        setImportResults(result.results || []);
        if (!result.success && !result.results?.length) {
            setImportError(result.error || 'Импорт завершился с ошибкой');
            setImportStep('selecting');
        } else {
            setImportStep('done');
        }
    };

    const handleImportReset = () => {
        setImportStep('idle');
        setImportFilePath(null);
        setImportTables([]);
        setImportSelections({});
        setImportResults([]);
        setImportError('');
    };

    // ── Navigation config ──────────────────────────────────────────────────
    const NAV_TABS = [
        { id: 'api'          as const, icon: Key,         label: 'API и ключи',        description: 'Gemini API, пул ключей'   },
        { id: 'catalog'      as const, icon: Database,    label: 'Каталог вакцин',     description: 'Глобальный календарь'     },
        { id: 'organization' as const, icon: Building2,   label: 'Организация',        description: 'Профиль организации'      },
        { id: 'diseases'     as const, icon: Stethoscope, label: 'Болезни',            description: 'Каталог диагностики'      },
        { id: 'cache'        as const, icon: Zap,         label: 'Производительность', description: 'Мониторинг кеша'          },
        { id: 'security'     as const, icon: Shield,      label: 'Безопасность',       description: 'Данные и резервные копии' },
        ...(isAdmin ? [{ id: 'licenses' as const, icon: Key, label: 'Лицензии', description: 'Управление лицензиями' }] : []),
    ];

    return (
        <div className="max-w-6xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── Mobile: header + horizontal scroll nav (< md) ─────── */}
            <div className="md:hidden mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Настройки</h1>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {NAV_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-all ${
                                    isActive
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                                }`}
                            >
                                <Icon size={14} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-start gap-8">

                {/* ── Desktop sidebar (≥ md) ─────────────────────────── */}
                <aside className="hidden md:flex flex-col w-56 shrink-0">
                    <div className="mb-6 px-1">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Настройки</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Параметры приложения</p>
                    </div>
                    <nav className="sticky top-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 space-y-0.5">
                        {NAV_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                                        isActive
                                            ? 'bg-blue-50 dark:bg-blue-950/40'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                    }`}
                                >
                                    <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                                        isActive
                                            ? 'bg-blue-100 dark:bg-blue-900/50'
                                            : 'bg-slate-100 dark:bg-slate-700/60'
                                    }`}>
                                        <Icon
                                            size={15}
                                            className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-medium leading-tight ${
                                            isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'
                                        }`}>
                                            {tab.label}
                                        </div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                                            {tab.description}
                                        </div>
                                    </div>
                                    {isActive && (
                                        <div className="w-1 h-5 bg-blue-500 rounded-full shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* ── Main content ───────────────────────────────────── */}
                <main className="flex-1 min-w-0">

            {activeTab === 'api' && (
            <>
            {/* Google Gemini API Keys — CRUD */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Key className="text-blue-600 dark:text-blue-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Google Gemini API ключи</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Ключи хранятся зашифрованными внутри приложения. Получить ключ на{' '}
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline">Google AI Studio</a>.
                        </p>
                    </div>
                </div>

                {/* Stored keys list */}
                <div className="space-y-2 mb-5">
                    {isLoadingKeys ? (
                        <div className="flex items-center gap-2 py-4 text-slate-400">
                            <Loader className="animate-spin" size={16} />
                            <span className="text-sm">Загрузка ключей...</span>
                        </div>
                    ) : keysList.length === 0 ? (
                        <div className="py-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                            Ключи не добавлены. Добавьте первый ключ ниже.
                        </div>
                    ) : (
                        keysList.map((key) => (
                            <div key={key.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/40 ${
                                    key.isPrimary
                                        ? 'border-yellow-400 dark:border-yellow-500'
                                        : 'border-slate-200 dark:border-slate-700'
                                }`}>
                                <Key size={16} className={key.isPrimary ? 'text-yellow-500 flex-shrink-0' : 'text-slate-400 flex-shrink-0'} />
                                {editingKeyId === key.id ? (
                                    <input
                                        className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                                        value={editingKeyLabel}
                                        onChange={e => setEditingKeyLabel(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveLabel(key.id); if (e.key === 'Escape') setEditingKeyId(null); }}
                                        autoFocus
                                    />
                                ) : (
                                    <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                        {key.label}
                                        {key.isPrimary && <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400 font-normal">основной</span>}
                                    </span>
                                )}
                                <span className="text-xs text-slate-400 hidden sm:block flex-shrink-0">
                                    {new Date(key.createdAt).toLocaleDateString('ru-RU')}
                                </span>
                                {/* Model selector / badge */}
                                {editingModelId === key.id ? (
                                    <select
                                        value={key.model}
                                        onChange={e => handleSaveModel(key.id, e.target.value)}
                                        onBlur={() => setEditingModelId(null)}
                                        autoFocus
                                        className="text-xs px-2 py-1 border border-blue-400 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none max-w-[200px]"
                                    >
                                        {GEMINI_MODELS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <button onClick={() => setEditingModelId(key.id)} title="Изменить модель"
                                        className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-shrink-0 max-w-[160px] truncate">
                                        {savingModelId === key.id
                                            ? <Loader size={12} className="animate-spin" />
                                            : (GEMINI_MODELS.find(m => m.value === key.model)?.label ?? key.model)}
                                    </button>
                                )}
                                {/* Set primary button */}
                                {!key.isPrimary && editingKeyId !== key.id && (
                                    <button onClick={() => handleSetPrimary(key.id)} disabled={settingPrimaryId === key.id}
                                        title="Сделать основным"
                                        className="p-1.5 rounded text-slate-300 hover:text-yellow-500 dark:text-slate-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 disabled:opacity-50">
                                        {settingPrimaryId === key.id ? <Loader size={14} className="animate-spin" /> : <Star size={14} />}
                                    </button>
                                )}
                                {editingKeyId === key.id ? (
                                    <button onClick={() => handleSaveLabel(key.id)} disabled={!!savingLabelId}
                                        className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50">
                                        {savingLabelId === key.id ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                                    </button>
                                ) : (
                                    <button onClick={() => handleStartEditLabel(key)} title="Переименовать"
                                        className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                                        <Pencil size={14} />
                                    </button>
                                )}
                                {/* Test key button */}
                                <button onClick={() => handleTestKey(key.id)} disabled={testingKeyId === key.id}
                                    title="Проверить ключ"
                                    className="p-1.5 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50">
                                    {testingKeyId === key.id
                                        ? <Loader size={14} className="animate-spin" />
                                        : keyTestResults[key.id] !== undefined
                                            ? keyTestResults[key.id].ok
                                                ? <Check size={14} className="text-green-500" />
                                                : <X size={14} className="text-red-500" />
                                            : <Zap size={14} />}
                                </button>
                                {keyTestResults[key.id] && (
                                    <span className={`text-xs flex-shrink-0 max-w-[200px] break-words whitespace-normal leading-tight ${keyTestResults[key.id].ok ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                        {keyTestResults[key.id].ok
                                            ? `${keyTestResults[key.id].latencyMs}ms`
                                            : keyTestResults[key.id].message}
                                    </span>
                                )}
                                <button onClick={() => handleDeleteKey(key.id)} disabled={deletingKeyId === key.id}
                                    title="Удалить ключ"
                                    className="p-1.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
                                    {deletingKeyId === key.id ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Add key form */}
                <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-3">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Добавить ключ</p>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type={showNewKeyValue ? 'text' : 'password'}
                                placeholder="Вставьте ключ из Google AI Studio (AIzaSy...)"
                                value={newKeyValue}
                                onChange={e => { setNewKeyValue(e.target.value); setAddKeyError(''); }}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddKey(); }}
                                className="w-full px-3 py-2 pr-10 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button type="button" onClick={() => setShowNewKeyValue(v => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                {showNewKeyValue ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <select
                            value={newKeyModel}
                            onChange={e => setNewKeyModel(e.target.value)}
                            className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent max-w-[220px]"
                        >
                            {GEMINI_MODELS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                        <button onClick={handleAddKey} disabled={isAddingKey || !newKeyValue.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
                            {isAddingKey ? <Loader size={15} className="animate-spin" /> : <Plus size={15} />}
                            Добавить
                        </button>
                    </div>
                    {addKeyError && (
                        <p className="text-sm text-red-600 dark:text-red-400">{addKeyError}</p>
                    )}
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
                                        Добавьте новые ключи в разделе «Google Gemini API ключи» выше.
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
                                onClick={loadPoolStatus}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 
                                    rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
                            >
                                <RefreshCw size={16} />
                                Обновить
                            </button>
                        </div>

                        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Тест доступности ключей</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Выполняет реальный тестовый запрос к Gemini API и показывает результат по каждому ключу.
                                    </p>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={testOnlyActiveKeys}
                                        onChange={(e) => setTestOnlyActiveKeys(e.target.checked)}
                                        className="rounded border-slate-300 dark:border-slate-600"
                                    />
                                    Только активные ключи
                                </label>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleTestPoolConnectivity}
                                    disabled={isTestingPool}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    {isTestingPool ? (
                                        <>
                                            <Loader className="animate-spin" size={16} />
                                            Проверка ключей...
                                        </>
                                    ) : (
                                        <>
                                            <FlaskConical size={16} />
                                            Проверить ключи
                                        </>
                                    )}
                                </button>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Таймаут запроса: 12s</span>
                            </div>

                            {poolConnectivityError && (
                                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                                    {poolConnectivityError}
                                </div>
                            )}

                            {poolConnectivityReport && (
                                <div className="mt-4 space-y-3">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Проверено</p>
                                            <p className="text-lg font-semibold text-slate-900 dark:text-white">{poolConnectivityReport.totalTested}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                                            <p className="text-xs text-green-700 dark:text-green-400">Успешно</p>
                                            <p className="text-lg font-semibold text-green-700 dark:text-green-400">{poolConnectivityReport.ok}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                                            <p className="text-xs text-red-700 dark:text-red-400">С ошибкой</p>
                                            <p className="text-lg font-semibold text-red-700 dark:text-red-400">{poolConnectivityReport.failed}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {poolConnectivityReport.results.map((item) => (
                                            <div
                                                key={item.index}
                                                className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Ключ [{item.index}]</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getConnectivityBadgeClass(item.status)}`}>
                                                        {getConnectivityStatusLabel(item.status)}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    {item.latencyMs != null ? `${item.latencyMs} ms` : '—'}
                                                </div>
                                                <div className="w-full text-xs text-slate-600 dark:text-slate-300">{item.message}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                Ключи хранятся зашифрованными внутри приложения. Для добавления новых ключей используйте форму выше.
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

            {activeTab === 'organization' && (
            <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Building2 className="text-blue-600 dark:text-blue-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Профиль организации</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Данные используются в печатных формах как шапка документа
                        </p>
                    </div>
                </div>

                {isLoadingOrganization ? (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 py-3">
                        <Loader className="animate-spin" size={18} />
                        Загрузка профиля организации...
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                                value={organizationProfile.name || ''}
                                onChange={(e) => handleOrganizationFieldChange('name', e.target.value)}
                                placeholder="Название организации *"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <input
                                value={organizationProfile.legalName || ''}
                                onChange={(e) => handleOrganizationFieldChange('legalName', e.target.value)}
                                placeholder="Полное юридическое наименование"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <input
                                value={organizationProfile.department || ''}
                                onChange={(e) => handleOrganizationFieldChange('department', e.target.value)}
                                placeholder="Отделение / подразделение"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <input
                                value={organizationProfile.chiefDoctor || ''}
                                onChange={(e) => handleOrganizationFieldChange('chiefDoctor', e.target.value)}
                                placeholder="Главный врач"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <input
                                value={organizationProfile.phone || ''}
                                onChange={(e) => handleOrganizationFieldChange('phone', e.target.value)}
                                placeholder="+7 (999) 123-45-67"
                                inputMode="tel"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <input
                                value={organizationProfile.email || ''}
                                onChange={(e) => handleOrganizationFieldChange('email', e.target.value)}
                                placeholder="Email"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <input
                                value={organizationProfile.website || ''}
                                onChange={(e) => handleOrganizationFieldChange('website', e.target.value)}
                                placeholder="Сайт"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <input
                                value={organizationProfile.inn || ''}
                                onChange={(e) => handleOrganizationFieldChange('inn', e.target.value)}
                                placeholder="1234 567890"
                                inputMode="numeric"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <input
                                value={organizationProfile.ogrn || ''}
                                onChange={(e) => handleOrganizationFieldChange('ogrn', e.target.value)}
                                placeholder="1 2345 6789 0123"
                                inputMode="numeric"
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                            <textarea
                                value={organizationProfile.address || ''}
                                onChange={(e) => handleOrganizationFieldChange('address', e.target.value)}
                                rows={3}
                                placeholder="Адрес"
                                className="md:col-span-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                        </div>

                        {organizationError && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                                {organizationError}
                            </div>
                        )}

                        {organizationInfo && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
                                {organizationInfo}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={loadOrganizationProfile}
                                disabled={isLoadingOrganization || isSavingOrganization}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={16} />
                                Обновить
                            </button>
                            <button
                                onClick={handleOrganizationSave}
                                disabled={isSavingOrganization}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {isSavingOrganization ? <Loader className="animate-spin" size={16} /> : <Check size={16} />}
                                Сохранить профиль
                            </button>
                        </div>
                    </div>
                )}
            </div>
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
                                    onChange={(value) => setNewEntryType(value as 'lab' | 'instrumental')}
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

                    {/* ── DB Import Section ──────────────────────────── */}
                    {isAdmin && (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50">
                            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Upload className="text-amber-600 dark:text-amber-400" size={18} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Импорт из внешней базы данных</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Перенос таблиц из другого файла БД той же архитектуры. Перед импортом автоматически создаётся резервная копия.
                                </p>
                            </div>
                            {importStep !== 'idle' && (
                                <button
                                    onClick={handleImportReset}
                                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1 rounded"
                                >
                                    Сбросить
                                </button>
                            )}
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Step: idle */}
                            {importStep === 'idle' && (
                                <button
                                    onClick={handleImportSelectFile}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors text-sm font-medium"
                                >
                                    <Upload size={16} />
                                    Выбрать файл базы данных…
                                </button>
                            )}

                            {/* Step: scanning */}
                            {importStep === 'scanning' && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                    <Loader className="animate-spin" size={16} />
                                    Сканирование таблиц…
                                </div>
                            )}

                            {/* Error */}
                            {importError && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                    <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={16} />
                                    <p className="text-xs text-red-700 dark:text-red-300">{importError}</p>
                                </div>
                            )}

                            {/* Step: selecting */}
                            {importStep === 'selecting' && importTables.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Файл: <span className="font-mono text-slate-700 dark:text-slate-300 break-all">{importFilePath?.split(/[\\/]/).pop()}</span>
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setImportSelections(prev => {
                                                    const next = { ...prev };
                                                    for (const k of Object.keys(next)) next[k] = { ...next[k], selected: true };
                                                    return next;
                                                })}
                                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                Все
                                            </button>
                                            <span className="text-slate-300 dark:text-slate-600">|</span>
                                            <button
                                                onClick={() => setImportSelections(prev => {
                                                    const next = { ...prev };
                                                    for (const k of Object.keys(next)) next[k] = { ...next[k], selected: false };
                                                    return next;
                                                })}
                                                className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                                            >
                                                Снять
                                            </button>
                                        </div>
                                    </div>

                                    <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {importTables.map((t) => {
                                            const sel = importSelections[t.name];
                                            if (!sel) return null;
                                            return (
                                                <div key={t.name} className={`flex items-center gap-3 px-3 py-2 transition-colors ${sel.selected ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900/30'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={sel.selected}
                                                        onChange={(e) => setImportSelections(prev => ({
                                                            ...prev,
                                                            [t.name]: { ...prev[t.name], selected: e.target.checked }
                                                        }))}
                                                        className="rounded border-slate-300 text-indigo-600"
                                                    />
                                                    <span className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-300">{t.name}</span>
                                                    <span className="text-xs text-slate-400 tabular-nums">{t.rowCount} строк</span>
                                                    {sel.selected && (
                                                        <select
                                                            value={sel.strategy}
                                                            onChange={(e) => setImportSelections(prev => ({
                                                                ...prev,
                                                                [t.name]: { ...prev[t.name], strategy: e.target.value as DbImportStrategy }
                                                            }))}
                                                            className="text-xs border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                                        >
                                                            <option value="merge">Merge (пропустить дубли)</option>
                                                            <option value="replace">Replace (заменить всё)</option>
                                                            <option value="append">Append (добавить с заменой)</option>
                                                        </select>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="flex items-center gap-3 pt-1">
                                        <button
                                            onClick={handleImportExecute}
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm font-medium"
                                        >
                                            <FileCheck size={16} />
                                            Выполнить импорт
                                        </button>
                                        <p className="text-xs text-slate-400">
                                            {Object.values(importSelections).filter(s => s.selected).length} из {importTables.length} таблиц выбрано
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Step: importing */}
                            {importStep === 'importing' && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                    <Loader className="animate-spin" size={16} />
                                    Выполняется импорт… Пожалуйста, не закрывайте приложение.
                                </div>
                            )}

                            {/* Step: done */}
                            {importStep === 'done' && importResults.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Результаты импорта:</p>
                                    <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700/50">
                                        {importResults.map((r) => (
                                            <div key={r.table} className="flex items-center gap-3 px-3 py-2">
                                                {r.status === 'success' && <Check className="text-green-500 flex-shrink-0" size={14} />}
                                                {r.status === 'skipped' && <ChevronRight className="text-slate-400 flex-shrink-0" size={14} />}
                                                {r.status === 'error' && <X className="text-red-500 flex-shrink-0" size={14} />}
                                                <span className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-300">{r.table}</span>
                                                {r.status === 'success' && (
                                                    <span className="text-xs text-green-600 dark:text-green-400">{r.imported} строк</span>
                                                )}
                                                {r.status === 'skipped' && (
                                                    <span className="text-xs text-slate-400">{r.reason}</span>
                                                )}
                                                {r.status === 'error' && (
                                                    <span className="text-xs text-red-500 truncate max-w-[200px]" title={r.reason}>{r.reason}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                        ✓ Импорт завершён. {importResults.filter(r => r.status === 'success').length} таблиц успешно.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            </div>
            )}

            {isAdmin && activeTab === 'licenses' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <LicenseAdminPanel />
            </div>
            )}

                </main>
            </div>
        </div>
    );
};
