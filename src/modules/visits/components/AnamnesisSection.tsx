import React, { useMemo } from 'react';
import { Card } from '../../../components/ui/Card';
import { FileText } from 'lucide-react';
import { Visit, HeredityData, BirthData, FeedingData, InfectiousDiseasesData, AllergyStatusData } from '../../../types';
import {
    HereditySection,
    BirthSection,
    FeedingSection,
    InfectiousDiseasesSection,
    AllergyStatusSection,
} from './anamnesis025';

interface AnamnesisSectionProps {
    formData: Partial<Visit>;
    onChange: (field: keyof Visit, value: any) => void;
    visitType?: 'primary' | 'followup' | 'consultation' | 'emergency' | 'urgent' | null;
    errors?: Record<string, string>;
}

export const AnamnesisSection: React.FC<AnamnesisSectionProps> = ({
    formData,
    onChange,
    visitType,
    errors = {},
}) => {
    // Показывать только для первичного приема и консультации
    const shouldShow = visitType === 'primary' || visitType === 'consultation';

    if (!shouldShow) {
        return null;
    }

    // Парсинг JSON полей
    const heredityData = useMemo(() => {
        if (!formData.heredityData) return null;
        if (typeof formData.heredityData === 'string') {
            try {
                return JSON.parse(formData.heredityData) as HeredityData;
            } catch {
                return null;
            }
        }
        return formData.heredityData as HeredityData;
    }, [formData.heredityData]);

    const birthData = useMemo(() => {
        if (!formData.birthData) return null;
        if (typeof formData.birthData === 'string') {
            try {
                return JSON.parse(formData.birthData) as BirthData;
            } catch {
                return null;
            }
        }
        return formData.birthData as BirthData;
    }, [formData.birthData]);

    const feedingData = useMemo(() => {
        if (!formData.feedingData) return null;
        if (typeof formData.feedingData === 'string') {
            try {
                return JSON.parse(formData.feedingData) as FeedingData;
            } catch {
                return null;
            }
        }
        return formData.feedingData as FeedingData;
    }, [formData.feedingData]);

    const infectiousDiseasesData = useMemo(() => {
        if (!formData.infectiousDiseasesData) return null;
        if (typeof formData.infectiousDiseasesData === 'string') {
            try {
                return JSON.parse(formData.infectiousDiseasesData) as InfectiousDiseasesData;
            } catch {
                return null;
            }
        }
        return formData.infectiousDiseasesData as InfectiousDiseasesData;
    }, [formData.infectiousDiseasesData]);

    const allergyStatusData = useMemo(() => {
        if (!formData.allergyStatusData) return null;
        if (typeof formData.allergyStatusData === 'string') {
            try {
                return JSON.parse(formData.allergyStatusData) as AllergyStatusData;
            } catch {
                return null;
            }
        }
        return formData.allergyStatusData as AllergyStatusData;
    }, [formData.allergyStatusData]);

    // Обработчики для обновления JSON полей
    const handleHeredityChange = (data: HeredityData) => {
        onChange('heredityData', JSON.stringify(data));
    };

    const handleBirthChange = (data: BirthData) => {
        onChange('birthData', JSON.stringify(data));
    };

    const handleFeedingChange = (data: FeedingData) => {
        onChange('feedingData', JSON.stringify(data));
    };

    const handleInfectiousDiseasesChange = (data: InfectiousDiseasesData) => {
        onChange('infectiousDiseasesData', JSON.stringify(data));
    };

    const handleAllergyStatusChange = (data: AllergyStatusData) => {
        onChange('allergyStatusData', JSON.stringify(data));
    };

    return (
        <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Анамнез жизни (форма 025/у)
                </h3>
            </div>

            <div className="space-y-6">
                <HereditySection data={heredityData} onChange={handleHeredityChange} />
                <BirthSection data={birthData} onChange={handleBirthChange} />
                <FeedingSection data={feedingData} onChange={handleFeedingChange} />
                <InfectiousDiseasesSection data={infectiousDiseasesData} onChange={handleInfectiousDiseasesChange} />
                <AllergyStatusSection data={allergyStatusData} onChange={handleAllergyStatusChange} />
            </div>
        </Card>
    );
};
