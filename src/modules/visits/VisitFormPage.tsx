import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { visitService } from './services/visitService';
import { medicationService } from '../medications/services/medicationService';
import { diseaseService } from '../diseases/services/diseaseService';
import { patientService } from '../../services/patient.service';
import { informedConsentService } from './services/informedConsentService';
import { logger } from '../../services/logger';
import { draftService } from '../../services/draftService';
import { useTabs } from '../../context/TabsContext';
import debounce from 'lodash/debounce';
import { Visit, ChildProfile, Disease, Medication, DiagnosisSuggestion, DiagnosisEntry, InformedConsent, MedicationRecommendation, getFullName } from '../../types';
import { MedicationBrowser } from './components/MedicationBrowser';
import { VisitTypeSelector, VisitType } from './components/VisitTypeSelector';
import { AnamnesisSection } from './components/AnamnesisSection';
import { DiseaseHistorySection } from './components/DiseaseHistorySection';
import { VitalSignsSection } from './components/VitalSignsSection';
import { PhysicalExamBySystems } from './components/PhysicalExamBySystems';
import { DiagnosisSelector, MultipleDiagnosisSelector } from './components/DiagnosisSelector';
import { IcdCodeSearchModal } from './components/IcdCodeSearchModal';
import { DiseaseSearchModal } from './components/DiseaseSearchModal';
import { DiseaseSidePanel } from './components/DiseaseSidePanel';
import { InformedConsentForm } from './components/InformedConsentForm';
import { VisitTemplateSelector } from './components/VisitTemplateSelector';
import { MedicationDoseModal, DoseData } from './components/MedicationDoseModal';
import { MedicationTemplateSelector } from './components/MedicationTemplateSelector';
import { MedicationTemplateBatchEditor } from './components/MedicationTemplateBatchEditor';
import { CreateMedicationTemplateModal } from './components/CreateMedicationTemplateModal';
import { medicationTemplateService } from './services/medicationTemplateService';
import { CreateDiagnosticTemplateModal } from './components/CreateDiagnosticTemplateModal';
import { DiagnosticTemplateSelector } from './components/DiagnosticTemplateSelector';
import { DiagnosticTemplateBatchEditor } from './components/DiagnosticTemplateBatchEditor';
import { DiagnosticBrowser } from './components/DiagnosticBrowser';
import { diagnosticTemplateService } from './services/diagnosticTemplateService';
import { RecommendationsSection } from './components/RecommendationsSection';
import { RecommendationTemplateSelector } from './components/RecommendationTemplateSelector';
import { CreateRecommendationTemplateModal } from './components/CreateRecommendationTemplateModal';
import { printService } from '../printing';
import { VisitFormPrintData } from '../printing/templates/visit/types';
import { buildVisitPayload } from './utils/buildVisitPayload';
import { VisitFormNavigation, NavigationSection } from './components/VisitFormNavigation';
import { useActiveSection } from './hooks/useActiveSection';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ErrorModal } from '../../components/ui/ErrorModal';
import { useAuth } from '../../context/AuthContext';
import {
    ChevronLeft,
    Save,
    Stethoscope,
    Activity,
    Sparkles,
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
    Eye,
    Beaker,
    Microscope,
    FlaskConical,
    FileBarChart,
    X,
    Search,
    FileSignature,
    Printer
} from 'lucide-react';
import { calculateBMI, calculateBSA, getBMICategory, getBMICategoryLabel, formatBMI, formatBSA, validateAnthropometry } from '../../utils/anthropometry';
import { calculateAgeInMonths, getFormattedAge } from '../../utils/ageUtils';
import { getRouteLabel } from '../../utils/routeOfAdmin';
import { getDiluentLabel } from '../../utils/diluentTypes';
import { getRandomVitalsInNormForAge } from './constants';

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
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
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

    // Рекомендации
    const [recommendations, setRecommendations] = useState<string[]>([]);
    const [isRecommendationTemplateSelectorOpen, setIsRecommendationTemplateSelectorOpen] = useState(false);
    const [isCreateRecommendationTemplateOpen, setIsCreateRecommendationTemplateOpen] = useState(false);

    // Модальные окна
    const [isIcdSearchOpen, setIsIcdSearchOpen] = useState(false);
    const [isDiseaseSearchOpen, setIsDiseaseSearchOpen] = useState(false);
    const [currentDiagnosisSelector, setCurrentDiagnosisSelector] = useState<'primary' | 'complications' | 'comorbidities' | null>(null);

    // Sidepanel для просмотра заболевания
    const [selectedDiseaseForView, setSelectedDiseaseForView] = useState<Disease | null>(null);
    const [isDiseasePanelOpen, setIsDiseasePanelOpen] = useState(false);

    // Информированное согласие
    const [informedConsent, setInformedConsent] = useState<InformedConsent | null>(null);
    const [showConsentForm, setShowConsentForm] = useState(false);

    // Восстановление черновика
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [savedDraft, setSavedDraft] = useState<Partial<Visit> | null>(null);
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
            draftService.saveDraft(draftKey, formData);
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
    }, [closeTab, tabId, navigate, childId, hasLocalChanges, formData, draftKey, recommendations, currentUser?.id]);

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
        () => debounce((data: Partial<Visit>) => {
            if (!initialLoadDone.current) return;
            draftService.saveDraft(draftKey, data);
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
            debouncedSaveDraft(formData);
            debouncedBackendSave(formData, recommendations);
        }
        return () => {
            debouncedSaveDraft.cancel();
            debouncedBackendSave.cancel();
        };
    }, [formData, hasLocalChanges, recommendations, debouncedSaveDraft, debouncedBackendSave]);

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
            const draft = draftService.loadDraft<Partial<Visit>>(draftKey);
            if (draft && draft.data) {
                // Показываем модальное окно восстановления
                setSavedDraft(draft.data);
                setShowRestoreModal(true);
            }
        }
    }, [draftKey, isEdit]);

    // Обработчик восстановления черновика
    const handleRestoreDraft = () => {
        if (savedDraft) {
            setFormData(savedDraft);
            setShowRestoreModal(false);
            setSavedDraft(null);
            setHasLocalChanges(true);
            logger.info('[VisitFormPage] Draft restored', { draftKey });
        }
    };

    // Обработчик отклонения черновика
    const handleDiscardDraft = () => {
        draftService.removeDraft(draftKey);
        setShowRestoreModal(false);
        setSavedDraft(null);
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
                draftService.saveDraft(key, data);
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, []);

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
                        logger.warn('[VisitFormPage] Failed to parse primaryDiagnosis:', e);
                    }
                }
                if (typeof parsedData.complications === 'string' && parsedData.complications) {
                    try {
                        parsedData.complications = JSON.parse(parsedData.complications);
                    } catch (e) {
                        logger.warn('[VisitFormPage] Failed to parse complications:', e);
                    }
                }
                if (typeof parsedData.comorbidities === 'string' && parsedData.comorbidities) {
                    try {
                        parsedData.comorbidities = JSON.parse(parsedData.comorbidities);
                    } catch (e) {
                        logger.warn('[VisitFormPage] Failed to parse comorbidities:', e);
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
                        logger.warn('[VisitFormPage] Failed to parse recommendations:', e);
                    }
                }

                if (visitData.currentWeight && visitData.currentHeight) {
                    setCalculatedBMI(visitData.bmi || calculateBMI(visitData.currentWeight, visitData.currentHeight));
                    setCalculatedBSA(visitData.bsa || calculateBSA(visitData.currentWeight, visitData.currentHeight));
                }

                // Загружаем информированное согласие, если есть
                if (visitData.informedConsentId) {
                    try {
                        const consent = await informedConsentService.getById(visitData.informedConsentId);
                        setInformedConsent(consent);
                    } catch (err) {
                        logger.warn('[VisitFormPage] Failed to load informed consent:', err);
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
            logger.error('[VisitFormPage] Failed to determine visit type:', err);
            return 'primary';
        }
    };

    // Обработчик изменения полей формы
    const handleFieldChange = useCallback((field: keyof Visit, value: any) => {
        updateFormData(prev => ({ ...prev, [field]: value }));
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
            const printData: VisitFormPrintData = {
                visit: formData as Visit,
                child: child,
                doctorName: getFullName(currentUser) || 'Врач',
                recommendations: recommendations,
            };

            await printService.preview('visit-form', printData, {
                title: `Прием: ${child.surname} ${child.name}`,
                createdAt: new Date(),
                author: getFullName(currentUser) || undefined,
            });
        } catch (err: any) {
            logger.error('[VisitFormPage] Print failed:', err);
            setError('Не удалось открыть предпросмотр печати');
        }
    }, [child, formData, currentUser, recommendations]);

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
            setSuccess(true);
            
            // Очищаем черновик и помечаем вкладку как "чистую" после успешного сохранения
            draftService.removeDraft(draftKey);
            setDirty(false);
            setHasLocalChanges(false);
            logger.info('[VisitFormPage] Visit saved, draft cleared', { draftKey });

            // Если статус completed и нужно согласие, показываем форму
            if (status === 'completed' && !informedConsent) {
                // Проверяем, требуется ли согласие
                const needsConsent = await informedConsentService.needsNewConsent(
                    Number(childId),
                    'Медицинское вмешательство согласно протоколу приема'
                );
                if (needsConsent) {
                    setShowConsentForm(true);
                    return; // Не перенаправляем, показываем форму согласия
                }
            }

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
                    errorsList = cleanMessage.split(',').map(e => e.trim()).filter(Boolean);
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

    const handleConsentSave = async (consentData: Partial<InformedConsent>) => {
        try {
            const savedConsent = await informedConsentService.upsert({
                ...consentData,
                visitId: formData.id || null,
            });
            setInformedConsent(savedConsent);
            setFormData(prev => ({ ...prev, informedConsentId: savedConsent.id }));
            setShowConsentForm(false);
            setSuccess(true);
            setTimeout(() => handleBack(), 1500);
        } catch (err: any) {
            setError(err.message || 'Ошибка сохранения согласия');
            logger.error('[VisitFormPage] Consent save failed:', err);
        }
    };

    // AI анализ запускается вручную через кнопку

    const runAnalysis = async () => {
        if (!childId) return;

        // Проверяем, есть ли данные для анализа
        const hasClinicalData =
            formData.complaints?.trim() ||
            formData.diseaseHistory?.trim() ||
            formData.physicalExam?.trim();

        if (!hasClinicalData) {
            setError('Введите жалобы, анамнез или данные осмотра для анализа');
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        const startTime = Date.now();

        try {
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

            // Выполняем AI-анализ (использует расширенные поля из service)
            const results = await visitService.analyzeVisit(visitId!);
            setSuggestions(results);

            const duration = Date.now() - startTime;
            logger.info(`[VisitFormPage] Analysis completed in ${duration}ms`, { visitId, duration });

            if (duration > 5000) {
                logger.warn(`[VisitFormPage] Analysis took longer than expected: ${duration}ms`, { duration });
            }
        } catch (err: any) {
            logger.error('[VisitFormPage] Analysis failed', { error: err, visitId: formData.id });
            setError(err.message || 'Ошибка анализа. Попробуйте еще раз.');
        } finally {
            setIsAnalyzing(false);
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
                // Фильтруем препараты с учетом аллергоанамнеза
                const filtered = recommendations.filter(rec => {
                    // Если есть предупреждения об аллергии, исключаем препарат
                    const hasAllergyWarning = rec.warnings?.some(w =>
                        w.toLowerCase().includes('аллергия') ||
                        w.toLowerCase().includes('непереносимость')
                    );
                    return !hasAllergyWarning && rec.canUse;
                });
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
            
            const filtered = uniqueRecommendations.filter(rec => {
                const hasAllergyWarning = rec.warnings?.some(w =>
                    w.toLowerCase().includes('аллергия') ||
                    w.toLowerCase().includes('непереносимость')
                );
                return !hasAllergyWarning && rec.canUse;
            });

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

    // Загрузка препаратов и диагностики для существующего приема при открытии
    const medicationsLoadedForEdit = useRef(false);
    const diagnosticsLoadedForEdit = useRef(false);
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
            loadDiagnosticsForAllDiagnoses(diagnosis, complications, comorbidities)
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
            loadDiagnosticsForAllDiagnoses(primaryDiagnosis, newComplications, comorbidities)
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
            loadDiagnosticsForAllDiagnoses(primaryDiagnosis, complications, newComorbidities)
        ]);
    };

    const handleViewDisease = async (disease: Disease) => {
        // Загружаем полные данные заболевания
        try {
            const fullDisease = await diseaseService.getDisease(disease.id!);
            if (fullDisease) {
                setSelectedDiseaseForView(fullDisease);
                setIsDiseasePanelOpen(true);
            }
        } catch (err: any) {
            logger.error('[VisitFormPage] Failed to load disease details:', err);
            setError('Не удалось загрузить детальную информацию о заболевании');
        }
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
            let doseInfo: any = null;
            try {
                doseInfo = await medicationService.calculateDose(
                    medicationId,
                    currentWeight,
                    patientAgeMonths,
                    currentHeight
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

            // Подготавливаем начальные данные для модального окна
            const initialDoseData: Partial<DoseData> = {
                dosing: doseInfo?.instruction || recommendation?.recommendedDose?.instruction || '',
                duration: recommendation?.duration || '5-7 дней',
                singleDoseMg: doseInfo?.singleDoseMg ?? recommendation?.recommendedDose?.singleDoseMg,
                timesPerDay: doseInfo?.timesPerDay ?? recommendation?.recommendedDose?.timesPerDay,
                routeOfAdmin: medication?.routeOfAdmin || null,
                dilution: null // Разведение настраивается вручную в модальном окне
            };

            // Открываем модальное окно для редактирования дозировки
            setSelectedMedicationForDose(medication);
            setCalculatedDoseData(initialDoseData);
            setPendingMedicationId(medicationId);
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
                currentHeight
            );

            // Подготавливаем начальные данные для модального окна
            const initialDoseData: Partial<DoseData> = {
                dosing: doseInfo.canUse ? doseInfo.instruction : '',
                duration: '5-7 дней',
                singleDoseMg: doseInfo.singleDoseMg,
                timesPerDay: doseInfo.timesPerDay,
                routeOfAdmin: med?.routeOfAdmin || null,
                dilution: null // Разведение настраивается вручную в модальном окне
            };

            // Открываем модальное окно для редактирования дозировки
            setSelectedMedicationForDose(med);
            setCalculatedDoseData(initialDoseData);
            setPendingMedicationId(med.id!);
            setIsDoseModalOpen(true);
        } catch (err) {
            logger.error('[VisitFormPage] Dose calc failed', { error: err, medicationId: med.id, weight: currentWeight, ageMonths, height: currentHeight });
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
            routeOfAdmin: doseData.routeOfAdmin || selectedMedicationForDose.routeOfAdmin || null,
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
    };

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

    return (
        <div
            className={`p-6 ${isDiseasePanelOpen ? 'mr-[50%]' : ''} transition-all duration-300`}
        >
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

            {/* Sticky Navigation Bar - Same width as header */}
            <div className="sticky top-6 z-30">
                <VisitFormNavigation
                    sections={navigationSections}
                    activeSection={activeSection}
                    onNavigate={scrollToSection}
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
                                if (result.medicationTemplateId && child) {
                                    try {
                                        const items = await medicationTemplateService.prepareApplication({
                                            templateId: result.medicationTemplateId,
                                            childWeight: formData.currentWeight || (child.birthWeight / 1000),
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
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    <Calendar className="w-4 h-4" />
                                    Дата приема
                                </label>
                                <Input
                                    type="date"
                                    value={formData.visitDate || ''}
                                    onChange={(e) => handleFieldChange('visitDate', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    <Clock className="w-4 h-4" />
                                    Время приема
                                </label>
                                <Input
                                    type="time"
                                    value={formData.visitTime || ''}
                                    onChange={(e) => handleFieldChange('visitTime', e.target.value)}
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
                            isAnalyzing={isAnalyzing}
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
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setIsMedicationBrowserOpen(true)}
                                    className="rounded-xl"
                                >
                                    <Search className="w-4 h-4 mr-1" />
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
                                        {(p.singleDoseMg || p.timesPerDay) && (
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
                                                {p.dilution.drugAmountMg && (
                                                    <div>
                                                        Количество в ампуле: {p.dilution.drugAmountMg} мг
                                                    </div>
                                                )}
                                                <div>
                                                    {getDiluentLabel(p.dilution.diluentType || null)} - {p.dilution.diluentVolumeMl || '—'} мл
                                                </div>
                                                {p.dilution.volumeToDrawMl && (
                                                    <div className="mt-1 font-semibold text-primary-600 dark:text-primary-400">
                                                        Объем для набора: {p.dilution.volumeToDrawMl} мл
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
                                                    setSelectedMedicationForDose(med);
                                                    setCalculatedDoseData({
                                                        dosing: p.dosing || '',
                                                        duration: p.duration || '5-7 дней',
                                                        singleDoseMg: p.singleDoseMg || null,
                                                        timesPerDay: p.timesPerDay || null,
                                                        routeOfAdmin: p.routeOfAdmin || med?.routeOfAdmin || null,
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
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setIsDiagnosticBrowserOpen(true)}
                                    className="rounded-xl"
                                >
                                    <Search className="w-4 h-4 mr-1" />
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
                        />
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-[110px] space-y-6 self-start max-h-[calc(100vh-140px)] overflow-y-auto pr-2 custom-scrollbar transition-all duration-300">
                        <Card className="p-5 rounded-[32px] bg-gradient-to-br from-primary-50 to-white dark:from-primary-950/20 dark:to-slate-900 border-primary-100 shadow-lg">
                            <h2 className="text-sm font-black text-primary-700 dark:text-primary-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                AI рекомендации диагнозов
                                {isAnalyzing && (
                                    <span className="ml-2 text-xs text-slate-500">Анализ...</span>
                                )}
                            </h2>

                            {suggestions.length > 0 ? (
                                <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                                    {suggestions.map((s, idx) => {
                                        const confidencePercent = Math.round(s.confidence * 100);
                                        const confidenceColor = s.confidence > 0.7 ? 'text-green-600' : s.confidence > 0.4 ? 'text-yellow-600' : 'text-red-600';
                                        const confidenceBg = s.confidence > 0.7 ? 'bg-green-50 dark:bg-green-950/20' : s.confidence > 0.4 ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'bg-red-50 dark:bg-red-950/20';

                                        return (
                                            <div
                                                key={idx}
                                                className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm group"
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                                                        {s.disease.icd10Code}
                                                    </Badge>
                                                    <div className={`text-[10px] font-black ${confidenceColor} ml-auto flex items-center gap-1`}>
                                                        <Sparkles className="w-3 h-3" />
                                                        {confidencePercent}%
                                                    </div>
                                                </div>
                                                <div className="font-bold text-slate-800 dark:text-white text-sm mb-1">
                                                    {s.disease.nameRu}
                                                </div>
                                                {s.matchedSymptoms && s.matchedSymptoms.length > 0 && (
                                                    <div className="text-xs text-slate-500 mb-2">
                                                        Совпало: {s.matchedSymptoms.join(', ')}
                                                    </div>
                                                )}
                                                <div className={`text-xs p-2 rounded-lg ${confidenceBg} border border-slate-100 dark:border-slate-700 mb-2`}>
                                                    <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Обоснование:</div>
                                                    <div className="text-slate-600 dark:text-slate-400 italic">{s.reasoning}</div>
                                                </div>
                                                <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-2">
                                                    <div
                                                        className={`h-1.5 rounded-full transition-all ${s.confidence > 0.7 ? 'bg-green-500' :
                                                            s.confidence > 0.4 ? 'bg-yellow-500' :
                                                                'bg-red-500'
                                                            }`}
                                                        style={{ width: `${confidencePercent}%` }}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => handleViewDisease(s.disease)}
                                                        className="flex-1"
                                                    >
                                                        <Eye className="w-3 h-3 mr-1" />
                                                        Открыть карточку
                                                    </Button>
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => selectDiagnosis(s.disease)}
                                                        className="flex-1"
                                                    >
                                                        Выбрать
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <Stethoscope className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 font-medium italic">
                                        {isAnalyzing
                                            ? 'AI анализирует данные...'
                                            : 'Заполните анамнез и клинический осмотр для получения рекомендаций'}
                                    </p>
                                </div>
                            )}
                        </Card>

                        {primaryDiagnosis && (
                            <Card className="p-5 rounded-[32px] border-slate-200 shadow-sm animate-in zoom-in-95 duration-200">
                                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4" />
                                    Выбранный диагноз
                                </h2>

                                <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                                    {/* Primary Diagnosis */}
                                    <div className="p-3 bg-primary-600 rounded-2xl text-white shadow-lg shadow-primary-500/30">
                                        <div className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Основной</div>
                                        <div className="text-xs font-black text-white/80">{primaryDiagnosis.code}</div>
                                        <div className="font-bold">{primaryDiagnosis.nameRu}</div>
                                        {primaryDiagnosis.diseaseId && (
                                            <div className="text-[10px] text-white/60 mt-1 italic">Из базы знаний</div>
                                        )}
                                    </div>

                                    {/* Complications */}
                                    {complications.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Осложнения</div>
                                            {complications.map((c: any, i: number) => (
                                                <div key={i} className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
                                                    <div className="text-[10px] font-black text-amber-600 dark:text-amber-400">{c.code}</div>
                                                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{c.nameRu}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Comorbidities */}
                                    {comorbidities.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Сопутствующие</div>
                                            {comorbidities.map((c: any, i: number) => (
                                                <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                                    <div className="text-[10px] font-black text-slate-500">{c.code}</div>
                                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{c.nameRu}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )}
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
                    <p className="font-bold">Прием успешно сохранен!</p>
                </div>
            )}

            {/* Medication Browser Modal */}
            <MedicationBrowser
                isOpen={isMedicationBrowserOpen}
                onClose={() => setIsMedicationBrowserOpen(false)}
                onSelect={async (medication) => {
                    await addPrescription(medication);
                }}
                currentIcd10Codes={[
                    // Собираем коды всех диагнозов (основной + осложнения + сопутствующие)
                    ...(primaryDiagnosis?.code ? [primaryDiagnosis.code] : []),
                    ...complications.map(c => c.code).filter(Boolean),
                    ...comorbidities.map(c => c.code).filter(Boolean)
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

            {/* Disease Side Panel */}
            <DiseaseSidePanel
                disease={selectedDiseaseForView}
                isOpen={isDiseasePanelOpen}
                onClose={() => {
                    setIsDiseasePanelOpen(false);
                    setSelectedDiseaseForView(null);
                }}
            />

            {/* Informed Consent Form Modal */}
            {showConsentForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
                    <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <InformedConsentForm
                            consent={informedConsent}
                            childId={Number(childId)}
                            visitId={formData.id || null}
                            doctorId={currentUser?.id!}
                            onSave={handleConsentSave}
                            onCancel={() => setShowConsentForm(false)}
                        />
                    </div>
                </div>
            )}

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
                                if (!child) return;
                                try {
                                    const items = await medicationTemplateService.prepareApplication({
                                        templateId,
                                        childWeight: formData.currentWeight || (child.birthWeight / 1000),
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
                    childWeight={formData.currentWeight || (child.birthWeight / 1000)}
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
