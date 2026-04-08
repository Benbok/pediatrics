import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Activity, Sparkles, FileText, Clock, TrendingUp, Pill } from 'lucide-react';
import { Visit } from '../../../types';

interface DiseaseHistorySectionProps {
    formData: Partial<Visit>;
    onChange: (field: keyof Visit, value: any) => void;
    onAnalyze?: () => void;
    isAnalyzing?: boolean;
    canAnalyze?: boolean;
    errors?: Record<string, string>;
}

export const DiseaseHistorySection: React.FC<DiseaseHistorySectionProps> = ({
    formData,
    onChange,
    onAnalyze,
    isAnalyzing = false,
    canAnalyze = true,
    errors = {},
}) => {
    const hasDiseaseHistoryData = Boolean(
        formData.complaints?.trim() ||
        formData.diseaseOnset?.trim() ||
        formData.diseaseCourse?.trim() ||
        formData.treatmentBeforeVisit?.trim()
    );

    return (
        <Card className="p-6 rounded-[32px] border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-xl">
                        <Activity className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        АНАМНЕЗ ЗАБОЛЕВАНИЯ
                    </h2>
                </div>
                {onAnalyze && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onAnalyze}
                        disabled={isAnalyzing || !canAnalyze || !hasDiseaseHistoryData}
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
                )}
            </div>

            <div className="space-y-6">
                {/* Жалобы на момент поступления */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Activity className="w-4 h-4 text-red-500" />
                        Жалобы на момент поступления
                    </label>
                    <textarea
                        value={formData.complaints || ''}
                        onChange={(e) => onChange('complaints', e.target.value)}
                        placeholder="Например: температура 38.5, сухой кашель, одышка..."
                        rows={4}
                        className={`
                            w-full p-4 rounded-2xl border bg-white dark:bg-slate-900 outline-none
                            transition-all text-sm text-slate-800 dark:text-white
                            focus:ring-4 focus:ring-offset-0
                            ${errors.complaints
                                ? 'border-red-300 text-red-900 focus:ring-red-500/10 focus:border-red-500'
                                : 'border-slate-200 dark:border-slate-800 focus:ring-primary-500/10 focus:border-primary-500'
                            }
                        `}
                    />
                    {errors.complaints && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            {errors.complaints}
                        </p>
                    )}
                </div>

                {/* Когда началось заболевание и первые симптомы */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Clock className="w-4 h-4" />
                        Когда началось заболевание и первые симптомы
                    </label>
                    <textarea
                        value={formData.diseaseOnset || ''}
                        onChange={(e) => onChange('diseaseOnset', e.target.value)}
                        placeholder="Опишите когда началось заболевание, первые симптомы, как они появились..."
                        rows={3}
                        className={`
                            w-full p-4 rounded-2xl border bg-white dark:bg-slate-900 outline-none
                            transition-all text-sm text-slate-800 dark:text-white
                            focus:ring-4 focus:ring-offset-0
                            ${errors.diseaseOnset
                                ? 'border-red-300 text-red-900 focus:ring-red-500/10 focus:border-red-500'
                                : 'border-slate-200 dark:border-slate-800 focus:ring-primary-500/10 focus:border-primary-500'
                            }
                        `}
                    />
                    {errors.diseaseOnset && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            {errors.diseaseOnset}
                        </p>
                    )}
                </div>

                {/* Течение болезни */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <TrendingUp className="w-4 h-4" />
                        Течение болезни
                    </label>
                    <textarea
                        value={formData.diseaseCourse || ''}
                        onChange={(e) => onChange('diseaseCourse', e.target.value)}
                        placeholder="Опишите динамику развития заболевания, изменение симптомов, периоды улучшения/ухудшения..."
                        rows={3}
                        className={`
                            w-full p-4 rounded-2xl border bg-white dark:bg-slate-900 outline-none
                            transition-all text-sm text-slate-800 dark:text-white
                            focus:ring-4 focus:ring-offset-0
                            ${errors.diseaseCourse
                                ? 'border-red-300 text-red-900 focus:ring-red-500/10 focus:border-red-500'
                                : 'border-slate-200 dark:border-slate-800 focus:ring-primary-500/10 focus:border-primary-500'
                            }
                        `}
                    />
                    {errors.diseaseCourse && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            {errors.diseaseCourse}
                        </p>
                    )}
                </div>

                {/* Лечение, проводимое до обращения */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Pill className="w-4 h-4" />
                        Лечение, проводимое до обращения
                    </label>
                    <textarea
                        value={formData.treatmentBeforeVisit || ''}
                        onChange={(e) => onChange('treatmentBeforeVisit', e.target.value)}
                        placeholder="Укажите какие препараты принимались, дозировки, длительность приема, эффект от лечения..."
                        rows={3}
                        className={`
                            w-full p-4 rounded-2xl border bg-white dark:bg-slate-900 outline-none
                            transition-all text-sm text-slate-800 dark:text-white
                            focus:ring-4 focus:ring-offset-0
                            ${errors.treatmentBeforeVisit
                                ? 'border-red-300 text-red-900 focus:ring-red-500/10 focus:border-red-500'
                                : 'border-slate-200 dark:border-slate-800 focus:ring-primary-500/10 focus:border-primary-500'
                            }
                        `}
                    />
                    {errors.treatmentBeforeVisit && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            {errors.treatmentBeforeVisit}
                        </p>
                    )}
                </div>
            </div>
        </Card>
    );
};
