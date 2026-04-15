import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DiseaseRecommendationSuggestion, DiseaseRecommendationCategory } from '../../../types';
import { logger } from '../../../services/logger';
import { visitService } from '../services/visitService';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { BookOpen, Search, X, CheckCircle2, Plus, Loader2 } from 'lucide-react';

const DISPLAY_LIMIT = 60;

const areArraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    return [...a].sort().every((v, i) => v === [...b].sort()[i]);
};

const CATEGORY_LABELS: Record<DiseaseRecommendationCategory, string> = {
    regimen: 'Режим',
    nutrition: 'Питание',
    followup: 'Наблюдение',
    activity: 'Активность',
    education: 'Родителям',
    other: 'Прочее',
};

const CATEGORY_COLORS: Record<DiseaseRecommendationCategory, string> = {
    regimen: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    nutrition: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    followup: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    activity: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    education: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    other: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

interface RecommendationsBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (text: string) => void;
    onRemove?: (text: string) => void;
    currentIcd10Codes?: string[];
    selectedTexts?: string[];
}

export const RecommendationsBrowser: React.FC<RecommendationsBrowserProps> = ({
    isOpen,
    onClose,
    onSelect,
    onRemove,
    currentIcd10Codes = [],
    selectedTexts = [],
}) => {
    const [recommendations, setRecommendations] = useState<DiseaseRecommendationSuggestion[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [filterCategory, setFilterCategory] = useState<DiseaseRecommendationCategory | 'all'>('all');
    const [filterByIcd10, setFilterByIcd10] = useState(false);
    const [expandedIcdCodes, setExpandedIcdCodes] = useState<string[]>([]);
    const [displayCount, setDisplayCount] = useState(DISPLAY_LIMIT);

    const dataLoadedRef = useRef(false);
    const prevIcdCodesRef = useRef<string[]>([]);

    useEffect(() => {
        if (!isOpen) return;

        const icdCodesChanged = !areArraysEqual(prevIcdCodesRef.current, currentIcd10Codes);

        if (!dataLoadedRef.current || icdCodesChanged) {
            loadRecommendations();
            loadExpandedIcdCodes();
            prevIcdCodesRef.current = [...currentIcd10Codes];
            dataLoadedRef.current = true;
        }
    }, [isOpen, currentIcd10Codes]);

    const loadRecommendations = async () => {
        setIsLoading(true);
        try {
            const data = await visitService.getAllDiseaseRecommendations();
            setRecommendations(data);
        } catch (error) {
            logger.error('[RecommendationsBrowser] Failed to load recommendations', { error });
        } finally {
            setIsLoading(false);
        }
    };

    const loadExpandedIcdCodes = async () => {
        if (currentIcd10Codes.length === 0) {
            setExpandedIcdCodes([]);
            return;
        }
        try {
            const expanded = await visitService.getExpandedIcdCodes(currentIcd10Codes);
            setExpandedIcdCodes(expanded);
        } catch (error) {
            logger.error('[RecommendationsBrowser] Failed to expand ICD codes', { error });
            setExpandedIcdCodes(currentIcd10Codes);
        }
    };

    const filteredRecommendations = useMemo(() => {
        let filtered = recommendations;

        if (filterCategory !== 'all') {
            filtered = filtered.filter(r => r.item.category === filterCategory);
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                r.item.text.toLowerCase().includes(term) ||
                r.sourceDiseaseName.toLowerCase().includes(term) ||
                (r.icd10Codes || []).some(c => c.toLowerCase().includes(term))
            );
        }

        if (filterByIcd10 && expandedIcdCodes.length > 0) {
            filtered = filtered.filter(r =>
                (r.icd10Codes || []).some(recCode =>
                    expandedIcdCodes.some(diseaseCode => {
                        const a = recCode.toUpperCase();
                        const b = diseaseCode.toUpperCase();
                        return a === b || a.startsWith(b + '.') || b.startsWith(a + '.');
                    })
                )
            );
        }

        return filtered;
    }, [recommendations, filterCategory, searchTerm, filterByIcd10, expandedIcdCodes]);

    useEffect(() => {
        setDisplayCount(DISPLAY_LIMIT);
    }, [filteredRecommendations]);

    if (!isOpen) return null;

    const categories: Array<DiseaseRecommendationCategory | 'all'> = ['all', 'regimen', 'nutrition', 'followup', 'activity', 'education', 'other'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-4xl max-h-[90vh] m-4 flex flex-col rounded-3xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-100 dark:bg-teal-900/40 rounded-xl">
                            <BookOpen className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Справочник рекомендаций
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Клинические рекомендации из базы знаний заболеваний
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Search and Filters */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4 flex-shrink-0">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Поиск по тексту рекомендации, заболеванию или коду МКБ-10..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 rounded-xl"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilterCategory(cat)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    filterCategory === cat
                                        ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400 ring-1 ring-teal-400'
                                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                                }`}
                            >
                                {cat === 'all' ? 'Все' : CATEGORY_LABELS[cat]}
                            </button>
                        ))}
                    </div>

                    {currentIcd10Codes.length > 0 && (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="filter-icd10-recs"
                                checked={filterByIcd10}
                                onChange={(e) => setFilterByIcd10(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-teal-600"
                            />
                            <label htmlFor="filter-icd10-recs" className="text-sm text-slate-600 dark:text-slate-400">
                                Показать только рекомендации для выбранного диагноза
                            </label>
                        </div>
                    )}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                        </div>
                    ) : filteredRecommendations.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Рекомендации не найдены</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filteredRecommendations.slice(0, displayCount).map((rec, idx) => {
                                    const isSelected = selectedTexts.includes(rec.item.text);
                                    const cat = rec.item.category as DiseaseRecommendationCategory;

                                    return (
                                        <div
                                            key={`${rec.item.text}-${idx}`}
                                            className={`
                                                p-4 rounded-2xl cursor-pointer group relative
                                                transition-all duration-200
                                                border-2
                                                ${isSelected
                                                    ? 'border-green-400 bg-green-50 dark:bg-green-950/30 shadow-md shadow-green-500/20'
                                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-teal-300 hover:shadow-md hover:shadow-teal-500/10'
                                                }
                                            `}
                                            onClick={() => {
                                                if (isSelected) {
                                                    onRemove?.(rec.item.text);
                                                    return;
                                                }

                                                onSelect(rec.item.text);
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium leading-snug mb-2 ${
                                                        isSelected ? 'text-green-800 dark:text-green-200' : 'text-slate-800 dark:text-slate-200'
                                                    }`}>
                                                        {rec.item.text}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${CATEGORY_COLORS[cat] || CATEGORY_COLORS.other}`}>
                                                            {CATEGORY_LABELS[cat] || cat}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                            {rec.sourceDiseaseName}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                                    isSelected
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:bg-teal-100 group-hover:text-teal-600 dark:group-hover:bg-teal-900/40 dark:group-hover:text-teal-400'
                                                }`}>
                                                    {isSelected
                                                        ? <CheckCircle2 className="w-4 h-4" />
                                                        : <Plus className="w-4 h-4" />
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {filteredRecommendations.length > displayCount && (
                                <div className="mt-4 text-center">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setDisplayCount(prev => prev + DISPLAY_LIMIT)}
                                        className="rounded-xl text-sm"
                                    >
                                        Показать ещё ({filteredRecommendations.length - displayCount})
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        {filteredRecommendations.length} рекомендаций
                        {selectedTexts.length > 0 && ` · ${selectedTexts.length} добавлено`}
                    </span>
                    <Button variant="secondary" onClick={onClose} className="rounded-xl">
                        Закрыть
                    </Button>
                </div>
            </Card>
        </div>
    );
};
