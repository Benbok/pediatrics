import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DiagnosticPlanItem, DiagnosticRecommendationWithCodes } from '../../../types';
import { logger } from '../../../services/logger';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Microscope, Search, X, Plus, Loader2, FlaskConical, FileBarChart, CheckCircle2, Trash2 } from 'lucide-react';

const DISPLAY_LIMIT = 50;

// Утилита для сравнения массивов строк
const areArraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
};

interface DiagnosticBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (item: DiagnosticPlanItem) => void;
    onRemove?: (item: DiagnosticPlanItem) => void; // Удаление при повторном клике
    currentIcd10Codes?: string[]; // Для фильтрации по ICD-10
    selectedTests?: DiagnosticPlanItem[]; // Уже выбранные исследования
}

export const DiagnosticBrowser: React.FC<DiagnosticBrowserProps> = ({
    isOpen,
    onClose,
    onSelect,
    onRemove,
    currentIcd10Codes = [],
    selectedTests = []
}) => {
    const [diagnostics, setDiagnostics] = useState<DiagnosticRecommendationWithCodes[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [filterByIcd10, setFilterByIcd10] = useState(false);
    const [expandedIcdCodes, setExpandedIcdCodes] = useState<string[]>([]);
    const [filterType, setFilterType] = useState<'all' | 'lab' | 'instrumental'>('all');
    const [displayCount, setDisplayCount] = useState(DISPLAY_LIMIT);

    // Refs для предотвращения лишних загрузок
    const dataLoadedRef = useRef(false);
    const prevIcdCodesRef = useRef<string[]>([]);

    // Загрузка данных только при первом открытии или изменении ICD кодов
    useEffect(() => {
        if (!isOpen) {
            return;
        }
        
        // Проверяем, изменились ли ICD коды
        const icdCodesChanged = !areArraysEqual(prevIcdCodesRef.current, currentIcd10Codes);
        
        // Загружаем только если данные еще не загружены или ICD коды изменились
        if (!dataLoadedRef.current || icdCodesChanged) {
            loadDiagnostics();
            loadExpandedIcdCodes();
            prevIcdCodesRef.current = [...currentIcd10Codes];
            dataLoadedRef.current = true;
        }
    }, [isOpen, currentIcd10Codes]);

    // Сброс флага при закрытии модалки (опционально, для свежих данных при следующем открытии)
    useEffect(() => {
        if (!isOpen) {
            // Не сбрасываем dataLoadedRef, чтобы не перезагружать при переключении
        }
    }, [isOpen]);

    const filteredDiagnostics = useMemo(() => {
        let filtered = diagnostics;
        if (filterType !== 'all') {
            filtered = filtered.filter(d => d.item.type === filterType);
        }
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(d =>
                d.item.test.toLowerCase().includes(term) ||
                d.sourceDiseaseName.toLowerCase().includes(term) ||
                d.icd10Codes.some(code => code.toLowerCase().includes(term))
            );
        }
        if (filterByIcd10 && expandedIcdCodes.length > 0) {
            filtered = filtered.filter(d =>
                d.icd10Codes.some(diagCode =>
                    expandedIcdCodes.some(diseaseCode => {
                        const normalizedDiag = diagCode.toUpperCase();
                        const normalizedDisease = diseaseCode.toUpperCase();
                        if (normalizedDiag === normalizedDisease) return true;
                        if (normalizedDiag.startsWith(normalizedDisease + '.')) return true;
                        if (normalizedDisease.startsWith(normalizedDiag + '.')) return true;
                        return false;
                    })
                )
            );
        }
        return filtered;
    }, [diagnostics, searchTerm, filterByIcd10, expandedIcdCodes, filterType]);

    useEffect(() => {
        setDisplayCount(DISPLAY_LIMIT);
    }, [filteredDiagnostics]);

    const loadDiagnostics = async () => {
        setIsLoading(true);
        try {
            const data = await window.electronAPI.getAllDiagnosticTests();
            setDiagnostics(data);
        } catch (error) {
            logger.error('[DiagnosticBrowser] Failed to load diagnostics', { error });
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
            const expanded = await window.electronAPI.getExpandedIcdCodes(currentIcd10Codes);
            setExpandedIcdCodes(expanded);
            logger.info('[DiagnosticBrowser] Expanded ICD codes', { 
                original: currentIcd10Codes, 
                expanded 
            });
        } catch (error) {
            logger.error('[DiagnosticBrowser] Failed to expand ICD codes', { error });
            setExpandedIcdCodes(currentIcd10Codes);
        }
    };

    const isTestSelected = (test: DiagnosticPlanItem): boolean => {
        return selectedTests.some(t => 
            t.test.toLowerCase().trim() === test.test.toLowerCase().trim()
        );
    };

    if (!isOpen) return null;

    const labCount = filteredDiagnostics.filter(d => d.item.type === 'lab').length;
    const instrCount = filteredDiagnostics.filter(d => d.item.type === 'instrumental').length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-4xl max-h-[90vh] m-4 flex flex-col rounded-3xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
                            <Microscope className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Справочник исследований
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Лабораторные и инструментальные исследования из базы знаний
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
                            placeholder="Поиск по названию исследования или коду МКБ-10..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 rounded-xl"
                        />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                filterType === 'all' 
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 ring-1 ring-blue-400' 
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                            }`}
                        >
                            Все
                        </button>
                        <button
                            onClick={() => setFilterType('lab')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                                filterType === 'lab' 
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 ring-1 ring-blue-400' 
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                            }`}
                        >
                            <FlaskConical className="w-4 h-4" />
                            Лабораторные
                        </button>
                        <button
                            onClick={() => setFilterType('instrumental')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                                filterType === 'instrumental' 
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 ring-1 ring-purple-400' 
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                            }`}
                        >
                            <FileBarChart className="w-4 h-4" />
                            Инструментальные
                        </button>

                        {currentIcd10Codes.length > 0 && (
                            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer ml-2">
                                <input
                                    type="checkbox"
                                    id="filter-icd10-diag"
                                    checked={filterByIcd10}
                                    onChange={(e) => setFilterByIcd10(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                />
                                Показать только исследования для выбранного диагноза
                            </label>
                        )}
                    </div>
                </div>

                {/* Diagnostics List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    ) : filteredDiagnostics.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Microscope className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Исследования не найдены</p>
                        </div>
                    ) : (
                        <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredDiagnostics.slice(0, displayCount).map((diag, idx) => {
                                const isSelected = isTestSelected(diag.item);
                                const isLab = diag.item.type === 'lab';
                                
                                return (
                                    <div
                                        key={`${diag.item.test}-${idx}`}
                                        className={`
                                            p-4 rounded-2xl cursor-pointer group relative overflow-hidden
                                            transition-all duration-200
                                            border-2
                                            ${isSelected 
                                                ? 'border-green-500 bg-green-50 dark:bg-green-950/30 shadow-md shadow-green-500/20 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:shadow-red-500/20' 
                                                : `border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-${isLab ? 'blue' : 'purple'}-400 hover:shadow-md hover:shadow-${isLab ? 'blue' : 'purple'}-500/10`
                                            }
                                        `}
                                        onClick={() => {
                                            if (isSelected && onRemove) {
                                                onRemove(diag.item);
                                            } else if (!isSelected) {
                                                onSelect(diag.item);
                                            }
                                        }}
                                    >
                                        {/* Animated background gradient on hover */}
                                        <div className={`
                                            absolute inset-0 opacity-0 group-hover:opacity-100 
                                            transition-opacity duration-300
                                            ${isSelected 
                                                ? 'bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/20' 
                                                : `bg-gradient-to-br ${isLab ? 'from-blue-50/50' : 'from-purple-50/50'} to-transparent dark:${isLab ? 'from-blue-900/20' : 'from-purple-900/20'}`
                                            }
                                        `} />
                                        
                                        <div className="relative flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`
                                                    p-1.5 rounded-lg transition-all duration-300
                                                    ${isSelected 
                                                        ? 'bg-green-100 dark:bg-green-900/40 group-hover:bg-red-100 dark:group-hover:bg-red-900/40' 
                                                        : `${isLab ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-purple-100 dark:bg-purple-900/40'}`
                                                    }
                                                `}>
                                                    {isLab ? (
                                                        <FlaskConical className={`w-4 h-4 transition-colors duration-300 ${isSelected ? 'text-green-600 group-hover:text-red-600' : 'text-blue-600'}`} />
                                                    ) : (
                                                        <FileBarChart className={`w-4 h-4 transition-colors duration-300 ${isSelected ? 'text-green-600 group-hover:text-red-600' : 'text-purple-600'}`} />
                                                    )}
                                                </div>
                                                <div className={`
                                                    font-semibold transition-colors duration-300
                                                    ${isSelected 
                                                        ? 'text-green-800 dark:text-green-200 group-hover:text-red-700 dark:group-hover:text-red-300' 
                                                        : `text-slate-800 dark:text-white group-hover:text-${isLab ? 'blue' : 'purple'}-600`
                                                    }
                                                `}>
                                                    {diag.item.test}
                                                </div>
                                            </div>
                                            
                                            {/* Status indicator with smooth transition */}
                                            <div className="relative h-6 min-w-[90px] flex items-center justify-end">
                                                {isSelected ? (
                                                    <>
                                                        <Badge 
                                                            variant="success" 
                                                            size="sm" 
                                                            className="flex items-center gap-1 transition-all duration-300 group-hover:opacity-0 group-hover:scale-90 absolute right-0"
                                                        >
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            Добавлено
                                                        </Badge>
                                                        <Badge 
                                                            variant="destructive" 
                                                            size="sm" 
                                                            className="flex items-center gap-1 transition-all duration-300 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 absolute right-0"
                                                        >
                                                            <X className="w-3 h-3" />
                                                            Убрать
                                                        </Badge>
                                                    </>
                                                ) : (
                                                    <div className={`
                                                        flex items-center gap-1 px-2 py-1 rounded-lg
                                                        transition-all duration-300
                                                        opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100
                                                        ${isLab ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}
                                                    `}>
                                                        <Plus className="w-3.5 h-3.5" />
                                                        <span className="text-xs font-medium">Добавить</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="relative text-xs text-slate-500 mb-2 transition-colors duration-300">
                                            Источник: {diag.sourceDiseaseName}
                                        </div>
                                        {diag.item.rationale && (
                                            <div className="relative text-xs text-slate-600 dark:text-slate-400 italic mb-2">
                                                {diag.item.rationale}
                                            </div>
                                        )}
                                        {diag.icd10Codes && diag.icd10Codes.length > 0 && (
                                            <div className="relative flex flex-wrap gap-1 mt-2">
                                                {diag.icd10Codes.slice(0, 3).map((code, codeIdx) => (
                                                    <Badge key={codeIdx} variant="outline" size="sm" className="font-mono text-[10px] transition-all duration-200">
                                                        {code}
                                                    </Badge>
                                                ))}
                                                {diag.icd10Codes.length > 3 && (
                                                    <Badge variant="outline" size="sm" className="text-[10px] transition-all duration-200">
                                                        +{diag.icd10Codes.length - 3}
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {filteredDiagnostics.length > displayCount && (
                            <div className="flex justify-center pt-4">
                                <Button
                                    variant="secondary"
                                    onClick={() => setDisplayCount(c => c + DISPLAY_LIMIT)}
                                    className="rounded-xl"
                                >
                                    Показать ещё {Math.min(DISPLAY_LIMIT, filteredDiagnostics.length - displayCount)}
                                </Button>
                            </div>
                        )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                    <div className="text-sm text-slate-500 flex items-center gap-4">
                        <span>
                            {filteredDiagnostics.length} исследований
                            {selectedTests.length > 0 && ` · ${selectedTests.length} добавлено`}
                        </span>
                        <span className="text-blue-600 dark:text-blue-400">
                            <FlaskConical className="w-4 h-4 inline mr-1" />
                            {labCount} лаб.
                        </span>
                        <span className="text-purple-600 dark:text-purple-400">
                            <FileBarChart className="w-4 h-4 inline mr-1" />
                            {instrCount} инстр.
                        </span>
                    </div>
                    <Button variant="secondary" onClick={onClose} className="rounded-xl">
                        Закрыть
                    </Button>
                </div>
            </Card>
        </div>
    );
};
