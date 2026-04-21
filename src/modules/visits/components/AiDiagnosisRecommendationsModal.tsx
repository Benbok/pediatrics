import React from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DiagnosisSuggestion, Disease } from '../../../types';
import { ClipboardList, Sparkles, Stethoscope, X } from 'lucide-react';

interface AiDiagnosisRecommendationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    suggestions: DiagnosisSuggestion[];
    isAnalyzing: boolean;
    onSelectDiagnosis: (disease: Disease) => void | Promise<void>;
    onOpenDiseaseCard: (diseaseId: number) => void;
}

export const AiDiagnosisRecommendationsModal: React.FC<AiDiagnosisRecommendationsModalProps> = ({
    isOpen,
    onClose,
    suggestions,
    isAnalyzing,
    onSelectDiagnosis,
    onOpenDiseaseCard,
}) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-primary-50 to-white dark:from-primary-950/20 dark:to-slate-950">
                    <div className="min-w-0">
                        <h2 className="text-base font-black text-primary-700 dark:text-primary-400 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            AI рекомендации диагнозов
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {isAnalyzing
                                ? 'AI анализирует жалобы и анамнез заболевания.'
                                : suggestions.length > 0
                                    ? `Найдено вариантов: ${suggestions.length}`
                                    : 'Заполните жалобы и анамнез заболевания, затем запустите анализ.'}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(85vh-88px)] custom-scrollbar">
                    {suggestions.length > 0 ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {suggestions.map((suggestion, index) => {
                                const confidencePercent = Math.round(suggestion.confidence * 100);
                                const confidenceColor = suggestion.confidence > 0.7
                                    ? 'text-green-600'
                                    : suggestion.confidence > 0.4
                                        ? 'text-yellow-600'
                                        : 'text-red-600';
                                const confidenceBg = suggestion.confidence > 0.7
                                    ? 'bg-green-50 dark:bg-green-950/20'
                                    : suggestion.confidence > 0.4
                                        ? 'bg-yellow-50 dark:bg-yellow-950/20'
                                        : 'bg-red-50 dark:bg-red-950/20';

                                return (
                                    <div
                                        key={`${suggestion.disease.id ?? suggestion.disease.icd10Code}-${index}`}
                                        className={`p-4 bg-white dark:bg-slate-900 rounded-3xl border shadow-sm ${
                                            suggestion.isUsingFallback
                                                ? 'border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/10'
                                                : 'border-slate-200 dark:border-slate-800'
                                        }`}
                                    >
                                        {suggestion.isUsingFallback && (
                                            <div className="mb-3 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-lg font-semibold border border-yellow-200 dark:border-yellow-800">
                                                Упрощённый анализ (AI недоступен)
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 mb-3">
                                            <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                                                {suggestion.disease.icd10Code}
                                            </Badge>
                                            <div className={`text-[10px] font-black ${confidenceColor} ml-auto flex items-center gap-1`}>
                                                <Sparkles className="w-3 h-3" />
                                                {confidencePercent}%
                                            </div>
                                        </div>

                                        {suggestion.disease.id ? (
                                            <button
                                                type="button"
                                                onClick={() => onOpenDiseaseCard(suggestion.disease.id!)}
                                                className="font-bold text-slate-800 dark:text-white text-sm mb-2 hover:underline underline-offset-2 text-left"
                                                title="Открыть карточку заболевания"
                                            >
                                                {suggestion.disease.nameRu}
                                            </button>
                                        ) : (
                                            <div className="font-bold text-slate-800 dark:text-white text-sm mb-2">
                                                {suggestion.disease.nameRu}
                                            </div>
                                        )}

                                        {suggestion.matchedSymptoms && suggestion.matchedSymptoms.length > 0 && (
                                            <div className="text-xs text-slate-500 mb-3">
                                                Совпало: {suggestion.matchedSymptoms.join(', ')}
                                            </div>
                                        )}

                                        <div className={`text-xs p-3 rounded-2xl ${confidenceBg} border border-slate-100 dark:border-slate-800 mb-3`}>
                                            <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Обоснование</div>
                                            <div className="text-slate-600 dark:text-slate-400 italic">{suggestion.reasoning}</div>
                                        </div>

                                        <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-3">
                                            <div
                                                className={`h-1.5 rounded-full transition-all ${
                                                    suggestion.confidence > 0.7
                                                        ? 'bg-green-500'
                                                        : suggestion.confidence > 0.4
                                                            ? 'bg-yellow-500'
                                                            : 'bg-red-500'
                                                }`}
                                                style={{ width: `${confidencePercent}%` }}
                                            />
                                        </div>

                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={async () => {
                                                await onSelectDiagnosis(suggestion.disease);
                                                onClose();
                                            }}
                                            className="w-full"
                                        >
                                            <ClipboardList className="w-4 h-4 mr-2" />
                                            Выбрать диагноз
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium italic">
                                {isAnalyzing
                                    ? 'AI анализирует данные...'
                                    : 'Рекомендации появятся после запуска анализа в разделе жалоб.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};