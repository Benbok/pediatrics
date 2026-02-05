import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Visit, getFullName } from '../../../types';
import { Calendar, User, Stethoscope, Trash2 } from 'lucide-react';

interface VisitCardProps {
    visit: Visit;
    onClick: (id: number) => void;
    onDelete?: (id: number) => void;
}

export const VisitCard: React.FC<VisitCardProps> = ({ visit, onClick, onDelete }) => {
    const formattedDate = new Date(visit.visitDate).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
        <Card
            className="p-4 hover:border-primary-500 transition-all cursor-pointer group"
            onClick={() => visit.id && onClick(visit.id)}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                        <Calendar className="w-4 h-4 text-primary-600" />
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{formattedDate}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={visit.status === 'completed' ? 'success' : 'warning'}>
                        {visit.status === 'completed' ? 'Завершен' : 'Черновик'}
                    </Badge>
                    {onDelete && visit.id && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(visit.id!);
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Удалить приём"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                    <Stethoscope className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-slate-600 dark:text-slate-400 line-clamp-2 italic">
                        "{visit.complaints}"
                    </p>
                </div>

                {visit.primaryDiagnosisId && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        <Badge variant="primary" size="sm" className="font-mono text-[10px]">
                            {(visit as any).primaryDiagnosis?.icd10Code || 'МКБ-10'}
                        </Badge>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                            {(visit as any).primaryDiagnosis?.nameRu}
                        </span>
                    </div>
                )}
            </div>

            <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <User className="w-3 h-3" />
                <span>{getFullName((visit as any).doctor) || 'Врач'}</span>
            </div>
        </Card>
    );
};
