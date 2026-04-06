import React, { useState, useEffect, useMemo } from 'react';
import { Medication } from '../../../types';
import { medicationService } from '../../medications/services/medicationService';
import { MedicationCard } from '../../medications/components/MedicationCard';
import { Pill, Loader2, AlertCircle, Layers, Search, X, ChevronDown, ChevronRight, RotateCcw, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logger } from '../../../services/logger';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { PrettySelect, type SelectOption } from './PrettySelect';
import { buildDiseaseMedicationViewModel } from '../utils/diseaseMedicationViewModel';

interface DiseaseMedicationsTabProps {
    diseaseId: number;
    diseaseName: string;
}

export const DiseaseMedicationsTab: React.FC<DiseaseMedicationsTabProps> = ({ diseaseId, diseaseName }) => {
    const [medications, setMedications] = useState<Medication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const navigate = useNavigate();

    useEffect(() => {
        loadMedications();
    }, [diseaseId]);

    useEffect(() => {
        setSearchQuery('');
        setSelectedGroup(null);
        setShowFavoritesOnly(false);
        setExpandedGroups({});
    }, [diseaseId]);

    const loadMedications = async () => {
        setIsLoading(true);
        try {
            const data = await medicationService.getMedicationsByDisease(diseaseId);
            setMedications(data);
            setError(null);
        } catch (err) {
            setError('Не удалось загрузить препараты');
            logger.error('Failed to load medications for disease', { error: err, diseaseId });
        } finally {
            setIsLoading(false);
        }
    };

    const { availableGroups, filteredItems, groups } = useMemo(() => {
        return buildDiseaseMedicationViewModel(medications, {
            searchQuery,
            selectedGroup,
            favoritesOnly: showFavoritesOnly,
        });
    }, [medications, searchQuery, selectedGroup, showFavoritesOnly]);

    const groupOptions = useMemo<Array<SelectOption<string>>>(() => {
        return [
            { value: '', label: 'Все группы' },
            ...availableGroups.map((group) => ({ value: group, label: group })),
        ];
    }, [availableGroups]);

    const hasActiveControls = Boolean(searchQuery.trim() || selectedGroup || showFavoritesOnly);

    const toggleGroup = (groupName: string) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [groupName]: !(prev[groupName] ?? hasActiveControls),
        }));
    };

    const expandAllGroups = () => {
        setExpandedGroups(Object.fromEntries(groups.map((group) => [group.name, true])));
    };

    const collapseAllGroups = () => {
        setExpandedGroups(Object.fromEntries(groups.map((group) => [group.name, false])));
    };

    const resetFilters = () => {
        setSearchQuery('');
        setSelectedGroup(null);
        setShowFavoritesOnly(false);
        setExpandedGroups({});
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
                <p className="font-medium">{error}</p>
            </div>
        );
    }

    if (medications.length === 0) {
        return (
            <div className="text-center py-20">
                <div className="bg-slate-50 dark:bg-slate-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Pill className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                    Препараты не найдены
                </h3>
                <p className="text-slate-500 max-w-md mx-auto">
                    Для заболевания "{diseaseName}" пока нет препаратов с совпадающими кодами МКБ-10 в базе данных
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Найдено препаратов: <span className="font-bold text-primary-600">{filteredItems.length}</span>
                            <span className="text-slate-400"> из {medications.length}</span>
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            Группы свернуты по умолчанию. Раскрывайте только нужные разделы.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 self-start lg:self-auto">
                        <Button variant="secondary" size="sm" onClick={expandAllGroups} disabled={groups.length === 0}>
                            Развернуть все
                        </Button>
                        <Button variant="secondary" size="sm" onClick={collapseAllGroups} disabled={groups.length === 0}>
                            Свернуть все
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.8fr)_auto_auto]">
                    <div className="min-w-0">
                        <Input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Поиск по названию или действующему веществу..."
                            className="h-12 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                            leftIcon={<Search className="w-4 h-4" />}
                            rightIcon={searchQuery ? <X className="w-4 h-4" /> : undefined}
                            onRightIconClick={searchQuery ? () => setSearchQuery('') : undefined}
                        />
                    </div>

                    <div className="min-w-0">
                        <PrettySelect
                            value={selectedGroup ?? ''}
                            onChange={(value) => setSelectedGroup(value || null)}
                            options={groupOptions}
                            searchable
                            searchPlaceholder="Поиск группы..."
                            emptyText="Группы не найдены"
                            buttonClassName="h-12 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                            panelClassName="max-h-72"
                        />
                    </div>

                    <Button
                        variant={showFavoritesOnly ? 'primary' : 'secondary'}
                        onClick={() => setShowFavoritesOnly((prev) => !prev)}
                        className="h-12 rounded-2xl"
                    >
                        <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                        Избранное
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={resetFilters}
                        disabled={!hasActiveControls}
                        className="h-12 rounded-2xl"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Сбросить
                    </Button>
                </div>
            </div>

            {groups.length === 0 ? (
                <div className="text-center py-16 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/20">
                    <div className="bg-slate-50 dark:bg-slate-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                        Ничего не найдено
                    </h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-4">
                        Попробуйте изменить поисковый запрос или сбросить активные фильтры.
                    </p>
                    {hasActiveControls && (
                        <Button variant="secondary" onClick={resetFilters}>
                            <RotateCcw className="w-4 h-4" />
                            Сбросить фильтры
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {groups.map((group) => {
                        const isExpanded = expandedGroups[group.name] ?? hasActiveControls;

                        return (
                            <div key={group.name} className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group.name)}
                                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="rounded-2xl bg-primary-50 p-2 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
                                            <Layers className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-800 dark:text-white truncate">{group.name}</div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                {group.items.length} {group.items.length === 1 ? 'препарат' : group.items.length < 5 ? 'препарата' : 'препаратов'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {group.items.some((item) => item.isFavorite) && (
                                            <Badge variant="outline" className="text-xs">
                                                <Star className="w-3 h-3 mr-1 text-yellow-500" />
                                                {group.items.filter((item) => item.isFavorite).length}
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="text-xs">
                                            {group.items.length}
                                        </Badge>
                                        {isExpanded ? (
                                            <ChevronDown className="w-5 h-5 text-slate-400" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-slate-400" />
                                        )}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-4 md:px-5">
                                        <div className="border-l-2 border-slate-100 dark:border-slate-800 pl-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {group.items.map((med) => (
                                                    <MedicationCard
                                                        key={med.id}
                                                        medication={med}
                                                        onSelect={(id) => navigate(`/medications/${id}?from=disease&diseaseId=${diseaseId}`)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
