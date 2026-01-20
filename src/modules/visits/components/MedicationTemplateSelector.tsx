import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Pill, Loader2, Check } from 'lucide-react';
import { MedicationTemplate } from '../../../types';
import { medicationTemplateService } from '../services/medicationTemplateService';
import { logger } from '../../../services/logger';

interface MedicationTemplateSelectorProps {
    userId: number;
    onApply: (templateId: number) => void;
}

export const MedicationTemplateSelector: React.FC<MedicationTemplateSelectorProps> = ({
    userId,
    onApply,
}) => {
    const [templates, setTemplates] = useState<MedicationTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

    useEffect(() => {
        loadTemplates();
    }, [userId]);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            const data = await medicationTemplateService.getAll(userId);
            setTemplates(data);
        } catch (err: any) {
            logger.error('[MedicationTemplateSelector] Failed to load templates:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = (templateId: number) => {
        setSelectedTemplate(templateId);
        onApply(templateId);
    };

    if (isLoading) {
        return (
            <Card className="p-4">
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                </div>
            </Card>
        );
    }

    if (templates.length === 0) {
        return (
            <Card className="p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                    Нет сохраненных шаблонов назначений
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-2">
            {templates.map((template) => {
                const items = Array.isArray(template.items) ? template.items : [];
                return (
                    <div
                        key={template.id}
                        className={`
                            p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer
                            ${selectedTemplate === template.id
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                            }
                        `}
                        onClick={() => handleApply(template.id!)}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Pill className="w-4 h-4 text-primary-600" />
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {template.name}
                                    </span>
                                    {items.length > 0 && (
                                        <Badge variant="secondary" size="sm">
                                            {items.length} препарат{items.length > 1 ? 'ов' : ''}
                                        </Badge>
                                    )}
                                </div>
                                {template.description && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {template.description}
                                    </p>
                                )}
                            </div>
                            {selectedTemplate === template.id && (
                                <Check className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
