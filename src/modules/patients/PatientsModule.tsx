import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
    UserPlus,
    Search,
    Calendar,
    CalendarRange,
    Clock3,
    Users as UsersIcon,
    ChevronRight,
    X
} from 'lucide-react';
import { ChildProfile } from '../../types';
import { useChild } from '../../context/ChildContext';
import { patientService } from '../../services/patient.service';
import { logger } from '../../services/logger';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DatePicker } from '../../components/ui/DatePicker';

const normalizeIsoDate = (value?: string | Date | null): string | null => {
    if (!value) return null;

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return value.toISOString().slice(0, 10);
    }

    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

const formatCreatedAtLabel = (value?: string): string | null => {
    if (!value) return null;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(parsed);
};

export const PatientsModule: React.FC = () => {
    const navigate = useNavigate();
    const { setSelectedChild } = useChild();
    const [children, setChildren] = useState<ChildProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [createdFrom, setCreatedFrom] = useState('');
    const [createdTo, setCreatedTo] = useState('');

    useEffect(() => {
        loadChildren();
    }, []);

    const loadChildren = async (): Promise<void> => {
        try {
            const data = await patientService.getAllChildren();
            setChildren(data);
        } catch (error) {
            logger.error('[PatientsModule] Failed to load children', { error });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectPatient = (child: ChildProfile): void => {
        setSelectedChild(child);
        navigate(`/patients/${child.id}`);
    };

    const hasActiveFilters = Boolean(searchQuery.trim() || createdFrom || createdTo);

    const filteredChildren = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return children.filter((child) => {
            const fullName = `${child.surname} ${child.name} ${child.patronymic || ''}`.toLowerCase();
            if (normalizedQuery && !fullName.includes(normalizedQuery)) {
                return false;
            }

            const createdAtDate = normalizeIsoDate(child.createdAt);
            if (createdFrom && (!createdAtDate || createdAtDate < createdFrom)) {
                return false;
            }

            if (createdTo && (!createdAtDate || createdAtDate > createdTo)) {
                return false;
            }

            return true;
        });
    }, [children, searchQuery, createdFrom, createdTo]);

    const handleResetFilters = (): void => {
        setSearchQuery('');
        setCreatedFrom('');
        setCreatedTo('');
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Area */}
            <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-900/5 overflow-hidden">
                <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-100 dark:border-slate-800/50 gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="text-slate-700 border-slate-200 bg-slate-50 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200">
                            Реестр пациентов
                        </Badge>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <UsersIcon size={15} className="text-primary-600 dark:text-primary-400" />
                            Всего пациентов: <span className="font-black text-slate-900 dark:text-white">{children.length}</span>
                        </div>
                    </div>

                    <Button
                        onClick={() => navigate('/patients/new')}
                        className="h-10 px-5 rounded-xl shrink-0 border border-primary-600 bg-primary-600 text-white shadow-lg shadow-primary-500/20 hover:bg-primary-700 hover:border-primary-700 dark:border-primary-500 dark:bg-primary-500 dark:hover:bg-primary-400 dark:hover:border-primary-400"
                        leftIcon={<UserPlus size={18} strokeWidth={2.5} />}
                    >
                        Новый пациент
                    </Button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    <div className="flex items-center justify-between min-w-0 gap-4 flex-wrap">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-500/25 dark:bg-primary-500 dark:shadow-primary-900/20">
                                <UsersIcon size={24} />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                    Пациенты
                                </h1>
                                <p className="mt-0.5 text-sm font-medium text-slate-600 dark:text-slate-400 max-w-2xl">
                                    Картотека пациентов с поиском по ФИО и фильтром по дате создания карточки.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Фильтр по созданию
                                </span>
                            </div>
                            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
                            <div className="flex items-center gap-2">
                                <Clock3 className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Найдено: {filteredChildren.length}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(210px,0.72fr)_minmax(210px,0.72fr)_auto] xl:items-end">
                        <div className="flex h-full flex-col justify-end">
                            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                <Search size={16} className="text-slate-400" />
                                Поиск по ФИО
                            </label>
                            <Input
                                placeholder="Фамилия, имя или отчество..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                leftIcon={<Search size={18} className="text-slate-500" />}
                                rightIcon={searchQuery ? <X size={16} /> : undefined}
                                onRightIconClick={searchQuery ? () => setSearchQuery('') : undefined}
                                className="h-14 !rounded-2xl bg-white/90 dark:bg-slate-950/80"
                            />
                        </div>

                        <div className="flex h-full flex-col justify-end">
                            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                <CalendarRange size={16} className="text-slate-400" />
                                Карточка создана с
                            </label>
                            <DatePicker
                                value={createdFrom}
                                max={createdTo || undefined}
                                onChange={setCreatedFrom}
                                placement="bottom"
                                className="h-14 rounded-2xl bg-white/90 dark:bg-slate-950/80"
                            />
                        </div>

                        <div className="flex h-full flex-col justify-end">
                            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                <CalendarRange size={16} className="text-slate-400" />
                                Карточка создана по
                            </label>
                            <DatePicker
                                value={createdTo}
                                min={createdFrom || undefined}
                                onChange={setCreatedTo}
                                placement="bottom"
                                className="h-14 rounded-2xl bg-white/90 dark:bg-slate-950/80"
                            />
                        </div>

                        <div className="flex h-full flex-col justify-end gap-2 xl:items-end">
                            <Button
                                variant="ghost"
                                onClick={handleResetFilters}
                                disabled={!hasActiveFilters}
                                className="h-14 rounded-2xl px-4"
                            >
                                Сбросить фильтры
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Empty State */}
            {filteredChildren.length === 0 && (
                <Card className="flex flex-col items-center justify-center p-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-xl mb-6">
                        <UsersIcon size={40} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        {hasActiveFilters ? 'Пациенты не найдены' : 'Картотека пуста'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs mx-auto font-medium">
                        {hasActiveFilters
                            ? 'Измените поисковый запрос или диапазон дат создания карточки, чтобы расширить выборку.'
                            : 'Начните работу с добавления первого пациента в базу данных системы'
                        }
                    </p>
                    <Button
                        variant="secondary"
                        onClick={() => { hasActiveFilters ? handleResetFilters() : navigate('/patients/new'); }}
                    >
                        {hasActiveFilters ? 'Сбросить фильтры' : 'Завести первую карточку'}
                    </Button>
                </Card>
            )}

            {/* Patients Grid */}
            {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-2xl" />
                    ))}
                </div>
            ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredChildren.map((child, index) => (
                    <Card
                        key={child.id}
                        hoverable
                        onClick={() => handleSelectPatient(child)}
                        className="relative p-6 border-slate-200 dark:border-slate-800/50 group overflow-hidden flex flex-col transition-all duration-300 active:scale-[0.98] before:content-[''] before:absolute before:inset-0 before:rounded-xl before:border-2 before:border-primary-500/80 dark:before:border-primary-400/70 before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100 before:pointer-events-none"
                        style={{
                            animation: `slideIn 0.3s ease-out ${index * 0.05}s both`
                        }}
                    >
                        {/* Status Dots or Indicators could go here */}
                        <div className="flex items-start gap-5">
                            <div className={clsx(
                                "w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
                                child.gender === 'male'
                                    ? "bg-blue-600 text-white shadow-blue-500/30"
                                    : "bg-rose-500 text-white shadow-rose-500/30"
                            )}>
                                {child.surname.charAt(0)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-black text-slate-900 dark:text-white text-xl truncate leading-tight mb-1">
                                    {child.surname} {child.name}
                                </h3>
                                <div className="text-sm font-bold text-primary-600 dark:text-primary-400 mb-4">
                                    {patientService.getAgeLabel(child.birthDate)}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[13px] font-bold text-slate-500 dark:text-slate-400">
                                        <Calendar size={14} className="opacity-70" />
                                        {new Date(child.birthDate).toLocaleDateString('ru-RU')}
                                    </div>
                                    {formatCreatedAtLabel(child.createdAt) && (
                                        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-400 dark:text-slate-500">
                                            <Clock3 size={14} className="opacity-70" />
                                            Дата создания: {formatCreatedAtLabel(child.createdAt)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="self-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover:bg-primary-600 group-hover:text-white transition-all text-slate-400">
                                <ChevronRight size={20} strokeWidth={3} />
                            </div>
                        </div>

                        {/* Hover Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </Card>
                ))}
            </div>
            )}
        </div>
    );
};
