import React from 'react';
import { Input } from '../../../../components/ui/Input';
import { AutoResizeTextarea } from '../../../../components/ui/AutoResizeTextarea';
import { Bug } from 'lucide-react';
import { InfectiousDiseasesData } from '../../../../types';

interface InfectiousDiseasesSectionProps {
    data: InfectiousDiseasesData | null;
    onChange: (data: InfectiousDiseasesData) => void;
}

export const InfectiousDiseasesSection: React.FC<InfectiousDiseasesSectionProps> = ({ data, onChange }) => {
    const infectiousData: InfectiousDiseasesData = data || {};

    const parseBoundedAgeValue = (rawValue: string, maxValue: number): number | null => {
        const sanitizedValue = rawValue.replace(/\D/g, '').slice(0, 2);
        if (!sanitizedValue) return null;

        return Math.min(parseInt(sanitizedValue, 10), maxValue);
    };

    const handleDiseaseChange = (diseaseName: string, had: boolean) => {
        const current = infectiousData[diseaseName as keyof InfectiousDiseasesData] as any;
        onChange({
            ...infectiousData,
            [diseaseName]: {
                ...current,
                had,
                ageYears: had ? (current?.ageYears || null) : null,
            },
        });
    };

    const handleAgeYearsChange = (diseaseName: string, ageYears: number | null) => {
        const current = infectiousData[diseaseName as keyof InfectiousDiseasesData] as any;
        onChange({
            ...infectiousData,
            [diseaseName]: {
                ...current,
                had: current?.had || false,
                ageYears: ageYears !== null && !isNaN(ageYears) ? ageYears : null,
            },
        });
    };

    const handleAgeMonthsChange = (diseaseName: string, ageMonths: number | null) => {
        const current = infectiousData[diseaseName as keyof InfectiousDiseasesData] as any;
        onChange({
            ...infectiousData,
            [diseaseName]: {
                ...current,
                had: current?.had || false,
                ageMonths: ageMonths !== null && !isNaN(ageMonths) ? ageMonths : null,
            },
        });
    };

    const handleTonsillitisChange = (had: boolean) => {
        const current = infectiousData.tonsillitis;
        onChange({
            ...infectiousData,
            tonsillitis: {
                had,
                perYear: had ? (current?.perYear || null) : null,
            },
        });
    };

    const handleTonsillitisPerYearChange = (perYear: number | null) => {
        onChange({
            ...infectiousData,
            tonsillitis: {
                had: infectiousData.tonsillitis?.had || false,
                perYear: perYear || null,
            },
        });
    };

    const handleOtherChange = (value: string) => {
        onChange({
            ...infectiousData,
            other: value || null,
        });
    };

    const diseases = [
        { key: 'measles', label: 'Корь' },
        { key: 'chickenpox', label: 'Ветряная оспа' },
        { key: 'rubella', label: 'Краснуха' },
        { key: 'pertussis', label: 'Коклюш' },
        { key: 'scarletFever', label: 'Скарлатина' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
                <Bug className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Перенесенные инфекционные заболевания
                </h4>
            </div>

            <div className="space-y-3">
                {diseases.map((disease) => {
                    const diseaseData = infectiousData[disease.key as keyof InfectiousDiseasesData] as any;
                    const had = diseaseData?.had || false;

                    return (
                        <div key={disease.key} className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                            <label className="flex items-center gap-2 flex-1 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={had}
                                    onChange={(e) => handleDiseaseChange(disease.key, e.target.checked)}
                                    className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">{disease.label}</span>
                            </label>
                            {had && (
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-slate-500 dark:text-slate-400">Лет (0–18)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={2}
                                            value={diseaseData?.ageYears?.toString() ?? ''}
                                            onChange={(e) => {
                                                const val = parseBoundedAgeValue(e.target.value, 18);
                                                handleAgeYearsChange(disease.key, val);
                                            }}
                                            min={0}
                                            max={18}
                                            className={`w-20 px-2 py-1.5 rounded-xl border text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                                                diseaseData?.ageYears != null && (diseaseData.ageYears < 0 || diseaseData.ageYears > 18)
                                                    ? 'border-red-400 dark:border-red-500'
                                                    : 'border-slate-200 dark:border-slate-700'
                                            }`}
                                            placeholder="—"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-slate-500 dark:text-slate-400">Мес. (0–11)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={2}
                                            value={diseaseData?.ageMonths?.toString() ?? ''}
                                            onChange={(e) => {
                                                const val = parseBoundedAgeValue(e.target.value, 11);
                                                handleAgeMonthsChange(disease.key, val);
                                            }}
                                            min={0}
                                            max={11}
                                            className={`w-20 px-2 py-1.5 rounded-xl border text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                                                diseaseData?.ageMonths != null && (diseaseData.ageMonths < 0 || diseaseData.ageMonths > 11)
                                                    ? 'border-red-400 dark:border-red-500'
                                                    : 'border-slate-200 dark:border-slate-700'
                                            }`}
                                            placeholder="—"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={infectiousData.tonsillitis?.had || false}
                            onChange={(e) => handleTonsillitisChange(e.target.checked)}
                            className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Ангина</span>
                    </label>
                    {infectiousData.tonsillitis?.had && (
                        <div className="w-32">
                            <Input
                                type="number"
                                value={infectiousData.tonsillitis?.perYear?.toString() || ''}
                                onChange={(e) => handleTonsillitisPerYearChange(e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="Кол-во в год"
                                min={0}
                                max={50}
                                className="w-full"
                            />
                        </div>
                    )}
                </div>

                <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Прочие
                    </label>
                    <AutoResizeTextarea
                        value={infectiousData.other || ''}
                        onChange={(e) => handleOtherChange(e.target.value)}
                        placeholder="Другие перенесенные инфекционные заболевания..."
                        rows={3}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm text-slate-800 dark:text-white"
                    />
                </div>
            </div>
        </div>
    );
};
