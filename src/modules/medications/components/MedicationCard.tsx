import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Medication } from '../../../types';
import { ChevronRight, Pill, Factory, Beaker } from 'lucide-react';

interface MedicationCardProps {
    medication: Medication;
    onSelect: (id: number) => void;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({ medication, onSelect }) => {
    const indicationsSummary = Array.isArray(medication.indications)
        ? medication.indications.join(', ')
        : String(medication.indications || '');

    return (
        <Card
            className="p-4 hover:border-primary-500 transition-colors cursor-pointer group"
            onClick={() => medication.id && onSelect(medication.id)}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                            {medication.nameRu}
                        </h3>
                        {medication.atcCode && (
                            <Badge variant="default" className="text-[10px] font-mono uppercase">
                                {medication.atcCode}
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-1 text-sm text-slate-500 mb-2">
                        <Beaker className="w-3.5 h-3.5 text-primary-500" />
                        <span className="font-medium">{medication.activeSubstance}</span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-1 mb-3 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        {indicationsSummary || 'Показания не указаны'}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                        <div className="flex items-center gap-1">
                            <Factory className="w-3 h-3 text-slate-400" />
                            <span>{medication.manufacturer || 'Не указан'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2 ml-4 self-center">
                    <div className="p-2.5 bg-secondary-50 dark:bg-secondary-900/20 rounded-xl">
                        <Pill className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
                    </div>
                    <Button variant="ghost" size="sm" className="rounded-full p-2 h-8 w-8">
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary-500 transition-colors" />
                    </Button>
                </div>
            </div>
        </Card>
    );
};
