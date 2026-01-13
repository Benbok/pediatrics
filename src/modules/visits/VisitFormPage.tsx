import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { visitService } from './services/visitService';
import { medicationService } from '../medications/services/medicationService';
import { diseaseService } from '../diseases/services/diseaseService';
import { Visit, ChildProfile, Disease, Medication, DiagnosisSuggestion } from '../../types';
import { MedicationBrowser } from './components/MedicationBrowser';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
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
    TrendingUp
} from 'lucide-react';
import { calculateBMI, calculateBSA, getBMICategory, getBMICategoryLabel, formatBMI, formatBSA, validateAnthropometry } from '../../utils/anthropometry';

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
        complaints: '',
        physicalExam: '',
        primaryDiagnosisId: null,
        prescriptions: [],
        status: 'draft',
    });

    const [suggestions, setSuggestions] = useState<DiagnosisSuggestion[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [calculatedBMI, setCalculatedBMI] = useState<number | null>(null);
    const [calculatedBSA, setCalculatedBSA] = useState<number | null>(null);
    const [medicationRecommendations, setMedicationRecommendations] = useState<any[]>([]);
    const [isLoadingMedications, setIsLoadingMedications] = useState(false);
    const [isMedicationBrowserOpen, setIsMedicationBrowserOpen] = useState(false);
    const [analysisTimeout, setAnalysisTimeout] = useState<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadData();
    }, [id, childId]);

    const loadData = async () => {
        try {
            const childData = await window.electronAPI.getChild(Number(childId));
            setChild(childData);

            if (isEdit) {
                const visitData = await visitService.getVisit(Number(id));
                setFormData(visitData);
                if (visitData.currentWeight && visitData.currentHeight) {
                    setCalculatedBMI(visitData.bmi || calculateBMI(visitData.currentWeight, visitData.currentHeight));
                    setCalculatedBSA(visitData.bsa || calculateBSA(visitData.currentWeight, visitData.currentHeight));
                }
            }
        } catch (err) {
            setError('Ошибка загрузки данных');
        }
    };

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
            console.error('Failed to load last anthropometry', err);
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
        try {
            const dataToSave = { ...formData, status };
            const savedVisit = await visitService.upsertVisit(dataToSave as Visit);
            setSuccess(true);
            setTimeout(() => navigate(`/patients/${childId}/visits`), 1500);
        } catch (err: any) {
            setError(err.message || 'Ошибка сохранения');
        } finally {
            setIsSaving(false);
        }
    };

    const runAnalysis = async () => {
        if (!formData.complaints || !childId) return;
        
        // Отменяем предыдущий таймер, если есть
        if (analysisTimeout) {
            clearTimeout(analysisTimeout);
        }

        // Debounce: ждем 1 секунду перед выполнением
        const timeout = setTimeout(async () => {
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
                    setFormData({ ...formData, id: visitId });
                } else {
                    // Обновляем жалобы перед анализом
                    await visitService.upsertVisit({
                        ...formData,
                        complaints: formData.complaints
                    } as Visit);
                }

                // Выполняем AI-анализ
                const results = await visitService.analyzeVisit(visitId!);
                setSuggestions(results);
                
                const duration = Date.now() - startTime;
                console.log(`[VisitFormPage] Analysis completed in ${duration}ms`);
                
                if (duration > 5000) {
                    console.warn(`[VisitFormPage] Analysis took longer than expected: ${duration}ms`);
                }
            } catch (err: any) {
                console.error('Analysis failed', err);
                setError(err.message || 'Ошибка анализа. Попробуйте еще раз.');
            } finally {
                setIsAnalyzing(false);
            }
        }, 1000);

        setAnalysisTimeout(timeout);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (analysisTimeout) {
                clearTimeout(analysisTimeout);
            }
        };
    }, [analysisTimeout]);

    const selectDiagnosis = async (disease: Disease) => {
        setFormData({
            ...formData,
            primaryDiagnosisId: disease.id,
        });
        setSuggestions([]);

        // Загружаем препараты для выбранного диагноза
        if (disease.id && childId) {
            setIsLoadingMedications(true);
            try {
                const recommendations = await visitService.getMedicationsForDiagnosis(disease.id, Number(childId));
                setMedicationRecommendations(recommendations);
            } catch (err: any) {
                console.error('Failed to load medications:', err);
                setError('Не удалось загрузить препараты для диагноза');
            } finally {
                setIsLoadingMedications(false);
            }
        }
    };

    const toggleMedicationSelection = (medicationId: number) => {
        const currentPrescriptions = formData.prescriptions || [];
        const isSelected = currentPrescriptions.some((p: any) => p.medicationId === medicationId);

        if (isSelected) {
            setFormData({
                ...formData,
                prescriptions: currentPrescriptions.filter((p: any) => p.medicationId !== medicationId)
            });
        } else {
            const recommendation = medicationRecommendations.find(r => r.medication.id === medicationId);
            if (recommendation && recommendation.recommendedDose) {
                const newPrescription = {
                    medicationId: medicationId,
                    name: recommendation.medication.nameRu,
                    dosing: recommendation.recommendedDose.instruction || '',
                    duration: recommendation.duration || '5-7 дней',
                    singleDoseMg: recommendation.recommendedDose.singleDoseMg,
                    timesPerDay: recommendation.recommendedDose.timesPerDay
                };
                setFormData({
                    ...formData,
                    prescriptions: [...currentPrescriptions, newPrescription]
                });
            }
        }
    };

    const addPrescription = async (med: Medication) => {
        if (!child) return;

        const birthDate = new Date(child.birthDate);
        const ageMonths = (new Date().getFullYear() - birthDate.getFullYear()) * 12 + (new Date().getMonth() - birthDate.getMonth());

        // Используем текущий вес из формы, если есть, иначе вес при рождении
        const currentWeight = formData.currentWeight || (child.birthWeight / 1000);
        const currentHeight = formData.currentHeight || null;

        try {
            const doseInfo = await window.electronAPI.calculateDose({
                medicationId: med.id!,
                weight: currentWeight,
                ageMonths,
                height: currentHeight
            });

            setFormData({
                ...formData,
                prescriptions: [
                    ...(formData.prescriptions || []),
                    {
                        medicationId: med.id,
                        name: med.nameRu,
                        dosing: doseInfo.canUse ? doseInfo.instruction : '',
                        duration: '5-7 дней'
                    }
                ]
            });
        } catch (err) {
            console.error('Dose calc failed', err);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 pb-24">
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
                            {isEdit ? 'Протокол приема' : 'Новый клинический прием'}
                        </h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Пациент: {child?.surname} {child?.name}
                        </p>
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
                                        {child && (
                                            <div className="text-xs text-slate-500 mt-1">
                                                {getBMICategoryLabel(getBMICategory(calculatedBMI, 
                                                    (new Date().getFullYear() - new Date(child.birthDate).getFullYear()) * 12 + 
                                                    (new Date().getMonth() - new Date(child.birthDate).getMonth())
                                                ))}
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

                    <Card className="p-6 rounded-[32px] border-slate-200 shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Activity className="w-5 h-5 text-red-500" />
                                Анамнез и статус
                            </h2>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={runAnalysis}
                                isLoading={isAnalyzing}
                                className="rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 border-none px-4"
                            >
                                <Sparkles className="w-4 h-4 mr-2" />
                                Анализ AI
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Жалобы (через запятую)</label>
                                <textarea
                                    value={formData.complaints}
                                    onChange={e => setFormData({ ...formData, complaints: e.target.value })}
                                    placeholder="Например: температура 38.5, сухой кашель, одышка..."
                                    className="w-full min-h-[100px] p-4 rounded-2xl border border-slate-100 bg-slate-50/50 dark:bg-slate-800/30 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Объективный осмотр</label>
                                <textarea
                                    value={formData.physicalExam || ''}
                                    onChange={e => setFormData({ ...formData, physicalExam: e.target.value })}
                                    placeholder="Зев гиперемирован, хрипы отсутствуют..."
                                    className="w-full min-h-[100px] p-4 rounded-2xl border border-slate-100 bg-slate-50/50 dark:bg-slate-800/30 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Рекомендованные препараты */}
                    {formData.primaryDiagnosisId && (
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
                            ) : (
                                <div className="text-center py-8 text-slate-400">
                                    <Pill className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Препараты не найдены для данного диагноза</p>
                                </div>
                            )}

                            <Button 
                                variant="secondary" 
                                className="w-full h-12 rounded-xl group border-dashed" 
                                onClick={() => setIsMedicationBrowserOpen(true)}
                            >
                                <Plus className="w-4 h-4 mr-2 group-hover:scale-125 transition-transform" />
                                Выбрать другой препарат из справочника
                            </Button>
                        </Card>
                    )}

                    <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Pill className="w-5 h-5 text-teal-500" />
                            Выбранные назначения
                        </h2>

                        <div className="space-y-3">
                            {formData.prescriptions?.map((p: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                                        <Pill className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800 dark:text-white">{p.name}</div>
                                        <div className="text-xs text-slate-500">{p.dosing} | {p.duration}</div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setFormData({
                                            ...formData,
                                            prescriptions: formData.prescriptions?.filter((_, i) => i !== idx)
                                        })}
                                        className="text-slate-400 hover:text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
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
                            Подбор диагноза
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
                                            onClick={() => selectDiagnosis(s.disease)}
                                            className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-primary-500 transition-all shadow-sm group"
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
                                            <div className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-primary-600 transition-colors mb-1">
                                                {s.disease.nameRu}
                                            </div>
                                            {s.matchedSymptoms && s.matchedSymptoms.length > 0 && (
                                                <div className="text-xs text-slate-500 mb-2">
                                                    Совпало: {s.matchedSymptoms.join(', ')}
                                                </div>
                                            )}
                                            <div className={`text-xs p-2 rounded-lg ${confidenceBg} border border-slate-100 dark:border-slate-700`}>
                                                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Обоснование:</div>
                                                <div className="text-slate-600 dark:text-slate-400 italic">{s.reasoning}</div>
                                            </div>
                                            <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                                <div 
                                                    className={`h-1.5 rounded-full transition-all ${
                                                        s.confidence > 0.7 ? 'bg-green-500' : 
                                                        s.confidence > 0.4 ? 'bg-yellow-500' : 
                                                        'bg-red-500'
                                                    }`}
                                                    style={{ width: `${confidencePercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <Stethoscope className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-xs text-slate-400 font-medium italic">Введите жалобы и нажмите "Анализ AI"</p>
                            </div>
                        )}
                    </Card>

                    {formData.primaryDiagnosisId && (
                        <Card className="p-5 rounded-[32px] border-slate-200 shadow-sm animate-in zoom-in-95 duration-200">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <ClipboardList className="w-4 h-4" />
                                Выбранный диагноз
                            </h2>
                            <div className="p-3 bg-primary-600 rounded-2xl text-white shadow-lg shadow-primary-500/30">
                                <div className="text-[10px] font-black text-white/70">{(formData as any).primaryDiagnosis?.icd10Code || 'ICD-10'}</div>
                                <div className="font-bold">{(formData as any).primaryDiagnosis?.nameRu || 'Диагноз выбран'}</div>
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
                    formData.primaryDiagnosisId
                        ? (suggestions.find(s => s.disease.id === formData.primaryDiagnosisId)?.disease.icd10Codes || [])
                        : []
                }
            />
        </div>
    );
};
