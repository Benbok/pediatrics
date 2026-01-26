import React, { useState, useEffect } from 'react';
import { X, FileText, Save, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { VisitTemplate, Visit } from '../../../types';
import { visitTemplateService } from '../services/visitTemplateService';
import { logger } from '../../../services/logger';

interface CreateVisitTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    visitData?: Partial<Visit>; // Опционально для режима редактирования
    visitType: string;
    userId: number;
    templateId?: number; // ID шаблона для редактирования
}

export const CreateVisitTemplateModal: React.FC<CreateVisitTemplateModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    visitData,
    visitType,
    userId,
    templateId,
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [isDefault, setIsDefault] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [existingTemplates, setExistingTemplates] = useState<VisitTemplate[]>([]);
    const [selectedTemplateToOverwrite, setSelectedTemplateToOverwrite] = useState<number | null>(null);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const isEditMode = !!templateId;

    // Загрузка данных шаблона при редактировании или списка существующих шаблонов при создании
    useEffect(() => {
        if (isOpen && templateId) {
            loadTemplate();
        } else if (isOpen && !templateId) {
            // Сброс формы при создании нового шаблона
            resetForm();
            // Загружаем список существующих шаблонов для возможности перезаписи
            loadExistingTemplates();
        }
    }, [isOpen, templateId, visitType]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadTemplate = async () => {
        if (!templateId) return;
        
        setIsLoading(true);
        setError(null);
        try {
            const template = await visitTemplateService.getById(templateId);
            if (!template) {
                setError('Шаблон не найден');
                return;
            }

            // Проверка прав доступа
            if (template.createdById !== userId) {
                setError('У вас нет прав на редактирование этого шаблона');
                return;
            }

            // Заполняем форму данными шаблона
            setName(template.name || '');
            setDescription(template.description || '');
            setIsPublic(template.isPublic || false);
            setIsDefault(template.isDefault || false);
        } catch (err: any) {
            logger.error('[CreateVisitTemplateModal] Failed to load template', { error: err, templateId });
            setError(err.message || 'Не удалось загрузить шаблон');
        } finally {
            setIsLoading(false);
        }
    };

    const loadExistingTemplates = async () => {
        if (!visitType) return;
        
        setIsLoadingTemplates(true);
        try {
            const templates = await visitTemplateService.getByVisitType(visitType);
            // Фильтруем только шаблоны, созданные текущим пользователем
            const userTemplates = templates.filter(t => t.createdById === userId);
            setExistingTemplates(userTemplates);
        } catch (err: any) {
            logger.error('[CreateVisitTemplateModal] Failed to load existing templates', { error: err });
            // Не показываем ошибку пользователю, просто не загружаем список
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    const resetForm = () => {
        setName('');
        setDescription('');
        setIsPublic(false);
        setIsDefault(false);
        setSelectedTemplateToOverwrite(null);
        setError(null);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Название шаблона обязательно');
            return;
        }

        if (!visitType) {
            setError('Тип приема обязателен');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            let templateData: string;
            
            if (isEditMode) {
                // При редактировании загружаем текущие данные шаблона
                const existingTemplate = await visitTemplateService.getById(templateId!);
                if (!existingTemplate) {
                    throw new Error('Шаблон не найден');
                }
                // Используем существующие данные шаблона, если не передан visitData
                templateData = typeof existingTemplate.templateData === 'string' 
                    ? existingTemplate.templateData 
                    : JSON.stringify(existingTemplate.templateData);
            } else {
                // При создании или перезаписи подготавливаем данные из текущего приема
                if (!visitData) {
                    throw new Error('Данные приема обязательны для создания шаблона');
                }
                const preparedData = visitTemplateService.prepareTemplateData(visitData);
                templateData = JSON.stringify(preparedData);
            }

            // Определяем ID шаблона: либо из режима редактирования, либо из выбранного для перезаписи
            const templateIdToUse = isEditMode 
                ? templateId 
                : selectedTemplateToOverwrite || undefined;

            const template: VisitTemplate = {
                ...(templateIdToUse && { id: templateIdToUse }),
                name: name.trim(),
                visitType: visitType,
                specialty: null,
                description: description.trim() || null,
                templateData: templateData,
                medicationTemplateId: null,
                examTemplateSetId: null,
                isDefault: isDefault,
                isPublic: isPublic,
                createdById: userId,
            };

            await visitTemplateService.upsert(template);
            onSuccess();
            handleClose();
        } catch (err: any) {
            logger.error('[CreateVisitTemplateModal] Failed to save template', { error: err });
            setError(err.message || 'Не удалось сохранить шаблон');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={handleClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 bg-primary-50 dark:bg-primary-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-2xl">
                            <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                {isEditMode ? 'Редактировать шаблон приема' : 'Сохранить как шаблон приема'}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {isEditMode 
                                    ? 'Измените параметры шаблона приема'
                                    : 'Сохраните текущий прием для повторного использования'
                                }
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-2 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                            <span className="ml-3 text-sm text-slate-600 dark:text-slate-400">Загрузка шаблона...</span>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl">
                                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                                </div>
                            )}

                            {!isEditMode && existingTemplates.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Перезаписать существующий шаблон (опционально)
                                    </label>
                                    <select
                                        value={selectedTemplateToOverwrite || ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setSelectedTemplateToOverwrite(value ? Number(value) : null);
                                            // Автоматически заполняем имя и описание выбранного шаблона
                                            if (value) {
                                                const template = existingTemplates.find(t => t.id === Number(value));
                                                if (template) {
                                                    setName(template.name || '');
                                                    setDescription(template.description || '');
                                                    setIsPublic(template.isPublic || false);
                                                    setIsDefault(template.isDefault || false);
                                                }
                                            } else {
                                                setName('');
                                                setDescription('');
                                                setIsPublic(false);
                                                setIsDefault(false);
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 text-slate-900 dark:text-white"
                                    >
                                        <option value="">Создать новый шаблон</option>
                                        {existingTemplates.map((template) => (
                                            <option key={template.id} value={template.id}>
                                                {template.name} {template.isDefault ? '(по умолчанию)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Выберите существующий шаблон для перезаписи данными текущего приема
                                    </p>
                                    {selectedTemplateToOverwrite && (
                                        <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                                <strong>Внимание:</strong> Данные выбранного шаблона будут полностью заменены данными текущего приема. Это действие нельзя отменить.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Название шаблона *
                        </label>
                        <Input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Например: Первичный прием ОРВИ"
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Описание (опционально)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Краткое описание шаблона..."
                            rows={3}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 text-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isPublic}
                                onChange={(e) => setIsPublic(e.target.checked)}
                                className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                Сделать шаблон публичным (доступен всем пользователям)
                            </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isDefault}
                                onChange={(e) => setIsDefault(e.target.checked)}
                                className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                Установить как шаблон по умолчанию для типа "{visitType}"
                            </span>
                        </label>
                    </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        className="min-w-[120px]"
                        disabled={isSaving}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        className="min-w-[120px]"
                        disabled={isSaving || isLoading || !name.trim()}
                    >
                        {isSaving ? 'Сохранение...' : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                {isEditMode 
                                    ? 'Сохранить изменения' 
                                    : selectedTemplateToOverwrite 
                                        ? 'Перезаписать шаблон' 
                                        : 'Сохранить'
                                }
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
