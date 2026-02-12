import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { medicationService } from './services/medicationService';
import { useDataCache } from '../../context/DataCacheContext';
import { Medication } from '../../types';
import { MedicationCard } from './components/MedicationCard';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Search, Plus, Filter, Pill, AlertCircle, Beaker, Star } from 'lucide-react';
import { PharmGroupFilter } from './components/PharmGroupFilter';
import { FormTypeFilter } from './components/FormTypeFilter';

export const MedicationsModule: React.FC = () => {
    const navigate = useNavigate();
    const { medications: cachedMedications, loadMedications, invalidate, isLoadingMedications } = useDataCache();
    const [medications, setMedications] = useState<Medication[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [selectedFormType, setSelectedFormType] = useState<string | null>(null);

    const formTypeLabelMap: Record<string, string> = {
        tablet: 'Таблетки',
        solution: 'Раствор',
        syrup: 'Сироп',
        suspension: 'Суспензия',
        injection: 'Инъекция',
        capsule: 'Капсулы',
        suppository: 'Свечи',
        powder: 'Порошок',
        drops: 'Капли',
        ointment: 'Мазь',
        gel: 'Гель',
        cream: 'Крем',
        spray: 'Спрей',
        patch: 'Пластырь'
    };

    const getFormTypeLabel = (type: string) => formTypeLabelMap[type] || type;

    useEffect(() => {
        // Загружаем данные из кеша или делаем запрос
        const initializeData = async () => {
            try {
                const data = await loadMedications();
                setMedications(data);
                setError(null);
                
                // Отладка: проверяем первый препарат
                if (data.length > 0) {
                    console.log('[MedicationsModule] Sample medication data:', {
                        name: data[0].nameRu,
                        forms: data[0].forms,
                        formsType: typeof data[0].forms,
                        formsIsArray: Array.isArray(data[0].forms)
                    });
                }
            } catch (err) {
                setError('Не удалось загрузить базу препаратов');
                console.error(err);
            }
        };

        // Если данные уже в кеше - используем их, иначе загружаем
        if (cachedMedications) {
            setMedications(cachedMedications);
            // Отладка кешированных данных
            if (cachedMedications.length > 0) {
                console.log('[MedicationsModule] Cached medication data:', {
                    name: cachedMedications[0].nameRu,
                    forms: cachedMedications[0].forms,
                    formsType: typeof cachedMedications[0].forms,
                    formsIsArray: Array.isArray(cachedMedications[0].forms)
                });
            }
        } else {
            initializeData();
        }
    }, [cachedMedications, loadMedications]);

    // Синхронизируем локальное состояние с кешем (автоматическое обновление при изменении кеша)
    useEffect(() => {
        if (cachedMedications) {
            setMedications(cachedMedications);
        } else if (medications.length > 0) {
            // Кеш был инвалидирован - перезагружаем данные
            loadMedications(true).then(data => setMedications(data)).catch(err => {
                console.error('Failed to reload medications:', err);
            });
        }
    }, [cachedMedications, loadMedications, medications.length]);

    // Обновление при изменении избранного (кеш инвалидируется автоматически через dataEvents)
    const handleFavoriteToggle = async () => {
        // Данные обновятся автоматически через useEffect при изменении cachedMedications
    };

    const filteredMeds = medications.filter(m => {
        const matchesSearch = m.nameRu.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             m.activeSubstance.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             (m.atcCode || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesFavorite = !showFavoritesOnly || m.isFavorite;
        
        const matchesGroup = !selectedGroup || m.clinicalPharmGroup === selectedGroup;
        
        const matchesFormType = !selectedFormType || (() => {
            if (!selectedFormType) return true;
            const normalizedType = selectedFormType.toLowerCase();
            const normalizedLabel = getFormTypeLabel(selectedFormType).toLowerCase();

            if (Array.isArray(m.forms) && m.forms.length > 0) {
                const hasStructuredMatch = m.forms.some(form => {
                    if (!form) return false;
                    if (typeof form === 'string') {
                        const text = form.toLowerCase();
                        return text.includes(normalizedType) || text.includes(normalizedLabel);
                    }
                    if (typeof form.type === 'string') {
                        const text = form.type.toLowerCase();
                        return text.includes(normalizedType) || text.includes(normalizedLabel);
                    }
                    return false;
                });
                if (hasStructuredMatch) return true;
            }

            const descriptionText = (m.packageDescription || '').toLowerCase();
            return descriptionText.includes(normalizedType) || descriptionText.includes(normalizedLabel);
        })();
        
        return matchesSearch && matchesFavorite && matchesGroup && matchesFormType;
    });

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
                        onClick={() => navigate('/medications/new')}
                        className="h-12 px-6 rounded-xl shadow-lg shadow-primary-500/20"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Добавить препарат
                    </Button>
                </div>
            </div>

            {/* Search & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск по названию, веществу или АТХ-коду..."
                            className="pl-12 h-14 rounded-2xl bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800"
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
            </div>

            {/* Фильтры */}
            {medications.length > 0 && (
                <div className="space-y-4">
                    <PharmGroupFilter onGroupSelect={setSelectedGroup} />
                    <FormTypeFilter onFormTypeSelect={setSelectedFormType} />
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
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{medications.length}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Всего препаратов</span>
                </Card>
            </div>

            {/* Medications Grid */}
            {isLoadingMedications && medications.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-2xl" />
                    ))}
                </div>
            ) : filteredMeds.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMeds.map(med => (
                        <MedicationCard
                            key={med.id}
                            medication={med}
                            onSelect={(id) => navigate(`/medications/${id}`)}
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
                        {searchQuery ? 'Ничего не найдено' : 'Справочник пуст'}
                    </h3>
                    <p className="text-slate-500 max-w-sm">
                        {searchQuery
                            ? 'Попробуйте изменить запрос или добавьте новый препарат вручную'
                            : 'Начните с добавления первого препарата для автоматического расчета дозировок'
                        }
                    </p>
                </div>
            )}
        </div>
    );
};
