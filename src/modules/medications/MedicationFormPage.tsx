import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { medicationService } from './services/medicationService';
import { Medication } from '../../types';
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
    ShieldAlert
} from 'lucide-react';

export const MedicationFormPage: React.FC = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isEdit = !!id;
    
    // Определяем источник навигации
    const fromDisease = searchParams.get('from') === 'disease';
    const diseaseId = searchParams.get('diseaseId');

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

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isEdit) {
            loadMedication();
        }
    }, [isEdit]);

    const loadMedication = async () => {
        try {
            const data = await medicationService.getMedication(Number(id));
            setFormData(data);
        } catch (err) {
            setError('Не удалось загрузить данные препарата');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            await medicationService.upsertMedication(formData as Medication);
            setSuccess(true);
            setTimeout(() => navigate('/medications'), 1500);
        } catch (err: any) {
            setError(err.message || 'Произошла ошибка при сохранении');
        } finally {
            setIsSaving(false);
        }
    };

    const addDosingRule = () => {
        setFormData({
            ...formData,
            pediatricDosing: [
                ...(formData.pediatricDosing as any[] || []),
                { minAgeMonths: 0, maxAgeMonths: 216, mgPerKg: 0, timesPerDay: 1, instruction: '' }
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
            navigate('/medications');
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={handleBack} className="rounded-xl">
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Назад
                </Button>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                    {isEdit ? 'Редактировать препарат' : 'Новый препарат'}
                </h1>
            </div>

            <form onSubmit={handleSave} className="space-y-6 pb-20">
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
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Рег. номер
                            </label>
                            <Input
                                value={formData.registrationNumber || ''}
                                onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })}
                                placeholder="П N013012/01"
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
                            <Input
                                value={(formData.icd10Codes || []).join(', ')}
                                onChange={e => setFormData({
                                    ...formData,
                                    icd10Codes: e.target.value.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
                                })}
                                placeholder="J00, J20.9, R50"
                                className="h-14 rounded-2xl font-mono"
                            />
                        </div>
                    </div>
                </Card>

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

                    <div className="space-y-4">
                        {(formData.pediatricDosing as any[] || []).map((rule, idx) => (
                            <div key={idx} className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 relative group animate-in slide-in-from-right-2">
                                <button
                                    type="button"
                                    onClick={() => removeDosingRule(idx)}
                                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Возраст (мес)</label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                value={rule.minAgeMonths}
                                                onChange={e => updateDosingRule(idx, { minAgeMonths: Number(e.target.value) })}
                                                placeholder="От"
                                                className="h-10 text-center"
                                            />
                                            <span className="text-slate-300">-</span>
                                            <Input
                                                type="number"
                                                value={rule.maxAgeMonths}
                                                onChange={e => updateDosingRule(idx, { maxAgeMonths: Number(e.target.value) })}
                                                placeholder="До"
                                                className="h-10 text-center"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">мг/кг (разовая)</label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={rule.mgPerKg}
                                            onChange={e => updateDosingRule(idx, { mgPerKg: Number(e.target.value) })}
                                            className="h-10"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Раз в день</label>
                                        <Input
                                            type="number"
                                            value={rule.timesPerDay}
                                            onChange={e => updateDosingRule(idx, { timesPerDay: Number(e.target.value) })}
                                            className="h-10"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Макс. суточная (мг)</label>
                                        <Input
                                            type="number"
                                            value={rule.maxDailyMg || ''}
                                            onChange={e => updateDosingRule(idx, { maxDailyMg: Number(e.target.value) })}
                                            placeholder="Неогранич."
                                            className="h-10"
                                        />
                                    </div>

                                    <div className="md:col-span-4 mt-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Инструкция / Комментарий</label>
                                        <Input
                                            value={rule.instruction || ''}
                                            onChange={e => updateDosingRule(idx, { instruction: e.target.value })}
                                            placeholder="Например: После еды, для детей весом от 5кг..."
                                            className="h-11 mt-1"
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

                <div className="flex justify-end gap-3 pt-6">
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
            </form>
        </div>
    );
};
