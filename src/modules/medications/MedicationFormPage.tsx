import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { medicationService } from './services/medicationService';
import { diseaseService } from '../diseases/services/diseaseService';
import { Medication, Disease } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft,
    Save,
    Plus,
    X,
    Pill,
    AlertCircle,
    CheckCircle2,
    Beaker,
    Scale,
    Calendar,
    Zap,
    ShieldAlert,
    Download,
    Eye,
    History,
    Trash2,
    Copy,
    FileText,
    Stethoscope,
    ExternalLink
} from 'lucide-react';
import { ChangeHistoryPanel } from './components/ChangeHistoryPanel';
import { MedicationDiseasesTab } from './components/MedicationDiseasesTab';
import { PrettySelect, type SelectOption } from '../vaccination/components/PrettySelect';
import VIDAL_JSON_TEMPLATE from './templates/vidalJsonTemplate.json';

const ROUTE_OPTIONS: Array<SelectOption<string>> = [
    { value: '', label: 'Не указано' },
    { value: 'oral', label: 'Перорально' },
    { value: 'rectal', label: 'Ректально' },
    { value: 'iv_bolus', label: 'В/В болюсно' },
    { value: 'iv_infusion', label: 'В/В капельно' },
    { value: 'iv_slow', label: 'В/В медленно' },
    { value: 'im', label: 'В/М' },
    { value: 'sc', label: 'П/К' },
    { value: 'sublingual', label: 'Сублингвально' },
    { value: 'topical', label: 'Наружно' },
    { value: 'inhalation', label: 'Ингаляционно' },
    { value: 'intranasal', label: 'Интраназально' },
    { value: 'transdermal', label: 'Трансдермально' },
];

const DOSING_TYPE_OPTIONS: Array<SelectOption<string>> = [
    { value: 'weight_based', label: 'По весу (мг/кг)' },
    { value: 'bsa_based', label: 'По ППТ (мг/м²)' },
    { value: 'fixed', label: 'Фиксированная доза' },
    { value: 'age_based', label: 'По возрасту' },
];

const VIDAL_USING_OPTIONS: Array<SelectOption<string>> = [
    { value: '', label: '—' },
    { value: 'Can', label: 'Can — можно' },
    { value: 'Care', label: 'Care — с осторожностью' },
    { value: 'Not', label: 'Not — нельзя' },
    { value: 'Qwes', label: 'Qwes — под вопросом' },
];

export const MedicationFormPage: React.FC = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const isEdit = !!id;
    const isViewMode = isEdit && searchParams.get('mode') === 'view';
    
    // Определяем источник навигации
    const fromDisease = searchParams.get('from') === 'disease';
    const diseaseId = searchParams.get('diseaseId');
    const medicationsListPath = `/medications${location.search}`;

    const [formData, setFormData] = useState<Partial<Medication>>({
        nameRu: '',
        nameEn: '',
        activeSubstance: '',
        atcCode: '',
        manufacturer: '',
        forms: [],
        pediatricDosing: [],
        icd10Codes: [],
        packageDescription: '',
        contraindications: '',
        indications: [],
    });
    const [icd10Input, setIcd10Input] = useState('');

    // Вкладки (только в режиме редактирования)
    const [activeTab, setActiveTab] = useState<'form' | 'diseases'>('form');

    // Список болезней для inline preview МКБ-10
    const [allDiseases, setAllDiseases] = useState<Disease[]>([]);

    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    
    // Импорт из Видаль
    const [isImporting, setIsImporting] = useState(false);
    const [vidalUrl, setVidalUrl] = useState('');
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [importMethod, setImportMethod] = useState<'url' | 'json'>('url');
    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<Medication | null>(null);
    const [validationResult, setValidationResult] = useState<{
        isValid: boolean;
        errors: any[];
        warnings: any[];
        needsReview: boolean;
    } | null>(null);
    
    // Проверка дубликатов
    const [duplicateWarning, setDuplicateWarning] = useState<{
        show: boolean;
        duplicate: Medication | null;
    }>({ show: false, duplicate: null });
    const [ignoreDuplicate, setIgnoreDuplicate] = useState(false);

    const fullInstructionText = useMemo(() => {
        const value = formData.fullInstruction;
        if (value == null) return '';
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }, [formData.fullInstruction]);

    useEffect(() => {
        if (isEdit && id) {
            loadMedication();
        }
    }, [isEdit, id]);

    // Загрузка всех болезней для inline preview МКБ-10
    useEffect(() => {
        diseaseService.getDiseases()
            .then(setAllDiseases)
            .catch(() => { /* некритично — preview просто не покажется */ });
    }, []);

    // Производный список болезней, совпадающих с текущими кодами МКБ-10
    const matchingDiseases = useMemo(() => {
        const codes = formData.icd10Codes ?? [];
        if (codes.length === 0 || allDiseases.length === 0) return [];

        return allDiseases.filter(disease => {
            const diseaseCodes = [disease.icd10Code, ...(disease.icd10Codes ?? [])];
            return codes.some(medCode =>
                diseaseCodes.some(dc =>
                    dc === medCode ||
                    dc.startsWith(medCode + '.') ||
                    medCode.startsWith(dc + '.')
                )
            );
        });
    }, [formData.icd10Codes, allDiseases]);

    // Коды без совпадений (для предупреждения)
    const unmatchedCodes = useMemo(() => {
        const codes = formData.icd10Codes ?? [];
        if (codes.length === 0 || allDiseases.length === 0) return [];

        return codes.filter(medCode => {
            return !allDiseases.some(disease => {
                const diseaseCodes = [disease.icd10Code, ...(disease.icd10Codes ?? [])];
                return diseaseCodes.some(dc =>
                    dc === medCode ||
                    dc.startsWith(medCode + '.') ||
                    medCode.startsWith(dc + '.')
                );
            });
        });
    }, [formData.icd10Codes, allDiseases]);

    // Проверка дубликатов при изменении названия
    const checkForDuplicates = async (name: string) => {
        if (!name.trim() || ignoreDuplicate) {
            setDuplicateWarning({ show: false, duplicate: null });
            return;
        }

        try {
            const result = await medicationService.checkDuplicate(
                name,
                isEdit ? Number(id) : undefined
            );

            if (result.success && result.hasDuplicate && result.duplicate) {
                setDuplicateWarning({ show: true, duplicate: result.duplicate });
            } else {
                setDuplicateWarning({ show: false, duplicate: null });
            }
        } catch (err) {
            console.error('Failed to check duplicates:', err);
        }
    };

    // Debounced проверка при вводе названия
    useEffect(() => {
        if (ignoreDuplicate) return;
        
        const timer = setTimeout(() => {
            if (formData.nameRu) {
                checkForDuplicates(formData.nameRu);
            }
        }, 500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.nameRu, ignoreDuplicate, isEdit, id]);

    const parseIcd10Codes = (value: string) => {
        return value
            .split(/[,\n;]/)
            .map(code => code.trim().toUpperCase())
            .filter(Boolean);
    };

    const normalizeIcd10Codes = (value: unknown): string[] => {
        if (Array.isArray(value)) {
            return value
                .map(code => String(code).trim().toUpperCase())
                .filter(Boolean);
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [];

            if (trimmed.startsWith('[')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) {
                        return parsed
                            .map(code => String(code).trim().toUpperCase())
                            .filter(Boolean);
                    }
                } catch {
                    // Fall back to comma-separated parsing for legacy values.
                }
            }

            return parseIcd10Codes(trimmed);
        }

        return [];
    };

    const loadMedication = async () => {
        try {
            const data = await medicationService.getMedication(Number(id));
            if (!data) {
                setError('Препарат не найден');
                setTimeout(() => navigate(medicationsListPath), 2000);
                return;
            }
            const normalizedIcd10Codes = normalizeIcd10Codes(data.icd10Codes);
            setFormData({
                ...data,
                icd10Codes: normalizedIcd10Codes,
            });
            setIcd10Input(normalizedIcd10Codes.join(', '));
        } catch (err: any) {
            setError(err?.message || 'Не удалось загрузить данные препарата');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Если есть предупреждение о дублировании и пользователь не подтвердил
        if (duplicateWarning.show && !ignoreDuplicate) {
            setError('Подтвердите создание препарата с дублирующимся названием или откройте существующий');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const source = validationResult ? 'vidal_import' : 'manual';
            const icd10Codes = parseIcd10Codes(icd10Input);
            await medicationService.upsertMedication({ ...formData, icd10Codes } as Medication, source);
            setSuccess(true);
            setTimeout(() => navigate(medicationsListPath), 1500);
        } catch (err: any) {
            setError(err.message || 'Произошла ошибка при сохранении');
        } finally {
            setIsSaving(false);
        }
    };

    // Валидация JSON в реальном времени
    useEffect(() => {
        if (importMethod === 'json' && jsonText.trim()) {
            try {
                JSON.parse(jsonText);
                setJsonError(null);
            } catch (err: any) {
                setJsonError(err.message || 'Неверный формат JSON');
            }
        } else {
            setJsonError(null);
        }
    }, [jsonText, importMethod]);

    const handleCopyTemplate = () => {
        const templateStr = JSON.stringify(VIDAL_JSON_TEMPLATE, null, 2);
        navigator.clipboard.writeText(templateStr).then(() => {
            setJsonText(templateStr);
            setError(null);
        }).catch(() => {
            setError('Не удалось скопировать шаблон');
        });
    };

    const handleImportFromVidal = async () => {
        if (importMethod === 'url') {
            if (!vidalUrl.trim()) {
                setError('Введите URL страницы Видаль');
                return;
            }
            
            setIsImporting(true);
            setError(null);
            
            try {
                const result = await medicationService.importFromVidal(vidalUrl);
                
                if (result.success && result.data) {
                    // Проверить на дубликаты перед заполнением формы
                    const dupCheck = await medicationService.checkDuplicate(
                        result.data.nameRu,
                        isEdit ? Number(id) : undefined
                    );
                    
                    if (dupCheck.success && dupCheck.hasDuplicate && dupCheck.duplicate) {
                        // Показать предупреждение
                        setDuplicateWarning({ show: true, duplicate: dupCheck.duplicate });
                    }
                    
                    // Сохранить результаты валидации
                    if (result.validation) {
                        setValidationResult(result.validation);
                    }
                    
                    // Показать предпросмотр
                    setPreviewData(result.data);
                    setShowPreview(true);
                    setShowImportDialog(false);
                } else {
                    setError(result.error || 'Не удалось импортировать данные');
                }
            } catch (err: any) {
                setError(err.message || 'Произошла ошибка при импорте');
            } finally {
                setIsImporting(false);
            }
        } else {
            // Импорт из JSON
            if (!jsonText.trim()) {
                setError('Вставьте JSON данные');
                return;
            }
            
            if (jsonError) {
                setError('Исправьте ошибки в JSON перед импортом');
                return;
            }
            
            setIsImporting(true);
            setError(null);
            
            try {
                const result = await medicationService.importFromJson(jsonText);
                
                if (result.success && result.data) {
                    // Проверить на дубликаты перед заполнением формы
                    const dupCheck = await medicationService.checkDuplicate(
                        result.data.nameRu,
                        isEdit ? Number(id) : undefined
                    );
                    
                    if (dupCheck.success && dupCheck.hasDuplicate && dupCheck.duplicate) {
                        // Показать предупреждение
                        setDuplicateWarning({ show: true, duplicate: dupCheck.duplicate });
                    }
                    
                    // Сохранить результаты валидации
                    if (result.validation) {
                        setValidationResult(result.validation);
                    }
                    
                    // Показать предпросмотр
                    setPreviewData(result.data);
                    setShowPreview(true);
                    setShowImportDialog(false);
                } else {
                    setError(result.error || 'Не удалось импортировать данные');
                }
            } catch (err: any) {
                setError(err.message || 'Произошла ошибка при импорте');
            } finally {
                setIsImporting(false);
            }
        }
    };

    const handleConfirmImport = () => {
        // Если есть критичные ошибки - вернуться к редактированию JSON
        if (validationResult && !validationResult.isValid) {
            setShowPreview(false);
            setShowImportDialog(true);
            setImportMethod('json');
            // Восстанавливаем JSON для редактирования
            if (previewData) {
                setJsonText(JSON.stringify(previewData, null, 2));
            }
            return;
        }
        
        if (previewData) {
            const normalizedIcd10Codes = normalizeIcd10Codes(previewData.icd10Codes);
            setFormData({
                ...formData,
                ...previewData,
                icd10Codes: normalizedIcd10Codes,
            });
            setIcd10Input(normalizedIcd10Codes.join(', '));
            setShowPreview(false);
            setPreviewData(null);
            // Сохраняем validationResult для отображения в форме
            setSuccess(true);
        }
    };

    const addDosingRule = () => {
        setFormData({
            ...formData,
            pediatricDosing: [
                ...(formData.pediatricDosing as any[] || []),
                { 
                    minAgeMonths: 0, 
                    maxAgeMonths: 216, 
                    dosing: { type: 'weight_based', mgPerKg: 0 },
                    routeOfAdmin: 'oral',
                    timesPerDay: 1, 
                    instruction: '',
                    maxSingleDose: null,
                    maxDailyDose: null
                }
            ]
        });
    };

    const updateDosingRule = (index: number, updates: any) => {
        const newRules = [...(formData.pediatricDosing as any[] || [])];
        newRules[index] = { ...newRules[index], ...updates };
        setFormData({ ...formData, pediatricDosing: newRules });
    };

    const removeDosingRule = (index: number) => {
        setFormData({
            ...formData,
            pediatricDosing: (formData.pediatricDosing as any[] || []).filter((_, i) => i !== index)
        });
    };

    const handleBack = () => {
        if (fromDisease && diseaseId) {
            // Если открыто из базы знаний - вернуться к заболеванию
            navigate(`/diseases/${diseaseId}`);
        } else {
            // Если открыто из модуля препаратов - вернуться к списку препаратов
            navigate(medicationsListPath);
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        
        setIsDeleting(true);
        setError(null);
        
        try {
            await medicationService.deleteMedication(Number(id));
            // Кеш инвалидируется автоматически через dataEvents в сервисе
            setSuccess(true);
            setTimeout(() => {
                navigate(medicationsListPath);
            }, 1000);
        } catch (err: any) {
            setError(err.message || 'Не удалось удалить препарат');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleSwitchToEditMode = () => {
        if (!isEdit || !id) return;
        const params = new URLSearchParams(location.search);
        params.set('mode', 'edit');
        const query = params.toString();
        navigate(`/medications/${id}${query ? `?${query}` : ''}`);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={handleBack} className="rounded-xl">
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Назад
                </Button>
                <div className="flex items-center gap-3">
                    {!isViewMode && (
                        <Button
                            variant="secondary"
                            onClick={() => setShowImportDialog(true)}
                            className="rounded-xl"
                        >
                            <Download className="w-5 h-5 mr-2" />
                            Импорт из Видаль
                        </Button>
                    )}
                    {isViewMode && (
                        <Button
                            variant="primary"
                            onClick={handleSwitchToEditMode}
                            className="rounded-xl"
                        >
                            <FileText className="w-5 h-5 mr-2" />
                            Перейти в редактирование
                        </Button>
                    )}
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                        {isViewMode ? 'Карточка препарата' : isEdit ? 'Редактировать препарат' : 'Новый препарат'}
                    </h1>
                </div>
            </div>

            {/* Переключатель вкладок (только в режиме редактирования) */}
            {isEdit && (
                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
                    <button
                        type="button"
                        onClick={() => setActiveTab('form')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            activeTab === 'form'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        <Pill className="w-4 h-4" />
                        Основная информация
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('diseases')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            activeTab === 'diseases'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        <Stethoscope className="w-4 h-4" />
                        Болезни
                        {matchingDiseases.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold">
                                {matchingDiseases.length}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* Режим: вкладка Болезни */}
            {isEdit && activeTab === 'diseases' && (
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-xl">
                    <MedicationDiseasesTab
                        medicationId={Number(id)}
                        icd10Codes={formData.icd10Codes ?? []}
                        onIcd10CodesUpdated={(codes) => {
                            setFormData(prev => ({ ...prev, icd10Codes: codes }));
                            setIcd10Input(codes.join(', '));
                        }}
                    />
                </Card>
            )}

            {/* Режим: форма */}
            {activeTab === 'form' && (
            <form onSubmit={handleSave} className={isViewMode ? 'space-y-6 pb-20 pointer-events-none select-none' : 'space-y-6 pb-20'}>
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-xl">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Pill className="w-5 h-5 text-primary-500" />
                        Основная информация
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Торговое название (RU) *
                            </label>
                            <Input
                                value={formData.nameRu}
                                onChange={e => setFormData({ ...formData, nameRu: e.target.value })}
                                placeholder="Например: Нурофен"
                                required
                                className="h-14 rounded-2xl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Действующее вещество *
                            </label>
                            <Input
                                value={formData.activeSubstance}
                                onChange={e => setFormData({ ...formData, activeSubstance: e.target.value })}
                                placeholder="Ибупрофен"
                                required
                                className="h-14 rounded-2xl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                АТХ-код
                            </label>
                            <Input
                                value={formData.atcCode || ''}
                                onChange={e => setFormData({ ...formData, atcCode: e.target.value.toUpperCase() })}
                                placeholder="M01AE01"
                                className="h-14 rounded-2xl font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Производитель
                            </label>
                            <Input
                                value={formData.manufacturer || ''}
                                onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                                placeholder="Reckitt Benckiser"
                                className="h-14 rounded-2xl"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Описание формы выпуска и упаковки
                            </label>
                            <textarea
                                value={formData.packageDescription || ''}
                                onChange={e => setFormData({ ...formData, packageDescription: e.target.value })}
                                placeholder="Раствор для приема внутрь (вишневый...) 24 мг/1 мл: фл. 50 мл..."
                                className="w-full min-h-[80px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Коды МКБ-10 (через запятую)
                            </label>
                            <textarea
                                value={icd10Input}
                                onChange={e => setIcd10Input(e.target.value)}
                                onBlur={() => setFormData({
                                    ...formData,
                                    icd10Codes: parseIcd10Codes(icd10Input)
                                })}
                                placeholder="J00, J20.9, R50"
                                rows={3}
                                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm font-mono resize-none"
                            />

                            {/* Inline preview совпавших болезней */}
                            {(formData.icd10Codes ?? []).length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {matchingDiseases.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {matchingDiseases.map(disease => (
                                                <button
                                                    key={disease.id}
                                                    type="button"
                                                    onClick={() => navigate(`/diseases/${disease.id}`)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors group"
                                                >
                                                    <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="font-mono font-bold">{disease.icd10Code}</span>
                                                    <span className="text-emerald-600 dark:text-emerald-400 max-w-[160px] truncate">{disease.nameRu}</span>
                                                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {unmatchedCodes.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {unmatchedCodes.map(code => (
                                                <span
                                                    key={code}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-medium"
                                                >
                                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                    <span className="font-mono font-bold">{code}</span>
                                                    <span className="text-amber-600 dark:text-amber-400">нет в базе</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Клинико-фармакологическая группа
                            </label>
                            <Input
                                value={formData.clinicalPharmGroup || ''}
                                onChange={e => setFormData({ ...formData, clinicalPharmGroup: e.target.value })}
                                placeholder="Например: Анальгетик-антипиретик"
                                className="h-14 rounded-2xl"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Фармако-терапевтическая группа
                            </label>
                            <Input
                                value={formData.pharmTherapyGroup || ''}
                                onChange={e => setFormData({ ...formData, pharmTherapyGroup: e.target.value })}
                                placeholder="Например: Анальгетики; другие анальгетики и антипиретики; анилиды"
                                className="h-14 rounded-2xl"
                            />
                        </div>
                    </div>
                </Card>

                {/* Предупреждение о дублировании */}
                {duplicateWarning.show && duplicateWarning.duplicate && !ignoreDuplicate && (
                    <Card className="p-6 rounded-[24px] border-amber-300 bg-amber-50 dark:bg-amber-900/20 shadow-lg animate-in slide-in-from-top-2">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-2">
                                    Препарат с таким названием уже существует
                                </h3>
                                
                                <div className="space-y-2 mb-4">
                                    <p className="text-sm text-amber-800 dark:text-amber-200">
                                        <strong>{duplicateWarning.duplicate.nameRu}</strong>
                                    </p>
                                    <p className="text-sm text-amber-700 dark:text-amber-300">
                                        Действующее вещество: {duplicateWarning.duplicate.activeSubstance}
                                    </p>
                                    {duplicateWarning.duplicate.manufacturer && (
                                        <p className="text-sm text-amber-700 dark:text-amber-300">
                                            Производитель: {duplicateWarning.duplicate.manufacturer}
                                        </p>
                                    )}
                                </div>
                                
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        type="button"
                                        variant="primary"
                                        onClick={() => navigate(`/medications/${duplicateWarning.duplicate?.id}${location.search}`)}
                                        className="rounded-xl"
                                    >
                                        Открыть существующий препарат
                                    </Button>
                                    
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                            setIgnoreDuplicate(true);
                                            setDuplicateWarning({ show: false, duplicate: null });
                                        }}
                                        className="rounded-xl"
                                    >
                                        Создать новый препарат
                                    </Button>
                                    
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => navigate(medicationsListPath)}
                                        className="rounded-xl"
                                    >
                                        Отменить
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Результаты валидации */}
                {validationResult && validationResult.needsReview && (
                    <Card className="p-6 rounded-[24px] border-orange-300 bg-orange-50 dark:bg-orange-900/20 mb-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-orange-100 dark:bg-orange-900/40 rounded-xl">
                                <AlertCircle className="w-6 h-6 text-orange-600" />
                            </div>
                            
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-orange-900 dark:text-orange-100 mb-3">
                                    Данные требуют проверки
                                </h3>
                                
                                {validationResult.errors.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="font-bold text-red-700 dark:text-red-300 mb-2">
                                            ❌ Критичные ошибки ({validationResult.errors.length})
                                        </h4>
                                        <ul className="space-y-1">
                                            {validationResult.errors.map((err, idx) => (
                                                <li key={idx} className="text-sm text-red-600 dark:text-red-400">
                                                    <strong>{err.field}:</strong> {err.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                
                                {validationResult.warnings.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-orange-700 dark:text-orange-300 mb-2">
                                            ⚠️ Предупреждения ({validationResult.warnings.length})
                                        </h4>
                                        <ul className="space-y-1">
                                            {validationResult.warnings.map((warn, idx) => (
                                                <li key={idx} className={`text-sm ${
                                                    warn.severity === 'high' ? 'text-orange-700' : 'text-orange-600'
                                                } dark:text-orange-400`}>
                                                    <strong>{warn.field}:</strong> {warn.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                
                                <div className="mt-4 p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                    <p className="text-sm text-orange-800 dark:text-orange-200">
                                        💡 <strong>Внимание:</strong> Данные получены автоматически с помощью AI. 
                                        Обязательно проверьте все значения перед сохранением!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Dosing Section */}
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Zap className="w-6 h-6 text-amber-500" />
                            Педиатрическое дозирование
                        </h2>
                        <Button type="button" variant="secondary" onClick={addDosingRule} className="rounded-xl">
                            <Plus className="w-4 h-4 mr-2" />
                            Добавить правило
                        </Button>
                    </div>

                    <div className="space-y-5">
                        {(formData.pediatricDosing as any[] || []).map((rule, idx) => (
                            <div key={idx} className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 relative group animate-in slide-in-from-right-2">
                                <button
                                    type="button"
                                    onClick={() => removeDosingRule(idx)}
                                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    title="Удалить правило"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                <div className="space-y-6 pr-8">
                                    {/* Критерии применения: возраст и вес */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Критерии применения</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Возраст, мес</label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        value={rule.minAgeMonths ?? ''}
                                                        onChange={e => updateDosingRule(idx, { minAgeMonths: e.target.value === '' ? 0 : Number(e.target.value) })}
                                                        placeholder="От"
                                                        className="h-10 text-center flex-1 min-w-0"
                                                    />
                                                    <span className="text-slate-400 shrink-0">—</span>
                                                    <Input
                                                        type="number"
                                                        value={rule.maxAgeMonths ?? ''}
                                                        onChange={e => updateDosingRule(idx, { maxAgeMonths: e.target.value === '' ? 216 : Number(e.target.value) })}
                                                        placeholder="До"
                                                        className="h-10 text-center flex-1 min-w-0"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Вес от, кг</label>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={rule.minWeightKg ?? ''}
                                                    onChange={e => updateDosingRule(idx, { minWeightKg: e.target.value === '' ? null : Number(e.target.value) })}
                                                    placeholder="не ограничено"
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Вес до, кг</label>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={rule.maxWeightKg ?? ''}
                                                    onChange={e => updateDosingRule(idx, { maxWeightKg: e.target.value === '' ? null : Number(e.target.value) })}
                                                    placeholder="не ограничено"
                                                    className="h-10"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Пустые поля веса — правило только по возрасту. Пример: до 20 кг → «Вес до» = 20.</p>
                                    </div>

                                    {/* Способ введения и тип дозы */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Способ введения и доза</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Путь введения</label>
                                                <PrettySelect
                                                    value={rule.routeOfAdmin || ''}
                                                    onChange={(value) => updateDosingRule(idx, { routeOfAdmin: value || null })}
                                                    options={ROUTE_OPTIONS}
                                                    buttonClassName="h-10 rounded-xl"
                                                    panelClassName="max-h-72"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Тип дозирования</label>
                                                <PrettySelect
                                                    value={rule.dosing?.type || 'weight_based'}
                                                    onChange={(value) => updateDosingRule(idx, { dosing: { ...rule.dosing, type: value } })}
                                                    options={DOSING_TYPE_OPTIONS}
                                                    buttonClassName="h-10 rounded-xl"
                                                    panelClassName="max-h-72"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    {rule.dosing?.type === 'weight_based' ? 'мг/кг' :
                                                     rule.dosing?.type === 'bsa_based' ? 'мг/м²' :
                                                     rule.dosing?.type === 'fixed' ? 'Доза, мг (мин — макс)' : 'Доза, мг'}
                                                </label>
                                                {rule.dosing?.type === 'weight_based' && (
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        value={rule.dosing?.mgPerKg ?? ''}
                                                        onChange={e => updateDosingRule(idx, { dosing: { ...rule.dosing, mgPerKg: Number(e.target.value) } })}
                                                        className="h-10"
                                                    />
                                                )}
                                                {rule.dosing?.type === 'bsa_based' && (
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        value={rule.dosing?.mgPerM2 ?? ''}
                                                        onChange={e => updateDosingRule(idx, { dosing: { ...rule.dosing, mgPerM2: Number(e.target.value) } })}
                                                        className="h-10"
                                                    />
                                                )}
                                                {rule.dosing?.type === 'age_based' && (
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        value={rule.dosing?.ageBasedDose?.dose ?? ''}
                                                        onChange={e => updateDosingRule(idx, {
                                                            dosing: { ...rule.dosing, ageBasedDose: { dose: Number(e.target.value), unit: 'mg' } }
                                                        })}
                                                        className="h-10"
                                                    />
                                                )}
                                                {rule.dosing?.type === 'fixed' && (
                                                    <div className="flex gap-2 items-center">
                                                        <Input
                                                            type="number"
                                                            value={rule.dosing?.fixedDose?.min ?? ''}
                                                            onChange={e => updateDosingRule(idx, {
                                                                dosing: { ...rule.dosing, fixedDose: { ...rule.dosing?.fixedDose, min: Number(e.target.value), unit: 'mg' } }
                                                            })}
                                                            placeholder="мин"
                                                            className="h-10 flex-1 min-w-0"
                                                        />
                                                        <span className="text-slate-400">—</span>
                                                        <Input
                                                            type="number"
                                                            value={rule.dosing?.fixedDose?.max ?? ''}
                                                            onChange={e => updateDosingRule(idx, {
                                                                dosing: { ...rule.dosing, fixedDose: { ...rule.dosing?.fixedDose, max: Number(e.target.value), unit: 'mg' } }
                                                            })}
                                                            placeholder="макс"
                                                            className="h-10 flex-1 min-w-0"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Кратность и лимиты */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Кратность и лимиты</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Раз в день</label>
                                                <Input
                                                    type="number"
                                                    value={rule.timesPerDay ?? ''}
                                                    onChange={e => updateDosingRule(idx, { timesPerDay: Number(e.target.value) })}
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Макс. разовая, мг</label>
                                                <Input
                                                    type="number"
                                                    value={rule.maxSingleDose ?? ''}
                                                    onChange={e => updateDosingRule(idx, { maxSingleDose: e.target.value === '' ? null : Number(e.target.value) })}
                                                    placeholder="—"
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Макс. суточная, мг</label>
                                                <Input
                                                    type="number"
                                                    value={rule.maxDailyDose ?? ''}
                                                    onChange={e => updateDosingRule(idx, { maxDailyDose: e.target.value === '' ? null : Number(e.target.value) })}
                                                    placeholder="—"
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Интервал, ч</label>
                                                <Input
                                                    type="number"
                                                    value={rule.intervalHours ?? ''}
                                                    onChange={e => updateDosingRule(idx, { intervalHours: e.target.value === '' ? null : Number(e.target.value) })}
                                                    placeholder="—"
                                                    className="h-10"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Инструкция */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Инструкция / комментарий</label>
                                        <textarea
                                            value={rule.instruction ?? ''}
                                            onChange={e => updateDosingRule(idx, { instruction: e.target.value })}
                                            placeholder="Например: Внутрь, после еды. Детям 6–9 лет: по ½ таблетки до 4 раз в сутки..."
                                            rows={3}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y min-h-[80px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(!formData.pediatricDosing || (formData.pediatricDosing as any[]).length === 0) && (
                            <div className="text-center py-10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                                <ShieldAlert className="w-10 h-10 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
                                <p className="text-sm text-slate-400 font-medium italic">Добавьте правила дозирования для использования в CDSS</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Clinical Info */}
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                        Клинические данные
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Инструкция по применению (полная)
                            </label>
                            <textarea
                                value={fullInstructionText}
                                onChange={e => setFormData({ ...formData, fullInstruction: e.target.value || null })}
                                className="w-full min-h-[180px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm font-mono"
                                placeholder="Полная инструкция из Vidal (JSON/текст)..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Показания к применению
                            </label>
                            <textarea
                                value={formData.indications as unknown as string || ''}
                                onChange={e => setFormData({ ...formData, indications: e.target.value as any })}
                                className="w-full min-h-[100px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                placeholder="Перечислите заболевания или симптомы..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Противопоказания
                            </label>
                            <textarea
                                value={formData.contraindications}
                                onChange={e => setFormData({ ...formData, contraindications: e.target.value })}
                                className="w-full min-h-[100px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                placeholder="Абсолютные и относительные противопоказания..."
                            />
                        </div>
                    </div>
                </Card>

                {/* Данные Vidal */}
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-500" />
                        Данные Vidal
                    </h2>

                    <div className="space-y-6">
                        {/* isOtc */}
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="isOtc"
                                checked={formData.isOtc ?? false}
                                onChange={e => setFormData({ ...formData, isOtc: e.target.checked })}
                                className="w-4 h-4 rounded text-primary-600"
                            />
                            <label htmlFor="isOtc" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Безрецептурный препарат (OTC)
                            </label>
                        </div>

                        {/* Передозировка */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Передозировка
                            </label>
                            <textarea
                                value={formData.overdose ?? ''}
                                onChange={e => setFormData({ ...formData, overdose: e.target.value || null })}
                                className="w-full min-h-[80px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                placeholder="Симптомы и лечение передозировки..."
                            />
                        </div>

                        {/* Применение у детей */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                    Применение у детей
                                </label>
                                <textarea
                                    value={formData.childDosing ?? ''}
                                    onChange={e => setFormData({ ...formData, childDosing: e.target.value || null })}
                                    className="w-full min-h-[80px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                    placeholder="Особенности применения у детей..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                    Статус у детей
                                </label>
                                <PrettySelect
                                    value={formData.childUsing ?? ''}
                                    onChange={(value) => setFormData({ ...formData, childUsing: (value as any) || null })}
                                    options={VIDAL_USING_OPTIONS}
                                    buttonClassName="h-12 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50"
                                    panelClassName="max-h-72"
                                />
                            </div>
                        </div>

                        {/* Почечная недостаточность */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                    Почечная недостаточность
                                </label>
                                <textarea
                                    value={formData.renalInsuf ?? ''}
                                    onChange={e => setFormData({ ...formData, renalInsuf: e.target.value || null })}
                                    className="w-full min-h-[80px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                    placeholder="Коррекция дозы при почечной недостаточности..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                    Статус (почки)
                                </label>
                                <PrettySelect
                                    value={formData.renalUsing ?? ''}
                                    onChange={(value) => setFormData({ ...formData, renalUsing: (value as any) || null })}
                                    options={VIDAL_USING_OPTIONS}
                                    buttonClassName="h-12 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50"
                                    panelClassName="max-h-72"
                                />
                            </div>
                        </div>

                        {/* Печёночная недостаточность */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                    Печёночная недостаточность
                                </label>
                                <textarea
                                    value={formData.hepatoInsuf ?? ''}
                                    onChange={e => setFormData({ ...formData, hepatoInsuf: e.target.value || null })}
                                    className="w-full min-h-[80px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                    placeholder="Коррекция дозы при печёночной недостаточности..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                    Статус (печень)
                                </label>
                                <PrettySelect
                                    value={formData.hepatoUsing ?? ''}
                                    onChange={(value) => setFormData({ ...formData, hepatoUsing: (value as any) || null })}
                                    options={VIDAL_USING_OPTIONS}
                                    buttonClassName="h-12 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50"
                                    panelClassName="max-h-72"
                                />
                            </div>
                        </div>

                        {/* Особые указания */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Особые указания
                            </label>
                            <textarea
                                value={formData.specialInstruction ?? ''}
                                onChange={e => setFormData({ ...formData, specialInstruction: e.target.value || null })}
                                className="w-full min-h-[80px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                placeholder="Особые указания по применению..."
                            />
                        </div>

                        {/* Фармакокинетика */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Фармакокинетика
                            </label>
                            <textarea
                                value={formData.pharmacokinetics ?? ''}
                                onChange={e => setFormData({ ...formData, pharmacokinetics: e.target.value || null })}
                                className="w-full min-h-[80px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                placeholder="Всасывание, распределение, метаболизм, выведение..."
                            />
                        </div>

                        {/* Фармакодинамика */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Фармакодинамика
                            </label>
                            <textarea
                                value={formData.pharmacodynamics ?? ''}
                                onChange={e => setFormData({ ...formData, pharmacodynamics: e.target.value || null })}
                                className="w-full min-h-[80px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                placeholder="Механизм действия, фармакологические эффекты..."
                            />
                        </div>
                    </div>
                </Card>

                {/* История изменений (только при редактировании) */}
                {isEdit && id && (
                    <ChangeHistoryPanel medicationId={Number(id)} />
                )}

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        <p className="font-bold text-sm tracking-tight">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-green-600 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-5 h-5" />
                        <p className="font-bold text-sm tracking-tight">Препарат успешно зарегистрирован!</p>
                    </div>
                )}

                {!isViewMode && (
                <div className="flex justify-between items-center pt-6">
                    {/* Кнопка удаления (только в режиме редактирования) */}
                    {isEdit && id && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setShowDeleteConfirm(true)}
                            className="h-14 px-6 rounded-2xl text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                            <Trash2 className="w-5 h-5 mr-2" />
                            Удалить препарат
                        </Button>
                    )}
                    
                    {/* Кнопки справа */}
                    <div className="flex justify-end gap-3 ml-auto">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleBack}
                            className="h-14 px-8 rounded-2xl"
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={isSaving}
                            className="h-14 px-12 rounded-2xl shadow-xl shadow-primary-500/20"
                        >
                            <Save className="w-5 h-5 mr-2" />
                            {isEdit ? 'Сохранить изменения' : 'Создать препарат'}
                        </Button>
                    </div>
                </div>
                )}
            </form>
            )} {/* end activeTab === 'form' */}

            {/* Диалог импорта из Видаль */}
            {showImportDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Импорт данных из Видаль</h2>
                        
                        {/* Табы для выбора метода */}
                        <div className="flex gap-2 mb-4 border-b border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setImportMethod('url');
                                    setJsonError(null);
                                }}
                                className={`px-4 py-2 font-bold text-sm transition-colors border-b-2 ${
                                    importMethod === 'url'
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                }`}
                            >
                                <Download className="w-4 h-4 inline mr-2" />
                                Импорт по URL
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setImportMethod('json');
                                    setError(null);
                                }}
                                className={`px-4 py-2 font-bold text-sm transition-colors border-b-2 ${
                                    importMethod === 'json'
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                }`}
                            >
                                <FileText className="w-4 h-4 inline mr-2" />
                                Импорт из JSON
                            </button>
                        </div>
                        
                        {/* Контент в зависимости от выбранного метода */}
                        {importMethod === 'url' ? (
                            <>
                                <Input
                                    value={vidalUrl}
                                    onChange={e => setVidalUrl(e.target.value)}
                                    placeholder="https://www.vidal.ru/drugs/paracetamol-5"
                                    className="mb-4"
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                    Введите URL страницы препарата на сайте Видаль. Система автоматически извлечет данные с помощью AI.
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="flex gap-2 mb-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={handleCopyTemplate}
                                        className="text-xs"
                                    >
                                        <Copy className="w-3 h-3 mr-1" />
                                        Скопировать шаблон
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => {
                                            setJsonText('');
                                            setJsonError(null);
                                        }}
                                        className="text-xs"
                                    >
                                        <X className="w-3 h-3 mr-1" />
                                        Очистить
                                    </Button>
                                </div>
                                
                                <textarea
                                    value={jsonText}
                                    onChange={e => setJsonText(e.target.value)}
                                    placeholder="Вставьте JSON данные препарата здесь..."
                                    className={`w-full h-64 p-3 rounded-xl border-2 font-mono text-sm ${
                                        jsonError
                                            ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                                            : jsonText && !jsonError
                                            ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                                    }`}
                                />
                                
                                {jsonError && (
                                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                        <p className="text-xs text-red-600 dark:text-red-400 font-bold">
                                            Ошибка JSON: {jsonError}
                                        </p>
                                    </div>
                                )}
                                
                                {jsonText && !jsonError && (
                                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                        <p className="text-xs text-green-600 dark:text-green-400 font-bold">
                                            ✓ JSON валиден
                                        </p>
                                    </div>
                                )}
                                
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                    Вставьте JSON данные препарата. Используйте кнопку "Скопировать шаблон" для получения примера структуры.
                                </p>
                            </>
                        )}
                        
                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="primary"
                                onClick={handleImportFromVidal}
                                isLoading={isImporting}
                                disabled={importMethod === 'json' && (!jsonText.trim() || !!jsonError)}
                            >
                                Импортировать
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setShowImportDialog(false);
                                    setJsonText('');
                                    setJsonError(null);
                                    setVidalUrl('');
                                    setImportMethod('url');
                                }}
                            >
                                Отмена
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Предпросмотр импорта */}
            {showPreview && previewData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
                            <div className="flex items-center gap-3 mb-2">
                                <Eye className="w-6 h-6 text-primary-500" />
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    Предпросмотр импорта
                                </h2>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Проверьте данные перед добавлением в базу
                            </p>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Основная информация */}
                            <div>
                                <h3 className="text-lg font-bold mb-3">Основная информация</h3>
                                <div className="space-y-2">
                                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                        <div className="text-xs font-bold text-slate-500 uppercase">Название</div>
                                        <div className="text-sm text-slate-900 dark:text-white">{previewData.nameRu || 'Не заполнено'}</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                        <div className="text-xs font-bold text-slate-500 uppercase">Действующее вещество</div>
                                        <div className="text-sm text-slate-900 dark:text-white">{previewData.activeSubstance || 'Не заполнено'}</div>
                                    </div>
                                    {previewData.clinicalPharmGroup && (
                                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                            <div className="text-xs font-bold text-green-700 dark:text-green-300 uppercase">Клинико-фармакологическая группа</div>
                                            <div className="text-sm text-green-900 dark:text-green-100">{previewData.clinicalPharmGroup}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Дозирование */}
                            {previewData.pediatricDosing && previewData.pediatricDosing.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold mb-3">Дозирование</h3>
                                    <div className="space-y-3">
                                        {previewData.pediatricDosing.map((rule: any, idx: number) => (
                                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-l-4 border-primary-500">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="default">
                                                        {rule.minAgeMonths}-{rule.maxAgeMonths} мес
                                                    </Badge>
                                                    <Badge variant="primary">{rule.routeOfAdmin || 'oral'}</Badge>
                                                    {rule.timesPerDay && (
                                                        <Badge variant="outline">
                                                            {rule.timesPerDay}× в день
                                                        </Badge>
                                                    )}
                                                </div>
                                                
                                                <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                                                    {rule.instruction || 'Инструкция не указана'}
                                                </p>
                                                
                                                {/* Максимальные дозы */}
                                                <div className="grid grid-cols-2 gap-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-800">
                                                    <div>
                                                        <div className="text-xs text-slate-500 uppercase font-bold">Макс. разовая</div>
                                                        <div className={`text-sm font-bold ${rule.maxSingleDose ? 'text-green-600' : 'text-red-600'}`}>
                                                            {rule.maxSingleDose ? `${rule.maxSingleDose} мг` : '⚠️ Не указана'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-slate-500 uppercase font-bold">Макс. суточная</div>
                                                        <div className={`text-sm font-bold ${rule.maxDailyDose ? 'text-green-600' : 'text-red-600'}`}>
                                                            {rule.maxDailyDose ? `${rule.maxDailyDose} мг` : '⚠️ Не указана'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Общие ограничения препарата */}
                            {(previewData.minInterval || previewData.maxDosesPerDay || previewData.maxDurationDays) && (
                                <div>
                                    <h3 className="text-lg font-bold mb-3">Общие ограничения</h3>
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            {previewData.minInterval && (
                                                <div>
                                                    <div className="text-xs text-amber-700 dark:text-amber-300 uppercase font-bold">Интервал</div>
                                                    <div className="font-bold text-amber-900 dark:text-amber-100">
                                                        ≥ {previewData.minInterval} часов
                                                    </div>
                                                </div>
                                            )}
                                            {previewData.maxDosesPerDay && (
                                                <div>
                                                    <div className="text-xs text-amber-700 dark:text-amber-300 uppercase font-bold">Макс. доз/сутки</div>
                                                    <div className="font-bold text-amber-900 dark:text-amber-100">
                                                        {previewData.maxDosesPerDay}
                                                    </div>
                                                </div>
                                            )}
                                            {previewData.maxDurationDays && (
                                                <div>
                                                    <div className="text-xs text-amber-700 dark:text-amber-300 uppercase font-bold">Макс. длительность</div>
                                                    <div className="font-bold text-amber-900 dark:text-amber-100">
                                                        {previewData.maxDurationDays} дней
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Противопоказания */}
                            <div>
                                <h3 className="text-lg font-bold mb-3">Противопоказания</h3>
                                {previewData.contraindications ? (
                                    <p className="text-sm text-slate-700 dark:text-slate-300 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                        {previewData.contraindications}
                                    </p>
                                ) : (
                                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            ❌ Противопоказания не указаны
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Данные Vidal */}
                            {(previewData.isOtc || previewData.overdose || previewData.childDosing || previewData.renalInsuf || previewData.hepatoInsuf || previewData.specialInstruction) && (
                                <div>
                                    <h3 className="text-lg font-bold mb-3">Данные Vidal</h3>
                                    <div className="space-y-3">
                                        {previewData.isOtc && (
                                            <Badge variant="success">Безрецептурный (OTC)</Badge>
                                        )}
                                        {previewData.childUsing && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-medium text-slate-600 dark:text-slate-400">Дети:</span>
                                                <Badge variant={previewData.childUsing === 'Can' ? 'success' : previewData.childUsing === 'Not' ? 'error' : 'warning'} size="sm">{previewData.childUsing}</Badge>
                                            </div>
                                        )}
                                        {previewData.renalUsing && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-medium text-slate-600 dark:text-slate-400">Почки:</span>
                                                <Badge variant={previewData.renalUsing === 'Can' ? 'success' : previewData.renalUsing === 'Not' ? 'error' : 'warning'} size="sm">{previewData.renalUsing}</Badge>
                                            </div>
                                        )}
                                        {previewData.hepatoUsing && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-medium text-slate-600 dark:text-slate-400">Печень:</span>
                                                <Badge variant={previewData.hepatoUsing === 'Can' ? 'success' : previewData.hepatoUsing === 'Not' ? 'error' : 'warning'} size="sm">{previewData.hepatoUsing}</Badge>
                                            </div>
                                        )}
                                        {previewData.specialInstruction && (
                                            <div>
                                                <div className="text-xs font-bold text-slate-500 uppercase mb-1">Особые указания</div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl" dangerouslySetInnerHTML={{ __html: previewData.specialInstruction }} />
                                            </div>
                                        )}
                                        {previewData.overdose && (
                                            <div>
                                                <div className="text-xs font-bold text-slate-500 uppercase mb-1">Передозировка</div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl" dangerouslySetInnerHTML={{ __html: previewData.overdose }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Результаты валидации */}
                            {validationResult && (validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border-2 border-orange-200">
                                    <h3 className="text-lg font-bold text-orange-900 dark:text-orange-100 mb-3">
                                        Обнаружены проблемы
                                    </h3>
                                    {validationResult.errors.length > 0 && (
                                        <div className="mb-3">
                                            <p className="font-bold text-red-600 mb-1">Ошибки:</p>
                                            <ul className="list-disc list-inside text-sm text-red-600">
                                                {validationResult.errors.map((err, idx) => (
                                                    <li key={idx}>{err.message}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {validationResult.warnings.length > 0 && (
                                        <div>
                                            <p className="font-bold text-orange-600 mb-1">Предупреждения:</p>
                                            <ul className="list-disc list-inside text-sm text-orange-600">
                                                {validationResult.warnings.map((warn, idx) => (
                                                    <li key={idx}>{warn.message}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Кнопки */}
                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => {
                                setShowPreview(false);
                                setPreviewData(null);
                                setValidationResult(null);
                            }}>
                                Отменить
                            </Button>
                            <Button 
                                variant="primary" 
                                onClick={handleConfirmImport}
                                className={validationResult && !validationResult.isValid ? 'bg-orange-600 hover:bg-orange-700' : ''}
                            >
                                {validationResult && !validationResult.isValid ? (
                                    <>
                                        <AlertCircle className="w-4 h-4 mr-2" />
                                        Вернуться к редактированию
                                    </>
                                ) : (
                                    'Подтвердить импорт'
                                )}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Диалог подтверждения удаления */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="p-6 max-w-md w-full">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-xl">
                                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                    Удалить препарат?
                                </h2>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Вы уверены, что хотите удалить препарат <strong>{formData.nameRu}</strong>? 
                                    Это действие нельзя отменить.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 rounded-xl"
                                disabled={isDeleting}
                            >
                                Отмена
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleDelete}
                                isLoading={isDeleting}
                                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Удалить
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
