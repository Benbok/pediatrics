import React from 'react';
import { Input } from '../../../../components/ui/Input';
import { Dna } from 'lucide-react';
import { HeredityData } from '../../../../types';

interface HereditySectionProps {
    data: HeredityData | null;
    onChange: (data: HeredityData) => void;
}

export const HereditySection: React.FC<HereditySectionProps> = ({ data, onChange }) => {
    const heredityData: HeredityData = data || {
        tuberculosis: false,
        tuberculosisDetails: null,
        diabetes: false,
        diabetesDetails: null,
        hypertension: false,
        hypertensionDetails: null,
        oncology: false,
        oncologyDetails: null,
        allergies: false,
        allergiesDetails: null,
        other: null,
    };

    const handleCheckboxChange = (field: keyof HeredityData, value: boolean) => {
        const detailsFieldMap: Partial<Record<keyof HeredityData, keyof HeredityData>> = {
            tuberculosis: 'tuberculosisDetails',
            diabetes: 'diabetesDetails',
            hypertension: 'hypertensionDetails',
            oncology: 'oncologyDetails',
            allergies: 'allergiesDetails',
        };
        const detailsField = detailsFieldMap[field];

        onChange({
            ...heredityData,
            [field]: value,
            ...(detailsField && !value ? { [detailsField]: null } : {}),
        });
    };

    const handleDetailsChange = (
        field: 'tuberculosisDetails' | 'diabetesDetails' | 'hypertensionDetails' | 'oncologyDetails' | 'allergiesDetails',
        value: string
    ) => {
        onChange({
            ...heredityData,
            [field]: value || null,
        });
    };

    const handleOtherChange = (value: string) => {
        onChange({
            ...heredityData,
            other: value || null,
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
                <Dna className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Наследственность
                </h4>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={heredityData.tuberculosis}
                            onChange={(e) => handleCheckboxChange('tuberculosis', e.target.checked)}
                            className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Туберкулез</span>
                    </label>
                    {heredityData.tuberculosis && (
                        <div className="mt-2">
                            <Input
                                label="Уточнение (опционально)"
                                value={heredityData.tuberculosisDetails || ''}
                                onChange={(e) => handleDetailsChange('tuberculosisDetails', e.target.value)}
                                placeholder="Например: у матери, в ремиссии"
                            />
                        </div>
                    )}
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={heredityData.diabetes}
                            onChange={(e) => handleCheckboxChange('diabetes', e.target.checked)}
                            className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Диабет</span>
                    </label>
                    {heredityData.diabetes && (
                        <div className="mt-2">
                            <Input
                                label="Уточнение (опционально)"
                                value={heredityData.diabetesDetails || ''}
                                onChange={(e) => handleDetailsChange('diabetesDetails', e.target.value)}
                                placeholder="Например: СД 2 типа у отца"
                            />
                        </div>
                    )}
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={heredityData.hypertension}
                            onChange={(e) => handleCheckboxChange('hypertension', e.target.checked)}
                            className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Гипертоническая болезнь</span>
                    </label>
                    {heredityData.hypertension && (
                        <div className="mt-2">
                            <Input
                                label="Уточнение (опционально)"
                                value={heredityData.hypertensionDetails || ''}
                                onChange={(e) => handleDetailsChange('hypertensionDetails', e.target.value)}
                                placeholder="Например: у бабушки по материнской линии"
                            />
                        </div>
                    )}
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={heredityData.oncology}
                            onChange={(e) => handleCheckboxChange('oncology', e.target.checked)}
                            className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Онкологические заболевания</span>
                    </label>
                    {heredityData.oncology && (
                        <div className="mt-2">
                            <Input
                                label="Уточнение (опционально)"
                                value={heredityData.oncologyDetails || ''}
                                onChange={(e) => handleDetailsChange('oncologyDetails', e.target.value)}
                                placeholder="Например: рак молочной железы у родственника"
                            />
                        </div>
                    )}
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={heredityData.allergies}
                            onChange={(e) => handleCheckboxChange('allergies', e.target.checked)}
                            className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Аллергические заболевания</span>
                    </label>
                    {heredityData.allergies && (
                        <div className="mt-2">
                            <Input
                                label="Уточнение (опционально)"
                                value={heredityData.allergiesDetails || ''}
                                onChange={(e) => handleDetailsChange('allergiesDetails', e.target.value)}
                                placeholder="Например: бронхиальная астма у отца"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-3">
                <Input
                    label="Прочие"
                    value={heredityData.other || ''}
                    onChange={(e) => handleOtherChange(e.target.value)}
                    placeholder="Другие наследственные заболевания..."
                    className="w-full"
                />
            </div>
        </div>
    );
};
