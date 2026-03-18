import React, { useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';
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
    errors = {}
}) => {
    const [isExpanded, setIsExpanded] = useState(false); // По умолчанию свернута
    
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
        let parsed: FeedingData;
        if (typeof formData.feedingData === 'string') {
            try {
                parsed = JSON.parse(formData.feedingData) as FeedingData;
            } catch {
                return null;
            }
        } else {
            parsed = formData.feedingData as FeedingData;
        }
        
        // Обратная совместимость: преобразуем старые boolean значения в новые строковые
        if (parsed.breastfeeding === true) {
            parsed.breastfeeding = 'yes';
        } else if (parsed.breastfeeding === false) {
            parsed.breastfeeding = 'no';
        }
        
        return parsed;
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
        <Card className="p-0 space-y-0">
            <button
                className="w-full flex items-center gap-3 p-6 mb-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white text-left flex-1">
                    Анамнез жизни
                </h3>
                {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                ) : (
                    <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                )}
            </button>

            {isExpanded && (
                <div className="px-6 pb-6 space-y-6">
                    <div className="pt-2 space-y-6">
                        <HereditySection data={heredityData} onChange={handleHeredityChange} />
                        <BirthSection data={birthData} onChange={handleBirthChange} />
                        <FeedingSection data={feedingData} onChange={handleFeedingChange} />
                        <InfectiousDiseasesSection data={infectiousDiseasesData} onChange={handleInfectiousDiseasesChange} />
                        <AllergyStatusSection data={allergyStatusData} onChange={handleAllergyStatusChange} />
                    </div>
                </div>
            )}
        </Card>
    );
};
