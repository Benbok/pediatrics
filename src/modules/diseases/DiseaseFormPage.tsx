import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { diseaseService, parseSymptoms } from './services/diseaseService';
import { useToast } from '../../context/ToastContext';
import { icdCodeService } from '../../services/icdCode.service';
import { Disease, SymptomCategory, SymptomSpecificity, CategorizedSymptom, DiseaseRecommendationItem, DiseaseRecommendationCategory } from '../../types';
import { logger } from '../../services/logger';
import { Card } from '../../components/ui/Card';
import { SymptomsList } from './components/SymptomsList';
import { TestNameAutocomplete } from './components/TestNameAutocomplete';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PrettySelect, type SelectOption } from './components/PrettySelect';
import {
    ChevronLeft,
    ChevronRight,
    Save,
    Plus,
    X,
    Activity,
    Upload,
    FileText,
    AlertCircle,
    CheckCircle2,
    FileUp,
    Sparkles,
    Trash2,
    Copy,
    Eye,
    BookOpen,
    Star,
} from 'lucide-react';
import DISEASE_JSON_TEMPLATE from './templates/diseaseJsonTemplate.json';

type ValidationIssue = {
    code?: string;
    path?: Array<string | number>;
    message?: string;
};

type FormSectionKey = 'general' | 'symptoms' | 'diagnosticPlan' | 'treatmentPlan' | 'clinicalRecommendations' | 'differential';

const FORM_SECTION_IDS: Record<FormSectionKey, string> = {
    general: 'disease-form-section-general',
    symptoms: 'disease-form-section-symptoms',
    diagnosticPlan: 'disease-form-section-diagnostic-plan',
    treatmentPlan: 'disease-form-section-treatment-plan',
    clinicalRecommendations: 'disease-form-section-clinical-recommendations',
    differential: 'disease-form-section-differential',
};

const FORM_SECTION_TITLES: Record<FormSectionKey, string> = {
    general: 'Основная информация',
    symptoms: 'Симптомы и клинические признаки',
    diagnosticPlan: 'План диагностики',
    treatmentPlan: 'План лечения',
    clinicalRecommendations: 'Рекомендации',
    differential: 'Дифференциальная диагностика и красные флаги',
};

const asValidationIssueArray = (value: unknown): ValidationIssue[] => {
    if (!Array.isArray(value)) return [];
    return value
        .filter(item => item && typeof item === 'object')
        .map((item: any) => ({
            code: typeof item.code === 'string' ? item.code : undefined,
            path: Array.isArray(item.path) ? item.path : undefined,
            message: typeof item.message === 'string' ? item.message : undefined,
        }))
        .filter(item => item.message || (item.path && item.path.length > 0));
};

const parseValidationIssues = (error: any): ValidationIssue[] => {
    const directIssues = asValidationIssueArray(error?.issues || error?.errors);
    if (directIssues.length > 0) return directIssues;

    const rawMessage = typeof error?.message === 'string' ? error.message.trim() : '';
    if (!rawMessage || !rawMessage.startsWith('[')) return [];

    try {
        const parsed = JSON.parse(rawMessage);
        return asValidationIssueArray(parsed);
    } catch {
        return [];
    }
};

const resolveSectionFromPath = (path?: Array<string | number>): FormSectionKey | null => {
    const root = Array.isArray(path) && path.length > 0 ? String(path[0]) : '';

    if (['icd10Code', 'icd10Codes', 'nameRu', 'nameEn', 'description'].includes(root)) return 'general';
    if (root === 'symptoms') return 'symptoms';
    if (root === 'diagnosticPlan') return 'diagnosticPlan';
    if (root === 'treatmentPlan') return 'treatmentPlan';
    if (root === 'clinicalRecommendations') return 'clinicalRecommendations';
    if (root === 'differentialDiagnosis' || root === 'redFlags') return 'differential';

    return null;
};

export const DiseaseFormPage: React.FC = () => {
    const { showToast } = useToast();
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const isEdit = !!id;
    const isViewMode = isEdit && searchParams.get('mode') === 'view';
    const diseasesListParams = new URLSearchParams(searchParams);
    diseasesListParams.delete('mode');
    const diseasesListQuery = diseasesListParams.toString();
    const diseasesListPath = `/diseases${diseasesListQuery ? `?${diseasesListQuery}` : ''}`;

    const [formData, setFormData] = useState<Partial<Disease>>({
        nameRu: '',
        icd10Code: '',
        icd10Codes: [],
        description: '',
        symptoms: [],
        diagnosticPlan: [],
        treatmentPlan: [],
        clinicalRecommendations: [],
        differentialDiagnosis: [],
        redFlags: [],
    });
    const [importedPdfPath, setImportedPdfPath] = useState<string | null>(null);

    const [newSymptom, setNewSymptom] = useState('');
    const [newSymptomCategory, setNewSymptomCategory] = useState<SymptomCategory>('other');
    const [newSymptomSpecificity, setNewSymptomSpecificity] = useState<SymptomSpecificity>('medium');
    const [newIsPathognomonic, setNewIsPathognomonic] = useState(false);
    const [newDifferential, setNewDifferential] = useState('');
    const [newRedFlag, setNewRedFlag] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [success, setSuccess] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // JSON Import states
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<Disease | null>(null);
    const [validationResult, setValidationResult] = useState<{
        isValid: boolean;
        errors: any[];
        warnings: any[];
        needsReview: boolean;
    } | null>(null);

    // Available test names for autocomplete
    const [availableTestNames, setAvailableTestNames] = useState<string[]>([]);
    const [isLoadingTests, setIsLoadingTests] = useState(false);
    const [testResolutionHints, setTestResolutionHints] = useState<Record<number, string>>({});
    // Alias widget: key = plan item index, value = { typedValue, selectedCanonical }
    // selectedCanonical = '' means 'new entry' (default), non-empty = link as alias
    const [pendingAliasWidgets, setPendingAliasWidgets] = useState<Record<number, { typedValue: string; selectedCanonical: string }>>({});
    const transientErrorTimeoutRef = useRef<number | null>(null);
    const diagnosticResolveRequestIdRef = useRef<Record<number, number>>({});
    const diagnosticPlanSnapshotRef = useRef<any[]>([]);

    useEffect(() => {
        diagnosticPlanSnapshotRef.current = formData.diagnosticPlan || [];
    }, [formData.diagnosticPlan]);

    const showTransientError = (message: string) => {
        if (transientErrorTimeoutRef.current) {
            window.clearTimeout(transientErrorTimeoutRef.current);
        }

        setError(null);
        setValidationIssues([]);
        window.requestAnimationFrame(() => {
            setError(message);
        });
        showToast(message, 'warning');

        transientErrorTimeoutRef.current = window.setTimeout(() => {
            setError(null);
            transientErrorTimeoutRef.current = null;
        }, 3000);
    };

    const normalizeDuplicateValue = (value: string) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

    const isDuplicateDiagnosticItem = (items: any[], index: number, nextItem: any) => {
        const normalizedTest = normalizeDuplicateValue(nextItem?.test || '');
        if (!normalizedTest) return false;
        return items.some((item, itemIndex) => itemIndex !== index && normalizeDuplicateValue(item?.test || '') === normalizedTest);
    };

    const isDuplicateTreatmentItem = (items: any[], index: number, nextItem: any) => {
        const normalizedDescription = normalizeDuplicateValue(nextItem?.description || '');
        if (!normalizedDescription) return false;
        return items.some((item, itemIndex) => itemIndex !== index && normalizeDuplicateValue(item?.description || '') === normalizedDescription);
    };

    const isDuplicateRecommendationItem = (items: DiseaseRecommendationItem[], index: number, nextItem: DiseaseRecommendationItem) => {
        const normalizedText = normalizeDuplicateValue(nextItem?.text || '');
        if (!normalizedText) return false;
        return items.some((item, itemIndex) => itemIndex !== index && normalizeDuplicateValue(item?.text || '') === normalizedText);
    };

    useEffect(() => {
        // Load available test names for autocomplete
        const loadTestNames = async () => {
            setIsLoadingTests(true);
            try {
                const testNames = await diseaseService.getDiagnosticCatalogTestNames();
                setAvailableTestNames(testNames);
            } catch (error) {
                logger.error('[DiseaseFormPage] Failed to load test names', { error });
            } finally {
                setIsLoadingTests(false);
            }
        };

        loadTestNames();

        return () => {
            if (transientErrorTimeoutRef.current) {
                window.clearTimeout(transientErrorTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (isEdit) {
            loadDisease();
        }
    }, [isEdit]);

    const loadDisease = async () => {
        try {
            const data = await diseaseService.getDisease(Number(id));
            logger.debug('[DiseaseFormPage] Raw data from backend', { id: Number(id), data });

            // Backend returns parsed data; ensure symptoms are CategorizedSymptom[]
            const parsed = {
                ...data,
                symptoms: data.symptoms || [],
                icd10Codes: Array.isArray(data.icd10Codes) ? data.icd10Codes : (typeof data.icd10Codes === 'string' ? JSON.parse(data.icd10Codes) : []),
                diagnosticPlan: typeof data.diagnosticPlan === 'string' ? JSON.parse(data.diagnosticPlan) : (data.diagnosticPlan || []),
                treatmentPlan: typeof data.treatmentPlan === 'string' ? JSON.parse(data.treatmentPlan) : (data.treatmentPlan || []),
                clinicalRecommendations: typeof data.clinicalRecommendations === 'string' ? JSON.parse(data.clinicalRecommendations) : (data.clinicalRecommendations || []),
                differentialDiagnosis: typeof data.differentialDiagnosis === 'string' ? JSON.parse(data.differentialDiagnosis) : (data.differentialDiagnosis || []),
                redFlags: typeof data.redFlags === 'string' ? JSON.parse(data.redFlags) : (data.redFlags || []),
            };

            logger.debug('[DiseaseFormPage] Parsed formData', {
                diagnosticPlan: parsed.diagnosticPlan?.length || 0,
                treatmentPlan: parsed.treatmentPlan?.length || 0,
                differentialDiagnosis: parsed.differentialDiagnosis?.length || 0,
                redFlags: parsed.redFlags?.length || 0,
                symptoms: parsed.symptoms?.length || 0,
            });

            setFormData(parsed);
            setTestResolutionHints({});
            setPendingAliasWidgets({});
        } catch (err) {
            setError('Не удалось загрузить данные заболевания');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        setValidationIssues([]);

        try {
            const savedDisease = await diseaseService.upsertDisease(formData as Disease);

            // If we have an imported PDF, link it to the disease now
            if (importedPdfPath && savedDisease.id) {
                await diseaseService.uploadGuideline(savedDisease.id, importedPdfPath);
            }

            setSuccess(true);
            setTimeout(() => navigate(`/diseases/${savedDisease.id}`), 1500);
        } catch (err: any) {
            const issues = parseValidationIssues(err);
            if (issues.length > 0) {
                setValidationIssues(issues);
                setError('Форма содержит ошибки. Исправьте поля в указанных разделах.');

                const firstSection = resolveSectionFromPath(issues[0]?.path);
                if (firstSection) {
                    const target = document.getElementById(FORM_SECTION_IDS[firstSection]);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            } else {
                setError(err.message || 'Произошла ошибка при сохранении');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const addSymptom = () => {
        const symptomText = newSymptom.trim();
        if (!symptomText) return;

        const isDuplicate = (formData.symptoms || []).some(
            s => s.text.toLowerCase() === symptomText.toLowerCase()
        );

        if (isDuplicate) {
            showTransientError(`Симптом "${symptomText}" уже добавлен`);
            return;
        }

        const specificity = newIsPathognomonic ? 'high' : newSymptomSpecificity;
        setFormData({
            ...formData,
            symptoms: [...(formData.symptoms || []), {
                text: symptomText,
                category: newSymptomCategory,
                specificity,
                isPathognomonic: newIsPathognomonic,
            }]
        });
        setNewSymptom('');
        setNewSymptomSpecificity('medium');
        setNewIsPathognomonic(false);
    };

    const removeSymptom = (symptom: CategorizedSymptom) => {
        setFormData({
            ...formData,
            symptoms: formData.symptoms?.filter(s => s.text !== symptom.text) || []
        });
    };

    const updateSymptomCategory = (symptomText: string, newCategory: SymptomCategory) => {
        setFormData({
            ...formData,
            symptoms: formData.symptoms?.map(s =>
                s.text === symptomText ? { ...s, category: newCategory } : s
            ) || []
        });
    };

    const updateSymptom = (oldText: string, newText: string, newCategory: SymptomCategory, specificity: SymptomSpecificity = 'medium', isPathognomonic: boolean = false) => {
        if (!newText.trim()) {
            removeSymptom({ text: oldText, category: newCategory, specificity, isPathognomonic });
            return;
        }
        const trimmedNewText = newText.trim();
        const isDuplicate = formData.symptoms?.some(
            s => s.text.toLowerCase() === trimmedNewText.toLowerCase() && s.text !== oldText
        );
        if (isDuplicate) {
            showTransientError(`Симптом "${trimmedNewText}" уже существует`);
            return;
        }
        setFormData({
            ...formData,
            symptoms: formData.symptoms?.map(s =>
                s.text === oldText ? { text: trimmedNewText, category: newCategory, specificity, isPathognomonic } : s
            ) || []
        });
    };

    const addDiagnosticPlanItem = () => {
        setFormData(prev => ({
            ...prev,
            diagnosticPlan: [
                { type: 'lab', test: '', priority: 'medium', rationale: '' },
                ...(prev.diagnosticPlan || [])
            ]
        }));
        setTestResolutionHints(prev => {
            const next = {} as Record<number, string>;
            Object.entries(prev).forEach(([key, value]) => {
                next[Number(key) + 1] = value;
            });
            return next;
        });
        setPendingAliasWidgets(prev => {
            const next = {} as Record<number, { typedValue: string; selectedCanonical: string }>;
            Object.entries(prev).forEach(([key, value]) => {
                next[Number(key) + 1] = value;
            });
            return next;
        });
    };

    const clearTestHint = (index: number) => {
        setTestResolutionHints(prev => {
            if (!(index in prev)) return prev;
            const next = { ...prev };
            delete next[index];
            return next;
        });
    };

    const clearAliasWidget = (index: number) => {
        setPendingAliasWidgets(prev => {
            if (!(index in prev)) return prev;
            const next = { ...prev };
            delete next[index];
            return next;
        });
    };

    const updateDiagnosticPlanItem = (index: number, updates: any) => {
        let hasDuplicate = false;
        let duplicateValue = '';

        setFormData(prev => {
            const items = [...(prev.diagnosticPlan || [])];
            const nextItem = { ...items[index], ...updates };

            if (isDuplicateDiagnosticItem(items, index, nextItem)) {
                hasDuplicate = true;
                duplicateValue = String(nextItem?.test || '');
                return prev;
            }

            items[index] = nextItem;
            return { ...prev, diagnosticPlan: items };
        });

        if (hasDuplicate) {
            showTransientError(`Исследование "${duplicateValue}" уже добавлено в план диагностики`);
            return false;
        }

        if (typeof updates?.test === 'string') {
            clearTestHint(index);
            clearAliasWidget(index);
        }

        return true;
    };

    const resolveDiagnosticTestAlias = async (index: number, rawValue: string) => {
        const input = String(rawValue || '').trim();
        diagnosticResolveRequestIdRef.current[index] = (diagnosticResolveRequestIdRef.current[index] || 0) + 1;
        const requestId = diagnosticResolveRequestIdRef.current[index];

        if (!input) {
            clearTestHint(index);
            clearAliasWidget(index);
            return;
        }

        const result = await diseaseService.resolveDiagnosticTestName(input);

        if (diagnosticResolveRequestIdRef.current[index] !== requestId) {
            return;
        }

        const currentValue = String((diagnosticPlanSnapshotRef.current || [])[index]?.test || '').trim();
        if (currentValue !== input) {
            return;
        }

        if (result.changed && result.resolvedName) {
            const updated = updateDiagnosticPlanItem(index, { test: result.resolvedName });
            if (!updated) return;
            setTestResolutionHints(prev => ({
                ...prev,
                [index]: `Название нормализовано по каталогу: ${result.resolvedName}`
            }));
            clearAliasWidget(index);
            return;
        }

        // No match found — show alias-linking widget if there are known canonical names to choose from
        clearTestHint(index);
        if (availableTestNames.length > 0) {
            setPendingAliasWidgets(prev => ({
                ...prev,
                [index]: { typedValue: input, selectedCanonical: '' }
            }));
        }
    };

    const removeDiagnosticPlanItem = (index: number) => {
        setFormData({
            ...formData,
            diagnosticPlan: (formData.diagnosticPlan || []).filter((_, i) => i !== index)
        });
        setTestResolutionHints(prev => {
            const next = {} as Record<number, string>;
            Object.entries(prev).forEach(([key, value]) => {
                const numericKey = Number(key);
                if (numericKey < index) next[numericKey] = value;
                if (numericKey > index) next[numericKey - 1] = value;
            });
            return next;
        });
        setPendingAliasWidgets(prev => {
            const next = {} as Record<number, { typedValue: string; selectedCanonical: string }>;
            Object.entries(prev).forEach(([key, value]) => {
                const numericKey = Number(key);
                if (numericKey < index) next[numericKey] = value;
                if (numericKey > index) next[numericKey - 1] = value;
            });
            return next;
        });
    };

    /**
     * Confirm alias linking or dismiss the widget.
     * If canonicalName is non-empty: register alias via IPC, then update item.test to canonical.
     * If canonicalName is empty: dismiss widget — item stays as-is → auto-add as new canonical on save.
     */
    const confirmAliasLink = async (index: number, typedValue: string, canonicalName: string) => {
        clearAliasWidget(index);
        if (!canonicalName) {
            // User chose "new entry" — no changes needed
            return;
        }
        try {
            await diseaseService.linkTestAlias(typedValue, canonicalName);
        } catch {
            showTransientError(`Не удалось зарегистрировать псевдоним. Название будет сохранено как новое исследование.`);
            return;
        }
        // Update item.test to canonical name; mark as aliased so _ensureTestNamesInCatalog skips it
        setFormData(prev => {
            const items = [...(prev.diagnosticPlan || [])];
            if (!items[index]) return prev;
            items[index] = { ...items[index], test: canonicalName, _aliasFor: typedValue };
            return { ...prev, diagnosticPlan: items };
        });
        setTestResolutionHints(prev => ({
            ...prev,
            [index]: `Псевдоним «${typedValue}» привязан к «${canonicalName}»`
        }));
        // Refresh availableTestNames so newly aliased name appears in autocomplete next time
        diseaseService.getDiagnosticCatalogTestNames().then(names => {
            if (names.length > 0) setAvailableTestNames(names);
        }).catch(() => {});
    };

    const addTreatmentPlanItem = () => {
        setFormData(prev => ({
            ...prev,
            treatmentPlan: [
                { category: 'symptomatic', description: '', priority: 'medium' },
                ...(prev.treatmentPlan || [])
            ]
        }));
    };

    const updateTreatmentPlanItem = (index: number, updates: any) => {
        const items = [...(formData.treatmentPlan || [])];
        const nextItem = { ...items[index], ...updates };
        if (isDuplicateTreatmentItem(items, index, nextItem)) {
            showTransientError(`Пункт лечения "${nextItem.description}" уже добавлен`);
            return;
        }
        items[index] = nextItem;
        setFormData({ ...formData, treatmentPlan: items });
    };

    const removeTreatmentPlanItem = (index: number) => {
        setFormData({
            ...formData,
            treatmentPlan: (formData.treatmentPlan || []).filter((_, i) => i !== index)
        });
    };

    const addRecommendationItem = () => {
        setFormData(prev => ({
            ...prev,
            clinicalRecommendations: [
                { category: 'other' as DiseaseRecommendationCategory, text: '', priority: 'medium' },
                ...(prev.clinicalRecommendations || [])
            ]
        }));
    };

    const updateRecommendationItem = (index: number, updates: Partial<DiseaseRecommendationItem>) => {
        const items = [...(formData.clinicalRecommendations || [])];
        const nextItem = { ...items[index], ...updates } as DiseaseRecommendationItem;
        if (isDuplicateRecommendationItem(items, index, nextItem)) {
            showTransientError(`Рекомендация "${nextItem.text}" уже добавлена`);
            return;
        }
        items[index] = nextItem;
        setFormData({ ...formData, clinicalRecommendations: items });
    };

    const removeRecommendationItem = (index: number) => {
        setFormData({
            ...formData,
            clinicalRecommendations: (formData.clinicalRecommendations || []).filter((_, i) => i !== index)
        });
    };

    const addDifferentialDiagnosis = () => {
        if (!newDifferential.trim()) return;
        setFormData({
            ...formData,
            differentialDiagnosis: [...(formData.differentialDiagnosis || []), newDifferential.trim()]
        });
        setNewDifferential('');
    };

    const removeDifferentialDiagnosis = (value: string) => {
        setFormData({
            ...formData,
            differentialDiagnosis: (formData.differentialDiagnosis || []).filter(item => item !== value)
        });
    };

    const addRedFlag = () => {
        if (!newRedFlag.trim()) return;
        setFormData({
            ...formData,
            redFlags: [...(formData.redFlags || []), newRedFlag.trim()]
        });
        setNewRedFlag('');
    };

    const removeRedFlag = (value: string) => {
        setFormData({
            ...formData,
            redFlags: (formData.redFlags || []).filter(item => item !== value)
        });
    };

    const handleDeleteClick = () => {
        if (!isEdit || !id) return;
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = async () => {
        if (!isEdit || !id) return;

        setShowDeleteConfirm(false);
        setIsSaving(true);
        try {
            await diseaseService.deleteDisease(Number(id));
            navigate(diseasesListPath);
        } catch (err: any) {
            setError(err.message || 'Ошибка при удалении');
            setIsSaving(false);
        }
    };

    const handleSwitchToEditMode = () => {
        if (!isEdit || !id) return;
        const params = new URLSearchParams(location.search);
        params.set('mode', 'edit');
        const query = params.toString();
        navigate(`/diseases/edit/${id}${query ? `?${query}` : ''}`);
    };

    const handleFileUpload = async () => {
        if (!window.electronAPI) return;
        try {
            const result = await window.electronAPI.openFile({
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
                properties: ['openFile', 'multiSelections'] // Разрешаем выбор нескольких файлов
            });

            if (!result.canceled && result.filePaths.length > 0) {
                if (!isEdit) {
                    setError('Пожалуйста, сначала сохраните основную информацию о заболевании');
                    return;
                }

                setIsSaving(true);
                setError(null);

                // Неблокирующая загрузка (async queue): toast показывается глобально в ToastProvider
                const { batchId } = await diseaseService.uploadGuidelinesAsync(Number(id), result.filePaths);
                showToast(`Файлы добавлены в очередь: ${result.filePaths.length}`, 'info');

                // Reload disease data when batch completes (toast handled globally)
                const unsubscribe = window.electronAPI.onUploadBatchFinished((event: any, data: any) => {
                    if (!data || data.batchId !== batchId) return;
                    unsubscribe();
                    loadDisease();
                });

                setSuccess(true);
            }
        } catch (err: any) {
            setError(err.message || 'Ошибка при загрузке или обработке PDF');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePdfImport = async () => {
        if (!window.electronAPI) return;
        try {
            const result = await window.electronAPI.openFile({
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
            });

            if (!result.canceled && result.filePaths.length > 0) {
                setIsParsing(true);
                setError(null);
                const pdfPath = result.filePaths[0];

                const parsedData = await window.electronAPI.parsePdfOnly(pdfPath);

                // Autofill form with metadata (merge instead of replace to preserve existing fields)
                setFormData(prev => ({
                    ...prev, // Сохраняем все существующие поля (diagnosticPlan, treatmentPlan, etc.)
                    nameRu: parsedData.nameRu,
                    icd10Code: parsedData.icd10Code,
                    icd10Codes: parsedData.allIcd10Codes,
                    description: parsedData.description,
                    symptoms: parseSymptoms(parsedData.symptoms),
                }));
                setImportedPdfPath(pdfPath);

                // Show AI warning if fallback was used
                if (parsedData.aiWarning) {
                    setError(parsedData.aiWarning);
                    setTimeout(() => setError(null), 5000);
                }

                // Log all found ICD codes
                if (parsedData.allIcd10Codes && parsedData.allIcd10Codes.length > 1) {
                    const allCodes = parsedData.allIcd10Codes.join(', ');
                    logger.info('[PDF Import] Найдено кодов МКБ-10', { allCodes, used: parsedData.icd10Code });
                }

                // Show success with AI status
                const successMsg = parsedData.aiUsed
                    ? '✨ PDF успешно обработан с помощью AI!'
                    : 'PDF обработан (базовый парсер)';
                logger.info('[PDF Import] Parse completed', { aiUsed: Boolean(parsedData.aiUsed), message: successMsg });

                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            }
        } catch (err: any) {
            setError('Ошибка при парсинге PDF: ' + (err.message || 'Неизвестная ошибка'));
        } finally {
            setIsParsing(false);
        }
    };

    const handleCodeSelect = async (code: string) => {
        // Обновляем код МКБ
        setFormData({ ...formData, icd10Code: code });

        // Пытаемся получить название из справочника МКБ
        try {
            const icdCode = await icdCodeService.getByCode(code);
            if (icdCode && icdCode.name) {
                setFormData(prev => ({
                    ...prev,
                    icd10Code: code,
                    nameRu: icdCode.name
                }));
            }
        } catch (err) {
            // Если не удалось найти код в справочнике - просто обновляем код, название не трогаем
            logger.warn('[DiseaseForm] Failed to get ICD name', { code, error: err });
        }
    };

    const handleIcdCodeBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
        const code = e.target.value.trim().toUpperCase();
        if (code && code.length >= 3) {
            // Обновляем название только если поле названия пустое
            // Это позволяет пользователю вручную ввести свое название, если нужно
            if (!formData.nameRu || formData.nameRu.trim() === '') {
                try {
                    const icdCode = await icdCodeService.getByCode(code);
                    if (icdCode && icdCode.name) {
                        setFormData(prev => ({
                            ...prev,
                            nameRu: icdCode.name
                        }));
                    }
                } catch (err) {
                    // Игнорируем ошибки - пользователь может ввести название вручную
                    logger.warn('[DiseaseForm] Failed to get ICD name', { code, error: err });
                }
            }
        }
    };

    // Валидация JSON в реальном времени
    useEffect(() => {
        if (jsonText.trim()) {
            try {
                JSON.parse(jsonText);
                setJsonError(null);
            } catch (err: any) {
                setJsonError(err.message || 'Неверный формат JSON');
            }
        } else {
            setJsonError(null);
        }
    }, [jsonText]);

    const handleCopyTemplate = () => {
        const templateStr = JSON.stringify(DISEASE_JSON_TEMPLATE, null, 2);
        navigator.clipboard.writeText(templateStr).then(() => {
            setJsonText(templateStr);
            setError(null);
        }).catch(() => {
            setError('Не удалось скопировать шаблон');
        });
    };

    const handleImportFromJson = async () => {
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
            const result = await diseaseService.importFromJson(jsonText);

            if (result.success && result.data) {
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
    };

    const handleConfirmImport = () => {
        // Если есть критичные ошибки - вернуться к редактированию JSON
        if (validationResult && !validationResult.isValid) {
            setShowPreview(false);
            setShowImportDialog(true);
            // Восстанавливаем JSON для редактирования
            if (previewData) {
                setJsonText(JSON.stringify(previewData, null, 2));
            }
            return;
        }

        if (previewData) {
            setFormData({
                ...formData,
                ...previewData,
            });
            setTestResolutionHints({});
            setPendingAliasWidgets({});
            setShowPreview(false);
            setPreviewData(null);
            setValidationResult(null);
            setJsonText('');
        }
    };

    // Опции для выпадающих списков
    const symptomCategoryOptions: Array<SelectOption<SymptomCategory>> = [
        { value: 'other', label: 'Другое' },
        { value: 'clinical', label: 'Клинические' },
        { value: 'physical', label: 'Физикальные' },
        { value: 'laboratory', label: 'Лабораторные' },
    ];

    const diagnosticTypeOptions: Array<SelectOption<string>> = [
        { value: 'lab', label: 'Лабораторное' },
        { value: 'instrumental', label: 'Инструментальное' },
    ];

    const priorityOptions: Array<SelectOption<string>> = [
        { value: 'low', label: 'Низкий' },
        { value: 'medium', label: 'Средний' },
        { value: 'high', label: 'Высокий' },
    ];

    const treatmentCategoryOptions: Array<SelectOption<string>> = [
        { value: 'symptomatic', label: 'Симптоматическое' },
        { value: 'etiologic', label: 'Этиотропное' },
        { value: 'supportive', label: 'Поддерживающее' },
        { value: 'respiratory', label: 'Респираторная поддержка' },
        { value: 'other', label: 'Другое' },
    ];

    const recommendationCategoryOptions: Array<SelectOption<DiseaseRecommendationCategory>> = [
        { value: 'regimen', label: 'Режим' },
        { value: 'nutrition', label: 'Питание' },
        { value: 'followup', label: 'Наблюдение' },
        { value: 'activity', label: 'Активность' },
        { value: 'education', label: 'Рекомендации родителям' },
        { value: 'other', label: 'Другое' },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate(diseasesListPath)} className="rounded-xl">
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Назад
                </Button>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white-800">
                    {isViewMode ? 'Карточка заболевания' : isEdit ? 'Редактировать заболевание' : 'Новое заболевание'}
                </h1>
                <div className="flex gap-2">
                    {isEdit && !isViewMode && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleDeleteClick}
                            className="h-12 px-6 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all font-bold"
                        >
                            <Trash2 className="w-5 h-5 mr-2" />
                            Удалить
                        </Button>
                    )}
                    {isViewMode && (
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleSwitchToEditMode}
                            className="h-12 px-6 rounded-xl font-bold"
                        >
                            <FileText className="w-5 h-5 mr-2" />
                            Перейти в редактирование
                        </Button>
                    )}
                    {!isEdit && (
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handlePdfImport}
                                isLoading={isParsing}
                                className="h-12 px-6 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 hover:border-purple-400 transition-all shadow-sm font-bold"
                            >
                                <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
                                {isParsing ? 'Парсинг...' : 'Импорт из PDF'}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setShowImportDialog(true)}
                                className="h-12 px-6 rounded-xl bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 border-blue-200 hover:border-blue-400 transition-all shadow-sm font-bold"
                            >
                                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                                Импорт из JSON
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <form onSubmit={handleSave} className={isViewMode ? 'space-y-6 pointer-events-none select-none' : 'space-y-6'}>
                <div id={FORM_SECTION_IDS.general} className="scroll-mt-24">
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-xl overflow-hidden relative">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Название заболевания (RU) *
                            </label>
                            <Input
                                value={formData.nameRu}
                                onChange={e => setFormData({ ...formData, nameRu: e.target.value })}
                                placeholder="Например: Острый ларингит"
                                required
                                className="h-14 rounded-2xl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Код МКБ-10 *
                            </label>
                            <Input
                                value={formData.icd10Code}
                                onChange={e => setFormData({ ...formData, icd10Code: e.target.value.toUpperCase() })}
                                onBlur={handleIcdCodeBlur}
                                placeholder="Например: J04.0"
                                required
                                className="h-14 rounded-2xl font-mono"
                            />
                            {formData.icd10Codes && formData.icd10Codes.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {formData.icd10Codes.map(code => (
                                        <Badge
                                            key={code}
                                            variant={code === formData.icd10Code ? "primary" : "outline"}
                                            size="sm"
                                            className="cursor-pointer transition-all hover:scale-105"
                                            onClick={() => handleCodeSelect(code)}
                                        >
                                            {code}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Краткое описание
                            </label>
                            <textarea
                                value={formData.description || ''}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full min-h-[120px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-slate-900 dark:text-white"
                                placeholder="Общая информация о заболевании, этиология..."
                            />
                        </div>
                    </div>
                </Card>
                </div>

                {/* Symptoms Section */}
                <div id={FORM_SECTION_IDS.symptoms} className="scroll-mt-24">
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-primary-500" />
                        Симптомы и клинические признаки
                    </h2>

                    {/* Add symptom row */}
                    <div className="space-y-3 mb-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                        <div className="flex gap-2 flex-wrap">
                            <Input
                                value={newSymptom}
                                onChange={e => setNewSymptom(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSymptom())}
                                placeholder="Введите симптом или клинический признак..."
                                className="h-11 rounded-xl flex-1 min-w-[200px]"
                            />
                            <div className="w-44 flex-shrink-0">
                                <PrettySelect
                                    value={newSymptomCategory}
                                    onChange={(value) => setNewSymptomCategory(value)}
                                    options={symptomCategoryOptions}
                                    buttonClassName="h-11 px-4 rounded-xl font-bold"
                                    useFixedPanel
                                />
                            </div>
                        </div>

                        {/* Specificity + Pathognomonic + Add button */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Specificity pill-selector */}
                            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-800 h-9 gap-1">
                                {(['low', 'medium', 'high'] as const).map((spec) => {
                                    const dotColors: Record<string, string> = { low: 'bg-slate-400', medium: 'bg-amber-400', high: 'bg-emerald-500' };
                                    const activeColors: Record<string, string> = {
                                        low: 'bg-slate-100 text-slate-700 border-slate-400 dark:bg-slate-700 dark:text-slate-200',
                                        medium: 'bg-amber-50 text-amber-700 border-amber-400 dark:bg-amber-900/30 dark:text-amber-200',
                                        high: 'bg-emerald-50 text-emerald-700 border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-200',
                                    };
                                    const labels: Record<string, string> = { low: 'Низкая', medium: 'Средняя', high: 'Высокая' };
                                    const isActive = newSymptomSpecificity === spec;
                                    const isDisabled = newIsPathognomonic && spec !== 'high';
                                    return (
                                        <button
                                            key={spec}
                                            type="button"
                                            disabled={isDisabled}
                                            onClick={() => !isDisabled && setNewSymptomSpecificity(spec)}
                                            className={`flex items-center gap-1.5 px-3 h-full rounded-lg border text-xs font-medium transition-colors ${
                                                isActive ? activeColors[spec] : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                            } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                            aria-pressed={isActive}
                                            title={labels[spec]}
                                        >
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColors[spec]}`} />
                                            {labels[spec]}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Pathognomonic toggle */}
                            <button
                                type="button"
                                onClick={() => {
                                    const next = !newIsPathognomonic;
                                    setNewIsPathognomonic(next);
                                    if (next) setNewSymptomSpecificity('high');
                                }}
                                className={`h-9 flex items-center gap-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                                    newIsPathognomonic
                                        ? 'border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-amber-300 hover:text-amber-500'
                                }`}
                                aria-pressed={newIsPathognomonic}
                                title="Патогномоничный признак — характерен только для данного заболевания"
                            >
                                <Star className={`w-4 h-4 ${newIsPathognomonic ? 'fill-amber-400 text-amber-400' : ''}`} />
                                <span>Патогномоничный</span>
                            </button>

                            <Button type="button" onClick={addSymptom} variant="secondary" className="h-9 px-4 rounded-xl ml-auto">
                                <Plus className="w-4 h-4 mr-1" />
                                Добавить
                            </Button>
                        </div>
                    </div>

                    <SymptomsList
                        symptoms={formData.symptoms || []}
                        onRemove={removeSymptom}
                        onCategoryChange={updateSymptomCategory}
                        onUpdate={updateSymptom}
                        onError={showTransientError}
                        editable={!isViewMode}
                    />
                </Card>
                </div>

                {/* Diagnostic Plan Section */}
                <div id={FORM_SECTION_IDS.diagnosticPlan} className="scroll-mt-24">
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <FileText className="w-6 h-6 text-blue-500" />
                            План диагностики
                        </h2>
                        <Button type="button" variant="secondary" onClick={addDiagnosticPlanItem} className="rounded-xl">
                            <Plus className="w-4 h-4 mr-2" />
                            Добавить
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {(formData.diagnosticPlan || []).map((item: any, idx: number) => (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 relative">
                                <button
                                    type="button"
                                    onClick={() => removeDiagnosticPlanItem(idx)}
                                    className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Тип</label>
                                        <PrettySelect
                                            value={item.type || 'lab'}
                                            onChange={(value) => updateDiagnosticPlanItem(idx, { type: value })}
                                            options={diagnosticTypeOptions}
                                            buttonClassName="h-10 px-3 rounded-xl"
                                            useFixedPanel
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 md:col-span-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Исследование</label>
                                        <TestNameAutocomplete
                                            value={item.test || ''}
                                            onChange={value => updateDiagnosticPlanItem(idx, { test: value })}
                                            onBlurValue={value => resolveDiagnosticTestAlias(idx, value)}
                                            availableTests={availableTestNames}
                                            isLoading={isLoadingTests}
                                            placeholder="Например: ОАК"
                                            className="h-10"
                                        />
                                        {testResolutionHints[idx] && (
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 ml-1">
                                                {testResolutionHints[idx]}
                                            </p>
                                        )}
                                        {pendingAliasWidgets[idx] && (
                                            <div className="mt-2 p-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 flex flex-col gap-2">
                                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                                    Исследование <span className="font-bold">«{pendingAliasWidgets[idx].typedValue}»</span> не найдено в каталоге.
                                                </p>
                                                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                                                    <PrettySelect
                                                        value={pendingAliasWidgets[idx].selectedCanonical}
                                                        onChange={val => setPendingAliasWidgets(prev => ({
                                                            ...prev,
                                                            [idx]: { ...prev[idx], selectedCanonical: val }
                                                        }))}
                                                        options={[
                                                            { value: '', label: 'Сохранить как новое исследование' },
                                                            ...availableTestNames.map(n => ({ value: n, label: `Псевдоним для: ${n}` }))
                                                        ]}
                                                        buttonClassName="h-9 px-3 rounded-xl text-xs"
                                                        useFixedPanel
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() => confirmAliasLink(idx, pendingAliasWidgets[idx].typedValue, pendingAliasWidgets[idx].selectedCanonical)}
                                                        className="h-9 px-4 rounded-xl text-xs whitespace-nowrap"
                                                    >
                                                        Подтвердить
                                                    </Button>
                                                    <button
                                                        type="button"
                                                        onClick={() => clearAliasWidget(idx)}
                                                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                                                    >
                                                        Отмена
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Приоритет</label>
                                        <PrettySelect
                                            value={item.priority || 'medium'}
                                            onChange={(value) => updateDiagnosticPlanItem(idx, { priority: value })}
                                            options={priorityOptions}
                                            buttonClassName="h-10 px-3 rounded-xl"
                                            useFixedPanel
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 md:col-span-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Обоснование</label>
                                        <textarea
                                            value={item.rationale || ''}
                                            onChange={e => updateDiagnosticPlanItem(idx, { rationale: e.target.value })}
                                            placeholder="Почему необходимо"
                                            rows={3}
                                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 resize-y min-h-[80px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(formData.diagnosticPlan || []).length === 0 && (
                            <p className="text-sm text-slate-400 italic">План диагностики не заполнен</p>
                        )}
                    </div>
                </Card>
                </div>

                {/* Treatment Plan Section */}
                <div id={FORM_SECTION_IDS.treatmentPlan} className="scroll-mt-24">
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                            План лечения
                        </h2>
                        <Button type="button" variant="secondary" onClick={addTreatmentPlanItem} className="rounded-xl">
                            <Plus className="w-4 h-4 mr-2" />
                            Добавить
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {(formData.treatmentPlan || []).map((item: any, idx: number) => (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 relative">
                                <button
                                    type="button"
                                    onClick={() => removeTreatmentPlanItem(idx)}
                                    className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Категория</label>
                                        <PrettySelect
                                            value={item.category || 'symptomatic'}
                                            onChange={(value) => updateTreatmentPlanItem(idx, { category: value })}
                                            options={treatmentCategoryOptions}
                                            buttonClassName="h-10 px-3 rounded-xl"
                                            useFixedPanel
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 md:col-span-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Описание</label>
                                        <textarea
                                            value={item.description || ''}
                                            onChange={e => updateTreatmentPlanItem(idx, { description: e.target.value })}
                                            placeholder="Описание этапа лечения"
                                            rows={3}
                                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 resize-y min-h-[80px]"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Приоритет</label>
                                        <PrettySelect
                                            value={item.priority || 'medium'}
                                            onChange={(value) => updateTreatmentPlanItem(idx, { priority: value })}
                                            options={priorityOptions}
                                            buttonClassName="h-10 px-3 rounded-xl"
                                            useFixedPanel
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(formData.treatmentPlan || []).length === 0 && (
                            <p className="text-sm text-slate-400 italic">План лечения не заполнен</p>
                        )}
                    </div>
                </Card>
                </div>

                {/* Clinical Recommendations */}
                <div id={FORM_SECTION_IDS.clinicalRecommendations} className="scroll-mt-24">
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-teal-500" />
                            Рекомендации
                        </h2>
                        <Button type="button" variant="secondary" onClick={addRecommendationItem} className="rounded-xl">
                            <Plus className="w-4 h-4 mr-2" />
                            Добавить
                        </Button>
                    </div>
                    <div className="space-y-4">
                        {(formData.clinicalRecommendations || []).map((item: DiseaseRecommendationItem, idx: number) => (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 relative">
                                <button
                                    type="button"
                                    onClick={() => removeRecommendationItem(idx)}
                                    className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pr-8">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Категория</label>
                                        <PrettySelect
                                            value={item.category || 'other'}
                                            onChange={(value) => updateRecommendationItem(idx, { category: value as DiseaseRecommendationCategory })}
                                            options={recommendationCategoryOptions}
                                            buttonClassName="h-10 px-3 rounded-xl"
                                            useFixedPanel
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 md:col-span-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Текст рекомендации</label>
                                        <textarea
                                            value={item.text || ''}
                                            onChange={e => updateRecommendationItem(idx, { text: e.target.value })}
                                            placeholder="Например: Постельный режим 3-5 дней"
                                            rows={2}
                                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Приоритет</label>
                                        <PrettySelect
                                            value={item.priority || 'medium'}
                                            onChange={(value) => updateRecommendationItem(idx, { priority: value as 'low' | 'medium' | 'high' })}
                                            options={priorityOptions}
                                            buttonClassName="h-10 px-3 rounded-xl"
                                            useFixedPanel
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(formData.clinicalRecommendations || []).length === 0 && (
                            <p className="text-sm text-slate-400 italic">Рекомендации не заполнены</p>
                        )}
                    </div>
                </Card>
                </div>

                {/* Differential Diagnosis & Red Flags */}
                <div id={FORM_SECTION_IDS.differential} className="scroll-mt-24">
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Дифференциальная диагностика</h2>
                            <div className="flex gap-2 mb-4">
                                <Input
                                    value={newDifferential}
                                    onChange={e => setNewDifferential(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDifferentialDiagnosis())}
                                    placeholder="Добавить диагноз..."
                                    className="h-12 rounded-xl"
                                />
                                <Button type="button" onClick={addDifferentialDiagnosis} variant="secondary" className="h-12 w-12 rounded-xl p-0">
                                    <Plus className="w-6 h-6" />
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(formData.differentialDiagnosis || []).map((item: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="pl-3 pr-1 py-1.5 rounded-xl flex items-center gap-2">
                                        <span>{item}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeDifferentialDiagnosis(item)}
                                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </Badge>
                                ))}
                                {(formData.differentialDiagnosis || []).length === 0 && (
                                    <p className="text-sm text-slate-400 italic">Нет списка</p>
                                )}
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Красные флаги</h2>
                            <div className="flex gap-2 mb-4">
                                <Input
                                    value={newRedFlag}
                                    onChange={e => setNewRedFlag(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRedFlag())}
                                    placeholder="Добавить красный флаг..."
                                    className="h-12 rounded-xl"
                                />
                                <Button type="button" onClick={addRedFlag} variant="secondary" className="h-12 w-12 rounded-xl p-0">
                                    <Plus className="w-6 h-6" />
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(formData.redFlags || []).map((item: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="pl-3 pr-1 py-1.5 rounded-xl flex items-center gap-2">
                                        <span>{item}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeRedFlag(item)}
                                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </Badge>
                                ))}
                                {(formData.redFlags || []).length === 0 && (
                                    <p className="text-sm text-slate-400 italic">Нет списка</p>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
                </div>

                {/* Clinical Guideline List (ReadOnly in Form) */}
                {isEdit && (
                    <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileText className="w-6 h-6 text-teal-500" />
                                Клинические рекомендации (PDF)
                            </h2>
                            {!isViewMode && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleFileUpload}
                                    isLoading={isSaving}
                                    className="rounded-xl"
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Загрузить PDF
                                </Button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {(formData as any).guidelines?.map((guide: any) => (
                                <div key={guide.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                            <FileText className="w-5 h-5 text-red-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">{guide.title}</h4>
                                            <p className="text-xs text-slate-500 italic">Загружено {new Date(guide.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => window.electronAPI?.openExternalPath(guide.pdfPath)} // eslint-disable-line
                                    >
                                        Открыть
                                    </Button>
                                </div>
                            ))}
                            {(!(formData as any).guidelines || (formData as any).guidelines.length === 0) && (
                                <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                                    <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-400">Нет загруженных PDF-рекомендаций</p>
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {/* Status Messages */}
                <div className="space-y-4">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p className="font-bold text-sm tracking-tight">{error}</p>
                            </div>

                            {validationIssues.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {validationIssues.map((issue, idx) => {
                                        const section = resolveSectionFromPath(issue.path);
                                        return (
                                            <div key={`${issue.message || 'issue'}-${idx}`} className="p-3 rounded-xl border border-red-200 bg-white/70 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-red-700 break-words">{issue.message || 'Некорректные данные'}</p>
                                                    {section && (
                                                        <p className="text-xs text-red-500 mt-1">Раздел: {FORM_SECTION_TITLES[section]}</p>
                                                    )}
                                                </div>
                                                {section && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            const target = document.getElementById(FORM_SECTION_IDS[section]);
                                                            if (target) {
                                                                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                            }
                                                        }}
                                                        className="h-8 px-3 rounded-lg text-red-700 hover:bg-red-100 whitespace-nowrap"
                                                    >
                                                        Перейти
                                                        <ChevronRight className="w-4 h-4 ml-1" />
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {success && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-green-600 animate-in fade-in zoom-in duration-300">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                            <p className="font-bold text-sm tracking-tight">Заболевание успешно сохранено!</p>
                        </div>
                    )}
                </div>

                {!isViewMode && (
                <div className="flex justify-end gap-3 pt-4 pb-12">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => navigate(diseasesListPath)}
                        className="h-14 px-8 rounded-2xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
                    >
                        Отмена
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSaving}
                        variant="primary"
                        className="h-14 px-12 rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02]"
                    >
                        <Save className="w-5 h-5 mr-2" />
                        {isEdit ? 'Сохранить изменения' : 'Создать заболевание'}
                    </Button>
                </div>
                )}
            </form>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Удаление заболевания"
                message={`Вы уверены, что хотите удалить заболевание "${formData.nameRu}"?\n\nЭто действие нельзя отменить.`}
                confirmText="Удалить"
                cancelText="Отмена"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            {/* Диалог импорта из JSON */}
            {showImportDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Импорт заболевания из JSON</h2>

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
                            placeholder="Вставьте JSON данные заболевания здесь..."
                            className={`w-full h-64 p-3 rounded-xl border-2 font-mono text-sm ${jsonError
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

                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-4">
                            Вставьте JSON данные заболевания. Используйте кнопку "Скопировать шаблон" для получения примера структуры.
                        </p>

                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="primary"
                                onClick={handleImportFromJson}
                                isLoading={isImporting}
                                disabled={!jsonText.trim() || !!jsonError}
                            >
                                Импортировать
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setShowImportDialog(false);
                                    setJsonText('');
                                    setJsonError(null);
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
                                        <div className="text-xs font-bold text-slate-500 uppercase">Название (RU)</div>
                                        <div className="text-sm text-slate-900 dark:text-white">{previewData.nameRu || 'Не заполнено'}</div>
                                    </div>
                                    {previewData.nameEn && (
                                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                            <div className="text-xs font-bold text-slate-500 uppercase">Название (EN)</div>
                                            <div className="text-sm text-slate-900 dark:text-white">{previewData.nameEn}</div>
                                        </div>
                                    )}
                                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                        <div className="text-xs font-bold text-slate-500 uppercase">Код МКБ-10</div>
                                        <div className="text-sm text-slate-900 dark:text-white font-mono">{previewData.icd10Code || 'Не заполнено'}</div>
                                    </div>
                                    {previewData.icd10Codes && previewData.icd10Codes.length > 0 && (
                                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Все коды МКБ-10</div>
                                            <div className="flex flex-wrap gap-1">
                                                {previewData.icd10Codes.map((code, idx) => (
                                                    <Badge key={idx} variant="outline" className="font-mono">{code}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                        <div className="text-xs font-bold text-slate-500 uppercase">Описание</div>
                                        <div className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{previewData.description || 'Не заполнено'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Симптомы */}
                            {previewData.symptoms && previewData.symptoms.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold mb-3">Симптомы</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {previewData.symptoms.map((symptom, idx) => (
                                            <Badge key={idx} variant="primary">
                                                {typeof symptom === 'object' && symptom !== null && 'text' in symptom ? symptom.text : String(symptom)}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Ошибки валидации */}
                            {validationResult && validationResult.errors.length > 0 && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                                    <h4 className="font-bold text-red-700 dark:text-red-300 mb-2">
                                        ❌ Ошибки ({validationResult.errors.length})
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

                            {/* Предупреждения */}
                            {validationResult && validationResult.warnings.length > 0 && (
                                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                                    <h4 className="font-bold text-orange-700 dark:text-orange-300 mb-2">
                                        ⚠️ Предупреждения ({validationResult.warnings.length})
                                    </h4>
                                    <ul className="space-y-1">
                                        {validationResult.warnings.map((warn, idx) => (
                                            <li key={idx} className={`text-sm ${warn.severity === 'high' ? 'text-orange-700' : 'text-orange-600'
                                                } dark:text-orange-400`}>
                                                <strong>{warn.field}:</strong> {warn.message}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="mt-4 p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                <p className="text-sm text-orange-800 dark:text-orange-200">
                                    💡 <strong>Внимание:</strong> Обязательно проверьте все значения перед сохранением!
                                </p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                            {validationResult && !validationResult.isValid ? (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setShowPreview(false);
                                        setShowImportDialog(true);
                                        if (previewData) {
                                            setJsonText(JSON.stringify(previewData, null, 2));
                                        }
                                    }}
                                    className="flex-1"
                                >
                                    Вернуться к редактированию
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setShowPreview(false);
                                            setPreviewData(null);
                                            setValidationResult(null);
                                        }}
                                    >
                                        Отмена
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={handleConfirmImport}
                                        className="flex-1"
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Подтвердить и заполнить форму
                                    </Button>
                                </>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
