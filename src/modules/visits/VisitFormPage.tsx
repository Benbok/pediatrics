import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { visitService } from './services/visitService';
import { medicationService } from '../medications/services/medicationService';
import { diseaseService } from '../diseases/services/diseaseService';
import { Visit, ChildProfile, Disease, Medication } from '../../types';
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
    Scale
} from 'lucide-react';

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

    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

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
            }
        } catch (err) {
            setError('Ошибка загрузки данных');
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
        if (!formData.complaints) return;
        setIsAnalyzing(true);
        try {
            const results = await window.electronAPI.searchDiseases(formData.complaints.split(', '));
            setSuggestions(results.map(d => ({ disease: d, score: 0.8 })));
        } catch (err) {
            console.error('Analysis failed', err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const selectDiagnosis = (disease: Disease) => {
        setFormData({
            ...formData,
            primaryDiagnosisId: disease.id,
            prescriptions: (disease as any).medications?.map((dm: any) => ({
                medicationId: dm.medicationId,
                name: dm.medication.nameRu,
                dosing: dm.dosing || '',
                duration: dm.duration || ''
            })) || []
        });
        setSuggestions([]);
    };

    const addPrescription = async (med: Medication) => {
        if (!child) return;

        const birthDate = new Date(child.birthDate);
        const ageMonths = (new Date().getFullYear() - birthDate.getFullYear()) * 12 + (new Date().getMonth() - birthDate.getMonth());

        try {
            const doseInfo = await window.electronAPI.calculateDose({
                medicationId: med.id!,
                weight: child.birthWeight / 1000,
                ageMonths
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

                    <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Pill className="w-5 h-5 text-teal-500" />
                            Назначения
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
                            <Button variant="secondary" className="w-full h-12 rounded-xl group border-dashed" onClick={() => navigate('/medications')}>
                                <Plus className="w-4 h-4 mr-2 group-hover:scale-125 transition-transform" />
                                Выбрать препарат из справочника
                            </Button>
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
                                {suggestions.map((s, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => selectDiagnosis(s.disease)}
                                        className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-primary-500 transition-all shadow-sm group"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                                                {s.disease.icd10Code}
                                            </Badge>
                                            <div className="text-[10px] font-black text-slate-400 ml-auto">MATCH {Math.round(s.score * 100)}%</div>
                                        </div>
                                        <div className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-primary-600 transition-colors">
                                            {s.disease.nameRu}
                                        </div>
                                    </div>
                                ))}
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
        </div>
    );
};
