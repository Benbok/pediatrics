import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Calendar, Home, Stethoscope, AlertTriangle, Clock } from 'lucide-react';

export type VisitType = 'primary' | 'followup' | 'consultation' | 'emergency' | 'urgent' | null;

interface VisitTypeSelectorProps {
    value: VisitType;
    onChange: (type: VisitType) => void;
    disabled?: boolean;
    autoDetected?: VisitType;
}

const visitTypeOptions: Array<{
    value: VisitType;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    badgeVariant: 'default' | 'primary' | 'success' | 'warning' | 'error';
}> = [
    {
        value: 'primary',
        label: 'Первичный',
        description: 'Первый прием по данному заболеванию',
        icon: <Calendar className="w-5 h-5" />,
        color: 'blue',
        badgeVariant: 'primary',
    },
    {
        value: 'followup',
        label: 'Повторный',
        description: 'Повторный прием для наблюдения',
        icon: <Clock className="w-5 h-5" />,
        color: 'green',
        badgeVariant: 'success',
    },
    {
        value: 'consultation',
        label: 'Консультация',
        description: 'Консультация специалиста',
        icon: <Stethoscope className="w-5 h-5" />,
        color: 'purple',
        badgeVariant: 'default',
    },
    {
        value: 'emergency',
        label: 'Экстренный',
        description: 'Экстренная медицинская помощь',
        icon: <AlertTriangle className="w-5 h-5" />,
        color: 'red',
        badgeVariant: 'error',
    },
    {
        value: 'urgent',
        label: 'Неотложный',
        description: 'Неотложная медицинская помощь',
        icon: <AlertTriangle className="w-5 h-5" />,
        color: 'orange',
        badgeVariant: 'warning',
    },
];

export const VisitTypeSelector: React.FC<VisitTypeSelectorProps> = ({
    value,
    onChange,
    disabled = false,
    autoDetected,
}) => {
    return (
        <Card className="p-4">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Тип приема
                    </h3>
                    {autoDetected && value === autoDetected && (
                        <Badge variant="outline" className="text-xs">
                            Автоопределен
                        </Badge>
                    )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {visitTypeOptions.map((option) => {
                        const isSelected = value === option.value;
                        
                        // Определяем классы в зависимости от цвета
                        const getColorClasses = () => {
                            switch (option.color) {
                                case 'blue':
                                    return isSelected
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400'
                                        : '';
                                case 'green':
                                    return isSelected
                                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400'
                                        : '';
                                case 'purple':
                                    return isSelected
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400'
                                        : '';
                                case 'red':
                                    return isSelected
                                        ? 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                                        : '';
                                case 'orange':
                                    return isSelected
                                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400'
                                        : '';
                                default:
                                    return '';
                            }
                        };
                        
                        return (
                            <button
                                key={option.value || 'null'}
                                type="button"
                                onClick={() => !disabled && onChange(option.value)}
                                disabled={disabled}
                                className={`
                                    relative flex flex-col items-center justify-center p-4 rounded-xl
                                    border-2 transition-all duration-200
                                    ${isSelected
                                        ? getColorClasses() + ' shadow-md'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 text-slate-400'
                                    }
                                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm active:scale-95'}
                                `}
                            >
                                <div className="mb-2">
                                    {option.icon}
                                </div>
                                <span className={`
                                    text-sm font-semibold mb-1
                                    ${isSelected
                                        ? getColorClasses()
                                        : 'text-slate-700 dark:text-slate-300'
                                    }
                                `}>
                                    {option.label}
                                </span>
                                {isSelected && (
                                    <Badge variant={option.badgeVariant} size="sm" className="mt-1">
                                        Выбран
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </div>
                
                {value && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {visitTypeOptions.find(o => o.value === value)?.description}
                    </p>
                )}
            </div>
        </Card>
    );
};
