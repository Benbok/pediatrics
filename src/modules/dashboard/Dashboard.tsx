import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Calendar, TrendingUp, AlertCircle, ChevronRight, RefreshCw, StickyNote, Check, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { dashboardService } from '../../services/dashboard.service';
import { DashboardSummary, DashboardVisitItem } from '../../types';
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

// ─── Main Component ─────────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => {
        load();
    }, []);

    const doctorGreeting = currentUser
        ? `${currentUser.lastName} ${currentUser.firstName}`.trim()
        : '';

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
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
