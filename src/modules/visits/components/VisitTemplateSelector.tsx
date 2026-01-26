import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { FileText, Plus, Check, Loader2, Save, Edit2, Trash2 } from 'lucide-react';
import { Visit, VisitTemplate } from '../../../types';
import { CreateVisitTemplateModal } from './CreateVisitTemplateModal';
import { DeleteTemplateConfirmModal } from './DeleteTemplateConfirmModal';
import { visitTemplateService, VisitTemplateApplyResult } from '../services/visitTemplateService';
import { logger } from '../../../services/logger';

interface VisitTemplateSelectorProps {
    visitType: string | null;
    onSelect: (templateData: Partial<Visit>) => void;
    onTemplateApplied?: (result: VisitTemplateApplyResult & { template: VisitTemplate }) => void;
    currentData?: Partial<Visit>;
    userId?: number;
}

export const VisitTemplateSelector: React.FC<VisitTemplateSelectorProps> = ({
    visitType,
    onSelect,
    onTemplateApplied,
    currentData,
    userId,
}) => {
    const [templates, setTemplates] = useState<VisitTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<VisitTemplate | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
    const [deletingTemplate, setDeletingTemplate] = useState<{ id: number; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (visitType) {
            loadTemplates();
        }
    }, [visitType]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadTemplates = async () => {
        if (!visitType) return;
        setIsLoading(true);
        try {
            const data = await visitTemplateService.getByVisitType(visitType);
            setTemplates(data);
        } catch (err: any) {
            logger.error('[VisitTemplateSelector] Failed to load templates:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyTemplate = async (template: VisitTemplate) => {
        if (!template.id) return;
        
        try {
            const result = await visitTemplateService.applyTemplate(template.id, currentData || {});
            setSelectedTemplate(template);
            // result содержит mergedData, medicationTemplateId, examTemplateSetId
            onSelect(result.mergedData);
            
            // Вызываем callback с полной информацией о примененном шаблоне
            if (onTemplateApplied) {
                onTemplateApplied({
                    ...result,
                    template
                });
            }
        } catch (err: any) {
            logger.error('[VisitTemplateSelector] Failed to apply template:', err);
            throw err;
        }
    };

    const handleEditClick = (e: React.MouseEvent, template: VisitTemplate) => {
        e.stopPropagation(); // Предотвращаем применение шаблона при клике на кнопку редактирования
        if (template.id) {
            setEditingTemplateId(template.id);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, template: VisitTemplate) => {
        e.stopPropagation(); // Предотвращаем применение шаблона при клике на кнопку удаления
        if (template.id) {
            setDeletingTemplate({ id: template.id, name: template.name });
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingTemplate) return;

        setIsDeleting(true);
        try {
            await visitTemplateService.delete(deletingTemplate.id);
            setDeletingTemplate(null);
            loadTemplates(); // Перезагружаем список шаблонов
        } catch (err: any) {
            logger.error('[VisitTemplateSelector] Failed to delete template:', err);
            // Ошибка будет показана через toast или другой механизм уведомлений
        } finally {
            setIsDeleting(false);
        }
    };

    const canEditTemplate = (template: VisitTemplate): boolean => {
        return !!userId && template.createdById === userId;
    };

    if (!visitType) {
        return (
            <Card className="p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                    Выберите тип приема для загрузки шаблонов
                </p>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <Card className="p-4">
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                </div>
            </Card>
        );
    }

    return (
        <>
            <Card className="p-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Шаблоны приемов
                        </h3>
                        {userId && currentData && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsCreateModalOpen(true)}
                                className="text-xs"
                                title="Сохранить текущий прием как шаблон"
                            >
                                <Save className="w-3 h-3 mr-1" />
                                Сохранить шаблон
                            </Button>
                        )}
                    </div>

                    {templates.length === 0 ? (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                                Нет доступных шаблонов для типа "{visitType}"
                            </p>
                            {userId && currentData && (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="w-full"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Создать первый шаблон
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {templates.map((template) => {
                                const canEdit = canEditTemplate(template);
                                return (
                                    <div
                                        key={template.id}
                                        className={`
                                            p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer group
                                            ${selectedTemplate?.id === template.id
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                                            }
                                        `}
                                        onClick={() => handleApplyTemplate(template)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {template.name}
                                                    </span>
                                                    {template.isDefault && (
                                                        <Badge variant="primary" size="sm">
                                                            По умолчанию
                                                        </Badge>
                                                    )}
                                                </div>
                                                {template.description && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {template.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {selectedTemplate?.id === template.id && (
                                                    <Check className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                                )}
                                                {canEdit && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => handleEditClick(e, template)}
                                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                                            title="Редактировать шаблон"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeleteClick(e, template)}
                                                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                            title="Удалить шаблон"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Card>

            {(isCreateModalOpen || editingTemplateId) && visitType && (
                <CreateVisitTemplateModal
                    isOpen={isCreateModalOpen || !!editingTemplateId}
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        setEditingTemplateId(null);
                    }}
                    onSuccess={() => {
                        setIsCreateModalOpen(false);
                        setEditingTemplateId(null);
                        loadTemplates(); // Перезагружаем список шаблонов
                    }}
                    visitData={editingTemplateId ? undefined : currentData}
                    visitType={visitType}
                    userId={userId}
                    templateId={editingTemplateId || undefined}
                />
            )}

            <DeleteTemplateConfirmModal
                isOpen={!!deletingTemplate}
                onClose={() => setDeletingTemplate(null)}
                onConfirm={handleConfirmDelete}
                templateName={deletingTemplate?.name || ''}
                isDeleting={isDeleting}
            />
        </>
    );
};
