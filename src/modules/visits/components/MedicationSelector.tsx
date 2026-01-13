import React from 'react';
import { Medication, MedicationRecommendation } from '../../../types';
import { Pill, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';

interface MedicationSelectorProps {
    medications: MedicationRecommendation[];
    selectedIds: number[];
    onSelect: (medicationId: number) => void;
}

export const MedicationSelector: React.FC<MedicationSelectorProps> = ({
    medications,
    selectedIds,
    onSelect
}) => {
    if (medications.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                <Pill className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Препараты не найдены</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {medications.map((rec) => {
                const isSelected = selectedIds.includes(rec.medication.id!);
                const canUse = rec.canUse && rec.recommendedDose?.canUse !== false;

                return (
                    <Card
                        key={rec.medication.id}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                            isSelected
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20 shadow-lg'
                                : 'border-slate-100 dark:border-slate-800 hover:border-primary-300'
                        } ${!canUse ? 'opacity-60' : ''}`}
                        onClick={() => canUse && onSelect(rec.medication.id!)}
                    >
                        <div className="flex items-start gap-3">
                            <div className="mt-1">
                                {isSelected ? (
                                    <CheckCircle2 className="w-5 h-5 text-primary-600" />
                                ) : (
                                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="font-bold text-slate-800 dark:text-white truncate">
                                        {rec.medication.nameRu}
                                    </div>
                                    {rec.priority && rec.priority <= 2 && (
                                        <Badge variant="primary" size="sm" className="text-[10px]">
                                            Приоритет {rec.priority}
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 mb-2">
                                    {rec.medication.activeSubstance}
                                </div>

                                {rec.recommendedDose && canUse && (
                                    <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg mb-2">
                                        <div className="font-semibold mb-1">Рекомендуемая дозировка:</div>
                                        <div className="text-slate-600 dark:text-slate-400">
                                            {rec.recommendedDose.instruction}
                                        </div>
                                        {rec.recommendedDose.singleDoseMg && (
                                            <div className="text-xs text-slate-500 mt-2">
                                                Разовая доза: <strong>{rec.recommendedDose.singleDoseMg} мг</strong>
                                                {rec.recommendedDose.timesPerDay && (
                                                    <> × <strong>{rec.recommendedDose.timesPerDay}</strong> раз в день</>
                                                )}
                                                {rec.recommendedDose.dailyDoseMg && (
                                                    <> (суточная: <strong>{rec.recommendedDose.dailyDoseMg} мг</strong>)</>
                                                )}
                                            </div>
                                        )}
                                        {rec.duration && (
                                            <div className="text-xs text-slate-500 mt-1">
                                                Длительность: {rec.duration}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {rec.warnings && rec.warnings.length > 0 && (
                                    <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg">
                                        <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                                        <div className="text-xs text-yellow-700 dark:text-yellow-300">
                                            {rec.warnings.join(', ')}
                                        </div>
                                    </div>
                                )}

                                {!canUse && (
                                    <div className="flex items-start gap-2 mt-2 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg">
                                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                        <div className="text-xs text-red-700 dark:text-red-300">
                                            {rec.recommendedDose?.message || 'Препарат не рекомендуется для данного пациента'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};
