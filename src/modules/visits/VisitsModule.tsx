import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { visitService } from './services/visitService';
import { Visit, ChildProfile } from '../../types';
import { VisitCard } from './components/VisitCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
    Plus,
    ChevronLeft,
    Search,
    Stethoscope,
    Calendar as CalendarIcon,
    AlertCircle,
    Clock
} from 'lucide-react';

export const VisitsModule: React.FC = () => {
    const { childId } = useParams<{ childId: string }>();
    const navigate = useNavigate();

    const [visits, setVisits] = useState<Visit[]>([]);
    const [child, setChild] = useState<ChildProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (childId) {
            loadData();
        }
    }, [childId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [visitsData, childData] = await Promise.all([
                visitService.getVisits(Number(childId)),
                window.electronAPI.getChild(Number(childId))
            ]);
            setVisits(visitsData);
            setChild(childData);
            setError(null);
        } catch (err) {
            setError('Не удалось загрузить историю посещений');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredVisits = visits.filter(v =>
        v.complaints.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v as any).primaryDiagnosis?.nameRu?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium">Загрузка приемов...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate(`/patients/${childId}`)} className="rounded-xl">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Stethoscope className="w-7 h-7 text-primary-600" />
                            История приемов
                        </h1>
                        <p className="text-slate-500 font-medium">
                            {child?.name} {child?.surname}
                        </p>
                    </div>
                </div>
                <Button
                    variant="primary"
                    onClick={() => navigate(`/patients/${childId}/visits/new`)}
                    className="h-12 px-6 rounded-xl shadow-lg shadow-primary-500/20"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Новый прием
                </Button>
            </div>

            {/* Stats & Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-4 flex items-center gap-4 border-slate-100 shadow-sm">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                        <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{visits.length}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Всего визитов</div>
                    </div>
                </Card>

                <div className="md:col-span-2 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск по жалобам или диагнозу..."
                        className="w-full h-14 pl-12 pr-4 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm"
                    />
                </div>
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
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900/50 rounded-[32px] border-2 border-dashed border-slate-100 dark:border-slate-800">
                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-full mb-4">
                        <CalendarIcon className="w-12 h-12 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Приемов пока нет</h3>
                    <p className="text-slate-500 max-w-xs mx-auto">
                        Начните первый прием, чтобы система CDSS помогла с подбором диагноза и терапии.
                    </p>
                    <Button
                        variant="secondary"
                        onClick={() => navigate(`/patients/${childId}/visits/new`)}
                        className="mt-6 rounded-xl"
                    >
                        Начать первый прием
                    </Button>
                </div>
            )}
        </div>
    );
};
