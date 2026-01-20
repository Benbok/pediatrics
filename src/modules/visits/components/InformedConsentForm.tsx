import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { FileText, CheckCircle2, XCircle, AlertCircle, User, Pen } from 'lucide-react';
import { InformedConsent } from '../../../types';
import { logger } from '../../../services/logger';

interface InformedConsentFormProps {
    consent?: InformedConsent | null;
    childId: number;
    visitId?: number | null;
    doctorId: number;
    interventionType?: 'medication' | 'laboratory' | 'instrumental' | 'procedure';
    onSave: (consent: Partial<InformedConsent>) => Promise<void>;
    onCancel?: () => void;
}

export const InformedConsentForm: React.FC<InformedConsentFormProps> = ({
    consent,
    childId,
    visitId,
    doctorId,
    interventionType,
    onSave,
    onCancel,
}) => {
    const [formData, setFormData] = useState<Partial<InformedConsent>>({
        interventionDescription: '',
        goals: '',
        alternatives: '',
        risks: '',
        seriousComplicationsFrequency: '',
        status: 'given',
        parentName: '',
        parentRelation: '',
        notes: '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (consent) {
            setFormData(consent);
        } else if (interventionType) {
            // Загружаем шаблон для типа вмешательства
            loadTemplate(interventionType);
        }
    }, [consent, interventionType]);

    const loadTemplate = async (type: string) => {
        try {
            const template = await window.electronAPI.getInformedConsentTemplate(type);
            setFormData(prev => ({
                ...prev,
                ...template,
            }));
        } catch (err: any) {
            logger.error('[InformedConsentForm] Failed to load template:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.interventionDescription?.trim()) {
            setError('Описание вмешательства обязательно');
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                ...formData,
                childId,
                visitId: visitId || null,
                doctorId,
                consentDate: consent?.consentDate || new Date().toISOString(),
            });
        } catch (err: any) {
            setError(err.message || 'Ошибка при сохранении согласия');
        } finally {
            setIsSaving(false);
        }
    };

    const handleStatusChange = (status: 'given' | 'refused' | 'withdrawn') => {
        setFormData(prev => ({ ...prev, status }));
    };

    return (
        <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Информированное добровольное согласие
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        на медицинское вмешательство
                    </p>
                </div>
                {consent?.status && (
                    <Badge
                        variant={consent.status === 'given' ? 'success' : consent.status === 'refused' ? 'error' : 'warning'}
                        size="md"
                    >
                        {consent.status === 'given' && 'Дано согласие'}
                        {consent.status === 'refused' && 'Отказано'}
                        {consent.status === 'withdrawn' && 'Отозвано'}
                    </Badge>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Статус согласия */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Статус согласия
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            type="button"
                            onClick={() => handleStatusChange('given')}
                            className={`
                                p-4 rounded-xl border-2 transition-all duration-200
                                ${formData.status === 'given'
                                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                                }
                            `}
                        >
                            <CheckCircle2 className={`
                                w-6 h-6 mx-auto mb-2
                                ${formData.status === 'given' ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}
                            `} />
                            <span className={`
                                text-sm font-semibold
                                ${formData.status === 'given' ? 'text-green-700 dark:text-green-300' : 'text-slate-600 dark:text-slate-400'}
                            `}>
                                Дано согласие
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleStatusChange('refused')}
                            className={`
                                p-4 rounded-xl border-2 transition-all duration-200
                                ${formData.status === 'refused'
                                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                                }
                            `}
                        >
                            <XCircle className={`
                                w-6 h-6 mx-auto mb-2
                                ${formData.status === 'refused' ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}
                            `} />
                            <span className={`
                                text-sm font-semibold
                                ${formData.status === 'refused' ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'}
                            `}>
                                Отказано
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleStatusChange('withdrawn')}
                            className={`
                                p-4 rounded-xl border-2 transition-all duration-200
                                ${formData.status === 'withdrawn'
                                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                                }
                            `}
                        >
                            <AlertCircle className={`
                                w-6 h-6 mx-auto mb-2
                                ${formData.status === 'withdrawn' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}
                            `} />
                            <span className={`
                                text-sm font-semibold
                                ${formData.status === 'withdrawn' ? 'text-orange-700 dark:text-orange-300' : 'text-slate-600 dark:text-slate-400'}
                            `}>
                                Отозвано
                            </span>
                        </button>
                    </div>
                </div>

                {/* Описание вмешательства */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Описание вмешательства <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={formData.interventionDescription || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, interventionDescription: e.target.value }))}
                        placeholder="Опишите медицинское вмешательство..."
                        rows={4}
                        required
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500"
                    />
                </div>

                {/* Цели и ожидаемые результаты */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Цели и ожидаемые результаты
                    </label>
                    <textarea
                        value={formData.goals || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, goals: e.target.value }))}
                        placeholder="Опишите цели вмешательства и ожидаемые результаты..."
                        rows={3}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500"
                    />
                </div>

                {/* Альтернативные методы */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Альтернативные методы лечения
                    </label>
                    <textarea
                        value={formData.alternatives || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, alternatives: e.target.value }))}
                        placeholder="Опишите альтернативные методы лечения..."
                        rows={3}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500"
                    />
                </div>

                {/* Риски */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Возможные осложнения и побочные эффекты
                    </label>
                    <textarea
                        value={formData.risks || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, risks: e.target.value }))}
                        placeholder="Опишите возможные риски и осложнения..."
                        rows={4}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500"
                    />
                </div>

                {/* Частота серьезных осложнений */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Частота серьезных осложнений
                    </label>
                    <Input
                        value={formData.seriousComplicationsFrequency || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, seriousComplicationsFrequency: e.target.value }))}
                        placeholder="Например: менее 1%"
                        className="w-full"
                    />
                </div>

                {/* Данные родителя/представителя */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <User className="w-4 h-4" />
                            ФИО родителя/представителя
                        </label>
                        <Input
                            value={formData.parentName || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, parentName: e.target.value }))}
                            placeholder="Фамилия Имя Отчество"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Степень родства
                        </label>
                        <Input
                            value={formData.parentRelation || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, parentRelation: e.target.value }))}
                            placeholder="Мать, Отец, Опекун..."
                        />
                    </div>
                </div>

                {/* Подписи */}
                <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Pen className="w-4 h-4" />
                        Подписи
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-600 dark:text-slate-400">
                                Подпись пациента/родителя
                            </label>
                            <Input
                                value={formData.patientSignature || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, patientSignature: e.target.value }))}
                                placeholder="Подпись или путь к файлу"
                                disabled={!!consent?.patientSignature}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-600 dark:text-slate-400">
                                Подпись врача
                            </label>
                            <Input
                                value={formData.doctorSignature || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, doctorSignature: e.target.value }))}
                                placeholder="Подпись врача"
                            />
                        </div>
                    </div>
                </div>

                {/* Примечания */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Примечания
                    </label>
                    <textarea
                        value={formData.notes || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Дополнительные примечания..."
                        rows={2}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500"
                    />
                </div>

                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400">
                        <AlertCircle className="w-5 h-5" />
                        <p className="font-medium">{error}</p>
                    </div>
                )}

                {/* Кнопки действий */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                    {onCancel && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onCancel}
                        >
                            Отмена
                        </Button>
                    )}
                    <Button
                        type="submit"
                        isLoading={isSaving}
                        disabled={isSaving}
                    >
                        {consent ? 'Обновить согласие' : 'Сохранить согласие'}
                    </Button>
                </div>
            </form>
        </Card>
    );
};
