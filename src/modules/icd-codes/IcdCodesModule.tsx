import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { icdCodeService } from '../../services/icdCode.service';
import { diseaseService } from '../diseases/services/diseaseService';
import { IcdCode } from '../../types';
import { IcdCodeCard } from './components/IcdCodeCard';
import { IcdCodeCategoryFilter } from './components/IcdCodeCategoryFilter';
import { Input } from '../../components/ui/Input';
import { Search, FileText, AlertCircle, Loader2, X } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { logger } from '../../services/logger';

const ITEMS_PER_PAGE = 50;

export const IcdCodesModule: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [codes, setCodes] = useState<IcdCode[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(() => searchParams.get('cat') ?? null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [total, setTotal] = useState(0);

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    // Синхронизируем поиск и категорию в URL
    useEffect(() => {
        const params: Record<string, string> = {};
        if (searchQuery) params.q = searchQuery;
        if (selectedCategory) params.cat = selectedCategory;
        setSearchParams(params, { replace: true });
    }, [searchQuery, selectedCategory]);

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        performSearch();
    }, [debouncedSearchQuery, selectedCategory]);

    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            // Загружаем данные и категории параллельно
            const [loadResult, categoriesList] = await Promise.all([
                icdCodeService.loadCodes(),
                icdCodeService.getCategories()
            ]);
            
            setCategories(categoriesList);
            setError(null);
        } catch (err: any) {
            setError('Не удалось загрузить справочник МКБ');
            logger.error('[IcdCodesModule] Failed to load ICD codes', { error: err });
        } finally {
            setIsLoading(false);
        }
    };

    const performSearch = async () => {
        setIsSearching(true);
        setCurrentPage(0);
        
        try {
            let result;
            
            if (debouncedSearchQuery.trim()) {
                // Поиск по запросу (с опциональной фильтрацией по категории)
                result = await icdCodeService.searchCodes({
                    query: debouncedSearchQuery,
                    category: selectedCategory || undefined,
                    limit: ITEMS_PER_PAGE,
                    offset: 0
                });
            } else if (selectedCategory) {
                // Только фильтр по категории (без поискового запроса)
                result = await icdCodeService.getCodesByCategory(
                    selectedCategory,
                    ITEMS_PER_PAGE,
                    0
                );
            } else {
                // Все коды
                result = await icdCodeService.getAllCodes(ITEMS_PER_PAGE, 0);
            }
            
            setCodes(result.results);
            setTotal(result.total);
            setError(null);
        } catch (err: any) {
            setError('Ошибка при поиске кодов МКБ');
            logger.error('[IcdCodesModule] Search error', { error: err, query: debouncedSearchQuery, category: selectedCategory });
        } finally {
            setIsSearching(false);
        }
    };

    const loadMore = async () => {
        if (isSearching || codes.length >= total) return;
        
        setIsSearching(true);
        try {
            const nextPage = currentPage + 1;
            let result;
            
            if (debouncedSearchQuery.trim()) {
                // Поиск по запросу (с опциональной фильтрацией по категории)
                result = await icdCodeService.searchCodes({
                    query: debouncedSearchQuery,
                    category: selectedCategory || undefined,
                    limit: ITEMS_PER_PAGE,
                    offset: nextPage * ITEMS_PER_PAGE
                });
            } else if (selectedCategory) {
                // Только фильтр по категории
                result = await icdCodeService.getCodesByCategory(
                    selectedCategory,
                    ITEMS_PER_PAGE,
                    nextPage * ITEMS_PER_PAGE
                );
            } else {
                // Все коды
                result = await icdCodeService.getAllCodes(
                    ITEMS_PER_PAGE,
                    nextPage * ITEMS_PER_PAGE
                );
            }
            
            setCodes(prev => [...prev, ...result.results]);
            setCurrentPage(nextPage);
        } catch (err: any) {
            setError('Ошибка при загрузке кодов');
            logger.error('[IcdCodesModule] Load more error', { error: err, page: currentPage });
        } finally {
            setIsSearching(false);
        }
    };

    const handleCategorySelect = (category: string | null) => {
        setSelectedCategory(category);
        // Не очищаем поиск - фильтр категории работает вместе с поиском
    };

    const handleCodeClick = async (code: IcdCode) => {
        try {
            // Ищем заболевание с таким кодом МКБ
            const diseases = await diseaseService.getDiseases();
            const normalizedCode = code.code.toUpperCase().trim();
            
            // Ищем заболевание по основному коду или в списке дополнительных кодов
            const matchingDisease = diseases.find(disease => {
                // Проверяем основной код
                if (disease.icd10Code?.toUpperCase().trim() === normalizedCode) {
                    return true;
                }
                
                // Проверяем дополнительные коды
                let additionalCodes: string[] = [];
                if (Array.isArray(disease.icd10Codes)) {
                    additionalCodes = disease.icd10Codes;
                } else if (typeof disease.icd10Codes === 'string') {
                    try {
                        additionalCodes = JSON.parse(disease.icd10Codes || '[]');
                    } catch (e) {
                        // Если не JSON, игнорируем
                    }
                }
                
                return additionalCodes.some((c: string) => 
                    c?.toUpperCase().trim() === normalizedCode
                );
            });

            if (matchingDisease?.id) {
                // Найдено заболевание - переходим на его страницу
                navigate(`/diseases/${matchingDisease.id}`);
            } else {
                // Заболевание не найдено - ничего не делаем
                // В будущем можно показать уведомление или предложить создать заболевание
                logger.info('[IcdCodesModule] No disease found for code', { code: code.code });
            }
        } catch (err) {
            logger.error('[IcdCodesModule] Failed to search for disease', { error: err, code: code.code });
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/50 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-2xl">
                        <FileText className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Справочник МКБ-10
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            Международная классификация болезней 10-го пересмотра
                        </p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors z-10" />
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по коду МКБ или названию..."
                    className="pl-12 pr-12 h-14 rounded-2xl bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800"
                />
                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Category Filter */}
            {!isLoading && categories.length > 0 && (
                <IcdCodeCategoryFilter
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onCategorySelect={handleCategorySelect}
                />
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                </div>
            )}

            {/* Results */}
            {!isLoading && (
                <>
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Найдено: <span className="font-semibold text-slate-700 dark:text-slate-300">{total}</span> кодов
                        </p>
                    </div>

                    {codes.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-500 dark:text-slate-400">Коды не найдены</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {codes.map((code) => (
                                <IcdCodeCard 
                                    key={code.uid} 
                                    code={code}
                                    onClick={() => handleCodeClick(code)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Load More */}
                    {codes.length < total && (
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={loadMore}
                                disabled={isSearching}
                                className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSearching ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Загрузка...
                                    </span>
                                ) : (
                                    'Загрузить еще'
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
