import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { ChevronDown, ChevronUp, Eye, Heart, Brain, Activity, Stethoscope, FileText } from 'lucide-react';
import { Visit } from '../../../types';

interface PhysicalExamBySystemsProps {
    formData: Partial<Visit>;
    onChange: (field: keyof Visit, value: any) => void;
    errors?: Record<string, string>;
}

interface SystemSection {
    key: keyof Visit;
    label: string;
    icon: React.ReactNode;
    placeholder: string;
    description: string;
}

const systems: SystemSection[] = [
    {
        key: 'generalCondition',
        label: 'Общее состояние',
        icon: <Eye className="w-4 h-4" />,
        placeholder: 'Общее состояние ребенка, положение в пространстве, активность...',
        description: 'Оценка общего состояния, поведения, активности',
    },
    {
        key: 'consciousness',
        label: 'Сознание',
        icon: <Brain className="w-4 h-4" />,
        placeholder: 'Ясное, сопор, кома, уровень контакта...',
        description: 'Уровень сознания, контакт с ребенком',
    },
    {
        key: 'skinMucosa',
        label: 'Кожные покровы и видимые слизистые',
        icon: <FileText className="w-4 h-4" />,
        placeholder: 'Цвет кожи, тургор, влажность, высыпания, состояние слизистых...',
        description: 'Оценка кожных покровов, слизистых оболочек',
    },
    {
        key: 'lymphNodes',
        label: 'Лимфатические узлы',
        icon: <Activity className="w-4 h-4" />,
        placeholder: 'Размер, консистенция, болезненность, локализация увеличенных ЛУ...',
        description: 'Пальпация периферических лимфатических узлов',
    },
    {
        key: 'musculoskeletal',
        label: 'Костно-мышечная система',
        icon: <Stethoscope className="w-4 h-4" />,
        placeholder: 'Осанка, походка, объем движений в суставах, мышечный тонус...',
        description: 'Оценка опорно-двигательного аппарата',
    },
    {
        key: 'respiratory',
        label: 'Органы дыхания',
        icon: <Activity className="w-4 h-4" />,
        placeholder: 'ЧДД, характер дыхания, перкуссия, аускультация, хрипы...',
        description: 'Осмотр, пальпация, перкуссия, аускультация органов дыхания',
    },
    {
        key: 'cardiovascular',
        label: 'Сердечно-сосудистая система',
        icon: <Heart className="w-4 h-4" />,
        placeholder: 'ЧСС, тоны сердца, шумы, пульс, наполнение сосудов...',
        description: 'Осмотр, пальпация, перкуссия, аускультация ССС',
    },
    {
        key: 'abdomen',
        label: 'Органы брюшной полости',
        icon: <FileText className="w-4 h-4" />,
        placeholder: 'Форма живота, пальпация, перкуссия, размеры печени и селезенки...',
        description: 'Осмотр, пальпация, перкуссия органов брюшной полости',
    },
    {
        key: 'urogenital',
        label: 'Мочеполовая система',
        icon: <Stethoscope className="w-4 h-4" />,
        placeholder: 'Осмотр наружных половых органов, пальпация почек...',
        description: 'Осмотр мочеполовой системы',
    },
    {
        key: 'nervousSystem',
        label: 'Нервная система',
        icon: <Brain className="w-4 h-4" />,
        placeholder: 'Черепные нервы, двигательная сфера, рефлексы, чувствительность...',
        description: 'Неврологический осмотр',
    },
];

export const PhysicalExamBySystems: React.FC<PhysicalExamBySystemsProps> = ({
    formData,
    onChange,
    errors = {},
}) => {
    const [expandedSystems, setExpandedSystems] = useState<Set<keyof Visit>>(new Set());

    const toggleSystem = (key: keyof Visit) => {
        const newExpanded = new Set(expandedSystems);
        if (newExpanded.has(key)) {
            newExpanded.delete(key);
        } else {
            newExpanded.add(key);
        }
        setExpandedSystems(newExpanded);
    };

    const expandAll = () => {
        setExpandedSystems(new Set(systems.map(s => s.key)));
    };

    const collapseAll = () => {
        setExpandedSystems(new Set());
    };

    return (
        <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                        <Eye className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Объективный осмотр по системам
                    </h3>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={expandAll}
                        className="text-xs px-3 py-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 rounded-lg transition-colors"
                    >
                        Развернуть все
                    </button>
                    <button
                        type="button"
                        onClick={collapseAll}
                        className="text-xs px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Свернуть все
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {systems.map((system) => {
                    const isExpanded = expandedSystems.has(system.key);
                    const value = formData[system.key] as string | undefined;
                    const hasValue = value && value.trim().length > 0;
                    const error = errors[system.key as string];

                    return (
                        <div
                            key={system.key}
                            className={`
                                border rounded-xl transition-all duration-200
                                ${error
                                    ? 'border-red-300 dark:border-red-900/50'
                                    : 'border-slate-200 dark:border-slate-800'
                                }
                                ${isExpanded ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/50'}
                            `}
                        >
                            <button
                                type="button"
                                onClick={() => toggleSystem(system.key)}
                                className={`
                                    w-full flex items-center justify-between p-4
                                    hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors
                                    ${isExpanded && 'border-b border-slate-200 dark:border-slate-800'}
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                                        p-2 rounded-lg
                                        ${hasValue
                                            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                        }
                                    `}>
                                        {system.icon}
                                    </div>
                                    <div className="text-left">
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {system.label}
                                        </h4>
                                        {!isExpanded && hasValue && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                                                {value}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasValue && !isExpanded && (
                                        <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 text-xs rounded-md">
                                            Заполнено
                                        </span>
                                    )}
                                    {isExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="p-4 space-y-3">
                                    <textarea
                                        value={value || ''}
                                        onChange={(e) => onChange(system.key, e.target.value)}
                                        placeholder={system.placeholder}
                                        rows={4}
                                        className={`
                                            w-full px-4 py-3 bg-white dark:bg-slate-900 border rounded-xl text-sm
                                            transition-all duration-200 placeholder:text-slate-400
                                            focus:outline-none focus:ring-4 focus:ring-offset-0
                                            ${error
                                                ? 'border-red-300 text-red-900 focus:ring-red-500/10 focus:border-red-500'
                                                : 'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-primary-500/10 focus:border-primary-500'
                                            }
                                        `}
                                    />
                                    {error && (
                                        <p className="text-xs text-red-600 dark:text-red-400">
                                            {error}
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {system.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};
