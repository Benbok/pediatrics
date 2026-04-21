import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { visitService } from './services/visitService';
import { medicationService } from '../medications/services/medicationService';
import { diseaseService } from '../diseases/services/diseaseService';
import { patientService } from '../../services/patient.service';
import { logger } from '../../services/logger';
import { draftService } from '../../services/draftService';
import type { VisitDraftCachePayload } from '../../services/draftService';
import { analysisRegistry } from '../../services/analysisRegistry';
import { useTabs } from '../../context/TabsContext';
import { useVisitAnalysis } from '../../hooks/useVisitAnalysis';
import debounce from 'lodash/debounce';
import { Visit, ChildProfile, Disease, Medication, DiagnosisSuggestion, DiagnosisEntry, MedicationRecommendation, AllergyStatusData, getFullName } from '../../types';
import { MedicationBrowser } from './components/MedicationBrowser';
import { VisitTypeSelector, VisitType } from './components/VisitTypeSelector';
import { AnamnesisSection } from './components/AnamnesisSection';
import { DiseaseHistorySection } from './components/DiseaseHistorySection';
import { VitalSignsSection } from './components/VitalSignsSection';
import { PhysicalExamBySystems } from './components/PhysicalExamBySystems';
import { DiagnosisSelector, MultipleDiagnosisSelector } from './components/DiagnosisSelector';
import { IcdCodeSearchModal } from './components/IcdCodeSearchModal';
import { DiseaseSearchModal } from './components/DiseaseSearchModal';
import { VisitTemplateSelector } from './components/VisitTemplateSelector';
import type { DoseCalculationResult } from '../../types/medication.types';
import { MedicationDoseModal, DoseData } from './components/MedicationDoseModal';
import { MedicationTemplateSelector } from './components/MedicationTemplateSelector';
import { MedicationTemplateBatchEditor } from './components/MedicationTemplateBatchEditor';
import { CreateMedicationTemplateModal } from './components/CreateMedicationTemplateModal';
import { medicationTemplateService } from './services/medicationTemplateService';
import { CreateDiagnosticTemplateModal } from './components/CreateDiagnosticTemplateModal';
import { DiagnosticTemplateSelector } from './components/DiagnosticTemplateSelector';
import { DiagnosticTemplateBatchEditor } from './components/DiagnosticTemplateBatchEditor';
import { DiagnosticBrowser } from './components/DiagnosticBrowser';
import { RecommendationsBrowser } from './components/RecommendationsBrowser';
import { AiDiagnosisRecommendationsModal } from './components/AiDiagnosisRecommendationsModal';
import { diagnosticTemplateService } from './services/diagnosticTemplateService';
import { RecommendationsSection } from './components/RecommendationsSection';
import { RecommendationTemplateSelector } from './components/RecommendationTemplateSelector';
import { CreateRecommendationTemplateModal } from './components/CreateRecommendationTemplateModal';
import { printService } from '../printing';
import { VisitFormPrintData } from '../printing/templates/visit/types';
import { formatDate } from '../printing/utils/formatters';
import { organizationService } from '../../services/organization.service';
import { buildVisitPayload } from './utils/buildVisitPayload';
import { toggleRecommendationSelection } from './utils/recommendationSelection';
import { VisitFormNavigation, NavigationSection } from './components/VisitFormNavigation';
import { useActiveSection } from './hooks/useActiveSection';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ErrorModal } from '../../components/ui/ErrorModal';
import { useAuth } from '../../context/AuthContext';
import {
    ChevronLeft,
    Save,
    Stethoscope,
    Activity,
    Pill,
    ClipboardList,
    AlertCircle,
    CheckCircle2,
    Trash2,
    Plus,
    Scale,
    TrendingUp,
    Calendar,
    Clock,
    FileText,
    Beaker,
    Microscope,
    FlaskConical,
    FileBarChart,
    X,
    Search,
    FileSignature,
    Printer,
    BookOpen,
    Loader2
} from 'lucide-react';
import { calculateBMI, calculateBSA, getBMICategory, getBMICategoryLabel, formatBMI, formatBSA, validateAnthropometry } from '../../utils/anthropometry';
import { calculateAgeInMonths, getFormattedAge } from '../../utils/ageUtils';
import { getRouteLabel } from '../../utils/routeOfAdmin';
import { getDiluentLabel } from '../../utils/diluentTypes';
import { getRandomVitalsInNormForAge } from './constants';
import { parseMedicationAllergyFromAnamnesis } from './services/medicationAllergyRisk.service';

type PendingFieldRefinement = {
    original: string;
    refined: string;
};

export const VisitFormPage: React.FC = () => {
    const { childId, id } = useParams<{ childId: string; id?: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const isEdit = !!id;

    const [child, setChild] = useState<ChildProfile | null>(null);
    const [formData, setFormData] = useState<Partial<Visit>>({
        childId: Number(childId),
        doctorId: currentUser?.id,
        visitDate: new Date().toISOString().split('T')[0],
        visitType: null,
        visitPlace: 'clinic',
        visitTime: null,
        complaints: '',
        physicalExam: '',
        primaryDiagnosis: null,
        complications: null,
        comorbidities: null,
        primaryDiagnosisId: null,
        prescriptions: [],
        status: 'draft',
    });

    const [suggestions, setSuggestions] = useState<DiagnosisSuggestion[]>([]);
    const visitAnalysis = useVisitAnalysis({ maxConcurrentAnalyses: 1, cooldownMs: 2000 });
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('Прием успешно сохранен!');
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
    const [calculatedBMI, setCalculatedBMI] = useState<number | null>(null);
    const [calculatedBSA, setCalculatedBSA] = useState<number | null>(null);
    const [medicationRecommendations, setMedicationRecommendations] = useState<any[]>([]);
    const [isLoadingMedications, setIsLoadingMedications] = useState(false);
    const [isMedicationBrowserOpen, setIsMedicationBrowserOpen] = useState(false);
    const [autoDetectedVisitType, setAutoDetectedVisitType] = useState<VisitType | null>(null);

    // Модальное окно редактирования дозировки
    const [isDoseModalOpen, setIsDoseModalOpen] = useState(false);
    const [selectedMedicationForDose, setSelectedMedicationForDose] = useState<Medication | null>(null);
    const [calculatedDoseData, setCalculatedDoseData] = useState<Partial<DoseData> | null>(null);
    const [pendingMedicationId, setPendingMedicationId] = useState<number | null>(null);
    const [lastDoseResult, setLastDoseResult] = useState<DoseCalculationResult | null>(null);
    const [doseCalcParams, setDoseCalcParams] = useState<{ weight: number; ageMonths: number; height: number | null } | null>(null);

    // Шаблоны назначений
    const [isMedicationTemplateSelectorOpen, setIsMedicationTemplateSelectorOpen] = useState(false);
    const [isBatchEditorOpen, setIsBatchEditorOpen] = useState(false);
    const [pendingTemplateItems, setPendingTemplateItems] = useState<any[]>([]);
    const [isCreateMedicationTemplateOpen, setIsCreateMedicationTemplateOpen] = useState(false);

    // Диагностические исследования
    const [diagnosticRecommendations, setDiagnosticRecommendations] = useState<import('../../types').DiagnosticRecommendation[]>([]);
    const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);
    const [isCreateDiagnosticTemplateOpen, setIsCreateDiagnosticTemplateOpen] = useState(false);
    const [isDiagnosticTemplateSelectorOpen, setIsDiagnosticTemplateSelectorOpen] = useState(false);
    const [diagnosticTemplateToEdit, setDiagnosticTemplateToEdit] = useState<import('../../types').DiagnosticTemplate | null>(null);
    const [isDiagnosticBrowserOpen, setIsDiagnosticBrowserOpen] = useState(false);

    // Рекомендации из базы знаний заболеваний
    const [diseaseRecommendations, setDiseaseRecommendations] = useState<import('../../types').DiseaseRecommendationSuggestion[]>([]);
    const [isLoadingDiseaseRecs, setIsLoadingDiseaseRecs] = useState(false);

    // LLM field refinement
    const [refiningFields, setRefiningFields] = useState<Set<string>>(new Set());
    const [streamPreview, setStreamPreview] = useState<Record<string, string>>({});
    const [refineAiAvailable, setRefineAiAvailable] = useState<boolean | null>(null);
    const [refineAiProvider, setRefineAiProvider] = useState<'local' | 'gemini'>('local');
    const [analysisAiAvailable, setAnalysisAiAvailable] = useState<boolean | null>(null);
    const [analysisAiProvider, setAnalysisAiProvider] = useState<'local' | 'gemini'>('local');
    const [pendingRefinements, setPendingRefinements] = useState<Record<string, PendingFieldRefinement>>({});

    // Рекомендации
    const [recommendations, setRecommendations] = useState<string[]>([]);
    const [isRecommendationTemplateSelectorOpen, setIsRecommendationTemplateSelectorOpen] = useState(false);
    const [isCreateRecommendationTemplateOpen, setIsCreateRecommendationTemplateOpen] = useState(false);
    const [isRecommendationBrowserOpen, setIsRecommendationBrowserOpen] = useState(false);
    const [isAiDiagnosisModalOpen, setIsAiDiagnosisModalOpen] = useState(false);

    // Модальные окна
    const [isIcdSearchOpen, setIsIcdSearchOpen] = useState(false);
    const [isDiseaseSearchOpen, setIsDiseaseSearchOpen] = useState(false);
    const [currentDiagnosisSelector, setCurrentDiagnosisSelector] = useState<'primary' | 'complications' | 'comorbidities' | null>(null);

    // Восстановление черновика
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [savedDraft, setSavedDraft] = useState<Partial<Visit> | null>(null);
    const [savedDraftMeta, setSavedDraftMeta] = useState<{ recommendations: string[]; suggestions: DiagnosisSuggestion[] } | null>(null);
    const [hasLocalChanges, setHasLocalChanges] = useState(false);
    const initialLoadDone = useRef(false);
    const tabRegistered = useRef(false);

    // Tabs integration
    const { openTab, closeTab, markDirty, registerSaveHandler, unregisterSaveHandler } = useTabs();

    // Ключ для черновика в localStorage
    const draftKey = draftService.getVisitDraftKey(Number(childId), id ? Number(id) : null);
    const tabId = id ? `visit-${childId}-${id}` : `visit-${childId}-new`;

    // Обработчик выхода из формы: при наличии изменений сохраняем черновик (localStorage + бэкенд), затем закрываем
    const handleBack = useCallback(async () => {
        if (hasLocalChanges && formData) {
            draftService.saveDraft(draftKey, draftService.buildVisitDraftPayload(formData, recommendations, suggestions));
            const childIdNum = formData.childId ?? (childId ? Number(childId) : 0);
            const doctorIdNum = formData.doctorId ?? currentUser?.id;
            const visitDateStr = formData.visitDate;
            if (childIdNum && doctorIdNum && visitDateStr) {
                try {
                    const payload = buildVisitPayload(
                        { ...formData, childId: childIdNum, doctorId: doctorIdNum },
                        recommendations,
                        'draft'
                    );
                    await visitService.upsertVisit(payload);
                    draftService.removeDraft(draftKey);
                } catch (err: any) {
                    logger.warn('[VisitFormPage] Draft save on exit failed', { error: err?.message });
                }
            }
        }
        closeTab(tabId);
        setTimeout(() => {
            navigate(`/patients/${childId}/visits`);
        }, 0);
    }, [closeTab, tabId, navigate, childId, hasLocalChanges, formData, draftKey, recommendations, suggestions, currentUser?.id]);

    // Анимация прогресса AI анализа
    useEffect(() => {
        if (visitAnalysis.isAnalyzing) {
            setAnalysisProgress(5);
            progressIntervalRef.current = setInterval(() => {
                setAnalysisProgress(prev => {
                    if (prev < 30) return prev + 5;
                    if (prev < 70) return prev + 3;
                    if (prev < 90) return prev + 1;
                    return prev;
                });
            }, 300);
        } else if (analysisProgress > 0) {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
            setAnalysisProgress(100);
            const t = setTimeout(() => setAnalysisProgress(0), 600);
            return () => clearTimeout(t);
        }
        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitAnalysis.isAnalyzing]);

    // Переподключение к анализу, запущенному до перехода на другую страницу
    useEffect(() => {
        const visitId = formData.id;
        if (!visitId) return;
        const entry = analysisRegistry.get(visitId);
        if (!entry) return;
        // Отображаем анализ как активный
        visitAnalysis.cancelAnalysis(); // сбрасываем старый idle-стейт
        setAnalysisProgress(50); // произвольный прогресс — идёт фоновый анализ
        logger.info('[VisitFormPage] Re-attaching to in-flight analysis', { visitId, startedAt: entry.startedAt });
        entry.promise
            .then((results) => {
                setSuggestions(results);
                setHasLocalChanges(true);
                logger.info('[VisitFormPage] Re-attached analysis completed', { visitId, count: results.length });
            })
            .catch((err: any) => {
                logger.warn('[VisitFormPage] Re-attached analysis failed', { visitId, error: err?.message });
            });
    // Run once when visitId becomes known
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.id]);

    // Регистрация вкладки ТОЛЬКО после загрузки данных ребенка
    useEffect(() => {
        if (child && !tabRegistered.current) {
            // ChildProfile использует поля: surname, name, patronymic
            const childFullName = `${child.surname || ''} ${child.name || ''}`.trim() || 'Пациент';
            const route = id 
                ? `/patients/${childId}/visits/${id}` 
                : `/patients/${childId}/visits/new`;
            
            openTab({
                id: tabId,
                type: 'visit-form',
                route,
                label: `Прием: ${childFullName}`,
                isDirty: false,
                metadata: {
                    childId: Number(childId),
                    childName: childFullName,
                    visitId: id ? Number(id) : null
                }
            });
            tabRegistered.current = true;
            logger.info('[VisitFormPage] Tab registered', { tabId, childFullName });
        }
    }, [child, childId, id, openTab, tabId]);

    // Функция для установки флага dirty
    const setDirty = useCallback((isDirty: boolean) => {
        markDirty(tabId, isDirty);
    }, [markDirty, tabId]);

    /** Единая точка обновления формы при действиях пользователя — всегда помечает форму как изменённую для автосохранения черновика */
    const updateFormData = useCallback((updater: (prev: Partial<Visit>) => Partial<Visit>) => {
        setFormData(updater);
        setHasLocalChanges(true);
    }, []);

    // Debounced автосохранение черновика в localStorage
    const debouncedSaveDraft = useMemo(
        () => debounce((data: Partial<Visit>, recs: string[], aiSuggestions: DiagnosisSuggestion[]) => {
            if (!initialLoadDone.current) return;
            draftService.saveDraft(draftKey, draftService.buildVisitDraftPayload(data, recs, aiSuggestions));
            setDirty(true);
            logger.info('[VisitFormPage] Draft auto-saved to localStorage', { draftKey });
        }, 800),
        [draftKey, setDirty]
    );

    // Debounced автосохранение черновика на бэкенд
    const debouncedBackendSave = useMemo(
        () => debounce(async (data: Partial<Visit>, recs: string[]) => {
            if (!initialLoadDone.current) return;
            const childIdNum = data.childId ?? (childId ? Number(childId) : 0);
            const doctorIdNum = data.doctorId ?? currentUser?.id;
            const visitDateStr = data.visitDate;
            if (!childIdNum || !doctorIdNum || !visitDateStr) return;
            try {
                const payload = buildVisitPayload(
                    { ...data, childId: childIdNum, doctorId: doctorIdNum },
                    recs,
                    'draft'
                );
                const savedVisit = await visitService.upsertVisit(payload);
                if (!data.id && savedVisit.id) {
                    setFormData(prev => (prev ? { ...prev, id: savedVisit.id } : prev));
                }
                logger.info('[VisitFormPage] Draft auto-saved to backend', { visitId: savedVisit.id });
            } catch (err: any) {
                logger.warn('[VisitFormPage] Draft backend save failed', { error: err?.message });
            }
        }, 2500),
        [draftKey, childId, currentUser?.id]
    );

    // Автосохранение при изменении formData (localStorage + бэкенд)
    useEffect(() => {
        if (hasLocalChanges && initialLoadDone.current) {
            debouncedSaveDraft(formData, recommendations, suggestions);
            debouncedBackendSave(formData, recommendations);
        }
        return () => {
            debouncedSaveDraft.cancel();
            debouncedBackendSave.cancel();
        };
    }, [formData, hasLocalChanges, recommendations, suggestions, debouncedSaveDraft, debouncedBackendSave]);

    // Регистрация обработчика сохранения черновика при закрытии вкладки (для модалки «Сохранить черновик» в TabBar)
    const saveDraftForCloseRef = useRef<() => Promise<void>>(async () => {});
    useEffect(() => {
        saveDraftForCloseRef.current = async () => {
            if (!formData || !initialLoadDone.current) return;
            const childIdNum = formData.childId ?? (childId ? Number(childId) : 0);
            const doctorIdNum = formData.doctorId ?? currentUser?.id;
            const visitDateStr = formData.visitDate;
            if (!childIdNum || !doctorIdNum || !visitDateStr) return;
            try {
                const payload = buildVisitPayload(
                    { ...formData, childId: childIdNum, doctorId: doctorIdNum },
                    recommendations,
                    'draft'
                );
                await visitService.upsertVisit(payload);
                draftService.removeDraft(draftKey);
                setDirty(false);
                setHasLocalChanges(false);
            } catch (err: any) {
                logger.warn('[VisitFormPage] Save draft on close failed', { error: err?.message });
            }
        };
    }, [formData, recommendations, childId, currentUser?.id, draftKey, setDirty]);
    useEffect(() => {
        registerSaveHandler(tabId, async () => { await saveDraftForCloseRef.current?.(); });
        return () => unregisterSaveHandler(tabId);
    }, [tabId, registerSaveHandler, unregisterSaveHandler]);

    // Проверка черновика при загрузке
    useEffect(() => {
        if (!initialLoadDone.current && !isEdit) {
            const draft = draftService.loadDraft<Partial<Visit> | VisitDraftCachePayload>(draftKey);
            if (draft && draft.data) {
                const parsedDraft = draftService.parseVisitDraftPayload(draft.data);
                // Показываем модальное окно восстановления
                setSavedDraft(parsedDraft.formData);
                setSavedDraftMeta({
                    recommendations: parsedDraft.recommendations,
                    suggestions: parsedDraft.suggestions
                });
                setShowRestoreModal(true);
            }
        }
    }, [draftKey, isEdit]);

    // Обработчик восстановления черновика
    const handleRestoreDraft = () => {
        if (savedDraft) {
            setFormData(savedDraft);
            if (savedDraftMeta) {
                setRecommendations(savedDraftMeta.recommendations);
                setSuggestions(savedDraftMeta.suggestions);
            }
            setShowRestoreModal(false);
            setSavedDraft(null);
            setSavedDraftMeta(null);
            setHasLocalChanges(true);
            logger.info('[VisitFormPage] Draft restored', { draftKey });
        }
    };

    // Обработчик отклонения черновика
    const handleDiscardDraft = () => {
        draftService.removeDraft(draftKey);
        setShowRestoreModal(false);
        setSavedDraft(null);
        setSavedDraftMeta(null);
        logger.info('[VisitFormPage] Draft discarded', { draftKey });
    };

    useEffect(() => {
        loadData();
    }, [id, childId]);

    // Подстраховка: сохранение в localStorage при закрытии вкладки/окна (beforeunload ненадёжен на мобильных)
    const draftSnapshotRef = useRef({ draftKey, hasLocalChanges: false, formData: null as Partial<Visit> | null });
    draftSnapshotRef.current = { draftKey, hasLocalChanges, formData };
    useEffect(() => {
        const onBeforeUnload = () => {
            const { draftKey: key, hasLocalChanges: dirty, formData: data } = draftSnapshotRef.current;
            if (dirty && data) {
                draftService.saveDraft(key, draftService.buildVisitDraftPayload(data, recommendations, suggestions));
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [recommendations, suggestions]);

    const loadData = async () => {
        try {
            const childData = await patientService.getChildById(Number(childId));
            if (!childData) {
                throw new Error('Пациент не найден');
            }
            setChild(childData);

            if (isEdit && id) {
                const visitData = await visitService.getVisit(Number(id));

                // Парсим JSON поля диагнозов, если они строки
                const parsedData = { ...visitData };
                if (typeof parsedData.primaryDiagnosis === 'string' && parsedData.primaryDiagnosis) {
                    try {
                        parsedData.primaryDiagnosis = JSON.parse(parsedData.primaryDiagnosis);
                    } catch (e) {
                        logger.warn('[VisitFormPage] Failed to parse primaryDiagnosis:', { error: String(e) });
                    }
                }
                if (typeof parsedData.complications === 'string' && parsedData.complications) {
                    try {
                        parsedData.complications = JSON.parse(parsedData.complications);
                    } catch (e) {
                        logger.warn('[VisitFormPage] Failed to parse complications:', { error: String(e) });
                    }
                }
                if (typeof parsedData.comorbidities === 'string' && parsedData.comorbidities) {
                    try {
                        parsedData.comorbidities = JSON.parse(parsedData.comorbidities);
                    } catch (e) {
                        logger.warn('[VisitFormPage] Failed to parse comorbidities:', { error: String(e) });
                    }
                }

                setFormData(parsedData);

                // Парсим рекомендации
                if (visitData.recommendations) {
                    try {
                        const parsedRecommendations = typeof visitData.recommendations === 'string'
                            ? JSON.parse(visitData.recommendations)
                            : visitData.recommendations;
                        if (Array.isArray(parsedRecommendations)) {
                            setRecommendations(parsedRecommendations);
                        }
                    } catch (e) {
                        logger.warn('[VisitFormPage] Failed to parse recommendations:', { error: String(e) });
                    }
                }

                if (visitData.currentWeight && visitData.currentHeight) {
                    setCalculatedBMI(visitData.bmi || calculateBMI(visitData.currentWeight, visitData.currentHeight));
                    setCalculatedBSA(visitData.bsa || calculateBSA(visitData.currentWeight, visitData.currentHeight));
                }

                // Тихо восстанавливаем suggestions из черновика (без модального окна):
                // это позволяет вернуться к результатам AI-анализа после навигации
                const editDraftKey = draftService.getVisitDraftKey(Number(childId), Number(id));
                const savedEditDraft = draftService.loadDraft<Partial<Visit> | VisitDraftCachePayload>(editDraftKey);
                if (savedEditDraft?.data) {
                    const parsed = draftService.parseVisitDraftPayload(savedEditDraft.data);
                    if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
                        setSuggestions(parsed.suggestions);
                        logger.info('[VisitFormPage] Suggestions restored from draft', {
                            visitId: Number(id),
                            count: parsed.suggestions.length,
                        });
                    }
                }

            } else {
                // Для нового приема определяем тип автоматически
                const autoType = await determineVisitType();
                updateFormData(prev => ({ ...prev, visitType: autoType }));
                setAutoDetectedVisitType(autoType);
            }
            
            // Помечаем, что начальная загрузка завершена
            initialLoadDone.current = true;
        } catch (err: any) {
            setError(err.message || 'Ошибка загрузки данных');
            logger.error('[VisitFormPage] Load data failed:', err);
        }
    };

    // Определение типа приема
    const determineVisitType = async (): Promise<VisitType> => {
        if (!childId || !currentUser?.id) return 'primary';

        try {
            const visits = await visitService.getVisits(Number(childId));
            if (visits.length === 0) return 'primary';

            const lastVisit = visits[0];
            const daysSinceLastVisit = Math.floor(
                (new Date().getTime() - new Date(lastVisit.visitDate).getTime()) / (1000 * 60 * 60 * 24)
            );

            return daysSinceLastVisit > 30 ? 'primary' : 'followup';
        } catch (err) {
            logger.error('[VisitFormPage] Failed to determine visit type:', { error: String(err) });
            return 'primary';
        }
    };

    // Обработчик изменения полей формы
    const handleFieldChange = useCallback((field: keyof Visit, value: any) => {
        updateFormData(prev => ({ ...prev, [field]: value }));
        setPendingRefinements((prev) => {
            if (!prev[field as string]) return prev;
            const next = { ...prev };
            delete next[field as string];
            return next;
        });
    }, [updateFormData]);

    const handleClearVitals = useCallback(() => {
        updateFormData(prev => ({
            ...prev,
            bloodPressureSystolic: null,
            bloodPressureDiastolic: null,
            pulse: null,
            temperature: null,
            respiratoryRate: null,
            oxygenSaturation: null,
        }));
    }, [updateFormData]);

    const loadLastAnthropometry = async () => {
        try {
            const visits = await visitService.getVisits(Number(childId));
            const lastVisit = visits.find(v => v.currentWeight && v.currentHeight);
            if (lastVisit) {
                updateFormData(prev => ({
                    ...prev,
                    currentWeight: lastVisit.currentWeight,
                    currentHeight: lastVisit.currentHeight
                }));
                if (lastVisit.currentWeight && lastVisit.currentHeight) {
                    setCalculatedBMI(calculateBMI(lastVisit.currentWeight, lastVisit.currentHeight));
                    setCalculatedBSA(calculateBSA(lastVisit.currentWeight, lastVisit.currentHeight));
                }
            }
        } catch (err) {
            logger.error('Failed to load last anthropometry', { error: err });
        }
    };

    const handleAnthropometryChange = (field: 'currentWeight' | 'currentHeight', value: string) => {
        const numValue = value === '' ? null : parseFloat(value);
        updateFormData(prev => ({ ...prev, [field]: numValue }));

        // Автоматический расчет BMI и BSA
        const weight = field === 'currentWeight' ? numValue : formData.currentWeight;
        const height = field === 'currentHeight' ? numValue : formData.currentHeight;

        if (weight && height) {
            const validation = validateAnthropometry(weight, height);
            if (validation.valid) {
                try {
                    setCalculatedBMI(calculateBMI(weight, height));
                    setCalculatedBSA(calculateBSA(weight, height));
                } catch (err) {
                    setCalculatedBMI(null);
                    setCalculatedBSA(null);
                }
            } else {
                setCalculatedBMI(null);
                setCalculatedBSA(null);
            }
        } else {
            setCalculatedBMI(null);
            setCalculatedBSA(null);
        }
    };

    // Печать формы приема
    const handlePrint = useCallback(async () => {
        if (!child) {
            setError('Данные пациента не загружены');
            return;
        }

        try {
            const organizationProfile = await organizationService.getProfile();
            const printData: VisitFormPrintData = {
                visit: formData as Visit,
                child: child,
                doctorName: getFullName(currentUser) || 'Врач',
                recommendations: recommendations,
                clinicInfo: {
                    name: organizationProfile.name,
                    legalName: organizationProfile.legalName || undefined,
                    department: organizationProfile.department || undefined,
                    address: organizationProfile.address || undefined,
                    phone: organizationProfile.phone || undefined,
                    email: organizationProfile.email || undefined,
                    website: organizationProfile.website || undefined,
                    inn: organizationProfile.inn || undefined,
                    ogrn: organizationProfile.ogrn || undefined,
                    chiefDoctor: organizationProfile.chiefDoctor || undefined,
                },
                printDate: formatDate(new Date(), 'short'),
            };

            const result = await printService.exportToPDF('visit-form', printData, {
                title: `Прием: ${child.surname} ${child.name}`,
                createdAt: new Date(),
                author: getFullName(currentUser) || undefined,
            });
            if (!result.success) {
                setError(result.error || 'Не удалось создать PDF');
            }
        } catch (err: any) {
            logger.error('[VisitFormPage] Print failed:', err);
            setError('Не удалось создать PDF');
        }
    }, [child, formData, currentUser, recommendations]);

    const checkFeatureAvailability = useCallback(async (
        featureId: 'refine-field' | 'visit-analysis',
        onAvailable: (v: boolean) => void,
        onProvider: (p: 'local' | 'gemini') => void,
    ) => {
        if (!window.electronAPI?.llm?.checkFeature) {
            onAvailable(false);
            return false;
        }

        try {
            const result = await window.electronAPI.llm.checkFeature(featureId);
            onAvailable(Boolean(result.available));
            onProvider(result.provider ?? 'local');
            return Boolean(result.available);
        } catch {
            onAvailable(false);
            return false;
        }
    }, []);

    const checkRefineAvailability = useCallback(async () => {
        return checkFeatureAvailability('refine-field', setRefineAiAvailable, setRefineAiProvider);
    }, [checkFeatureAvailability]);

    const checkAnalysisAvailability = useCallback(async () => {
        return checkFeatureAvailability('visit-analysis', setAnalysisAiAvailable, setAnalysisAiProvider);
    }, [checkFeatureAvailability]);

    useEffect(() => {
        checkRefineAvailability();
        checkAnalysisAvailability();
    }, [checkRefineAvailability, checkAnalysisAvailability]);

    const handleAcceptRefine = useCallback((field: string) => {
        const proposal = pendingRefinements[field];
        if (!proposal) return;

        updateFormData((fd) => ({ ...fd, [field]: proposal.refined }));
        setPendingRefinements((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
        setStreamPreview((prev) => ({ ...prev, [field]: '' }));
    }, [pendingRefinements, updateFormData]);

    const handleRejectRefine = useCallback((field: string) => {
        const proposal = pendingRefinements[field];
        if (!proposal) return;

        updateFormData((fd) => ({ ...fd, [field]: proposal.original }));
        setPendingRefinements((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
        setStreamPreview((prev) => ({ ...prev, [field]: '' }));
    }, [pendingRefinements, updateFormData]);

    // LLM field refinement handler
    const handleRefineField = async (field: string, text: string) => {
        if (!text.trim()) return;
        if (!window.electronAPI?.llm?.refineField) {
            logger.error('[VisitFormPage] LLM API not available');
            return;
        }

        // Check LM Studio availability before starting
        const isAvailable = await checkRefineAvailability();
        if (!isAvailable) {
            if (refineAiProvider === 'gemini') {
                setError('Gemini API недоступен. Проверьте API ключи в настройках.');
            } else {
                setError('Локальный ИИ недоступен. Запустите LM Studio и загрузите модель.');
            }
            return;
        }

        setPendingRefinements((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });

        setRefiningFields(prev => new Set(prev).add(field));
        setStreamPreview(prev => ({ ...prev, [field]: '' }));

        try {
            const result = await window.electronAPI.llm.refineField(field, text);

            if (result.status === 'completed') {
                const refinedText = result.text?.trim() || text;
                setPendingRefinements((prev) => ({
                    ...prev,
                    [field]: {
                        original: text,
                        refined: refinedText,
                    },
                }));
                setStreamPreview(prev => ({ ...prev, [field]: '' }));
            } else if (result.status === 'error') {
                logger.error('[VisitFormPage] Field refinement error:', { error: String(result.error) });
                setError(`Ошибка рефайна: ${result.error || 'неизвестная ошибка'}`);
                setStreamPreview(prev => ({ ...prev, [field]: '' }));
            }
        } catch (err: any) {
            logger.error('[VisitFormPage] Field refinement failed:', { error: String(err) });
            setError('Не удалось выполнить рефайн поля');
            setStreamPreview(prev => ({ ...prev, [field]: '' }));
        } finally {
            setRefiningFields(prev => {
                const next = new Set(prev);
                next.delete(field);
                return next;
            });
        }
    };

    // Setup LLM token listeners for field refinement
    useEffect(() => {
        if (!window.electronAPI?.llm) return;

        const unsubscribeToken = window.electronAPI.llm.onFieldRefineToken((_event, data: any) => {
            setStreamPreview(prev => ({
                ...prev,
                [data.field]: (prev[data.field] || '') + data.token,
            }));
        });

        const unsubscribeError = window.electronAPI.llm.onFieldRefineError((_event, data: any) => {
            logger.error('[VisitFormPage] LLM refinement error:', { error: String(data.error) });
            setError(`Ошибка LLM: ${data.error || 'неизвестная ошибка'}`);
            setStreamPreview(prev => ({ ...prev, [data.field]: '' }));
            setRefiningFields(prev => {
                const next = new Set(prev);
                next.delete(data.field);
                return next;
            });
        });

        return () => {
            if (unsubscribeToken) unsubscribeToken();
            if (unsubscribeError) unsubscribeError();
        };
    }, []);

    const handleSave = async (status: 'draft' | 'completed' = 'draft') => {
        setIsSaving(true);
        setError(null);

        // Проверка наличия основного диагноза
        // Диагноз может быть объектом или строкой (JSON), проверяем оба варианта
        let hasPrimaryDiagnosis = false;
        if (formData.primaryDiagnosis) {
            if (typeof formData.primaryDiagnosis === 'object') {
                hasPrimaryDiagnosis = !!(formData.primaryDiagnosis.code || formData.primaryDiagnosis.nameRu);
            } else if (typeof formData.primaryDiagnosis === 'string') {
                // Если это JSON строка, проверяем что она не пустая
                const trimmed = formData.primaryDiagnosis.trim();
                hasPrimaryDiagnosis = trimmed !== '' && trimmed !== 'null' && trimmed !== 'undefined';
                // Попробуем распарсить для проверки валидности
                try {
                    const parsed = JSON.parse(trimmed);
                    hasPrimaryDiagnosis = !!(parsed?.code || parsed?.nameRu);
                } catch {
                    // Если не парсится, возможно это просто текст
                    hasPrimaryDiagnosis = trimmed.length > 0;
                }
            }
        }

        if (!hasPrimaryDiagnosis) {
            const errorMessage = 'Основной диагноз обязателен для сохранения приема';
            setError(errorMessage);
            setValidationErrors([errorMessage]);
            setIsErrorModalOpen(true);
            setIsSaving(false);
            return;
        }

        try {
            const dataToSave = buildVisitPayload(formData, recommendations, status);
            const savedVisit = await visitService.upsertVisit(dataToSave);
            setFormData(prev => ({
                ...prev,
                id: savedVisit.id,
                status: savedVisit.status ?? status,
            }));
            setSuccessMessage(
                status === 'completed'
                    ? (isCompletedVisit ? 'Изменения успешно сохранены!' : 'Прием успешно завершен!')
                    : 'Черновик успешно сохранен!'
            );
            setSuccess(true);
            
            // Очищаем черновик и помечаем вкладку как "чистую" после успешного сохранения
            draftService.removeDraft(draftKey);
            setDirty(false);
            setHasLocalChanges(false);
            logger.info('[VisitFormPage] Visit saved, draft cleared', { draftKey });

            setTimeout(() => handleBack(), 1500);
        } catch (err: any) {
            const errorMessage = err.message || 'Ошибка сохранения';
            setError(errorMessage);
            logger.error('[VisitFormPage] Save failed:', err);

            // Парсим ошибки валидации для отображения в модальном окне
            if (errorMessage.includes('Ошибка валидации') || errorMessage.includes('валидации')) {
                // Извлекаем список ошибок из сообщения
                let errorsList: string[] = [];

                // Убираем префикс "Ошибка валидации: " если есть
                let cleanMessage = errorMessage;
                if (cleanMessage.includes('Ошибка валидации:')) {
                    cleanMessage = cleanMessage.split('Ошибка валидации:')[1]?.trim() || cleanMessage;
                }

                // Разбиваем по запятой, учитывая что некоторые ошибки могут содержать запятые в скобках
                // Простое разбиение по запятым должно работать для большинства случаев
                if (cleanMessage.includes(',')) {
                    errorsList = cleanMessage.split(',').map((e: string) => e.trim()).filter(Boolean);
                } else {
                    errorsList = [cleanMessage];
                }

                if (errorsList.length > 0) {
                    setValidationErrors(errorsList);
                    setIsErrorModalOpen(true);
                }
            }
        } finally {
            setIsSaving(false);
        }
    };

    // AI анализ запускается вручную через кнопку

    const runAnalysis = async () => {
        if (!childId) return;

        // Проверяем, есть ли данные для анализа
        const hasClinicalData =
            formData.complaints?.trim() ||
            formData.diseaseOnset?.trim() ||
            formData.diseaseCourse?.trim() ||
            formData.treatmentBeforeVisit?.trim() ||
            formData.physicalExam?.trim();

        if (!hasClinicalData) {
            setError('Введите жалобы, анамнез заболевания или данные осмотра для анализа');
            return;
        }

        setError(null);

        try {
            const results = await visitAnalysis.runAnalysis(async () => {
                const startTime = Date.now();

                // Сначала сохраняем визит как черновик (если еще не сохранен)
                let visitId = formData.id;
                if (!visitId) {
                    const savedVisit = await visitService.upsertVisit({
                        ...formData,
                        status: 'draft'
                    } as Visit);
                    visitId = savedVisit.id!;
                    setFormData(prev => ({ ...prev, id: visitId }));
                } else {
                    // Обновляем данные перед анализом
                    await visitService.upsertVisit({
                        ...formData,
                    } as Visit);
                }

                // Регистрируем промис в реестре — переживёт размонтирование компонента
                const analysisPromise = visitService.analyzeVisit(visitId!);
                analysisRegistry.set(visitId!, analysisPromise);

                // Выполняем AI-анализ (использует расширенные поля из service)
                const results = await analysisPromise;
                setSuggestions(results);
                setHasLocalChanges(true);

                // Немедленно сохраняем результаты в черновик — переживут перезагрузку страницы
                draftService.saveDraft(
                    draftKey,
                    draftService.buildVisitDraftPayload(formData, recommendations, results)
                );

                const duration = Date.now() - startTime;
                logger.info(`[VisitFormPage] Analysis completed in ${duration}ms`, { visitId, duration });

                if (duration > 5000) {
                    logger.warn(`[VisitFormPage] Analysis took longer than expected: ${duration}ms`, { duration });
                }

                return results;
            });

            setSuggestions(results);
            setHasLocalChanges(true);
        } catch (err: any) {
            logger.error('[VisitFormPage] Analysis failed', { error: err, visitId: formData.id });
            setError(err.message || 'Ошибка анализа. Попробуйте еще раз.');
        }
    };


    const selectDiagnosis = async (disease: Disease) => {
        const diagnosisEntry: DiagnosisEntry = {
            code: disease.icd10Code,
            nameRu: disease.nameRu,
            diseaseId: disease.id,
        };

        updateFormData(prev => ({
            ...prev,
            primaryDiagnosis: diagnosisEntry,
            primaryDiagnosisId: disease.id,
        }));

        // Загружаем препараты для выбранного диагноза (с учетом аллергоанамнеза)
        if (disease.id && childId) {
            setIsLoadingMedications(true);
            try {
                const recommendations = await visitService.getMedicationsForDiagnosis(disease.id, Number(childId));
                // Фильтруем препараты строго по canUse (источник истины — backend)
                const filtered = recommendations.filter(rec => rec.canUse);
                setMedicationRecommendations(filtered);
            } catch (err: any) {
                logger.error('[VisitFormPage] Failed to load medications', { error: err, diseaseId: disease.id, childId });
                setError('Не удалось загрузить препараты для диагноза');
            } finally {
                setIsLoadingMedications(false);
            }
        }
    };

    /**
     * Загрузка препаратов для всех выбранных диагнозов
     * (основной + осложнения + сопутствующие)
     */
    const loadMedicationsForAllDiagnoses = async (
        primary: DiagnosisEntry | null,
        complicationsArr: DiagnosisEntry[],
        comorbiditiesArr: DiagnosisEntry[]
    ) => {
        if (!childId) {
            setMedicationRecommendations([]);
            return;
        }

        // Собираем все диагнозы
        const allDiagnoses: DiagnosisEntry[] = [
            ...(primary ? [primary] : []),
            ...complicationsArr,
            ...comorbiditiesArr
        ];

        if (allDiagnoses.length === 0) {
            setMedicationRecommendations([]);
            return;
        }

        setIsLoadingMedications(true);
        try {
            // Загружаем препараты для каждого диагноза
            const allRecommendations = await Promise.all(
                allDiagnoses.map(async (diagnosis) => {
                    try {
                        if (diagnosis.diseaseId) {
                            // Выбрано из базы знаний
                            return await visitService.getMedicationsForDiagnosis(
                                diagnosis.diseaseId,
                                Number(childId)
                            );
                        } else if (diagnosis.code) {
                            // Выбрано из МКБ напрямую
                            return await visitService.getMedicationsByIcdCode(
                                diagnosis.code,
                                Number(childId)
                            );
                        }
                        return [];
                    } catch (err) {
                        logger.error('[VisitFormPage] Failed to load medications for diagnosis', {
                            error: err,
                            diagnosis
                        });
                        return [];
                    }
                })
            );

            // Объединяем и дедуплицируем по medicationId, сохраняя наименьший priority
            const medicationMap = new Map<number, MedicationRecommendation>();
            
            allRecommendations.flat().forEach(rec => {
                const existing = medicationMap.get(rec.medication.id!);
                if (!existing || (rec.priority && existing.priority && rec.priority < existing.priority)) {
                    medicationMap.set(rec.medication.id!, rec);
                }
            });

            // Преобразуем в массив и фильтруем с учетом аллергий
            const uniqueRecommendations = Array.from(medicationMap.values());
            
            const filtered = uniqueRecommendations.filter(rec => rec.canUse);

            // Сортируем по приоритету
            filtered.sort((a, b) => (a.priority || 999) - (b.priority || 999));

            setMedicationRecommendations(filtered);
        } catch (err: any) {
            logger.error('[VisitFormPage] Failed to load medications for all diagnoses', {
                error: err,
                childId
            });
            setError('Не удалось загрузить препараты для диагнозов');
            setMedicationRecommendations([]);
        } finally {
            setIsLoadingMedications(false);
        }
    };

    /**
     * Загрузка диагностических исследований для всех выбранных диагнозов
     * (основной + осложнения + сопутствующие) по кодам МКБ
     */
    const loadDiagnosticsForAllDiagnoses = async (
        primary: DiagnosisEntry | null,
        complicationsArr: DiagnosisEntry[],
        comorbiditiesArr: DiagnosisEntry[]
    ) => {
        // Собираем все МКБ коды из диагнозов
        const allDiagnoses: DiagnosisEntry[] = [
            ...(primary ? [primary] : []),
            ...complicationsArr,
            ...comorbiditiesArr
        ];
        
        // Извлекаем уникальные коды МКБ
        const icdCodes = [...new Set(
            allDiagnoses.map(d => d.code).filter(Boolean)
        )] as string[];
        
        if (icdCodes.length === 0) {
            setDiagnosticRecommendations([]);
            return;
        }
        
        setIsLoadingDiagnostics(true);
        try {
            // Загружаем диагностику для каждого кода МКБ
            const allRecommendations = await Promise.all(
                icdCodes.map(code => visitService.getDiagnosticsByIcdCode(code))
            );
            
            // Объединяем и дедуплицируем по названию исследования
            const diagnosticsMap = new Map<string, import('../../types').DiagnosticRecommendation>();
            allRecommendations.flat().forEach(rec => {
                const testKey = rec.item.test.toLowerCase().trim();
                if (!diagnosticsMap.has(testKey)) {
                    diagnosticsMap.set(testKey, rec);
                }
            });
            
            setDiagnosticRecommendations(Array.from(diagnosticsMap.values()));
            logger.info('[VisitFormPage] Loaded diagnostics for diagnoses', { 
                icdCodes, 
                count: diagnosticsMap.size 
            });
        } catch (err) {
            logger.error('[VisitFormPage] Failed to load diagnostics', { err });
            setDiagnosticRecommendations([]);
        } finally {
            setIsLoadingDiagnostics(false);
        }
    };

    /**
     * Загрузка клинических рекомендаций из базы знаний для всех выбранных диагнозов
     */
    const loadDiseaseRecommendationsForAllDiagnoses = async (
        primary: DiagnosisEntry | null,
        complicationsArr: DiagnosisEntry[],
        comorbiditiesArr: DiagnosisEntry[]
    ) => {
        const allDiagnoses: DiagnosisEntry[] = [
            ...(primary ? [primary] : []),
            ...complicationsArr,
            ...comorbiditiesArr
        ];

        const icdCodes = [...new Set(
            allDiagnoses.map(d => d.code).filter(Boolean)
        )] as string[];

        if (icdCodes.length === 0) {
            setDiseaseRecommendations([]);
            return;
        }

        setIsLoadingDiseaseRecs(true);
        try {
            const allResults = await Promise.all(
                icdCodes.map(code => visitService.getDiseaseRecommendationsByIcdCode(code))
            );

            // Дедупликация по тексту рекомендации
            const recsMap = new Map<string, import('../../types').DiseaseRecommendationSuggestion>();
            allResults.flat().forEach(rec => {
                const key = rec.item.text.toLowerCase().trim();
                if (!recsMap.has(key)) {
                    recsMap.set(key, rec);
                }
            });

            setDiseaseRecommendations(Array.from(recsMap.values()));
            logger.info('[VisitFormPage] Loaded disease recommendations', {
                icdCodes,
                count: recsMap.size
            });
        } catch (err) {
            logger.error('[VisitFormPage] Failed to load disease recommendations', { err });
            setDiseaseRecommendations([]);
        } finally {
            setIsLoadingDiseaseRecs(false);
        }
    };

    // Загрузка препаратов и диагностики для существующего приема при открытии
    const medicationsLoadedForEdit = useRef(false);
    const diagnosticsLoadedForEdit = useRef(false);
    const diseaseRecsLoadedForEdit = useRef(false);
    useEffect(() => {
        // Загружаем препараты и диагностику только один раз при редактировании существующего приема
        if (isEdit && initialLoadDone.current) {
            const primary = formData.primaryDiagnosis as DiagnosisEntry | null;
            const complicationsArr = Array.isArray(formData.complications) ? formData.complications as DiagnosisEntry[] : [];
            const comorbiditiesArr = Array.isArray(formData.comorbidities) ? formData.comorbidities as DiagnosisEntry[] : [];
            
            if (primary || complicationsArr.length > 0 || comorbiditiesArr.length > 0) {
                // Загружаем препараты
                if (!medicationsLoadedForEdit.current) {
                    medicationsLoadedForEdit.current = true;
                    loadMedicationsForAllDiagnoses(primary, complicationsArr, comorbiditiesArr);
                    logger.info('[VisitFormPage] Loading medications for existing visit', { 
                        hasPrimary: !!primary,
                        complicationsCount: complicationsArr.length,
                        comorbiditiesCount: comorbiditiesArr.length
                    });
                }
                
                // Загружаем диагностику
                if (!diagnosticsLoadedForEdit.current) {
                    diagnosticsLoadedForEdit.current = true;
                    loadDiagnosticsForAllDiagnoses(primary, complicationsArr, comorbiditiesArr);
                    logger.info('[VisitFormPage] Loading diagnostics for existing visit', { 
                        hasPrimary: !!primary,
                        complicationsCount: complicationsArr.length,
                        comorbiditiesCount: comorbiditiesArr.length
                    });
                }

                // Загружаем рекомендации из базы знаний
                if (!diseaseRecsLoadedForEdit.current) {
                    diseaseRecsLoadedForEdit.current = true;
                    loadDiseaseRecommendationsForAllDiagnoses(primary, complicationsArr, comorbiditiesArr);
                    logger.info('[VisitFormPage] Loading disease recommendations for existing visit', {
                        hasPrimary: !!primary,
                        complicationsCount: complicationsArr.length,
                        comorbiditiesCount: comorbiditiesArr.length
                    });
                }
            }
        }
    }, [isEdit, formData.primaryDiagnosis, formData.complications, formData.comorbidities]);

    const handlePrimaryDiagnosisSelect = async (diagnosis: DiagnosisEntry | null) => {
        updateFormData(prev => ({
            ...prev,
            primaryDiagnosis: diagnosis,
            primaryDiagnosisId: diagnosis?.diseaseId || null,
        }));

        // Перезагружаем препараты и диагностику для всех диагнозов
        await Promise.all([
            loadMedicationsForAllDiagnoses(diagnosis, complications, comorbidities),
            loadDiagnosticsForAllDiagnoses(diagnosis, complications, comorbidities),
            loadDiseaseRecommendationsForAllDiagnoses(diagnosis, complications, comorbidities)
        ]);
    };

    const handleComplicationsChange = async (newComplications: DiagnosisEntry[]) => {
        updateFormData(prev => ({
            ...prev,
            complications: newComplications.length > 0 ? newComplications : null,
        }));

        // Перезагружаем препараты и диагностику для всех диагнозов
        await Promise.all([
            loadMedicationsForAllDiagnoses(primaryDiagnosis, newComplications, comorbidities),
            loadDiagnosticsForAllDiagnoses(primaryDiagnosis, newComplications, comorbidities),
            loadDiseaseRecommendationsForAllDiagnoses(primaryDiagnosis, newComplications, comorbidities)
        ]);
    };

    const handleComorbiditiesChange = async (newComorbidities: DiagnosisEntry[]) => {
        updateFormData(prev => ({
            ...prev,
            comorbidities: newComorbidities.length > 0 ? newComorbidities : null,
        }));

        // Перезагружаем препараты и диагностику для всех диагнозов
        await Promise.all([
            loadMedicationsForAllDiagnoses(primaryDiagnosis, complications, newComorbidities),
            loadDiagnosticsForAllDiagnoses(primaryDiagnosis, complications, newComorbidities),
            loadDiseaseRecommendationsForAllDiagnoses(primaryDiagnosis, complications, newComorbidities)
        ]);
    };

    const toggleMedicationSelection = async (medicationId: number) => {
        const currentPrescriptions = formData.prescriptions || [];
        const isSelected = currentPrescriptions.some((p: any) => p.medicationId === medicationId);

        if (isSelected) {
            // Удаление из списка
            updateFormData(prev => ({
                ...prev,
                prescriptions: currentPrescriptions.filter((p: any) => p.medicationId !== medicationId)
            }));
        } else {
            // Проверка дубликатов перед добавлением
            const duplicateCheck = visitService.checkDuplicateMedication(currentPrescriptions, medicationId);
            if (duplicateCheck.isDuplicate) {
                setValidationErrors([duplicateCheck.errorMessage || 'Препарат уже добавлен']);
                setIsErrorModalOpen(true);
                return;
            }

            const recommendation = medicationRecommendations.find(r => r.medication.id === medicationId);
            if (!child) {
                setError('Не удалось рассчитать дозировку: данные пациента не загружены');
                setValidationErrors(['Не удалось рассчитать дозировку: данные пациента не загружены']);
                setIsErrorModalOpen(true);
                return;
            }

            // Валидация данных пациента для расчета дозировки
            const patientValidation = visitService.validatePatientForDosing(
                child,
                formData.currentWeight,
                formData.visitDate,
                formData.currentHeight
            );

            if (!patientValidation.isValid || !patientValidation.params) {
                setValidationErrors(patientValidation.errors);
                setIsErrorModalOpen(true);
                return;
            }

            const { weight: currentWeight, ageMonths: patientAgeMonths, height: currentHeight } = patientValidation.params;

            // Загружаем препарат для модального окна
            let medication: Medication | null = recommendation?.medication || null;
            if (!medication) {
                try {
                    medication = await medicationService.getMedication(medicationId);
                } catch (err) {
                    logger.warn('[VisitFormPage] Failed to load medication details', { error: err, medicationId });
                    setError('Не удалось загрузить данные препарата');
                    setIsErrorModalOpen(true);
                    return;
                }
            }

            // Рассчитываем дозировку
            let doseInfo: DoseCalculationResult | null = null;
            try {
                doseInfo = await medicationService.calculateDose(
                    medicationId,
                    currentWeight,
                    patientAgeMonths,
                    currentHeight ?? undefined
                );
            } catch (err) {
                logger.error('[VisitFormPage] Dose calc failed on selection', {
                    error: err,
                    medicationId,
                    weight: currentWeight,
                    ageMonths: patientAgeMonths,
                    height: currentHeight
                });
            }

            const initialDoseData: Partial<DoseData> = {
                dosing: doseInfo?.instruction ?? recommendation?.recommendedDose?.instruction ?? '',
                duration: recommendation?.duration ?? '5-7 дней',
                singleDoseMg: doseInfo?.singleDoseMg ?? recommendation?.recommendedDose?.singleDoseMg ?? null,
                timesPerDay: doseInfo?.timesPerDay ?? recommendation?.recommendedDose?.timesPerDay ?? null,
                routeOfAdmin: doseInfo?.routeOfAdmin ?? medication?.routeOfAdmin ?? null,
                formId: doseInfo?.form?.id ?? null,
                packagingDescription: doseInfo?.form?.description ?? medication?.packageDescription ?? null,
                dilution: null
            };

            setSelectedMedicationForDose(medication);
            setCalculatedDoseData(initialDoseData);
            setPendingMedicationId(medicationId);
            setLastDoseResult(doseInfo ?? null);
            setDoseCalcParams({ weight: currentWeight, ageMonths: patientAgeMonths, height: currentHeight ?? null });
            setIsDoseModalOpen(true);
        }
    };

    const addPrescription = async (med: Medication) => {
        if (!child) return;

        // Проверка дубликатов
        const currentPrescriptions = formData.prescriptions || [];
        const duplicateCheck = visitService.checkDuplicateMedication(currentPrescriptions, med.id!);
        if (duplicateCheck.isDuplicate) {
            setValidationErrors([duplicateCheck.errorMessage || 'Препарат уже добавлен']);
            setIsErrorModalOpen(true);
            return;
        }

        // Валидация данных пациента для расчета дозировки
        const patientValidation = visitService.validatePatientForDosing(
            child,
            formData.currentWeight,
            formData.visitDate,
            formData.currentHeight
        );

        if (!patientValidation.isValid || !patientValidation.params) {
            setValidationErrors(patientValidation.errors);
            setIsErrorModalOpen(true);
            return;
        }

        const { weight: currentWeight, ageMonths: patientAgeMonths, height: currentHeight } = patientValidation.params;

        try {
            const doseInfo = await medicationService.calculateDose(
                med.id!,
                currentWeight,
                patientAgeMonths,
                currentHeight ?? undefined
            );

            const initialDoseData: Partial<DoseData> = {
                dosing: doseInfo.canUse ? doseInfo.instruction : '',
                duration: '5-7 дней',
                singleDoseMg: doseInfo.singleDoseMg ?? null,
                timesPerDay: doseInfo.timesPerDay ?? null,
                routeOfAdmin: doseInfo.routeOfAdmin ?? med?.routeOfAdmin ?? null,
                formId: doseInfo.form?.id ?? null,
                packagingDescription: doseInfo.form?.description ?? med?.packageDescription ?? null,
                dilution: null
            };

            setSelectedMedicationForDose(med);
            setCalculatedDoseData(initialDoseData);
            setPendingMedicationId(med.id!);
            setLastDoseResult(doseInfo);
            setDoseCalcParams({ weight: currentWeight, ageMonths: patientAgeMonths, height: currentHeight ?? null });
            setIsDoseModalOpen(true);
        } catch (err) {
            logger.error('[VisitFormPage] Dose calc failed', { error: err, medicationId: med.id, weight: currentWeight, ageMonths: patientAgeMonths, height: currentHeight });
            setError('Не удалось рассчитать дозировку');
            setValidationErrors(['Не удалось рассчитать дозировку для препарата']);
            setIsErrorModalOpen(true);
        }
    };

    // Обработчик подтверждения дозировки из модального окна
    const handleDoseConfirm = (doseData: DoseData) => {
        if (!selectedMedicationForDose || pendingMedicationId === null) return;

        const currentPrescriptions = formData.prescriptions || [];

        // Проверяем, редактируем ли существующее назначение или добавляем новое
        const existingIndex = currentPrescriptions.findIndex((p: any) => p.medicationId === pendingMedicationId);

        const updatedPrescription = {
            medicationId: pendingMedicationId,
            name: selectedMedicationForDose.nameRu,
            dosing: doseData.dosing,
            duration: doseData.duration,
            singleDoseMg: doseData.singleDoseMg,
            timesPerDay: doseData.timesPerDay,
            formId: doseData.formId || null,
            formType: doseData.formType || null,
            routeOfAdmin: doseData.routeOfAdmin || selectedMedicationForDose.routeOfAdmin || null,
            packagingDescription: doseData.packagingDescription || null,
            daySchedule: doseData.daySchedule?.length ? doseData.daySchedule : null,
            dilution: doseData.dilution || null
        };

        if (existingIndex >= 0) {
            // Обновляем существующее назначение
            const updated = [...currentPrescriptions];
            updated[existingIndex] = updatedPrescription;
            updateFormData(prev => ({ ...prev, prescriptions: updated }));
        } else {
            // Добавляем новое назначение
            updateFormData(prev => ({ ...prev, prescriptions: [...currentPrescriptions, updatedPrescription] }));
        }

        // Закрываем модальное окно и очищаем состояние
        setIsDoseModalOpen(false);
        setSelectedMedicationForDose(null);
        setCalculatedDoseData(null);
        setPendingMedicationId(null);
    };

    // Обработчик отмены модального окна дозировки
    const handleDoseCancel = () => {
        setIsDoseModalOpen(false);
        setSelectedMedicationForDose(null);
        setCalculatedDoseData(null);
        setPendingMedicationId(null);
        setLastDoseResult(null);
        setDoseCalcParams(null);
    };

    // Смена правила дозирования в модалке (пересчёт и обновление полей)
    const handleDoseRuleChange = useCallback(async (ruleIndex: number) => {
        if (!selectedMedicationForDose?.id || !doseCalcParams) return;
        try {
            const result = await medicationService.calculateDose(
                selectedMedicationForDose.id,
                doseCalcParams.weight,
                doseCalcParams.ageMonths,
                doseCalcParams.height ?? undefined,
                ruleIndex
            );
            setLastDoseResult(result);
            setCalculatedDoseData({
                dosing: result.instruction,
                duration: calculatedDoseData?.duration ?? '5-7 дней',
                singleDoseMg: result.singleDoseMg ?? null,
                timesPerDay: result.timesPerDay ?? null,
                formId: result.form?.id ?? calculatedDoseData?.formId ?? null,
                routeOfAdmin: result.routeOfAdmin ?? selectedMedicationForDose.routeOfAdmin ?? null,
                packagingDescription: result.form?.description ?? calculatedDoseData?.packagingDescription ?? selectedMedicationForDose.packageDescription ?? null,
                dilution: null
            });
        } catch (err) {
            logger.error('[VisitFormPage] Dose recalc on rule change failed', {
                error: err,
                medicationId: selectedMedicationForDose.id,
                ruleIndex
            });
        }
    }, [selectedMedicationForDose?.id, doseCalcParams, calculatedDoseData?.duration]);

    // ==================== ОБРАБОТЧИКИ ДИАГНОСТИЧЕСКИХ ИССЛЕДОВАНИЙ ====================

    // Добавить исследование в выбранную диагностику
    const handleAddDiagnosticTest = (item: import('../../types').DiagnosticPlanItem) => {
        const fieldName = item.type === 'lab' ? 'laboratoryTests' : 'instrumentalTests';
        const currentTests = (formData as any)[fieldName] || [];
        
        // Проверка на дубликат по названию
        if (currentTests.some((t: import('../../types').DiagnosticPlanItem) => 
            t.test.toLowerCase().trim() === item.test.toLowerCase().trim()
        )) {
            return; // Уже добавлено
        }
        
        updateFormData(prev => ({
            ...prev,
            [fieldName]: [...currentTests, item]
        }));
    };

    // Удалить исследование из выбранной диагностики по индексу
    const handleRemoveDiagnosticTest = (type: 'lab' | 'instrumental', index: number) => {
        const fieldName = type === 'lab' ? 'laboratoryTests' : 'instrumentalTests';
        const currentTests = (formData as any)[fieldName] || [];
        
        updateFormData(prev => ({
            ...prev,
            [fieldName]: currentTests.filter((_: any, i: number) => i !== index)
        }));
    };

    // Удалить исследование из выбранной диагностики по названию (для справочника)
    const handleRemoveDiagnosticTestByName = (testName: string, type: 'lab' | 'instrumental') => {
        const fieldName = type === 'lab' ? 'laboratoryTests' : 'instrumentalTests';
        const currentTests = (formData as any)[fieldName] || [];
        
        updateFormData(prev => ({
            ...prev,
            [fieldName]: currentTests.filter((t: any) => 
                t.test.toLowerCase().trim() !== testName.toLowerCase().trim()
            )
        }));
    };

    // Сохранить текущий набор исследований как шаблон
    const handleSaveDiagnosticTemplate = () => {
        setIsCreateDiagnosticTemplateOpen(true);
    };

    // Загрузить шаблон диагностики
    const handleLoadDiagnosticTemplate = () => {
        setIsDiagnosticTemplateSelectorOpen(true);
    };

    // Применить шаблон диагностики
    const handleApplyDiagnosticTemplate = (items: import('../../types').DiagnosticPlanItem[]) => {
        // Группируем по типу и добавляем к текущим
        const labTests = items.filter(i => i.type === 'lab');
        const instrumentalTests = items.filter(i => i.type === 'instrumental');
        
        const currentLabTests = (formData as any).laboratoryTests || [];
        const currentInstrumentalTests = (formData as any).instrumentalTests || [];
        
        updateFormData(prev => ({
            ...prev,
            laboratoryTests: [
                ...currentLabTests,
                ...labTests.filter(lt => 
                    !currentLabTests.some((t: import('../../types').DiagnosticPlanItem) => 
                        t.test.toLowerCase().trim() === lt.test.toLowerCase().trim()
                    )
                )
            ],
            instrumentalTests: [
                ...currentInstrumentalTests,
                ...instrumentalTests.filter(it => 
                    !currentInstrumentalTests.some((t: import('../../types').DiagnosticPlanItem) => 
                        t.test.toLowerCase().trim() === it.test.toLowerCase().trim()
                    )
                )
            ]
        }));
        setIsDiagnosticTemplateSelectorOpen(false);
    };

    // Редактировать шаблон диагностики
    const handleEditDiagnosticTemplate = (template: import('../../types').DiagnosticTemplate) => {
        setDiagnosticTemplateToEdit(template);
        setIsDiagnosticTemplateSelectorOpen(false);
    };

    // Удалить шаблон диагностики (из селектора)
    const handleDeleteDiagnosticTemplate = async (templateId: number) => {
        // Удаление обрабатывается в DiagnosticTemplateSelector
        logger.info('[VisitFormPage] Diagnostic template deleted', { templateId });
    };

    // Шаблон диагностики сохранен
    const handleDiagnosticTemplateSaved = () => {
        setIsCreateDiagnosticTemplateOpen(false);
        setDiagnosticTemplateToEdit(null);
    };

    // Получить текущие диагностические исследования для шаблона
    const getCurrentDiagnosticItems = (): import('../../types').DiagnosticPlanItem[] => {
        const labTests = ((formData as any).laboratoryTests || []) as import('../../types').DiagnosticPlanItem[];
        const instrumentalTests = ((formData as any).instrumentalTests || []) as import('../../types').DiagnosticPlanItem[];
        return [...labTests, ...instrumentalTests];
    };

    // Вычисляем возраст ребенка на дату приема (для показателей жизнедеятельности и дозировок)
    const visitDateForCalculation = formData.visitDate ? new Date(formData.visitDate) : new Date();
    const ageMonths = child ? calculateAgeInMonths(
        child.birthDate,
        visitDateForCalculation
    ) : undefined;

    const handleFillVitalsNorm = useCallback(() => {
        const defaults = getRandomVitalsInNormForAge(ageMonths);
        updateFormData(prev => ({
            ...prev,
            bloodPressureSystolic: defaults.bloodPressureSystolic,
            bloodPressureDiastolic: defaults.bloodPressureDiastolic,
            pulse: defaults.pulse,
            temperature: defaults.temperature,
            respiratoryRate: defaults.respiratoryRate,
            oxygenSaturation: defaults.oxygenSaturation,
        }));
    }, [ageMonths, updateFormData]);

    // Форматируем дату рождения для отображения
    const formatBirthDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Форматируем пол для отображения
    const formatGender = (gender: 'male' | 'female'): string => {
        return gender === 'male' ? 'Мужской' : 'Женский';
    };

    // Получаем отформатированный возраст
    const formattedAge = child ? getFormattedAge(child.birthDate, new Date(), 'full') : null;

    // Парсим диагнозы для отображения
    const primaryDiagnosis = typeof formData.primaryDiagnosis === 'string'
        ? (formData.primaryDiagnosis ? JSON.parse(formData.primaryDiagnosis) : null)
        : formData.primaryDiagnosis;
    const complications = typeof formData.complications === 'string'
        ? (formData.complications ? JSON.parse(formData.complications) : [])
        : (Array.isArray(formData.complications) ? formData.complications : []);
    const comorbidities = typeof formData.comorbidities === 'string'
        ? (formData.comorbidities ? JSON.parse(formData.comorbidities) : [])
        : (Array.isArray(formData.comorbidities) ? formData.comorbidities : []);

    const medicationAllergyText = useMemo(
        () => parseMedicationAllergyFromAnamnesis(formData.allergyStatusData as AllergyStatusData | string | null | undefined),
        [formData.allergyStatusData]
    );

    // Мемоизированные ICD коды для DiagnosticBrowser (предотвращает лишние перерендеры)
    const diagnosticBrowserIcdCodes = useMemo(() => {
        const codes: string[] = [];
        if (primaryDiagnosis?.code) codes.push(primaryDiagnosis.code);
        complications.forEach((c: any) => c?.code && codes.push(c.code));
        comorbidities.forEach((c: any) => c?.code && codes.push(c.code));
        return codes;
    }, [primaryDiagnosis, complications, comorbidities]);

    // Мемоизированный список выбранных диагностических исследований
    const currentDiagnosticItems = useMemo(() => {
        const labTests = ((formData as any).laboratoryTests || []) as import('../../types').DiagnosticPlanItem[];
        const instrumentalTests = ((formData as any).instrumentalTests || []) as import('../../types').DiagnosticPlanItem[];
        return [...labTests, ...instrumentalTests];
    }, [(formData as any).laboratoryTests, (formData as any).instrumentalTests]);

    // Navigation sections for floating TOC
    const navigationSections: NavigationSection[] = useMemo(() => [
        {
            id: 'section-visit-type',
            label: 'Тип приема',
            icon: Stethoscope,
            isComplete: !!formData.visitType,
            isVisible: true,
        },
        {
            id: 'section-datetime',
            label: 'Дата и время',
            icon: Calendar,
            isComplete: !!formData.visitDate,
            isVisible: true,
        },
        {
            id: 'section-anthropometry',
            label: 'Антропометрия',
            icon: Scale,
            isComplete: !!(formData.currentWeight && formData.currentHeight),
            isVisible: true,
        },
        {
            id: 'section-anamnesis-life',
            label: 'Анамнез жизни',
            icon: FileText,
            isComplete: !!(formData.heredityData || formData.birthData || formData.feedingData),
            isVisible: formData.visitType === 'primary' || formData.visitType === 'consultation',
        },
        {
            id: 'section-anamnesis-disease',
            label: 'Анамнез заболевания',
            icon: ClipboardList,
            isComplete: !!(formData.complaints && formData.complaints.length > 10),
            isVisible: true,
        },
        {
            id: 'section-vitals',
            label: 'Витальные показатели',
            icon: Activity,
            isComplete: !!(formData.pulse || formData.bloodPressureSystolic),
            isVisible: true,
        },
        {
            id: 'section-physical-exam',
            label: 'Физикальный осмотр',
            icon: Stethoscope,
            isComplete: !!(formData.physicalExam && formData.physicalExam.length > 10),
            isVisible: true,
        },
        {
            id: 'section-diagnosis',
            label: 'Диагнозы',
            icon: AlertCircle,
            isComplete: !!primaryDiagnosis,
            isVisible: true,
        },
        {
            id: 'section-medications',
            label: 'Препараты',
            icon: Pill,
            isComplete: !!(formData.prescriptions && formData.prescriptions.length > 0),
            isVisible: true,
        },
        {
            id: 'section-diagnostics',
            label: 'Диагностика',
            icon: Microscope,
            isComplete: currentDiagnosticItems.length > 0,
            isVisible: true,
        },
        {
            id: 'section-recommendations',
            label: 'Рекомендации',
            icon: FileSignature,
            isComplete: recommendations.length > 0,
            isVisible: true,
        },
    ], [formData, primaryDiagnosis, currentDiagnosticItems, recommendations]);

    // Active section tracking for navigation
    const sectionIds = useMemo(() => 
        navigationSections.filter(s => s.isVisible).map(s => s.id),
        [navigationSections]
    );
    const { activeSection, scrollToSection } = useActiveSection(sectionIds);
    const isCompletedVisit = formData.status === 'completed';

    return (
        <div className="p-6 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-[1600px] mx-auto space-y-4">
                {/* Main Content */}
                <div className="space-y-4">
            {/* Premium Header with Enhanced Layout */}
            <div
                data-visit-form-header
                className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-900/5"
            >
                {/* Top Row: Navigation & Actions */}
                <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            onClick={handleBack} 
                            className="rounded-xl h-10 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 mr-1" />
                            Назад
                        </Button>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                        <Badge 
                            variant={formData.status === 'completed' ? 'success' : 'default'} 
                            className="px-3 py-1 text-xs font-bold uppercase tracking-wider"
                        >
                            {formData.status === 'completed' ? '✓ Завершен' : 'Черновик'}
                        </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button 
                            variant="ghost" 
                            onClick={handlePrint} 
                            className="rounded-xl h-10 px-4 hover:bg-slate-100 dark:hover:bg-slate-800" 
                            title="Печать формы приема"
                        >
                            <Printer className="w-4 h-4 mr-2" />
                            Печать
                        </Button>
                        {isCompletedVisit ? (
                            <Button 
                                variant="primary" 
                                onClick={() => handleSave('completed')} 
                                isLoading={isSaving} 
                                className="rounded-xl h-10 px-6 !text-white font-bold shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all"
                            >
                                <Save className="w-4 h-4 mr-2 !text-white" />
                                Сохранить изменения
                            </Button>
                        ) : (
                            <>
                                <Button 
                                    variant="secondary" 
                                    onClick={() => handleSave('draft')} 
                                    isLoading={isSaving} 
                                    className="rounded-xl h-10 px-5 font-semibold"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Сохранить черновик
                                </Button>
                                <Button 
                                    variant="primary" 
                                    onClick={() => handleSave('completed')} 
                                    isLoading={isSaving} 
                                    className="rounded-xl h-10 px-6 !text-white font-bold shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all"
                                >
                                    <CheckCircle2 className="w-5 h-5 mr-2 !text-white" />
                                    Завершить прием
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Bottom Row: Patient Info & Visit Details */}
                <div className="px-5 py-4 flex items-center justify-between min-w-0">
                    {/* Left: Title & Patient */}
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                <Stethoscope className="w-6 h-6 !text-white" strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                    {isEdit ? 'Протокол приема (форма 025/у)' : 'Новый клинический прием'}
                                </h1>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                        Пациент:
                                    </span>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {child?.surname} {child?.name} {child?.patronymic}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Patient Details */}
                    {child && (
                        <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                        {formatBirthDate(child.birthDate)}
                                    </span>
                                </div>
                                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {formattedAge || '—'}
                                    </span>
                                </div>
                                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
                                <Badge 
                                    variant="default"
                                    className={`text-xs font-bold ${
                                        child.gender === 'male' 
                                            ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900' 
                                            : 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900'
                                    }`}
                                >
                                    {formatGender(child.gender)}
                                </Badge>
                            </div>

                            {formData.visitDate && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-950/20 rounded-xl border border-primary-200 dark:border-primary-900/40">
                                    <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                    <span className="text-xs font-semibold text-primary-700 dark:text-primary-400">
                                        {new Date(formData.visitDate).toLocaleDateString('ru-RU')}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Top navigation overview */}
            <div>
                <VisitFormNavigation
                    sections={navigationSections}
                    activeSection={activeSection}
                    onNavigate={scrollToSection}
                    layout="horizontal"
                />
            </div>

            {/* Main content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Main Form Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Тип приема */}
                    <div id="section-visit-type">
                    <VisitTypeSelector
                        value={formData.visitType as VisitType}
                        onChange={(type) => handleFieldChange('visitType', type)}
                        autoDetected={autoDetectedVisitType}
                    />
                    </div>

                    {/* Шаблоны приемов */}
                    {formData.visitType && (
                        <VisitTemplateSelector
                            visitType={formData.visitType}
                            onSelect={(templateData) => {
                                updateFormData(prev => ({ ...prev, ...templateData }));
                            }}
                            onTemplateApplied={async (result) => {
                                // Если шаблон содержит ссылку на шаблон назначений, применяем его
                                if (result.medicationTemplateId && child && formData.currentWeight) {
                                    try {
                                        const items = await medicationTemplateService.prepareApplication({
                                            templateId: result.medicationTemplateId,
                                            childWeight: formData.currentWeight,
                                            childAgeMonths: ageMonths || 0,
                                            childHeight: formData.currentHeight || null,
                                        });
                                        setPendingTemplateItems(items);
                                        setIsBatchEditorOpen(true);
                                    } catch (err) {
                                        logger.error('[VisitFormPage] Failed to prepare medication template from visit template', { error: err });
                                    }
                                }
                            }}
                            currentData={formData}
                            userId={currentUser?.id}
                        />
                    )}

                    {/* Дата и время приема */}
                    <Card id="section-datetime" className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="visit-date" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 cursor-pointer">
                                    <Calendar className="w-4 h-4" />
                                    Дата приема
                                </label>
                                <DatePicker
                                    id="visit-date"
                                    value={formData.visitDate || ''}
                                    onChange={(value) => handleFieldChange('visitDate', value)}
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="visit-time" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 cursor-pointer">
                                    <Clock className="w-4 h-4" />
                                    Время приема
                                </label>
                                <TimePicker
                                    id="visit-time"
                                    value={formData.visitTime || ''}
                                    onChange={(value) => handleFieldChange('visitTime', value)}
                                    placeholder="ЧЧ:ММ"
                                />
                            </div>
                            {formData.ticketNumber && (
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        <FileText className="w-4 h-4" />
                                        Номер талона
                                    </label>
                                    <Input
                                        value={formData.ticketNumber}
                                        disabled
                                        className="bg-slate-50 dark:bg-slate-800"
                                    />
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Антропометрия */}
                    <Card id="section-anthropometry" className="p-6 rounded-[32px] border-slate-200 shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Scale className="w-5 h-5 text-blue-500" />
                                Антропометрия
                            </h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={loadLastAnthropometry}
                                className="rounded-full text-xs"
                            >
                                <TrendingUp className="w-3 h-3 mr-1" />
                                Взять последние значения
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                                    Вес (кг)
                                </label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0.5"
                                    max="200"
                                    value={formData.currentWeight || ''}
                                    onChange={(e) => handleAnthropometryChange('currentWeight', e.target.value)}
                                    placeholder="0.0"
                                    className="rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                                    Рост (см)
                                </label>
                                <Input
                                    type="number"
                                    step="1"
                                    min="30"
                                    max="250"
                                    value={formData.currentHeight || ''}
                                    onChange={(e) => handleAnthropometryChange('currentHeight', e.target.value)}
                                    placeholder="0"
                                    className="rounded-xl"
                                />
                            </div>
                        </div>

                        {(calculatedBMI || calculatedBSA) && (
                            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                {calculatedBMI && (
                                    <div>
                                        <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                                            ИМТ
                                        </div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white">
                                            {formatBMI(calculatedBMI)}
                                        </div>
                                        {child && ageMonths !== undefined && (
                                            <div className="text-xs text-slate-500 mt-1">
                                                {getBMICategoryLabel(getBMICategory(calculatedBMI, ageMonths))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {calculatedBSA && (
                                    <div>
                                        <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                                            ППТ (площадь тела)
                                        </div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white">
                                            {formatBSA(calculatedBSA)}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            Формула Мостеллера
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Анамнез жизни 025/у (только для primary/consultation) */}
                    {(formData.visitType === 'primary' || formData.visitType === 'consultation') && (
                        <div id="section-anamnesis-life">
                            <AnamnesisSection
                                formData={formData}
                                onChange={handleFieldChange}
                                visitType={formData.visitType}
                            />
                        </div>
                    )}

                    {/* Анамнез заболевания (для всех типов приема) */}
                    <div id="section-anamnesis-disease">
                        <DiseaseHistorySection
                            formData={formData}
                            onChange={handleFieldChange}
                            onAnalyze={() => runAnalysis()}
                            onOpenAiRecommendations={() => setIsAiDiagnosisModalOpen(true)}
                            isAnalyzing={visitAnalysis.isAnalyzing}
                            canAnalyze={visitAnalysis.canAnalyze}
                            aiSuggestionsCount={suggestions.length}
                            onRefine={handleRefineField}
                            refiningFields={refiningFields}
                            streamPreview={streamPreview}
                            refineAiAvailable={refineAiAvailable}
                            refineAiProvider={refineAiProvider}
                            analysisAiAvailable={analysisAiAvailable}
                            analysisAiProvider={analysisAiProvider}
                            pendingRefinements={pendingRefinements}
                            onAcceptRefine={handleAcceptRefine}
                            onRejectRefine={handleRejectRefine}
                            analysisProgress={analysisProgress}
                        />
                    </div>

                    {/* Показатели жизнедеятельности */}
                    <div id="section-vitals">
                        <VitalSignsSection
                            formData={formData}
                            onChange={handleFieldChange}
                            ageMonths={ageMonths}
                            onClear={handleClearVitals}
                            onFillNorm={handleFillVitalsNorm}
                        />
                    </div>

                    {/* Объективный осмотр по системам */}
                    <div id="section-physical-exam">
                        <PhysicalExamBySystems
                            formData={formData}
                            onChange={handleFieldChange}
                            userId={currentUser?.id}
                        />
                    </div>

                    {/* Диагнозы */}
                    <div id="section-diagnosis" className="space-y-4">
                        <DiagnosisSelector
                            value={primaryDiagnosis}
                            onChange={handlePrimaryDiagnosisSelect}
                            label="Основной диагноз"
                            required
                            onOpenIcdSearch={() => {
                                setCurrentDiagnosisSelector('primary');
                                setIsIcdSearchOpen(true);
                            }}
                            onOpenDiseaseSearch={() => {
                                setCurrentDiagnosisSelector('primary');
                                setIsDiseaseSearchOpen(true);
                            }}
                        />

                        <MultipleDiagnosisSelector
                            values={complications}
                            onChange={handleComplicationsChange}
                            label="Осложнения"
                            onOpenIcdSearch={() => {
                                setCurrentDiagnosisSelector('complications');
                                setIsIcdSearchOpen(true);
                            }}
                            onOpenDiseaseSearch={() => {
                                setCurrentDiagnosisSelector('complications');
                                setIsDiseaseSearchOpen(true);
                            }}
                        />

                        <MultipleDiagnosisSelector
                            values={comorbidities}
                            onChange={handleComorbiditiesChange}
                            label="Сопутствующие заболевания"
                            onOpenIcdSearch={() => {
                                setCurrentDiagnosisSelector('comorbidities');
                                setIsIcdSearchOpen(true);
                            }}
                            onOpenDiseaseSearch={() => {
                                setCurrentDiagnosisSelector('comorbidities');
                                setIsDiseaseSearchOpen(true);
                            }}
                        />
                    </div>

                    <div id="section-medications" className="space-y-6">
                    <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Pill className="w-5 h-5 text-teal-500" />
                                Выбранные назначения
                            </h2>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsMedicationBrowserOpen(true)}
                                    className="text-xs"
                                    title="Открыть справочник препаратов"
                                >
                                    <BookOpen className="w-3 h-3 mr-1" />
                                    Справочник
                                </Button>
                            {currentUser?.id && (
                                <>
                                    {formData.prescriptions && formData.prescriptions.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsCreateMedicationTemplateOpen(true)}
                                            className="text-xs"
                                            title="Сохранить текущие назначения как шаблон"
                                        >
                                            <Save className="w-3 h-3 mr-1" />
                                            Сохранить шаблон
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsMedicationTemplateSelectorOpen(true)}
                                        className="text-xs"
                                        title="Выбрать сохраненный шаблон"
                                    >
                                        <FileText className="w-3 h-3 mr-1" />
                                        Выбрать шаблон
                                    </Button>
                                </>
                            )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {formData.prescriptions?.map((p: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                                        <Pill className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800 dark:text-white">{p.name}</div>
                                        {p.routeOfAdmin && (
                                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                                                Способ введения: <span className="font-semibold">{getRouteLabel(p.routeOfAdmin)}</span>
                                            </div>
                                        )}
                                        <div className="text-xs text-slate-500">{p.dosing} | {p.duration}</div>
                                        {p.daySchedule?.length > 1 ? (
                                            <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                                                {p.daySchedule.map((d: any, di: number) => (
                                                    <div key={di} className="flex gap-1.5">
                                                        <span className="font-medium text-slate-600 dark:text-slate-400">{d.dayLabel}:</span>
                                                        <span>
                                                            {d.singleDoseMg ? `${d.singleDoseMg} мг` : ''}
                                                            {d.timesPerDay ? ` × ${d.timesPerDay} р/сут` : ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (p.singleDoseMg || p.timesPerDay) && (
                                            <div className="text-xs text-slate-500 mt-1">
                                                Разовая доза: {p.singleDoseMg ?? '—'} мг
                                                {p.timesPerDay ? ` × ${p.timesPerDay} раз в день` : ''}
                                            </div>
                                        )}
                                        {p.dilution && p.dilution.enabled && (
                                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900/40">
                                                <div className="font-semibold mb-1 flex items-center gap-1">
                                                    <Beaker className="w-3 h-3" />
                                                    Разведение:
                                                </div>
                                                {p.dilution.powderVialMg && (
                                                    <div>
                                                        Порошок: {p.dilution.powderVialMg} мг / {p.dilution.reconstitutionVolumeMl ?? '?'} мл
                                                    </div>
                                                )}
                                                {p.dilution.drugAmountMg && (
                                                    <div>
                                                        В ампуле: {p.dilution.drugAmountMg} мг
                                                    </div>
                                                )}
                                                {p.dilution.diluentType && (
                                                    <div>
                                                        {getDiluentLabel(p.dilution.diluentType || null)}{p.dilution.diluentVolumeMl ? ` — ${p.dilution.diluentVolumeMl} мл` : ''}
                                                    </div>
                                                )}
                                                {p.dilution.concentrationMgPerMl && (
                                                    <div>Концентрация: {p.dilution.concentrationMgPerMl} мг/мл</div>
                                                )}
                                                {p.dilution.volumeToDrawMl && (
                                                    <div className="mt-1 font-semibold text-primary-600 dark:text-primary-400">
                                                        Набрать в шприц: {p.dilution.volumeToDrawMl} мл
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={async () => {
                                                // Редактирование дозировки
                                                try {
                                                    const med = await medicationService.getMedication(p.medicationId);
                                                    setLastDoseResult(null);
                                                    setDoseCalcParams(null);
                                                    setSelectedMedicationForDose(med);
                                                    setCalculatedDoseData({
                                                        dosing: p.dosing || '',
                                                        duration: p.duration || '5-7 дней',
                                                        singleDoseMg: p.singleDoseMg || null,
                                                        timesPerDay: p.timesPerDay || null,
                                                        formId: p.formId || null,
                                                        formType: p.formType || null,
                                                        routeOfAdmin: p.routeOfAdmin || med?.routeOfAdmin || null,
                                                        packagingDescription: p.packagingDescription || med?.packageDescription || null,
                                                        daySchedule: p.daySchedule || null,
                                                        dilution: p.dilution || null
                                                    });
                                                    setPendingMedicationId(p.medicationId);
                                                    setIsDoseModalOpen(true);
                                                } catch (err) {
                                                    logger.error('[VisitFormPage] Failed to load medication for edit', { error: err, medicationId: p.medicationId });
                                                }
                                            }}
                                            className="text-slate-400 hover:text-primary-500"
                                            title="Редактировать дозировку"
                                        >
                                            <FileText className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => updateFormData(prev => ({
                                                ...prev,
                                                prescriptions: prev.prescriptions?.filter((_, i) => i !== idx)
                                            }))}
                                            className="text-slate-400 hover:text-red-500"
                                            title="Удалить назначение"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {(!formData.prescriptions || formData.prescriptions.length === 0) && (
                                <div className="text-center py-8 text-slate-400 italic">
                                    Добавьте препараты через справочник или выберите шаблон
                                </div>
                            )}
                        </div>
                    </Card>
                    </div>

                    {/* ==================== ДИАГНОСТИЧЕСКИЕ ИССЛЕДОВАНИЯ ==================== */}
                    <div id="section-diagnostics" className="space-y-6">
                    {/* Выбранная диагностика */}
                    <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <ClipboardList className="w-5 h-5 text-blue-500" />
                                Выбранная диагностика
                            </h2>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsDiagnosticBrowserOpen(true)}
                                    className="text-xs"
                                    title="Открыть справочник исследований"
                                >
                                    <BookOpen className="w-3 h-3 mr-1" />
                                    Справочник
                                </Button>
                            {currentUser?.id && (
                                <>
                                    {currentDiagnosticItems.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleSaveDiagnosticTemplate}
                                            className="text-xs"
                                            title="Сохранить текущие исследования как шаблон"
                                        >
                                            <Save className="w-3 h-3 mr-1" />
                                            Сохранить шаблон
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleLoadDiagnosticTemplate}
                                        className="text-xs"
                                        title="Выбрать сохраненный шаблон"
                                    >
                                        <FileText className="w-3 h-3 mr-1" />
                                        Выбрать шаблон
                                    </Button>
                                </>
                            )}
                            </div>
                        </div>

                        {/* Лабораторные исследования */}
                        {(formData as any).laboratoryTests && (formData as any).laboratoryTests.length > 0 && (
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
                                    <FlaskConical className="w-4 h-4" />
                                    Лабораторные исследования ({(formData as any).laboratoryTests.length})
                                </h3>
                                <div className="space-y-2">
                                    {((formData as any).laboratoryTests as import('../../types').DiagnosticPlanItem[]).map((test, idx) => (
                                        <div key={idx} className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl flex justify-between items-start bg-slate-50 dark:bg-slate-800/50">
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-900 dark:text-white">{test.test}</p>
                                                {test.rationale && (
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{test.rationale}</p>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveDiagnosticTest('lab', idx)}
                                                className="text-slate-400 hover:text-red-600"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Инструментальные исследования */}
                        {(formData as any).instrumentalTests && (formData as any).instrumentalTests.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-1">
                                    <FileBarChart className="w-4 h-4" />
                                    Инструментальные исследования ({(formData as any).instrumentalTests.length})
                                </h3>
                                <div className="space-y-2">
                                    {((formData as any).instrumentalTests as import('../../types').DiagnosticPlanItem[]).map((test, idx) => (
                                        <div key={idx} className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl flex justify-between items-start bg-slate-50 dark:bg-slate-800/50">
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-900 dark:text-white">{test.test}</p>
                                                {test.rationale && (
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{test.rationale}</p>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveDiagnosticTest('instrumental', idx)}
                                                className="text-slate-400 hover:text-red-600"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(!(formData as any).laboratoryTests || (formData as any).laboratoryTests.length === 0) &&
                         (!(formData as any).instrumentalTests || (formData as any).instrumentalTests.length === 0) && (
                            <div className="text-center py-8 text-slate-400 italic">
                                Добавьте исследования через справочник или загрузите шаблон
                            </div>
                        )}
                    </Card>
                    </div>

                    {/* ==================== РЕКОМЕНДАЦИИ ==================== */}
                    <div id="section-recommendations">
                        <RecommendationsSection
                            items={recommendations}
                            onChange={setRecommendations}
                            onOpenTemplateSelector={() => setIsRecommendationTemplateSelectorOpen(true)}
                            onOpenSaveTemplate={() => setIsCreateRecommendationTemplateOpen(true)}
                            onOpenBrowser={() => setIsRecommendationBrowserOpen(true)}
                        />
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-6 self-start transition-all duration-300">
                        <div className="hidden lg:block max-h-[calc(100vh-48px)] overflow-y-auto custom-scrollbar pr-2">
                            <VisitFormNavigation
                                sections={navigationSections}
                                activeSection={activeSection}
                                onNavigate={scrollToSection}
                                layout="sidebar"
                            />
                        </div>
                    </div>
                </div>
            </div>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    <p className="font-bold">{error}</p>
                </div>
            )}

            {success && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 p-4 bg-green-600 text-white rounded-2xl flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-5">
                    <CheckCircle2 className="w-6 h-6" />
                    <p className="font-bold">{successMessage}</p>
                </div>
            )}

            {/* Medication Browser Modal */}
            <MedicationBrowser
                isOpen={isMedicationBrowserOpen}
                onClose={() => setIsMedicationBrowserOpen(false)}
                onSelect={async (medication) => {
                    await addPrescription(medication);
                }}
                medicationAllergyText={medicationAllergyText}
                currentIcd10Codes={[
                    // Собираем коды всех диагнозов (основной + осложнения + сопутствующие)
                    ...(primaryDiagnosis?.code ? [primaryDiagnosis.code] : []),
                    ...complications.map((c: any) => c.code).filter(Boolean),
                    ...comorbidities.map((c: any) => c.code).filter(Boolean)
                ]}
            />

            {/* ICD Code Search Modal */}
            <IcdCodeSearchModal
                isOpen={isIcdSearchOpen}
                onClose={() => {
                    setIsIcdSearchOpen(false);
                    setCurrentDiagnosisSelector(null);
                }}
                onSelect={(diagnosis) => {
                    if (currentDiagnosisSelector === 'primary') {
                        handlePrimaryDiagnosisSelect(diagnosis);
                    } else if (currentDiagnosisSelector === 'complications') {
                        handleComplicationsChange([...complications, diagnosis]);
                    } else if (currentDiagnosisSelector === 'comorbidities') {
                        handleComorbiditiesChange([...comorbidities, diagnosis]);
                    }
                    setIsIcdSearchOpen(false);
                    setCurrentDiagnosisSelector(null);
                }}
            />

            {/* Disease Search Modal */}
            <DiseaseSearchModal
                isOpen={isDiseaseSearchOpen}
                onClose={() => {
                    setIsDiseaseSearchOpen(false);
                    setCurrentDiagnosisSelector(null);
                }}
                onSelect={(diagnosis) => {
                    if (currentDiagnosisSelector === 'primary') {
                        handlePrimaryDiagnosisSelect(diagnosis);
                        // Если выбран из базы знаний, загружаем препараты
                        if (diagnosis.diseaseId) {
                            diseaseService.getDisease(diagnosis.diseaseId).then(disease => {
                                if (disease) selectDiagnosis(disease);
                            });
                        }
                    } else if (currentDiagnosisSelector === 'complications') {
                        handleComplicationsChange([...complications, diagnosis]);
                    } else if (currentDiagnosisSelector === 'comorbidities') {
                        handleComorbiditiesChange([...comorbidities, diagnosis]);
                    }
                    setIsDiseaseSearchOpen(false);
                    setCurrentDiagnosisSelector(null);
                }}
            />

            {/* Error Modal for Validation Errors */}
            <ErrorModal
                isOpen={isErrorModalOpen}
                onClose={() => {
                    setIsErrorModalOpen(false);
                    setValidationErrors([]);
                }}
                title="Ошибка валидации"
                message={validationErrors.length > 0 ? validationErrors.join(', ') : error || 'Произошла ошибка при сохранении'}
                errors={validationErrors.length > 0 ? validationErrors : undefined}
            />

            {/* Draft Restore Modal */}
            {showRestoreModal && savedDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b dark:border-slate-800 bg-blue-50 dark:bg-blue-950/20">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl">
                                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                                        Найден несохраненный черновик
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {draftService.getDraftTimestamp(draftKey) && 
                                            `Последнее изменение: ${draftService.formatDraftTime(draftService.getDraftTimestamp(draftKey)!)}`
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-700 dark:text-slate-300 mb-4">
                                Вы начинали заполнять форму приема для этого пациента, но не сохранили её. 
                                Хотите восстановить данные?
                            </p>
                            {savedDraft.visitType && (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Тип приема: {savedDraft.visitType === 'primary' ? 'Первичный' : 
                                                 savedDraft.visitType === 'followup' ? 'Повторный' : 
                                                 savedDraft.visitType === 'consultation' ? 'Консультация' : savedDraft.visitType}
                                </p>
                            )}
                        </div>
                        <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                            <Button variant="ghost" onClick={handleDiscardDraft}>
                                Начать заново
                            </Button>
                            <Button variant="primary" onClick={handleRestoreDraft}>
                                Восстановить
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Medication Dose Edit Modal */}
            {child && (
                <MedicationDoseModal
                    isOpen={isDoseModalOpen}
                    onClose={handleDoseCancel}
                    onConfirm={handleDoseConfirm}
                    medication={selectedMedicationForDose}
                    initialDoseData={calculatedDoseData || undefined}
                    patientWeight={formData.currentWeight || undefined}
                    patientAgeMonths={ageMonths}
                    patientHeight={formData.currentHeight || null}
                    matchingRulesSummary={lastDoseResult?.matchingRulesSummary}
                    appliedRuleIndex={lastDoseResult?.appliedRuleIndex}
                    calculationBreakdown={lastDoseResult?.calculationBreakdown ?? null}
                    onRuleChange={handleDoseRuleChange}
                    notSuitableForPatient={lastDoseResult?.canUse === false ? (lastDoseResult.message ?? null) : null}
                />
            )}

            {/* Medication Template Selector Modal */}
            {currentUser?.id && isMedicationTemplateSelectorOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                    onClick={() => setIsMedicationTemplateSelectorOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border dark:border-slate-800 p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">
                            Выберите шаблон назначений
                        </h3>
                        <MedicationTemplateSelector
                            userId={currentUser.id}
                            onApply={async (templateId) => {
                                if (!child || !formData.currentWeight) return;
                                try {
                                    const items = await medicationTemplateService.prepareApplication({
                                        templateId,
                                        childWeight: formData.currentWeight,
                                        childAgeMonths: ageMonths || 0,
                                        childHeight: formData.currentHeight || null,
                                    });
                                    setPendingTemplateItems(items);
                                    setIsMedicationTemplateSelectorOpen(false);
                                    setIsBatchEditorOpen(true);
                                } catch (err) {
                                    logger.error('[VisitFormPage] Failed to prepare template', { error: err });
                                    setError('Не удалось загрузить шаблон назначений');
                                    setIsErrorModalOpen(true);
                                }
                            }}
                        />
                        <div className="mt-4 flex justify-end">
                            <Button variant="ghost" onClick={() => setIsMedicationTemplateSelectorOpen(false)}>
                                Отмена
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Medication Template Batch Editor */}
            {child && (
                <MedicationTemplateBatchEditor
                    isOpen={isBatchEditorOpen}
                    onClose={() => {
                        setIsBatchEditorOpen(false);
                        setPendingTemplateItems([]);
                    }}
                    onConfirm={(prescriptions) => {
                        // Проверяем дубликаты перед добавлением
                        const currentPrescriptions = formData.prescriptions || [];
                        const duplicates: string[] = [];

                        prescriptions.forEach((prescription: any) => {
                            const dupCheck = visitService.checkDuplicateMedication(
                                currentPrescriptions,
                                prescription.medicationId
                            );
                            if (dupCheck.isDuplicate) {
                                duplicates.push(prescription.name);
                            }
                        });

                        if (duplicates.length > 0) {
                            setValidationErrors([
                                `Препараты уже добавлены: ${duplicates.join(', ')}`
                            ]);
                            setIsErrorModalOpen(true);
                            return;
                        }

                        updateFormData(prev => ({
                            ...prev,
                            prescriptions: [...(prev.prescriptions || []), ...prescriptions]
                        }));
                        setIsBatchEditorOpen(false);
                        setPendingTemplateItems([]);
                    }}
                    templateItems={pendingTemplateItems}
                    childWeight={formData.currentWeight || 0}
                    childAgeMonths={ageMonths || 0}
                    childHeight={formData.currentHeight || null}
                />
            )}

            {/* Create Medication Template Modal */}
            {currentUser?.id && (
                <CreateMedicationTemplateModal
                    isOpen={isCreateMedicationTemplateOpen}
                    onClose={() => setIsCreateMedicationTemplateOpen(false)}
                    onSuccess={() => {
                        // Можно показать уведомление об успешном сохранении
                        setSuccess(true);
                        setTimeout(() => setSuccess(false), 3000);
                    }}
                    prescriptions={formData.prescriptions || []}
                    userId={currentUser.id}
                />
            )}

            {/* ==================== DIAGNOSTIC TEMPLATE MODALS ==================== */}
            
            {/* Create Diagnostic Template Modal */}
            {currentUser?.id && (
                <CreateDiagnosticTemplateModal
                    isOpen={isCreateDiagnosticTemplateOpen}
                    onClose={() => setIsCreateDiagnosticTemplateOpen(false)}
                    onSuccess={handleDiagnosticTemplateSaved}
                    diagnosticItems={currentDiagnosticItems}
                    userId={currentUser.id}
                />
            )}

            {/* Diagnostic Template Selector Modal */}
            {currentUser?.id && (
                <DiagnosticTemplateSelector
                    isOpen={isDiagnosticTemplateSelectorOpen}
                    onClose={() => setIsDiagnosticTemplateSelectorOpen(false)}
                    userId={currentUser.id}
                    onSelect={handleApplyDiagnosticTemplate}
                    onEdit={handleEditDiagnosticTemplate}
                    onDelete={handleDeleteDiagnosticTemplate}
                />
            )}

            {/* Diagnostic Template Batch Editor Modal */}
            {currentUser?.id && diagnosticTemplateToEdit && (
                <DiagnosticTemplateBatchEditor
                    isOpen={!!diagnosticTemplateToEdit}
                    onClose={() => setDiagnosticTemplateToEdit(null)}
                    template={diagnosticTemplateToEdit}
                    onSave={async (updated) => {
                        try {
                            await diagnosticTemplateService.upsert(updated);
                            handleDiagnosticTemplateSaved();
                            setSuccess(true);
                            setTimeout(() => setSuccess(false), 3000);
                        } catch (err) {
                            logger.error('[VisitFormPage] Failed to update diagnostic template', { err });
                            setError('Не удалось сохранить шаблон');
                            setIsErrorModalOpen(true);
                        }
                    }}
                    userId={currentUser.id}
                />
            )}

            {/* Diagnostic Browser Modal */}
            <DiagnosticBrowser
                isOpen={isDiagnosticBrowserOpen}
                onClose={() => setIsDiagnosticBrowserOpen(false)}
                onSelect={handleAddDiagnosticTest}
                onRemove={(item) => handleRemoveDiagnosticTestByName(item.test, item.type || 'lab')}
                currentIcd10Codes={diagnosticBrowserIcdCodes}
                selectedTests={currentDiagnosticItems}
            />

            {/* Recommendations Browser Modal */}
            <RecommendationsBrowser
                isOpen={isRecommendationBrowserOpen}
                onClose={() => setIsRecommendationBrowserOpen(false)}
                onSelect={(text) => setRecommendations(prev => toggleRecommendationSelection(prev, text))}
                onRemove={(text) => setRecommendations(prev => toggleRecommendationSelection(prev, text))}
                currentIcd10Codes={[
                    ...(primaryDiagnosis?.code ? [primaryDiagnosis.code] : []),
                    ...complications.map((c: any) => c.code).filter(Boolean),
                    ...comorbidities.map((c: any) => c.code).filter(Boolean),
                ]}
                selectedTexts={recommendations}
            />

            <AiDiagnosisRecommendationsModal
                isOpen={isAiDiagnosisModalOpen}
                onClose={() => setIsAiDiagnosisModalOpen(false)}
                suggestions={suggestions}
                isAnalyzing={visitAnalysis.isAnalyzing}
                onSelectDiagnosis={selectDiagnosis}
                onOpenDiseaseCard={(diseaseId) => navigate(`/diseases/${diseaseId}`)}
            />

            {/* ==================== RECOMMENDATION TEMPLATE MODALS ==================== */}

            {/* Recommendation Template Selector Modal */}
            {currentUser?.id && (
                <RecommendationTemplateSelector
                    isOpen={isRecommendationTemplateSelectorOpen}
                    onClose={() => setIsRecommendationTemplateSelectorOpen(false)}
                    userId={currentUser.id}
                    onSelect={(items) => {
                        // Добавляем выбранные рекомендации к текущим
                        setRecommendations(prev => [...prev, ...items.filter(item => !prev.includes(item))]);
                        setIsRecommendationTemplateSelectorOpen(false);
                    }}
                    onDelete={() => {
                        // Перезагрузка шаблонов происходит автоматически в компоненте
                    }}
                />
            )}

            {/* Create Recommendation Template Modal */}
            {currentUser?.id && (
                <CreateRecommendationTemplateModal
                    isOpen={isCreateRecommendationTemplateOpen}
                    onClose={() => setIsCreateRecommendationTemplateOpen(false)}
                    onSuccess={() => {
                        setSuccess(true);
                        setTimeout(() => setSuccess(false), 3000);
                    }}
                    items={recommendations}
                    userId={currentUser.id}
                />
            )}
        </div>
    );
};
