import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { visitService } from './services/visitService';
import { medicationService } from '../medications/services/medicationService';
import { diseaseService } from '../diseases/services/diseaseService';
import { patientService } from '../../services/patient.service';
import { informedConsentService } from './services/informedConsentService';
import { logger } from '../../services/logger';
import { Visit, ChildProfile, Disease, Medication, DiagnosisSuggestion, DiagnosisEntry, InformedConsent } from '../../types';
import { MedicationBrowser } from './components/MedicationBrowser';
import { VisitTypeSelector, VisitType } from './components/VisitTypeSelector';
import { AnamnesisSection } from './components/AnamnesisSection';
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
    Eye
} from 'lucide-react';
import { calculateBMI, calculateBSA, getBMICategory, getBMICategoryLabel, formatBMI, formatBSA, validateAnthropometry } from '../../utils/anthropometry';
import { calculateAgeInMonths, getFormattedAge } from '../../utils/ageUtils';

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
    
    useEffect(() => {
        loadData();
    }, [id, childId]);

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
                setFormData(prev => ({ ...prev, visitType: autoType }));
                setAutoDetectedVisitType(autoType);
            }
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
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    const loadLastAnthropometry = async () => {
        try {
            const visits = await visitService.getVisits(Number(childId));
            const lastVisit = visits.find(v => v.currentWeight && v.currentHeight);
            if (lastVisit) {
                setFormData({
                    ...formData,
                    currentWeight: lastVisit.currentWeight,
                    currentHeight: lastVisit.currentHeight
                });
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
        const newData = { ...formData, [field]: numValue };
        setFormData(newData);

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
            // Подготовка данных для сохранения: сериализация JSON полей диагнозов
            const dataToSave = { ...formData, status };
            
            // Сериализуем диагнозы в JSON строки, если они объекты
            if (dataToSave.primaryDiagnosis && typeof dataToSave.primaryDiagnosis === 'object') {
                dataToSave.primaryDiagnosis = JSON.stringify(dataToSave.primaryDiagnosis);
            }
            if (dataToSave.complications && Array.isArray(dataToSave.complications)) {
                dataToSave.complications = JSON.stringify(dataToSave.complications);
            }
            if (dataToSave.comorbidities && Array.isArray(dataToSave.comorbidities)) {
                dataToSave.comorbidities = JSON.stringify(dataToSave.comorbidities);
            }
            
            // Сериализуем другие JSON поля
            if (Array.isArray(dataToSave.laboratoryTests)) {
                dataToSave.laboratoryTests = JSON.stringify(dataToSave.laboratoryTests);
            }
            if (Array.isArray(dataToSave.instrumentalTests)) {
                dataToSave.instrumentalTests = JSON.stringify(dataToSave.instrumentalTests);
            }
            if (Array.isArray(dataToSave.consultationRequests)) {
                dataToSave.consultationRequests = JSON.stringify(dataToSave.consultationRequests);
            }
            
            const savedVisit = await visitService.upsertVisit(dataToSave as Visit);
            setSuccess(true);
            
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
            
            setTimeout(() => navigate(`/patients/${childId}/visits`), 1500);
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
            setTimeout(() => navigate(`/patients/${childId}/visits`), 1500);
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
        
        setFormData(prev => ({
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

    const handlePrimaryDiagnosisSelect = (diagnosis: DiagnosisEntry | null) => {
        setFormData(prev => ({
            ...prev,
            primaryDiagnosis: diagnosis,
            primaryDiagnosisId: diagnosis?.diseaseId || null,
        }));
        
        // Если выбран диагноз с diseaseId, загружаем препараты
        if (diagnosis?.diseaseId && childId) {
            selectDiagnosis({ id: diagnosis.diseaseId } as Disease);
        }
    };

    const handleComplicationsChange = (complications: DiagnosisEntry[]) => {
        setFormData(prev => ({
            ...prev,
            complications: complications.length > 0 ? complications : null,
        }));
    };

    const handleComorbiditiesChange = (comorbidities: DiagnosisEntry[]) => {
        setFormData(prev => ({
            ...prev,
            comorbidities: comorbidities.length > 0 ? comorbidities : null,
        }));
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
            setFormData({
                ...formData,
                prescriptions: currentPrescriptions.filter((p: any) => p.medicationId !== medicationId)
            });
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

            const ageMonths = calculateAgeInMonths(child.birthDate, new Date());
            const currentWeight = formData.currentWeight || (child.birthWeight / 1000);
            const currentHeight = formData.currentHeight || null;

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
                    ageMonths,
                    currentHeight
                );
            } catch (err) {
                logger.error('[VisitFormPage] Dose calc failed on selection', {
                    error: err,
                    medicationId,
                    weight: currentWeight,
                    ageMonths,
                    height: currentHeight
                });
            }

            // Подготавливаем начальные данные для модального окна
            const initialDoseData: Partial<DoseData> = {
                dosing: doseInfo?.instruction || recommendation?.recommendedDose?.instruction || '',
                duration: recommendation?.duration || '5-7 дней',
                singleDoseMg: doseInfo?.singleDoseMg ?? recommendation?.recommendedDose?.singleDoseMg,
                timesPerDay: doseInfo?.timesPerDay ?? recommendation?.recommendedDose?.timesPerDay
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

        const ageMonths = calculateAgeInMonths(child.birthDate, new Date());
        const currentWeight = formData.currentWeight || (child.birthWeight / 1000);
        const currentHeight = formData.currentHeight || null;

        try {
            const doseInfo = await medicationService.calculateDose(
                med.id!,
                currentWeight,
                ageMonths,
                currentHeight
            );

            // Подготавливаем начальные данные для модального окна
            const initialDoseData: Partial<DoseData> = {
                dosing: doseInfo.canUse ? doseInfo.instruction : '',
                duration: '5-7 дней',
                singleDoseMg: doseInfo.singleDoseMg,
                timesPerDay: doseInfo.timesPerDay
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
            timesPerDay: doseData.timesPerDay
        };

        if (existingIndex >= 0) {
            // Обновляем существующее назначение
            const updated = [...currentPrescriptions];
            updated[existingIndex] = updatedPrescription;
            setFormData({
                ...formData,
                prescriptions: updated
            });
        } else {
            // Добавляем новое назначение
            setFormData({
                ...formData,
                prescriptions: [...currentPrescriptions, updatedPrescription]
            });
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

    // Вычисляем возраст ребенка для показателей жизнедеятельности
    const ageMonths = child ? calculateAgeInMonths(
        child.birthDate,
        new Date()
    ) : undefined;

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

    return (
        <div className={`p-6 max-w-7xl mx-auto space-y-6 pb-24 ${isDiseasePanelOpen ? 'mr-[50%]' : ''} transition-all duration-300`}>
            {/* Header */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate(`/patients/${childId}/visits`)} className="rounded-xl">
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        Назад
                    </Button>
                    <div className="h-10 w-px bg-slate-200 dark:bg-slate-800" />
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                            {isEdit ? 'Протокол приема (форма 025/у)' : 'Новый клинический прием'}
                        </h1>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                Пациент: {child?.surname} {child?.name}
                            </p>
                            {child && (
                                <>
                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                        {formatBirthDate(child.birthDate)}
                                    </p>
                                    {formattedAge && (
                                        <>
                                            <span className="text-slate-300 dark:text-slate-600">•</span>
                                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                                {formattedAge}
                                            </p>
                                        </>
                                    )}
                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                        {formatGender(child.gender)}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => handleSave('draft')} isLoading={isSaving} className="rounded-xl font-bold">
                        Сохранить черновик
                    </Button>
                    <Button variant="primary" onClick={() => handleSave('completed')} isLoading={isSaving} className="rounded-xl px-8 shadow-lg shadow-primary-500/20">
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Завершить прием
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Тип приема */}
                    <VisitTypeSelector
                        value={formData.visitType as VisitType}
                        onChange={(type) => handleFieldChange('visitType', type)}
                        autoDetected={autoDetectedVisitType}
                    />

                    {/* Шаблоны приемов */}
                    {formData.visitType && (
                        <VisitTemplateSelector
                            visitType={formData.visitType}
                            onSelect={(templateData) => {
                                setFormData(prev => ({ ...prev, ...templateData }));
                            }}
                            onTemplateApplied={async (result) => {
                                // Если шаблон содержит ссылку на шаблон назначений, применяем его
                                if (result.medicationTemplateId && child) {
                                    try {
                                        const items = await medicationTemplateService.prepareApplication({
                                            templateId: result.medicationTemplateId,
                                            childWeight: formData.currentWeight || (child.birthWeight / 1000),
                                            childAgeMonths: calculateAgeInMonths(child.birthDate, new Date()),
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
                        />
                    )}

                    {/* Дата и время приема */}
                    <Card className="p-6">
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
                    <Card className="p-6 rounded-[32px] border-slate-200 shadow-xl overflow-hidden">
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

                    {/* Анамнез */}
                    <AnamnesisSection
                        formData={formData}
                        onChange={handleFieldChange}
                    />

                    {/* Показатели жизнедеятельности */}
                    <VitalSignsSection
                        formData={formData}
                        onChange={handleFieldChange}
                        ageMonths={ageMonths}
                    />

                    {/* Объективный осмотр по системам */}
                    <PhysicalExamBySystems
                        formData={formData}
                        onChange={handleFieldChange}
                        userId={currentUser?.id}
                    />

                    {/* Жалобы (для AI анализа) */}
                    <Card className="p-6 rounded-[32px] border-slate-200 shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Activity className="w-5 h-5 text-red-500" />
                                Жалобы
                            </h2>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => runAnalysis()}
                                disabled={isAnalyzing || !formData.complaints?.trim()}
                                className="flex items-center gap-2"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Sparkles className="w-4 h-4 animate-pulse" />
                                        Анализ AI...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Анализ AI
                                    </>
                                )}
                            </Button>
                        </div>
                        <div>
                            <textarea
                                value={formData.complaints}
                                onChange={e => handleFieldChange('complaints', e.target.value)}
                                placeholder="Например: температура 38.5, сухой кашель, одышка..."
                                rows={4}
                                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-medium text-slate-800 dark:text-white"
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                Нажмите "Анализ AI" для анализа жалоб, анамнеза и клинического осмотра для подбора диагнозов
                            </p>
                        </div>
                    </Card>

                    {/* Диагнозы */}
                    <div className="space-y-4">
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

                    {/* Рекомендованные препараты */}
                    <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Pill className="w-5 h-5 text-teal-500" />
                            Препараты для лечения
                        </h2>

                        {isLoadingMedications ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                            </div>
                        ) : medicationRecommendations.length > 0 ? (
                                <div className="space-y-3 mb-4">
                                    {medicationRecommendations.map((rec) => {
                                        const isSelected = formData.prescriptions?.some((p: any) => p.medicationId === rec.medication.id);
                                        return (
                                            <div
                                                key={rec.medication.id}
                                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
                                                        : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-primary-300'
                                                }`}
                                                onClick={() => toggleMedicationSelection(rec.medication.id)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleMedicationSelection(rec.medication.id)}
                                                        className="mt-1 w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="font-bold text-slate-800 dark:text-white mb-1">
                                                            {rec.medication.nameRu}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mb-2">
                                                            {rec.medication.activeSubstance}
                                                        </div>
                                                        {rec.recommendedDose && rec.canUse && (
                                                            <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">
                                                                <div className="font-semibold">Дозировка:</div>
                                                                <div>{rec.recommendedDose.instruction}</div>
                                                                {rec.recommendedDose.singleDoseMg && (
                                                                    <div className="text-xs text-slate-500 mt-1">
                                                                        Разовая доза: {rec.recommendedDose.singleDoseMg} мг
                                                                        {rec.recommendedDose.timesPerDay && ` × ${rec.recommendedDose.timesPerDay} раз в день`}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {rec.warnings && rec.warnings.length > 0 && (
                                                            <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                                                                ⚠️ {rec.warnings.join(', ')}
                                                            </div>
                                                        )}
                                                        {!rec.canUse && (
                                                            <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                                                                ⚠️ {rec.recommendedDose?.message || 'Препарат не рекомендуется'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : !primaryDiagnosis ? (
                                <div className="text-center py-8 text-slate-400">
                                    <Pill className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Выберите основной диагноз, чтобы увидеть рекомендованные препараты</p>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400">
                                    <Pill className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Для данного диагноза не найдено рекомендованных препаратов</p>
                                    <p className="text-xs mt-2 text-slate-500">Вы можете выбрать препарат вручную из справочника</p>
                                </div>
                            )}

                        <div className="flex gap-2">
                            <Button 
                                variant="secondary" 
                                className="flex-1 h-12 rounded-xl group border-dashed" 
                                onClick={() => setIsMedicationBrowserOpen(true)}
                            >
                                <Plus className="w-4 h-4 mr-2 group-hover:scale-125 transition-transform" />
                                Выбрать препарат
                            </Button>
                            {currentUser?.id && (
                                <Button 
                                    variant="secondary" 
                                    className="h-12 rounded-xl group border-dashed" 
                                    onClick={() => setIsMedicationTemplateSelectorOpen(true)}
                                >
                                    <FileText className="w-4 h-4 mr-2 group-hover:scale-125 transition-transform" />
                                    Шаблон
                                </Button>
                            )}
                        </div>
                    </Card>

                    <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Pill className="w-5 h-5 text-teal-500" />
                                Выбранные назначения
                            </h2>
                            {currentUser?.id && (
                                <div className="flex gap-2">
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
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            {formData.prescriptions?.map((p: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                                        <Pill className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800 dark:text-white">{p.name}</div>
                                        <div className="text-xs text-slate-500">{p.dosing} | {p.duration}</div>
                                        {(p.singleDoseMg || p.timesPerDay) && (
                                            <div className="text-xs text-slate-500 mt-1">
                                                Разовая доза: {p.singleDoseMg ?? '—'} мг
                                                {p.timesPerDay ? ` × ${p.timesPerDay} раз в день` : ''}
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
                                                        timesPerDay: p.timesPerDay || null
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
                                            onClick={() => setFormData({
                                                ...formData,
                                                prescriptions: formData.prescriptions?.filter((_, i) => i !== idx)
                                            })}
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
                                    Выберите препараты из рекомендованных выше или добавьте вручную
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="p-5 rounded-[32px] bg-gradient-to-br from-primary-50 to-white dark:from-primary-950/20 dark:to-slate-900 border-primary-100 shadow-lg">
                        <h2 className="text-sm font-black text-primary-700 dark:text-primary-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            AI рекомендации диагнозов
                            {isAnalyzing && (
                                <span className="ml-2 text-xs text-slate-500">Анализ...</span>
                            )}
                        </h2>

                        {suggestions.length > 0 ? (
                            <div className="space-y-3">
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
                                                    className={`h-1.5 rounded-full transition-all ${
                                                        s.confidence > 0.7 ? 'bg-green-500' : 
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
                            <div className="p-3 bg-primary-600 rounded-2xl text-white shadow-lg shadow-primary-500/30">
                                <div className="text-[10px] font-black text-white/70">{primaryDiagnosis.code}</div>
                                <div className="font-bold">{primaryDiagnosis.nameRu}</div>
                                {primaryDiagnosis.diseaseId && (
                                    <div className="text-xs text-white/70 mt-1">Из базы знаний</div>
                                )}
                            </div>
                        </Card>
                    )}
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
                currentIcd10Codes={
                    primaryDiagnosis?.code
                        ? [primaryDiagnosis.code]
                        : []
                }
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

            {/* Medication Dose Edit Modal */}
            {child && (
                <MedicationDoseModal
                    isOpen={isDoseModalOpen}
                    onClose={handleDoseCancel}
                    onConfirm={handleDoseConfirm}
                    medication={selectedMedicationForDose}
                    initialDoseData={calculatedDoseData || undefined}
                    patientWeight={formData.currentWeight || (child.birthWeight / 1000)}
                    patientAgeMonths={calculateAgeInMonths(child.birthDate, new Date())}
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
                                        childAgeMonths: calculateAgeInMonths(child.birthDate, new Date()),
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

                        setFormData({
                            ...formData,
                            prescriptions: [...currentPrescriptions, ...prescriptions]
                        });
                        setIsBatchEditorOpen(false);
                        setPendingTemplateItems([]);
                    }}
                    templateItems={pendingTemplateItems}
                    childWeight={formData.currentWeight || (child.birthWeight / 1000)}
                    childAgeMonths={calculateAgeInMonths(child.birthDate, new Date())}
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
        </div>
    );
};
