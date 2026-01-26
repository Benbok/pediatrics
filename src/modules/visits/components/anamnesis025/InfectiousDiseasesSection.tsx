import React from 'react';
import { Input } from '../../../../components/ui/Input';
import { Bug } from 'lucide-react';
import { InfectiousDiseasesData } from '../../../../types';

interface InfectiousDiseasesSectionProps {
    data: InfectiousDiseasesData | null;
    onChange: (data: InfectiousDiseasesData) => void;
}

export const InfectiousDiseasesSection: React.FC<InfectiousDiseasesSectionProps> = ({ data, onChange }) => {
    const infectiousData: InfectiousDiseasesData = data || {};

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

    const handleAgeChange = (diseaseName: string, ageYears: number | null) => {
        const current = infectiousData[diseaseName as keyof InfectiousDiseasesData] as any;
        onChange({
            ...infectiousData,
            [diseaseName]: {
                ...current,
                had: current?.had || false,
                ageYears: ageYears || null,
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
                                <div className="w-24">
                                    <Input
                                        type="number"
                                        value={diseaseData?.ageYears?.toString() || ''}
                                        onChange={(e) => handleAgeChange(disease.key, e.target.value ? parseInt(e.target.value) : null)}
                                        placeholder="Возраст"
                                        min={0}
                                        max={18}
                                        className="w-full"
                                    />
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
                    <Input
                        label="Прочие"
                        value={infectiousData.other || ''}
                        onChange={(e) => handleOtherChange(e.target.value)}
                        placeholder="Другие перенесенные инфекционные заболевания..."
                        className="w-full"
                    />
                </div>
            </div>
        </div>
    );
};
