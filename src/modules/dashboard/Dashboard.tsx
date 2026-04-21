import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Calendar, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, RefreshCw, StickyNote, Check, Loader2, RotateCcw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { dashboardService } from '../../services/dashboard.service';
import { logger } from '../../services/logger';
import { DashboardSummary, DashboardVisitAnalytics, DashboardVisitAnalyticsPatientItem, DashboardVisitItem } from '../../types';
import { getFormattedAge } from '../../utils/ageUtils';
import { useAuth } from '../../context/AuthContext';

// ─── Helpers ───────────────────────────────────────────────────────────────

function getInitials(name: string, surname: string): string {
    return `${surname.charAt(0)}${name.charAt(0)}`.toUpperCase();
}

const AVATAR_COLORS = [
    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
    'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
];

function avatarColor(childId: number): string {
    return AVATAR_COLORS[childId % AVATAR_COLORS.length];
}

function truncate(text: string | null | undefined, max = 60): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

function formatDisplayDate(date: string): string {
    return new Date(date).toLocaleDateString('ru-RU');
}

function toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCurrentMonthRange(): { dateFrom: string; dateTo: string } {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
        dateFrom: toIsoDate(monthStart),
        dateTo: toIsoDate(now),
    };
}

const ANALYTICS_PAGE_SIZE = 10;

// ─── Sub-components ────────────────────────────────────────────────────────

const StatCard: React.FC<{
    label: string;
    value: number | string;
    icon: React.ElementType;
    iconClass: string;
    loading: boolean;
}> = ({ label, value, icon: Icon, iconClass, loading }) => (
    <Card className="hover:shadow-lg transition-shadow duration-300 overflow-hidden">
        <div className="flex items-center justify-between">
            <div className={`p-3 rounded-xl ${iconClass}`}>
                <Icon size={24} strokeWidth={2} />
            </div>
            {loading ? (
                <div className="h-8 w-12 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
            ) : (
                <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {value}
                </span>
            )}
        </div>
        <h3 className="text-slate-500 dark:text-slate-400 font-semibold mt-4 text-sm uppercase tracking-wider">
            {label}
        </h3>
    </Card>
);

const VISIT_TYPE_LABELS: Record<string, string> = {
    'primary': 'Первичный',
    'followup': 'Повторный',
    'consultation': 'Консультация',
    'emergency': 'Экстренный',
    'urgent': 'Неотложный',
};

const VisitRow: React.FC<{ visit: DashboardVisitItem; index: number }> = ({ visit, index }) => {
    const child = visit.child;
    const [isNotesOpen, setIsNotesOpen] = useState(false);
    const [notes, setNotes] = useState(visit.notes || '');
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Decryption safety: if name/surname still look encrypted (contain :), show "Пациент"
    const isNameEncrypted = (child?.name || '').includes(':') || (child?.surname || '').includes(':');
    const fullName = child && !isNameEncrypted ? `${child.surname} ${child.name}` : 'Пациент';

    let age = '';
    try {
        if (child?.birthDate && !child.birthDate.startsWith('[') && child.birthDate.includes('-') && !child.birthDate.includes(':')) {
            age = getFormattedAge(child.birthDate, new Date(), 'short');
        }
    } catch (e) {
        console.warn('Failed to calculate age for dashboard:', e);
    }

    const initials = child && !isNameEncrypted
        ? getInitials(child.name, child.surname)
        : '?';

    const color = child ? avatarColor(child.id) : AVATAR_COLORS[0];
    const visitTypeLabel = visit.visitType ? VISIT_TYPE_LABELS[visit.visitType] || visit.visitType : null;

    const handleSaveNotes = async () => {
        if (!hasUnsavedChanges) return;
        setIsSaving(true);
        try {
            await dashboardService.updateNotes(visit.id, notes);
            setHasUnsavedChanges(false);
        } catch (err) {
            console.error('Failed to save notes:', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="border-b last:border-0 dark:border-slate-800">
            <div className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <Link
                    to={`/patients/${visit.childId}/visits/${visit.id}`}
                    className="flex items-center gap-4 flex-1 min-w-0"
                    aria-label={`Перейти к приёму: ${fullName}`}
                >
                    {/* Avatar */}
                    <div
                        className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-base shadow-sm group-hover:scale-105 transition-transform ${color}`}
                        aria-hidden="true"
                    >
                        {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {fullName}
                            </p>
                            {age && (
                                <span className="text-slate-400 dark:text-slate-500 font-normal text-sm lowercase">
                                    ({age})
                                </span>
                            )}
                            {visitTypeLabel && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-normal bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                                    {visitTypeLabel}
                                </Badge>
                            )}
                        </div>
                        {visit.primaryDiagnosis?.nameRu && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {visit.primaryDiagnosis.nameRu}
                            </p>
                        )}
                    </div>
                </Link>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            setIsNotesOpen(!isNotesOpen);
                        }}
                        className={`p-2 rounded-lg transition-colors ${isNotesOpen || notes
                            ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        title="Заметки"
                    >
                        <StickyNote size={18} />
                    </button>

                    <div className="flex items-center gap-2">
                        {visit.visitTime && (
                            <Badge variant="default" className="font-mono text-xs tabular-nums">
                                {visit.visitTime}
                            </Badge>
                        )}
                        <Link to={`/patients/${visit.childId}/visits/${visit.id}`}>
                            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary-500 transition-colors" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Notes Section */}
            {isNotesOpen && (
                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="relative">
                        <textarea
                            value={notes}
                            onChange={(e) => {
                                setNotes(e.target.value);
                                setHasUnsavedChanges(true);
                            }}
                            onBlur={handleSaveNotes}
                            placeholder="Введите заметку к приёму..."
                            className="w-full min-h-[80px] p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none dark:text-slate-200"
                        />
                        <div className="absolute bottom-3 right-3 flex items-center gap-2">
                            {isSaving ? (
                                <Loader2 size={14} className="animate-spin text-primary-500" />
                            ) : hasUnsavedChanges ? (
                                <span className="text-[10px] text-slate-400">Не сохранено</span>
                            ) : notes ? (
                                <Check size={14} className="text-green-500" />
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SkeletonRow: React.FC = () => (
    <div className="flex items-center gap-4 p-4">
        <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
            <div className="h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse w-2/5" />
            <div className="h-3 rounded bg-slate-200 dark:bg-slate-700 animate-pulse w-3/5" />
        </div>
        <div className="h-5 w-12 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
    </div>
);

const AnalyticsPatientRow: React.FC<{ patient: DashboardVisitAnalyticsPatientItem }> = ({ patient }) => {
    const child = patient.child;
    const fullName = child ? `${child.surname} ${child.name}` : 'Пациент';
    const age = child?.birthDate ? getFormattedAge(child.birthDate, new Date(), 'short') : '';
    const visitLink = `/patients/${patient.childId}/visits/${patient.lastVisitId}`;

    return (
        <Link
            to={visitLink}
            className="-mx-4 px-4 flex items-center justify-between gap-4 py-3 border-b last:border-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
            aria-label={`Перейти к приёму пациента ${fullName}`}
        >
            <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-white truncate">{fullName}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                    {age ? `${age} · ` : ''}
                    Последний приём: {formatDisplayDate(patient.lastVisitDate)}
                    {patient.lastVisitTime ? ` · ${patient.lastVisitTime}` : ''}
                </p>
            </div>
            <Badge variant="outline" className="tabular-nums shrink-0">
                {patient.visitsCount} {patient.visitsCount === 1 ? 'приём' : patient.visitsCount < 5 ? 'приёма' : 'приёмов'}
            </Badge>
        </Link>
    );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const defaultAnalyticsRange = useMemo(() => getCurrentMonthRange(), []);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [analytics, setAnalytics] = useState<DashboardVisitAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [analyticsError, setAnalyticsError] = useState<string | null>(null);
    const [analyticsPage, setAnalyticsPage] = useState(1);
    const [dateFrom, setDateFrom] = useState(defaultAnalyticsRange.dateFrom);
    const [dateTo, setDateTo] = useState(defaultAnalyticsRange.dateTo);

    const todayLabel = new Date().toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await dashboardService.getSummary();
            setSummary(data);
        } catch (err: any) {
            setError(err?.message ?? 'Не удалось загрузить данные дашборда');
        } finally {
            setLoading(false);
        }
    };

    const loadAnalytics = async (range: { dateFrom: string; dateTo: string }) => {
        setAnalyticsLoading(true);
        setAnalyticsError(null);
        try {
            const data = await dashboardService.getVisitAnalytics(range);
            setAnalytics(data);
        } catch (err: any) {
            logger.error('[Dashboard] Failed to load visit analytics', { error: err, range });
            setAnalyticsError(err?.message ?? 'Не удалось загрузить аналитику по приёмам');
        } finally {
            setAnalyticsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        loadAnalytics({ dateFrom, dateTo });
    }, [dateFrom, dateTo]);

    useEffect(() => {
        setAnalyticsPage(1);
    }, [dateFrom, dateTo]);

    const doctorGreeting = currentUser
        ? `${currentUser.lastName} ${currentUser.firstName}`.trim()
        : '';

    const analyticsPeriodLabel = useMemo(() => {
        if (!analytics) {
            return `${formatDisplayDate(dateFrom)} - ${formatDisplayDate(dateTo)}`;
        }

        return `${formatDisplayDate(analytics.dateFrom)} - ${formatDisplayDate(analytics.dateTo)}`;
    }, [analytics, dateFrom, dateTo]);

    const resetAnalyticsFilters = () => {
        setDateFrom(defaultAnalyticsRange.dateFrom);
        setDateTo(defaultAnalyticsRange.dateTo);
    };

    const analyticsTotalPages = useMemo(() => {
        const totalPatients = analytics?.patients.length ?? 0;
        return Math.max(1, Math.ceil(totalPatients / ANALYTICS_PAGE_SIZE));
    }, [analytics]);

    useEffect(() => {
        setAnalyticsPage((prevPage) => Math.min(prevPage, analyticsTotalPages));
    }, [analyticsTotalPages]);

    const paginatedAnalyticsPatients = useMemo(() => {
        if (!analytics) {
            return [];
        }

        const startIndex = (analyticsPage - 1) * ANALYTICS_PAGE_SIZE;
        return analytics.patients.slice(startIndex, startIndex + ANALYTICS_PAGE_SIZE);
    }, [analytics, analyticsPage]);

    const analyticsRangeStart = analytics
        ? Math.min((analyticsPage - 1) * ANALYTICS_PAGE_SIZE + 1, analytics.patients.length)
        : 0;

    const analyticsRangeEnd = analytics
        ? Math.min(analyticsPage * ANALYTICS_PAGE_SIZE, analytics.patients.length)
        : 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Рабочий стол
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 capitalize">
                        {todayLabel}
                        {doctorGreeting ? ` · ${doctorGreeting}` : ''}
                    </p>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={load}
                    disabled={loading}
                    aria-label="Обновить данные"
                    className="self-start md:self-auto"
                >
                    <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    Обновить
                </Button>
            </header>

            {/* Error banner */}
            {error && (
                <div
                    role="alert"
                    className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-400"
                >
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={load}
                        className="ml-auto text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                        Повторить
                    </Button>
                </div>
            )}

            {/* Stat cards */}
            <section
                aria-label="Сводная статистика"
                className="grid grid-cols-1 sm:grid-cols-3 gap-6"
            >
                <StatCard
                    label="Пациенты сегодня"
                    value={summary?.patientsTodayCount ?? 0}
                    icon={Users}
                    iconClass="bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"
                    loading={loading}
                />
                <StatCard
                    label="Приёмы сегодня"
                    value={summary?.visitsTodayCount ?? 0}
                    icon={Calendar}
                    iconClass="bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400"
                    loading={loading}
                />
                <StatCard
                    label="Приёмы за неделю"
                    value={summary?.weeklyVisitsCount ?? 0}
                    icon={TrendingUp}
                    iconClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
                    loading={loading}
                />
            </section>

            <section aria-label="Статистика приёмов за период">
                <Card className="shadow-sm">
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-primary-600" />
                                    Статистика за период
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    {analyticsPeriodLabel}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,180px)_minmax(0,180px)_auto] gap-3 w-full lg:w-auto">
                                <DatePicker
                                    value={dateFrom}
                                    onChange={setDateFrom}
                                    max={dateTo}
                                    label="С"
                                    className="min-w-0"
                                />
                                <DatePicker
                                    value={dateTo}
                                    onChange={setDateTo}
                                    min={dateFrom}
                                    max={toIsoDate(new Date())}
                                    label="По"
                                    className="min-w-0"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetAnalyticsFilters}
                                    className="self-end h-11"
                                >
                                    <RotateCcw className="w-4 h-4 mr-1.5" />
                                    Сбросить фильтры
                                </Button>
                            </div>
                        </div>

                        {analyticsError && (
                            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                                {analyticsError}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Всего приёмов</p>
                                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                                    {analyticsLoading ? '...' : analytics?.totalVisitsCount ?? 0}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Уникальных пациентов</p>
                                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                                    {analyticsLoading ? '...' : analytics?.uniquePatientsCount ?? 0}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Завершённых</p>
                                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                                    {analyticsLoading ? '...' : analytics?.completedVisitsCount ?? 0}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Черновиков</p>
                                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                                    {analyticsLoading ? '...' : analytics?.draftVisitsCount ?? 0}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b dark:border-slate-800">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Пациенты за выбранный период</h3>
                                {!analyticsLoading && analytics && analytics.patients.length > 0 && (
                                    <Badge variant="primary" className="tabular-nums">
                                        {analytics.patients.length}
                                    </Badge>
                                )}
                            </div>

                            <div className="px-4">
                                {analyticsLoading && (
                                    <div className="py-6 space-y-3" aria-busy="true" aria-label="Загрузка статистики за период">
                                        {[...Array(3)].map((_, index) => (
                                            <div key={index} className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                                        ))}
                                    </div>
                                )}

                                {!analyticsLoading && !analyticsError && analytics && analytics.patients.length === 0 && (
                                    <div className="py-8 text-center">
                                        <Users className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                        <p className="font-medium text-slate-500 dark:text-slate-400">За выбранный период приёмов нет</p>
                                    </div>
                                )}

                                {!analyticsLoading && analytics && analytics.patients.length > 0 && (
                                    <div>
                                        {paginatedAnalyticsPatients.map((patient) => (
                                            <AnalyticsPatientRow key={patient.childId} patient={patient} />
                                        ))}
                                    </div>
                                )}

                                {!analyticsLoading && analytics && analytics.patients.length > ANALYTICS_PAGE_SIZE && (
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Показано {analyticsRangeStart}-{analyticsRangeEnd} из {analytics.patients.length}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setAnalyticsPage((prevPage) => Math.max(1, prevPage - 1))}
                                                disabled={analyticsPage === 1}
                                            >
                                                <ChevronLeft className="w-4 h-4 mr-1" />
                                                Назад
                                            </Button>
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 px-2">
                                                Страница {analyticsPage} / {analyticsTotalPages}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setAnalyticsPage((prevPage) => Math.min(analyticsTotalPages, prevPage + 1))}
                                                disabled={analyticsPage === analyticsTotalPages}
                                            >
                                                Вперёд
                                                <ChevronRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            </section>

            {/* Today's appointments */}
            <section aria-label="Приёмы на сегодня">
                <Card className="shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary-600" />
                            Приёмы на сегодня
                        </h2>
                        {summary && summary.visitsTodayCount > 0 && (
                            <Badge variant="primary" className="tabular-nums">
                                {summary.visitsTodayCount}
                            </Badge>
                        )}
                    </div>

                    {/* Loading skeleton */}
                    {loading && (
                        <div aria-busy="true" aria-label="Загрузка приёмов">
                            {[...Array(3)].map((_, i) => (
                                <SkeletonRow key={i} />
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !error && (summary?.visitsToday.length ?? 0) === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium">
                                Приёмов на сегодня нет
                            </p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                Перейдите к пациенту, чтобы добавить приём
                            </p>
                        </div>
                    )}

                    {/* Visit rows */}
                    {!loading && summary && summary.visitsToday.length > 0 && (
                        <div className="divide-y divide-slate-50 dark:divide-slate-800/60 -mx-1">
                            {summary.visitsToday.map((visit, index) => (
                                <VisitRow key={visit.id} visit={visit} index={index} />
                            ))}
                        </div>
                    )}
                </Card>
            </section>
        </div>
    );
};
