import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { medicationService } from './services/medicationService';
import { MedicationListItem } from '../../types';
import { MedicationCard } from './components/MedicationCard';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Search, Plus, Pill, AlertCircle, Beaker, Star, ChevronLeft, ChevronRight, SlidersHorizontal, RotateCcw, X } from 'lucide-react';
import { PharmGroupFilter } from './components/PharmGroupFilter';
import { FormTypeFilter } from './components/FormTypeFilter';

const PAGE_SIZE = 60;

export const MedicationsModule: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    const initialSearch = searchParams.get('q') ?? '';
    const initialFavorites = searchParams.get('fav') === '1';
    const initialGroup = searchParams.get('group') || null;
    const initialFormType = searchParams.get('form') || null;
    const initialWithPediatricDosing = searchParams.get('pd') === '1';
    const initialPage = Math.max(1, Number(searchParams.get('page') || '1'));
    const initialShowFilters = searchParams.get('filters') === '1';

    const [medications, setMedications] = useState<MedicationListItem[]>([]);
    const [searchInput, setSearchInput] = useState(initialSearch);
    const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
    const [error, setError] = useState<string | null>(null);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(initialFavorites);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(initialGroup);
    const [selectedFormType, setSelectedFormType] = useState<string | null>(initialFormType);
    const [withPediatricDosing, setWithPediatricDosing] = useState(initialWithPediatricDosing);
    const [showFiltersPanel, setShowFiltersPanel] = useState(initialShowFilters);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(initialPage);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const latestRequestId = useRef(0);

    const activeFilters = useMemo(() => ({
        search: debouncedSearch,
        favoritesOnly: showFavoritesOnly,
        group: selectedGroup,
        formType: selectedFormType,
        hasPediatricDosing: withPediatricDosing,
    }), [debouncedSearch, showFavoritesOnly, selectedGroup, selectedFormType, withPediatricDosing]);

    const nonFavoriteFilterCount = useMemo(() => {
        let count = 0;
        if (selectedGroup) count += 1;
        if (selectedFormType) count += 1;
        if (withPediatricDosing) count += 1;
        return count;
    }, [selectedGroup, selectedFormType, withPediatricDosing]);

    const hasActiveListState = useMemo(() => {
        return Boolean(
            searchInput.trim() ||
            showFavoritesOnly ||
            selectedGroup ||
            selectedFormType ||
            withPediatricDosing ||
            page > 1
        );
    }, [searchInput, showFavoritesOnly, selectedGroup, selectedFormType, withPediatricDosing, page]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        const params = new URLSearchParams();

        if (debouncedSearch) {
            params.set('q', debouncedSearch);
        }
        if (showFavoritesOnly) {
            params.set('fav', '1');
        }
        if (selectedGroup) {
            params.set('group', selectedGroup);
        }
        if (selectedFormType) {
            params.set('form', selectedFormType);
        }
        if (withPediatricDosing) {
            params.set('pd', '1');
        }
        if (page > 1) {
            params.set('page', String(page));
        }
        if (showFiltersPanel) {
            params.set('filters', '1');
        }

        setSearchParams(params, { replace: true });
    }, [debouncedSearch, showFavoritesOnly, selectedGroup, selectedFormType, withPediatricDosing, page, showFiltersPanel, setSearchParams]);

    useEffect(() => {
        setPage(1);
    }, [activeFilters.search, activeFilters.favoritesOnly, activeFilters.group, activeFilters.formType]);

    useEffect(() => {
        let cancelled = false;
        const requestId = ++latestRequestId.current;

        const loadPage = async () => {
            setIsLoading(true);
            try {
                const result = await medicationService.getMedicationsPaginated({
                    page,
                    pageSize: PAGE_SIZE,
                    search: activeFilters.search,
                    favoritesOnly: activeFilters.favoritesOnly,
                    group: activeFilters.group,
                    formType: activeFilters.formType,
                    hasPediatricDosing: activeFilters.hasPediatricDosing,
                });

                if (cancelled || requestId !== latestRequestId.current) {
                    return;
                }

                setMedications(result.items);
                setTotal(result.total);
                setTotalPages(result.totalPages);
                setError(null);
            } catch (err) {
                if (!cancelled) {
                    setError('Не удалось загрузить базу препаратов');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadPage();

        return () => {
            cancelled = true;
        };
    }, [page, activeFilters]);

    // Обновление при изменении избранного (кеш инвалидируется автоматически через dataEvents)
    const handleFavoriteToggle = async () => {
        try {
            const result = await medicationService.getMedicationsPaginated({
                page,
                pageSize: PAGE_SIZE,
                search: activeFilters.search,
                favoritesOnly: activeFilters.favoritesOnly,
                group: activeFilters.group,
                formType: activeFilters.formType,
                    hasPediatricDosing: activeFilters.hasPediatricDosing,
            });
            setMedications(result.items);
            setTotal(result.total);
            setTotalPages(result.totalPages);
        } catch {
            // noop: main loader handles error display
        }
    };

    const handleResetListState = () => {
        setSearchInput('');
        setDebouncedSearch('');
        setShowFavoritesOnly(false);
        setSelectedGroup(null);
        setSelectedFormType(null);
        setWithPediatricDosing(false);
        setPage(1);
        setShowFiltersPanel(false);
        setSearchParams(new URLSearchParams(), { replace: true });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/50 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary-100 dark:bg-secondary-900/40 rounded-2xl">
                        <Pill className="w-8 h-8 text-secondary-600 dark:text-secondary-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Аптечный справочник
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            База лекарственных средств с педиатрическими дозировками
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="primary"
                        onClick={() => navigate(`/medications/new${location.search}`)}
                        className="h-12 px-6 rounded-xl shadow-lg shadow-primary-500/20"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Добавить препарат
                    </Button>
                </div>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                        <Input
                            value={searchInput}
                            onChange={(e) => {
                                const value = e.target.value;
                                const capitalized = value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
                                setSearchInput(capitalized);
                            }}
                            placeholder="Поиск по названию, веществу или АТХ-коду..."
                            className="pl-12 h-14 rounded-2xl bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800"
                            rightIcon={searchInput ? <X className="w-4 h-4" /> : undefined}
                            onRightIconClick={searchInput ? () => setSearchInput('') : undefined}
                        />
                    </div>
                </div>
                <Button
                    variant={showFavoritesOnly ? 'primary' : 'secondary'}
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className="h-14 rounded-2xl font-bold border-slate-200 dark:border-slate-800"
                >
                    <Star className={`w-5 h-5 mr-2 ${showFavoritesOnly ? 'fill-yellow-400' : ''}`} />
                    Избранное
                </Button>

                <Button
                    variant={showFiltersPanel || nonFavoriteFilterCount > 0 ? 'primary' : 'secondary'}
                    onClick={() => setShowFiltersPanel((prev) => !prev)}
                    className="h-14 rounded-2xl font-bold border-slate-200 dark:border-slate-800"
                >
                    <SlidersHorizontal className="w-5 h-5 mr-2" />
                    Фильтры
                    {nonFavoriteFilterCount > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-white/20 px-2 py-0.5 text-xs">
                            {nonFavoriteFilterCount}
                        </span>
                    )}
                </Button>
            </div>

            {hasActiveListState && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/40 px-4 py-3">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        Активны поиск или фильтры. Можно быстро вернуться к полному списку.
                    </div>
                    <Button
                        variant="ghost"
                        onClick={handleResetListState}
                        className="rounded-xl text-slate-600 dark:text-slate-300"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Сбросить все
                    </Button>
                </div>
            )}

            {/* Фильтры */}
            {(showFiltersPanel || nonFavoriteFilterCount > 0) && (
                <div className="space-y-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Настройка выдачи
                        </div>
                        {hasActiveListState && (
                            <button
                                type="button"
                                onClick={handleResetListState}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Сбросить все
                            </button>
                        )}
                    </div>
                    <PharmGroupFilter onGroupSelect={setSelectedGroup} />
                    <FormTypeFilter onFormTypeSelect={setSelectedFormType} />
                    <div className="flex items-center gap-2 pt-1">
                        <Button
                            variant={withPediatricDosing ? 'primary' : 'secondary'}
                            onClick={() => setWithPediatricDosing((prev) => !prev)}
                            className="h-10 rounded-xl text-sm"
                        >
                            С педиатрическим дозированием
                        </Button>
                    </div>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-1 gap-4">
                <Card className="p-4 border-slate-100 dark:border-slate-800 flex flex-col items-center max-w-xs">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{total}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Всего препаратов</span>
                </Card>
            </div>

            {/* Medications Grid */}
            {isLoading && medications.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-2xl" />
                    ))}
                </div>
            ) : medications.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {medications.map(med => (
                        <MedicationCard
                            key={med.id}
                            medication={med}
                            onSelect={(id) => navigate(`/medications/${id}${location.search}`)}
                            onFavoriteToggle={handleFavoriteToggle}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                        <Beaker className="w-12 h-12 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                        {searchInput || selectedGroup || selectedFormType || showFavoritesOnly || withPediatricDosing ? 'Ничего не найдено' : 'Справочник пуст'}
                    </h3>
                    <p className="text-slate-500 max-w-sm">
                        {searchInput || selectedGroup || selectedFormType || showFavoritesOnly || withPediatricDosing
                            ? 'Попробуйте изменить запрос или добавьте новый препарат вручную'
                            : 'Начните с добавления первого препарата для автоматического расчета дозировок'
                        }
                    </p>
                </div>
            )}

            {total > 0 && (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2">
                    <div className="text-sm text-slate-500">
                        Показано {medications.length} из {total} препаратов
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            className="h-10 px-4"
                            disabled={page <= 1 || isLoading}
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Назад
                        </Button>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 px-2">
                            Страница {page} / {totalPages}
                        </span>
                        <Button
                            variant="secondary"
                            className="h-10 px-4"
                            disabled={page >= totalPages || isLoading}
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        >
                            Вперёд
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
