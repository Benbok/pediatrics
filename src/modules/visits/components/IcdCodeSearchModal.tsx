import React, { useState, useEffect, useRef } from 'react';
import { icdCodeService } from '../../../services/icdCode.service';
import { IcdCode } from '../../../types';
import { IcdCodeCard } from '../../icd-codes/components/IcdCodeCard';
import { IcdCodeCategoryFilter } from '../../icd-codes/components/IcdCodeCategoryFilter';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Search, X, Loader2, AlertCircle } from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';
import { DiagnosisEntry } from '../../../types';
import { logger } from '../../../services/logger';

interface IcdCodeSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (diagnosis: DiagnosisEntry) => void;
}

const ITEMS_PER_PAGE = 50;

export const IcdCodeSearchModal: React.FC<IcdCodeSearchModalProps> = ({
    isOpen,
    onClose,
    onSelect,
}) => {
    const [codes, setCodes] = useState<IcdCode[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [total, setTotal] = useState(0);
    const modalRef = useRef<HTMLDivElement>(null);

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    useEffect(() => {
        if (isOpen) {
            loadInitialData();
            // Сброс состояния при открытии
            setSearchQuery('');
            setSelectedCategory(null);
            setCurrentPage(0);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            performSearch();
        }
    }, [debouncedSearchQuery, selectedCategory, isOpen]);

    // Закрытие по клику вне модального окна
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            const [loadResult, categoriesList] = await Promise.all([
                icdCodeService.loadCodes(),
                icdCodeService.getCategories()
            ]);
            
            setCategories(categoriesList);
            setError(null);
        } catch (err: any) {
            setError('Не удалось загрузить справочник МКБ');
            logger.error('[IcdCodeSearchModal] Failed to load ICD codes:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const performSearch = async () => {
        setIsSearching(true);
        setCurrentPage(0);
        
        try {
            let result;
            
            if (selectedCategory) {
                result = await icdCodeService.getCodesByCategory(
                    selectedCategory,
                    ITEMS_PER_PAGE,
                    0
                );
            } else if (debouncedSearchQuery.trim()) {
                result = await icdCodeService.searchCodes({
                    query: debouncedSearchQuery,
                    limit: ITEMS_PER_PAGE,
                    offset: 0
                });
            } else {
                result = await icdCodeService.getAllCodes(ITEMS_PER_PAGE, 0);
            }
            
            setCodes(result.results);
            setTotal(result.total);
            setError(null);
        } catch (err: any) {
            setError('Ошибка при поиске кодов МКБ');
            logger.error('[IcdCodeSearchModal] Search failed:', err);
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
            
            if (selectedCategory) {
                result = await icdCodeService.getCodesByCategory(
                    selectedCategory,
                    ITEMS_PER_PAGE,
                    nextPage * ITEMS_PER_PAGE
                );
            } else if (debouncedSearchQuery.trim()) {
                result = await icdCodeService.searchCodes({
                    query: debouncedSearchQuery,
                    limit: ITEMS_PER_PAGE,
                    offset: nextPage * ITEMS_PER_PAGE
                });
            } else {
                result = await icdCodeService.getAllCodes(
                    ITEMS_PER_PAGE,
                    nextPage * ITEMS_PER_PAGE
                );
            }
            
            setCodes(prev => [...prev, ...result.results]);
            setCurrentPage(nextPage);
        } catch (err: any) {
            setError('Ошибка при загрузке кодов');
            logger.error('[IcdCodeSearchModal] Load more failed:', err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleCodeSelect = (code: IcdCode) => {
        onSelect({
            code: code.code,
            nameRu: code.name,
            diseaseId: undefined, // Из МКБ нет связи с Disease
        });
        onClose();
    };

    const handleCategorySelect = (category: string | null) => {
        setSelectedCategory(category);
        setSearchQuery('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                            <Search className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Поиск кода МКБ
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Выберите код из справочника МКБ-10
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        leftIcon={<X className="w-4 h-4" />}
                    >
                        Закрыть
                    </Button>
                </div>

                {/* Search and Filters */}
                <div className="p-6 space-y-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск по коду МКБ или названию..."
                            className="pl-12"
                            leftIcon={<Search className="w-5 h-5" />}
                        />
                    </div>

                    {!isLoading && categories.length > 0 && (
                        <IcdCodeCategoryFilter
                            categories={categories}
                            selectedCategory={selectedCategory}
                            onCategorySelect={handleCategorySelect}
                        />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400 mb-4">
                            <AlertCircle className="w-5 h-5" />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                        </div>
                    )}

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
                                        <div
                                            key={code.uid}
                                            onClick={() => handleCodeSelect(code)}
                                            className="cursor-pointer"
                                        >
                                            <IcdCodeCard code={code} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {codes.length < total && (
                                <div className="flex justify-center pt-4">
                                    <Button
                                        onClick={loadMore}
                                        disabled={isSearching}
                                        variant="secondary"
                                    >
                                        {isSearching ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Загрузка...
                                            </span>
                                        ) : (
                                            'Загрузить еще'
                                        )}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
