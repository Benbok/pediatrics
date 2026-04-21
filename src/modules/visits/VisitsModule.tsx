import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { visitService } from './services/visitService';
import { patientService } from '../../services/patient.service';
import { logger } from '../../services/logger';
import { Visit, ChildProfile } from '../../types';
import { VisitCard } from './components/VisitCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DatePicker } from '../../components/ui/DatePicker';
import { PatientModuleHeader } from '../../components/PatientModuleHeader';
import { useTabs } from '../../context/TabsContext';
import {
    Plus,
    Stethoscope,
    Calendar as CalendarIcon,
    AlertCircle,
} from 'lucide-react';

const normalizeVisitDate = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const normalized = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

export const VisitsModule: React.FC = () => {
    const { childId } = useParams<{ childId: string }>();
    const navigate = useNavigate();
    const { getVisitTabs, closeTab } = useTabs();

    const [visits, setVisits] = useState<Visit[]>([]);
    const [child, setChild] = useState<ChildProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [visitIdToDelete, setVisitIdToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (childId) {
            loadData();
        }
    }, [childId]);

    const loadData = async (): Promise<void> => {
        if (!childId) return;
        setIsLoading(true);
        try {
            const [visitsData, childData] = await Promise.all([
                visitService.getVisits(Number(childId)),
                patientService.getChildById(Number(childId))
            ]);
            setVisits(visitsData);
            setChild(childData ?? null);
            setError(null);
        } catch (err) {
            setError('Не удалось загрузить историю посещений');
            logger.error('[VisitsModule] Failed to load visits and child', { error: err, childId });
        } finally {
            setIsLoading(false);
        }
    };

    const filteredVisits = useMemo(() => {
        return visits.filter((visit) => {
            const visitDate = normalizeVisitDate(visit.visitDate);
            if (!visitDate) {
                return !dateFrom && !dateTo;
            }

            if (dateFrom && visitDate < dateFrom) {
                return false;
            }

            if (dateTo && visitDate > dateTo) {
                return false;
            }

            return true;
        });
    }, [visits, dateFrom, dateTo]);

    const hasDateFilter = Boolean(dateFrom || dateTo);

    const handleConfirmDelete = async (): Promise<void> => {
        if (visitIdToDelete == null || !childId) return;
        setIsDeleting(true);
        try {
            await visitService.deleteVisit(visitIdToDelete);
            const tabId = `visit-${childId}-${visitIdToDelete}`;
            const openTabs = getVisitTabs();
            if (openTabs.some(t => t.id === tabId)) closeTab(tabId);
            setVisitIdToDelete(null);
            await loadData();
        } catch (err) {
            setError('Не удалось удалить приём');
            setVisitIdToDelete(null);
            logger.error('[VisitsModule] Failed to delete visit', { error: err, visitId: visitIdToDelete });
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium">Загрузка приемов...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {child && (
                <PatientModuleHeader
                    child={child}
                    title="История приемов"
                    icon={<Stethoscope className="w-6 h-6 !text-white" strokeWidth={2.5} />}
                    iconBgClass="bg-primary-600"
                    iconShadowClass="shadow-primary-500/25"
                    onBack={() => navigate(`/patients/${childId}`)}
                    badge={
                        <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                            {visits.length} визитов
                        </span>
                    }
                    actions={
                        <Button
                            variant="primary"
                            onClick={() => navigate(`/patients/${childId}/visits/new`)}
                            className="h-10 px-4 rounded-xl shadow-lg shadow-primary-500/20"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Новый прием
                        </Button>
                    }
                />
            )}

            {/* Date Filter */}
            <div>
                <Card className="p-4 border-slate-100 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    <CalendarIcon className="w-4 h-4" />
                                    Дата с
                                </label>
                                <DatePicker
                                    value={dateFrom}
                                    max={dateTo || undefined}
                                    onChange={setDateFrom}
                                    placement="bottom"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    <CalendarIcon className="w-4 h-4" />
                                    Дата по
                                </label>
                                <DatePicker
                                    value={dateTo}
                                    min={dateFrom || undefined}
                                    onChange={setDateTo}
                                    placement="bottom"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 lg:pb-0.5">
                            <div className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                Показано: <span className="font-bold text-slate-700 dark:text-slate-200">{filteredVisits.length}</span>
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setDateFrom('');
                                    setDateTo('');
                                }}
                                disabled={!hasDateFilter}
                                className="rounded-xl"
                            >
                                Сбросить
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    <p className="font-bold">{error}</p>
                </div>
            )}

            {/* Visits List */}
            {filteredVisits.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredVisits.map(visit => (
                        <VisitCard
                            key={visit.id}
                            visit={visit}
                            onClick={(id) => navigate(`/patients/${childId}/visits/${id}`)}
                            onDelete={() => setVisitIdToDelete(visit.id!)}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900/50 rounded-[32px] border-2 border-dashed border-slate-100 dark:border-slate-800">
                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-full mb-4">
                        <CalendarIcon className="w-12 h-12 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
                        {hasDateFilter ? 'Приемы за выбранный период не найдены' : 'Приемов пока нет'}
                    </h3>
                    <p className="text-slate-500 max-w-xs mx-auto">
                        {hasDateFilter
                            ? 'Измените диапазон дат или сбросьте фильтр, чтобы увидеть другие приемы.'
                            : 'Начните первый прием, чтобы система CDSS помогла с подбором диагноза и терапии.'}
                    </p>
                    {hasDateFilter ? (
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setDateFrom('');
                                setDateTo('');
                            }}
                            className="mt-6 rounded-xl"
                        >
                            Сбросить фильтр
                        </Button>
                    ) : (
                        <Button
                            variant="secondary"
                            onClick={() => navigate(`/patients/${childId}/visits/new`)}
                            className="mt-6 rounded-xl"
                        >
                            Начать первый прием
                        </Button>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={visitIdToDelete != null}
                title="Удалить приём?"
                message="Приём будет удалён без возможности восстановления."
                confirmText="Удалить"
                cancelText="Отмена"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setVisitIdToDelete(null)}
            />
        </div>
    );
};