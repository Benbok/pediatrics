import React, { useState, useEffect, useMemo } from 'react';
import { X, FileSignature, Search, Trash2, Edit2, Check, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { RecommendationTemplate } from '../../../types';
import { recommendationTemplateService } from '../services/recommendationTemplateService';
import { logger } from '../../../services/logger';

interface RecommendationTemplateSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    userId: number;
    onSelect: (items: string[]) => void;
    onEdit?: (template: RecommendationTemplate) => void;
    onDelete?: (templateId: number) => void;
}

export const RecommendationTemplateSelector: React.FC<RecommendationTemplateSelectorProps> = ({
    isOpen,
    onClose,
    userId,
    onSelect,
    onEdit,
    onDelete,
}) => {
    const [templates, setTemplates] = useState<RecommendationTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadTemplates();
        }
    }, [isOpen, userId]);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            const data = await recommendationTemplateService.getAll(userId);
            setTemplates(data);
        } catch (err: any) {
            logger.error('[RecommendationTemplateSelector] Failed to load templates:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredTemplates = useMemo(() => {
        if (!searchQuery.trim()) return templates;
        
        const query = searchQuery.toLowerCase();
        return templates.filter(t => 
            t.name.toLowerCase().includes(query) ||
            (t.description && t.description.toLowerCase().includes(query))
        );
    }, [templates, searchQuery]);

    // Group templates: own vs public
    const { ownTemplates, publicTemplates } = useMemo(() => {
        return {
            ownTemplates: filteredTemplates.filter(t => t.createdById === userId),
            publicTemplates: filteredTemplates.filter(t => t.createdById !== userId && t.isPublic)
        };
    }, [filteredTemplates, userId]);

    const handleSelect = (template: RecommendationTemplate) => {
        const items = recommendationTemplateService.parseItems(template.items);
        setSelectedTemplate(template.id || null);
        onSelect(items);
    };

    const handleEdit = (template: RecommendationTemplate) => {
        onEdit?.(template);
    };

    const handleDelete = async (templateId: number) => {
        try {
            await recommendationTemplateService.delete(templateId, userId);
            setTemplates(prev => prev.filter(t => t.id !== templateId));
            setDeleteConfirm(null);
            onDelete?.(templateId);
        } catch (err: any) {
            logger.error('[RecommendationTemplateSelector] Failed to delete template:', err);
        }
    };

    const getItemCount = (template: RecommendationTemplate): number => {
        const items = recommendationTemplateService.parseItems(template.items);
        return items.length;
    };

    const getPreviewItems = (template: RecommendationTemplate, maxItems: number = 3): string[] => {
        const items = recommendationTemplateService.parseItems(template.items);
        return items.slice(0, maxItems);
    };

    if (!isOpen) return null;

    const renderTemplateItem = (template: RecommendationTemplate, isOwn: boolean) => {
        const itemCount = getItemCount(template);
        const previewItems = getPreviewItems(template, 2);
        const isSelected = selectedTemplate === template.id;
        const isDeleting = deleteConfirm === template.id;

        return (
            <div
                key={template.id}
                className={`
                    p-4 rounded-xl border-2 transition-all duration-200
                    ${isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }
                `}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <FileSignature className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {template.name}
                            </span>
                        </div>
                        
                        {template.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-1">
                                {template.description}
                            </p>
                        )}
                        
                        {/* Preview items */}
                        <div className="space-y-1 mb-2">
                            {previewItems.map((item, idx) => (
                                <div key={idx} className="text-xs text-slate-600 dark:text-slate-400 truncate flex items-center gap-1">
                                    <span className="w-1 h-1 bg-indigo-400 rounded-full flex-shrink-0" />
                                    {item}
                                </div>
                            ))}
                            {itemCount > previewItems.length && (
                                <div className="text-xs text-slate-400 italic">
                                    + ещё {itemCount - previewItems.length}...
                                </div>
                            )}
                        </div>
                        
                        <Badge variant="default" size="sm">
                            {itemCount} рекомендаций
                        </Badge>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                        {isDeleting ? (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-red-600 dark:text-red-400 mr-1">Удалить?</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(template.id!)}
                                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                >
                                    Да
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteConfirm(null)}
                                >
                                    Нет
                                </Button>
                            </div>
                        ) : (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSelect(template)}
                                    className={isSelected ? 'text-indigo-600' : ''}
                                >
                                    {isSelected ? <Check className="w-4 h-4" /> : 'Применить'}
                                </Button>
                                
                                {isOwn && (
                                    <>
                                        {onEdit && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEdit(template)}
                                                className="text-slate-500 hover:text-indigo-600"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeleteConfirm(template.id!)}
                                            className="text-slate-500 hover:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 bg-indigo-50 dark:bg-indigo-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl">
                            <FileSignature className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                Шаблоны рекомендаций
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Выберите шаблон для добавления рекомендаций
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b dark:border-slate-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Поиск по названию..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-8">
                            <FileSignature className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">
                                Нет сохраненных шаблонов рекомендаций
                            </p>
                        </div>
                    ) : filteredTemplates.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-slate-500 dark:text-slate-400">
                                Ничего не найдено по запросу "{searchQuery}"
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {ownTemplates.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                                        Мои шаблоны ({ownTemplates.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {ownTemplates.map(t => renderTemplateItem(t, true))}
                                    </div>
                                </div>
                            )}

                            {publicTemplates.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                                        Публичные шаблоны ({publicTemplates.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {publicTemplates.map(t => renderTemplateItem(t, false))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                    >
                        Закрыть
                    </Button>
                </div>
            </div>
        </div>
    );
};
