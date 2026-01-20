import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { FileText, Plus, X, Check, Loader2 } from 'lucide-react';
import { Visit } from '../../../types';

export interface VisitTemplate {
    id?: number;
    name: string;
    visitType: string;
    specialty?: string | null;
    description?: string | null;
    templateData: string;
    isDefault: boolean;
    isPublic: boolean;
    createdById: number;
    createdAt?: string;
    updatedAt?: string;
}
import { logger } from '../../../services/logger';

interface VisitTemplateSelectorProps {
    visitType: string | null;
    onSelect: (templateData: Partial<Visit>) => void;
    currentData?: Partial<Visit>;
}

export const VisitTemplateSelector: React.FC<VisitTemplateSelectorProps> = ({
    visitType,
    onSelect,
    currentData,
}) => {
    const [templates, setTemplates] = useState<VisitTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<VisitTemplate | null>(null);

    useEffect(() => {
        if (visitType) {
            loadTemplates();
        }
    }, [visitType]);

    const loadTemplates = async () => {
        if (!visitType) return;
        setIsLoading(true);
        try {
            const data = await window.electronAPI.getVisitTemplatesByType(visitType);
            setTemplates(data);
        } catch (err: any) {
            logger.error('[VisitTemplateSelector] Failed to load templates:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyTemplate = async (template: VisitTemplate) => {
        try {
            const applied = await window.electronAPI.applyVisitTemplate({
                templateData: template.templateData,
                existingData: currentData || {},
            });
            setSelectedTemplate(template);
            onSelect(applied);
        } catch (err: any) {
            logger.error('[VisitTemplateSelector] Failed to apply template:', err);
        }
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
        <Card className="p-4">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Шаблоны приемов
                    </h3>
                </div>

                {templates.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                        Нет доступных шаблонов для типа "{visitType}"
                    </p>
                ) : (
                    <div className="space-y-2">
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                className={`
                                    p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer
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
                                    {selectedTemplate?.id === template.id && (
                                        <Check className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
};
