import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ChevronDown, ChevronUp, Eye, Heart, Brain, Activity, Stethoscope, FileText, ChevronsDownUp, Save, Trash2, Pencil } from 'lucide-react';
import { Visit } from '../../../types';
import { examTextTemplateService } from '../services/examTextTemplateService';
import { ExamTextTemplate } from '../../../types';
import { CreateExamTextTemplateModal } from './CreateExamTextTemplateModal';
import { logger } from '../../../services/logger';

interface PhysicalExamBySystemsProps {
    formData: Partial<Visit>;
    onChange: (field: keyof Visit, value: any) => void;
    errors?: Record<string, string>;
    userId?: number;
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
    userId,
}) => {
    const [expandedSystems, setExpandedSystems] = useState<Set<keyof Visit>>(new Set());
    const [templatesBySystem, setTemplatesBySystem] = useState<Record<string, ExamTextTemplate[]>>({});
    const [selectedSystemForTemplate, setSelectedSystemForTemplate] = useState<keyof Visit | null>(null);
    const [systemForSaveTemplate, setSystemForSaveTemplate] = useState<{ key: keyof Visit; label: string } | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<{ templateId: number; systemKey: keyof Visit; systemLabel: string } | null>(null);
    const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; templateId: number | null; templateName: string; systemKey: keyof Visit | null }>({
        isOpen: false,
        templateId: null,
        templateName: '',
        systemKey: null
    });

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

    const handleDeleteClick = (template: ExamTextTemplate, systemKey: keyof Visit) => {
        if (!userId || !template.id) return;
        setDeleteConfirm({
            isOpen: true,
            templateId: template.id,
            templateName: template.name || template.text.substring(0, 50) + '...',
            systemKey
        });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirm.templateId || !deleteConfirm.systemKey || !userId) return;

        const templateId = deleteConfirm.templateId;
        const systemKey = deleteConfirm.systemKey;

        setDeleteConfirm({ isOpen: false, templateId: null, templateName: '', systemKey: null });
        setDeletingTemplateId(templateId);

        try {
            await examTextTemplateService.delete(templateId, userId);
            // Обновляем список шаблонов
            const updatedTemplates = await examTextTemplateService.getBySystemKey(
                systemKey as string,
                userId
            );
            setTemplatesBySystem(prev => ({
                ...prev,
                [systemKey]: updatedTemplates
            }));
            // Если шаблонов не осталось, закрываем список
            if (updatedTemplates.length === 0) {
                setSelectedSystemForTemplate(null);
            }
        } catch (err) {
            logger.error('[PhysicalExamBySystems] Failed to delete template', { error: err, templateId });
            alert('Не удалось удалить шаблон');
        } finally {
            setDeletingTemplateId(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteConfirm({ isOpen: false, templateId: null, templateName: '', systemKey: null });
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
                                    {userId && (
                                        <div className="flex items-center justify-end gap-2">
                                            {value && value.trim().length > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSystemForSaveTemplate({ key: system.key, label: system.label })}
                                                    className="text-xs"
                                                    title="Сохранить текущий текст как шаблон"
                                                >
                                                    <Save className="w-3 h-3 mr-1" />
                                                    Сохранить шаблон
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={async () => {
                                                    try {
                                                        const templates = await examTextTemplateService.getBySystemKey(
                                                            system.key as string,
                                                            userId
                                                        );
                                                        setTemplatesBySystem(prev => ({
                                                            ...prev,
                                                            [system.key]: templates
                                                        }));
                                                        setSelectedSystemForTemplate(system.key);
                                                    } catch (err) {
                                                        logger.error('[PhysicalExamBySystems] Failed to load templates', { error: err, systemKey: system.key });
                                                    }
                                                }}
                                                className="text-xs"
                                                title="Выбрать сохраненный шаблон"
                                            >
                                                <ChevronsDownUp className="w-3 h-3 mr-1" />
                                                Выбрать шаблон
                                            </Button>
                                        </div>
                                    )}
                                    {selectedSystemForTemplate === system.key && templatesBySystem[system.key] && templatesBySystem[system.key].length > 0 && (
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-2 border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                                Выберите шаблон:
                                            </p>
                                            {templatesBySystem[system.key].map((template) => (
                                                <div
                                                    key={template.id}
                                                    className="flex items-center gap-2 group"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const currentValue = (formData[system.key] as string) || '';
                                                            const newValue = currentValue 
                                                                ? `${currentValue}\n\n${template.text}`
                                                                : template.text;
                                                            onChange(system.key, newValue);
                                                            setSelectedSystemForTemplate(null);
                                                        }}
                                                        className="flex-1 text-left p-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-colors"
                                                    >
                                                        {template.name || template.text.substring(0, 50) + '...'}
                                                    </button>
                                                    {userId && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const systemInfo = systems.find(s => s.key === system.key);
                                                                    if (template.id && systemInfo) {
                                                                        setEditingTemplate({
                                                                            templateId: template.id,
                                                                            systemKey: system.key,
                                                                            systemLabel: systemInfo.label
                                                                        });
                                                                    }
                                                                }}
                                                                disabled={deletingTemplateId === template.id}
                                                                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                title="Редактировать шаблон"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteClick(template, system.key);
                                                                }}
                                                                disabled={deletingTemplateId === template.id}
                                                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                title="Удалить шаблон"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedSystemForTemplate(null)}
                                                className="w-full text-xs"
                                            >
                                                Закрыть
                                            </Button>
                                        </div>
                                    )}
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

            {/* Create Exam Text Template Modal */}
            {userId && systemForSaveTemplate && (
                <CreateExamTextTemplateModal
                    isOpen={systemForSaveTemplate !== null}
                    onClose={() => setSystemForSaveTemplate(null)}
                    onSuccess={async () => {
                        setSystemForSaveTemplate(null);
                        // Обновляем список шаблонов после создания
                        if (systemForSaveTemplate.key && userId) {
                            try {
                                const templates = await examTextTemplateService.getBySystemKey(
                                    systemForSaveTemplate.key as string,
                                    userId
                                );
                                setTemplatesBySystem(prev => ({
                                    ...prev,
                                    [systemForSaveTemplate.key]: templates
                                }));
                            } catch (err) {
                                logger.error('[PhysicalExamBySystems] Failed to reload templates after create', { error: err });
                            }
                        }
                    }}
                    systemKey={systemForSaveTemplate.key as string}
                    systemLabel={systemForSaveTemplate.label}
                    initialText={(formData[systemForSaveTemplate.key] as string) || ''}
                    userId={userId}
                />
            )}

            {/* Edit Exam Text Template Modal */}
            {userId && editingTemplate && (
                <CreateExamTextTemplateModal
                    isOpen={editingTemplate !== null}
                    onClose={() => setEditingTemplate(null)}
                    onSuccess={async () => {
                        setEditingTemplate(null);
                        // Обновляем список шаблонов после редактирования
                        if (editingTemplate.systemKey && userId) {
                            try {
                                const templates = await examTextTemplateService.getBySystemKey(
                                    editingTemplate.systemKey as string,
                                    userId
                                );
                                setTemplatesBySystem(prev => ({
                                    ...prev,
                                    [editingTemplate.systemKey]: templates
                                }));
                            } catch (err) {
                                logger.error('[PhysicalExamBySystems] Failed to reload templates after edit', { error: err });
                            }
                        }
                    }}
                    systemKey={editingTemplate.systemKey as string}
                    systemLabel={editingTemplate.systemLabel}
                    initialText="" // Не используется при редактировании, данные загружаются из шаблона
                    userId={userId}
                    templateId={editingTemplate.templateId}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="Удаление шаблона"
                message={`Вы уверены, что хотите удалить шаблон "${deleteConfirm.templateName}"?\n\nЭто действие нельзя отменить.`}
                confirmText="Удалить"
                cancelText="Отмена"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />
        </Card>
    );
};
