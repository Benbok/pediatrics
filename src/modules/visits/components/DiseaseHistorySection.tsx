import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Activity, Sparkles, Clock, TrendingUp, Pill, Check, X, WifiOff } from 'lucide-react';
import { Visit } from '../../../types';

type PendingRefinement = {
    original: string;
    refined: string;
};

function extractNumericValues(text: string) {
    return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((token) => token.replace(',', '.'));
}

function getDiffSegments(original: string, refined: string) {
    let prefixLength = 0;
    const maxPrefixLength = Math.min(original.length, refined.length);

    while (prefixLength < maxPrefixLength && original[prefixLength] === refined[prefixLength]) {
        prefixLength += 1;
    }

    let suffixLength = 0;
    const originalRemainder = original.length - prefixLength;
    const refinedRemainder = refined.length - prefixLength;
    while (
        suffixLength < originalRemainder &&
        suffixLength < refinedRemainder &&
        original[original.length - 1 - suffixLength] === refined[refined.length - 1 - suffixLength]
    ) {
        suffixLength += 1;
    }

    return {
        original: {
            prefix: original.slice(0, prefixLength),
            changed: original.slice(prefixLength, original.length - suffixLength),
            suffix: suffixLength > 0 ? original.slice(original.length - suffixLength) : '',
        },
        refined: {
            prefix: refined.slice(0, prefixLength),
            changed: refined.slice(prefixLength, refined.length - suffixLength),
            suffix: suffixLength > 0 ? refined.slice(refined.length - suffixLength) : '',
        },
    };
}

function getRefineHints(original: string, refined: string) {
    const hints: string[] = [];
    if (extractNumericValues(original).join('|') === extractNumericValues(refined).join('|') && extractNumericValues(original).length > 0) {
        hints.push('Числа сохранены');
    }
    if (original.replace(/[\p{L}\p{N}\s]/gu, '') !== refined.replace(/[\p{L}\p{N}\s]/gu, '')) {
        hints.push('Исправлена пунктуация');
    }
    if (original.toLowerCase() === refined.toLowerCase() && original !== refined) {
        hints.push('Нормализован регистр');
    } else if (original.toLowerCase() !== refined.toLowerCase()) {
        // Check if word-level changes look like spelling corrections (not additions/removals)
        const origWords = original.toLowerCase().match(/[\p{L}]+/gu) ?? [];
        const refinedWords = refined.toLowerCase().match(/[\p{L}]+/gu) ?? [];
        if (origWords.length === refinedWords.length && origWords.some((w, i) => w !== refinedWords[i])) {
            hints.push('Исправлена орфография');
        }
    }
    if (/[.\-/\s]\d{1,2}[.\-/\s]\d{2,4}|\d{1,2}\s+\d{1,2}\s+\d{2,4}/.test(original) && original !== refined) {
        hints.push('Нормализована дата');
    }
    return hints;
}

const RefineProposal: React.FC<{
    proposal: PendingRefinement;
    onAccept: () => void;
    onReject: () => void;
}> = ({ proposal, onAccept, onReject }) => {
    const diff = getDiffSegments(proposal.original, proposal.refined);
    const hints = getRefineHints(proposal.original, proposal.refined);

    return (
        <Card className="mt-2 p-3 border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-900/60">
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                Предложение рефайна
            </div>
            {hints.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {hints.map((hint) => (
                        <span
                            key={hint}
                            className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-slate-900/70 dark:text-emerald-300"
                        >
                            {hint}
                        </span>
                    ))}
                </div>
            )}
            <div className="space-y-2 text-xs">
                <div>
                    <div className="text-slate-500 dark:text-slate-400 mb-1">Исходный текст</div>
                    <div className="rounded-lg bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-2 text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                        {diff.original.prefix}
                        {diff.original.changed && (
                            <span className="rounded bg-rose-100 px-0.5 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                                {diff.original.changed}
                            </span>
                        )}
                        {diff.original.suffix}
                    </div>
                </div>
                <div>
                    <div className="text-slate-500 dark:text-slate-400 mb-1">Текст после рефайна</div>
                    <div className="rounded-lg bg-white/80 dark:bg-slate-900/70 border border-emerald-200 dark:border-emerald-900 p-2 text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
                        {diff.refined.prefix}
                        {diff.refined.changed && (
                            <span className="rounded bg-emerald-100 px-0.5 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200">
                                {diff.refined.changed}
                            </span>
                        )}
                        {diff.refined.suffix}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
                <Button size="sm" className="flex items-center gap-1.5" onClick={onAccept}>
                    <Check className="w-3.5 h-3.5" />
                    Применить
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-1.5" onClick={onReject}>
                    <X className="w-3.5 h-3.5" />
                    Оставить как есть
                </Button>
            </div>
        </Card>
    );
};

interface DiseaseHistorySectionProps {
    formData: Partial<Visit>;
    onChange: (field: keyof Visit, value: any) => void;
    onAnalyze?: () => void;
    isAnalyzing?: boolean;
    canAnalyze?: boolean;
    errors?: Record<string, string>;
    onRefine?: (field: string, text: string) => void;
    refiningFields?: Set<string>;
    streamPreview?: Record<string, string>;
    refineAiAvailable?: boolean | null;
    refineAiProvider?: 'local' | 'gemini';
    analysisAiAvailable?: boolean | null;
    analysisAiProvider?: 'local' | 'gemini';
    pendingRefinements?: Record<string, PendingRefinement>;
    onAcceptRefine?: (field: string) => void;
    onRejectRefine?: (field: string) => void;
    analysisProgress?: number;
}

export const DiseaseHistorySection: React.FC<DiseaseHistorySectionProps> = ({
    formData,
    onChange,
    onAnalyze,
    isAnalyzing = false,
    canAnalyze = true,
    errors = {},
    onRefine,
    refiningFields = new Set(),
    streamPreview = {},
    refineAiAvailable = null,
    refineAiProvider = 'local',
    analysisAiAvailable = null,
    analysisAiProvider = 'local',
    pendingRefinements = {},
    onAcceptRefine,
    onRejectRefine,
    analysisProgress = 0,
}) => {
    const hasDiseaseHistoryData = Boolean(
        formData.complaints?.trim() ||
        formData.diseaseOnset?.trim() ||
        formData.diseaseCourse?.trim() ||
        formData.treatmentBeforeVisit?.trim()
    );
    const providerBadgeLabel = (provider: 'local' | 'gemini') => (provider === 'gemini' ? 'Gemini' : 'Local');
    const providerBadgeClass = (provider: 'local' | 'gemini') => (
        provider === 'gemini'
            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
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
                    <div className="flex items-center gap-2">
                        <span
                            title={analysisAiAvailable === false
                                ? (analysisAiProvider === 'gemini'
                                    ? 'Gemini API недоступен. Проверьте API ключи в настройках.'
                                    : 'Локальный ИИ недоступен. Запустите LM Studio и загрузите модель.')
                                : undefined}
                            className={analysisAiAvailable === false ? 'cursor-not-allowed' : undefined}
                        >
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onAnalyze}
                                disabled={isAnalyzing || !canAnalyze || !hasDiseaseHistoryData || analysisAiAvailable === false}
                                className="flex items-center gap-2"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Sparkles className="w-4 h-4 animate-pulse" />
                                        {analysisProgress > 0 && analysisProgress < 100 ? `Анализ ${analysisProgress}%` : 'Анализ AI...'}
                                    </>
                                ) : analysisAiAvailable === false ? (
                                    <>
                                        <WifiOff className="w-4 h-4" />
                                        Анализ AI
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Анализ AI
                                    </>
                                )}
                            </Button>
                        </span>
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${providerBadgeClass(analysisAiProvider)}`}>
                            {providerBadgeLabel(analysisAiProvider)}
                        </span>
                    </div>
                )}
            </div>

            <div className="space-y-6">
                {/* Жалобы на момент поступления */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <Activity className="w-4 h-4 text-red-500" />
                            Жалобы на момент поступления
                        </label>
                        {onRefine && formData.complaints && (
                            <div className="flex items-center gap-2">
                                <span
                                    title={refineAiAvailable === false
                                        ? (refineAiProvider === 'gemini'
                                            ? 'Gemini API недоступен. Проверьте API ключи в настройках.'
                                            : 'Локальный ИИ недоступен. Запустите LM Studio и загрузите модель.')
                                        : undefined}
                                    className={refineAiAvailable === false ? 'cursor-not-allowed' : undefined}
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onRefine('complaints', formData.complaints || '')}
                                        disabled={refiningFields.size > 0 || isAnalyzing || refineAiAvailable === false}
                                        className="flex items-center gap-1.5 text-xs"
                                    >
                                        {refiningFields.has('complaints') ? (
                                            <>
                                                <Sparkles className="w-3 h-3 animate-pulse" />
                                                Рефайнинг...
                                            </>
                                        ) : refineAiAvailable === false ? (
                                            <>
                                                <WifiOff className="w-3 h-3" />
                                                Рефайн
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-3 h-3" />
                                                Рефайн
                                            </>
                                        )}
                                    </Button>
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${providerBadgeClass(refineAiProvider)}`}>
                                    {providerBadgeLabel(refineAiProvider)}
                                </span>
                            </div>
                        )}
                    </div>
                    <textarea
                        value={streamPreview.complaints || formData.complaints || ''}
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
                    {streamPreview.complaints && (
                        <div className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 italic">
                            Генерация: {streamPreview.complaints}
                        </div>
                    )}
                    {pendingRefinements.complaints && (
                        <RefineProposal
                            proposal={pendingRefinements.complaints}
                            onAccept={() => onAcceptRefine?.('complaints')}
                            onReject={() => onRejectRefine?.('complaints')}
                        />
                    )}
                    {errors.complaints && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            {errors.complaints}
                        </p>
                    )}
                </div>

                {/* Когда началось заболевание и первые симптомы */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <Clock className="w-4 h-4" />
                            Когда началось заболевание и первые симптомы
                        </label>
                        {onRefine && formData.diseaseOnset && (
                            <div className="flex items-center gap-2">
                                <span
                                    title={refineAiAvailable === false
                                        ? (refineAiProvider === 'gemini'
                                            ? 'Gemini API недоступен. Проверьте API ключи в настройках.'
                                            : 'Локальный ИИ недоступен. Запустите LM Studio и загрузите модель.')
                                        : undefined}
                                    className={refineAiAvailable === false ? 'cursor-not-allowed' : undefined}
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onRefine('diseaseOnset', formData.diseaseOnset || '')}
                                        disabled={refiningFields.size > 0 || isAnalyzing || refineAiAvailable === false}
                                        className="flex items-center gap-1.5 text-xs"
                                    >
                                        {refiningFields.has('diseaseOnset') ? (
                                            <>
                                                <Sparkles className="w-3 h-3 animate-pulse" />
                                                Рефайнинг...
                                            </>
                                        ) : refineAiAvailable === false ? (
                                            <>
                                                <WifiOff className="w-3 h-3" />
                                                Рефайн
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-3 h-3" />
                                                Рефайн
                                            </>
                                        )}
                                    </Button>
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${providerBadgeClass(refineAiProvider)}`}>
                                    {providerBadgeLabel(refineAiProvider)}
                                </span>
                            </div>
                        )}
                    </div>
                    <textarea
                        value={streamPreview.diseaseOnset || formData.diseaseOnset || ''}
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
                    {streamPreview.diseaseOnset && (
                        <div className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 italic">
                            Генерация: {streamPreview.diseaseOnset}
                        </div>
                    )}
                    {pendingRefinements.diseaseOnset && (
                        <RefineProposal
                            proposal={pendingRefinements.diseaseOnset}
                            onAccept={() => onAcceptRefine?.('diseaseOnset')}
                            onReject={() => onRejectRefine?.('diseaseOnset')}
                        />
                    )}
                    {errors.diseaseOnset && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            {errors.diseaseOnset}
                        </p>
                    )}
                </div>

                {/* Течение болезни */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <TrendingUp className="w-4 h-4" />
                            Течение болезни
                        </label>
                        {onRefine && formData.diseaseCourse && (
                            <div className="flex items-center gap-2">
                                <span
                                    title={refineAiAvailable === false
                                        ? (refineAiProvider === 'gemini'
                                            ? 'Gemini API недоступен. Проверьте API ключи в настройках.'
                                            : 'Локальный ИИ недоступен. Запустите LM Studio и загрузите модель.')
                                        : undefined}
                                    className={refineAiAvailable === false ? 'cursor-not-allowed' : undefined}
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onRefine('diseaseCourse', formData.diseaseCourse || '')}
                                        disabled={refiningFields.size > 0 || isAnalyzing || refineAiAvailable === false}
                                        className="flex items-center gap-1.5 text-xs"
                                    >
                                        {refiningFields.has('diseaseCourse') ? (
                                            <>
                                                <Sparkles className="w-3 h-3 animate-pulse" />
                                                Рефайнинг...
                                            </>
                                        ) : refineAiAvailable === false ? (
                                            <>
                                                <WifiOff className="w-3 h-3" />
                                                Рефайн
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-3 h-3" />
                                                Рефайн
                                            </>
                                        )}
                                    </Button>
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${providerBadgeClass(refineAiProvider)}`}>
                                    {providerBadgeLabel(refineAiProvider)}
                                </span>
                            </div>
                        )}
                    </div>
                    <textarea
                        value={streamPreview.diseaseCourse || formData.diseaseCourse || ''}
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
                    {streamPreview.diseaseCourse && (
                        <div className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 italic">
                            Генерация: {streamPreview.diseaseCourse}
                        </div>
                    )}
                    {pendingRefinements.diseaseCourse && (
                        <RefineProposal
                            proposal={pendingRefinements.diseaseCourse}
                            onAccept={() => onAcceptRefine?.('diseaseCourse')}
                            onReject={() => onRejectRefine?.('diseaseCourse')}
                        />
                    )}
                    {errors.diseaseCourse && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            {errors.diseaseCourse}
                        </p>
                    )}
                </div>

                {/* Лечение, проводимое до обращения */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <Pill className="w-4 h-4" />
                            Лечение, проводимое до обращения
                        </label>
                        {onRefine && formData.treatmentBeforeVisit && (
                            <div className="flex items-center gap-2">
                                <span
                                    title={refineAiAvailable === false
                                        ? (refineAiProvider === 'gemini'
                                            ? 'Gemini API недоступен. Проверьте API ключи в настройках.'
                                            : 'Локальный ИИ недоступен. Запустите LM Studio и загрузите модель.')
                                        : undefined}
                                    className={refineAiAvailable === false ? 'cursor-not-allowed' : undefined}
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onRefine('treatmentBeforeVisit', formData.treatmentBeforeVisit || '')}
                                        disabled={refiningFields.size > 0 || isAnalyzing || refineAiAvailable === false}
                                        className="flex items-center gap-1.5 text-xs"
                                    >
                                        {refiningFields.has('treatmentBeforeVisit') ? (
                                            <>
                                                <Sparkles className="w-3 h-3 animate-pulse" />
                                                Рефайнинг...
                                            </>
                                        ) : refineAiAvailable === false ? (
                                            <>
                                                <WifiOff className="w-3 h-3" />
                                                Рефайн
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-3 h-3" />
                                                Рефайн
                                            </>
                                        )}
                                    </Button>
                                </span>
                                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${providerBadgeClass(refineAiProvider)}`}>
                                    {providerBadgeLabel(refineAiProvider)}
                                </span>
                            </div>
                        )}
                    </div>
                    <textarea
                        value={streamPreview.treatmentBeforeVisit || formData.treatmentBeforeVisit || ''}
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
                    {streamPreview.treatmentBeforeVisit && (
                        <div className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 italic">
                            Генерация: {streamPreview.treatmentBeforeVisit}
                        </div>
                    )}
                    {pendingRefinements.treatmentBeforeVisit && (
                        <RefineProposal
                            proposal={pendingRefinements.treatmentBeforeVisit}
                            onAccept={() => onAcceptRefine?.('treatmentBeforeVisit')}
                            onReject={() => onRejectRefine?.('treatmentBeforeVisit')}
                        />
                    )}
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
