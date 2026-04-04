import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { diseaseService } from './services/diseaseService';
import { useDataCache } from '../../context/DataCacheContext';
import { Disease } from '../../types';
import { DiseaseCard } from './components/DiseaseCard';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Search, Plus, Filter, BookOpen, AlertCircle, Loader2 } from 'lucide-react';

export const DiseasesModule: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { diseases: cachedDiseases, loadDiseases, invalidate, isLoadingDiseases } = useDataCache();
    const [diseases, setDiseases] = useState<Disease[]>([]);
    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; diseaseId: number | null; diseaseName: string }>({
        isOpen: false,
        diseaseId: null,
        diseaseName: ''
    });

    useEffect(() => {
        // Загружаем данные из кеша или делаем запрос
        const initializeData = async () => {
            try {
                const data = await loadDiseases();
                setDiseases(data);
                setError(null);
            } catch (err) {
                setError('Не удалось загрузить базу заболеваний');
                console.error(err);
            }
        };

        // Если данные уже в кеше - используем их, иначе загружаем
        if (cachedDiseases) {
            setDiseases(cachedDiseases);
        } else {
            initializeData();
        }
    }, [cachedDiseases, loadDiseases]);

    // Синхронизируем поиск в URL
    useEffect(() => {
        const params: Record<string, string> = {};
        if (searchQuery) params.q = searchQuery;
        setSearchParams(params, { replace: true });
    }, [searchQuery]);

    // Синхронизируем локальное состояние с кешем
    useEffect(() => {
        if (cachedDiseases) {
            setDiseases(cachedDiseases);
        }
    }, [cachedDiseases]);

    const handleDeleteDisease = (id: number) => {
        const disease = diseases.find(d => d.id === id);
        if (!disease) return;
        setDeleteConfirm({ isOpen: true, diseaseId: id, diseaseName: disease.nameRu });
    };

    const handleDeleteConfirm = async () => {
        const id = deleteConfirm.diseaseId;
        if (!id) return;

        setDeleteConfirm({ isOpen: false, diseaseId: null, diseaseName: '' });

        // Оптимистичное обновление - удаляем из UI сразу
        const originalDiseases = [...diseases];
        setDiseases(prev => prev.filter(d => d.id !== id));

        try {
            const success = await diseaseService.deleteDisease(id);
            if (success) {
                // Инвалидируем кеш для обновления данных
                invalidate('diseases');
                // Перезагружаем данные из кеша (backend уже инвалидировал кеш)
                const freshData = await loadDiseases(true);
                setDiseases(freshData);
            } else {
                // Откат при ошибке
                setDiseases(originalDiseases);
                setError('Не удалось удалить заболевание');
            }
        } catch (err: any) {
            // Откат при ошибке
            setDiseases(originalDiseases);
                setError(err.message || 'Ошибка при удалении');
            console.error(err);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteConfirm({ isOpen: false, diseaseId: null, diseaseName: '' });
    };

    const filteredDiseases = diseases.filter(d =>
        d.nameRu.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.icd10Code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.symptoms || []).some(s => {
            const text = typeof s === 'object' && s !== null && 'text' in s ? (s as { text: string }).text : String(s);
            return text.toLowerCase().includes(searchQuery.toLowerCase());
        })
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/50 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-2xl">
                        <BookOpen className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            База знаний CDSS
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            Справочник заболеваний и клинических рекомендаций МКБ-10
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="primary"
                        onClick={() => navigate('/diseases/new')}
                        className="h-12 px-6 rounded-xl shadow-lg shadow-primary-500/20"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Добавить диагноз
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
                            placeholder="Поиск по названию, коду МКБ или симптомам..."
                            className="pl-12 h-14 rounded-2xl bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800"
                        />
                    </div>
                </div>
                <Button
                    variant="secondary"
                    className="h-14 rounded-2xl font-bold border-slate-200 dark:border-slate-800"
                >
                    <Filter className="w-5 h-5 mr-2" />
                    Фильтры
                </Button>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {/* Diseases Grid */}
            {isLoadingDiseases && diseases.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-2xl" />
                    ))}
                </div>
            ) : filteredDiseases.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDiseases.map(disease => (
                        <DiseaseCard
                            key={disease.id}
                            disease={disease}
                            onSelect={(id) => navigate(`/diseases/${id}`)}
                            onDelete={handleDeleteDisease}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                        <BookOpen className="w-12 h-12 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                        {searchQuery ? 'Ничего не найдено' : 'База знаний пуста'}
                    </h3>
                    <p className="text-slate-500 max-w-sm">
                        {searchQuery
                            ? 'Попробуйте изменить запрос или добавьте новое заболевание вручную'
                            : 'Начните с добавления первого заболевания или загрузки клинических рекомендаций'
                        }
                    </p>
                </div>
            )}

            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Удаление заболевания"
                message={`Вы уверены, что хотите удалить заболевание "${deleteConfirm.diseaseName}"?\n\nЭто действие нельзя отменить.`}
                confirmText="Удалить"
                cancelText="Отмена"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />
        </div>
    );
};
