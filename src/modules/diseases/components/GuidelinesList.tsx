import React, { useState, useEffect } from 'react';
import { ClinicalGuideline } from '../../../types';
import { diseaseService } from '../services/diseaseService';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { FileText, Download, Trash2, Calendar, ExternalLink, Loader2, Upload, Edit3, Check, X } from 'lucide-react';

interface GuidelinesListProps {
    diseaseId: number;
    onGuidelineSelect?: (guideline: ClinicalGuideline) => void;
    selectedGuidelineId?: number;
    onGuidelineAdded?: (guidelines: ClinicalGuideline[]) => void;
}

export const GuidelinesList: React.FC<GuidelinesListProps> = ({
    diseaseId,
    onGuidelineSelect,
    selectedGuidelineId,
    onGuidelineAdded
}) => {
    const [guidelines, setGuidelines] = useState<ClinicalGuideline[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; guidelineId: number | null }>({
        isOpen: false,
        guidelineId: null
    });

    useEffect(() => {
        loadGuidelines();
    }, [diseaseId]);

    const loadGuidelines = async () => {
        setIsLoading(true);
        try {
            const disease = await diseaseService.getDisease(diseaseId);
            const loadedGuidelines = disease.guidelines || [];
            setGuidelines(loadedGuidelines);
            // Уведомляем родительский компонент о загрузке guidelines
            if (onGuidelineAdded) {
                onGuidelineAdded(loadedGuidelines);
            }
        } catch (error) {
            console.error('Failed to load guidelines:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteClick = (guidelineId: number) => {
        setConfirmDelete({ isOpen: true, guidelineId });
    };

    const handleDeleteConfirm = async () => {
        if (!confirmDelete.guidelineId) return;

        const guidelineId = confirmDelete.guidelineId;
        setConfirmDelete({ isOpen: false, guidelineId: null });
        setDeletingId(guidelineId);

        try {
            await window.electronAPI.deleteGuideline(guidelineId);
            await loadGuidelines();
        } catch (error) {
            console.error('Failed to delete guideline:', error);
            alert('Ошибка при удалении файла');
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteCancel = () => {
        setConfirmDelete({ isOpen: false, guidelineId: null });
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const cleanTitle = (title: string) => {
        return title.replace(/^Клинические рекомендации:\s*/, '');
    };

    const handleStartEdit = (guideline: ClinicalGuideline) => {
        setEditingId(guideline.id);
        setEditingTitle(cleanTitle(guideline.title));
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingTitle('');
    };

    const handleSaveEdit = async (guidelineId: number) => {
        if (!editingTitle.trim()) return;

        setIsUpdating(true);
        try {
            await diseaseService.updateGuideline(guidelineId, editingTitle);
            await loadGuidelines();
            setEditingId(null);
            setEditingTitle('');
        } catch (error) {
            console.error('Failed to update guideline name:', error);
            alert('Ошибка при обновлении названия файла');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleFileUpload = async () => {
        try {
            const result = await window.electronAPI.openFile({
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
                properties: ['openFile', 'multiSelections'] // Разрешаем выбор нескольких файлов
            });

            if (!result.canceled && result.filePaths.length > 0) {
                setIsUploading(true);

                try {
                    // Если выбран один файл - используем старый метод, если несколько - batch
                    if (result.filePaths.length === 1) {
                        await diseaseService.uploadGuideline(diseaseId, result.filePaths[0]);
                    } else {
                        const batchResult = await diseaseService.uploadGuidelinesBatch(diseaseId, result.filePaths);
                        if (batchResult.errors && batchResult.errors.length > 0) {
                            alert(`Загружено ${batchResult.success.length} из ${result.filePaths.length} файлов. Ошибки: ${batchResult.errors.map(e => e.path).join(', ')}`);
                        }
                    }

                    // Перезагружаем список файлов
                    await loadGuidelines();
                } catch (error: any) {
                    console.error('Failed to upload guideline:', error);
                    alert(error.message || 'Ошибка при загрузке или обработке PDF');
                } finally {
                    setIsUploading(false);
                }
            }
        } catch (error: any) {
            console.error('File dialog error:', error);
            alert(error.message || 'Ошибка при выборе файлов');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    if (guidelines.length === 0) {
        return (
            <div className="space-y-4">
                <div className="text-center py-12 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm mb-4">Нет загруженных файлов</p>
                    <Button
                        variant="secondary"
                        onClick={handleFileUpload}
                        isLoading={isUploading}
                        className="rounded-xl"
                    >
                        <Upload className="w-5 h-5 mr-2" />
                        Загрузить PDF
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex justify-end mb-2">
                <Button
                    variant="secondary"
                    onClick={handleFileUpload}
                    isLoading={isUploading}
                    className="rounded-xl"
                    size="sm"
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Загрузить PDF
                </Button>
            </div>
            {guidelines.map((guideline) => {
                const isSelected = selectedGuidelineId === guideline.id;
                const isDeleting = deletingId === guideline.id;

                return (
                    <Card
                        key={guideline.id}
                        className={`p-4 rounded-2xl border-2 transition-all ${isSelected
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
                                : 'border-slate-100 dark:border-slate-800 hover:border-primary-300'
                            }`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                    <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    {editingId === guideline.id ? (
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                className="flex-1 px-2 py-1 text-sm font-bold border-2 border-primary-500 rounded-lg outline-none bg-white dark:bg-slate-900"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEdit(guideline.id);
                                                    if (e.key === 'Escape') handleCancelEdit();
                                                }}
                                            />
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => handleSaveEdit(guideline.id)}
                                                isLoading={isUpdating}
                                                className="h-8 w-8 p-0 rounded-lg"
                                            >
                                                <Check className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleCancelEdit}
                                                disabled={isUpdating}
                                                className="h-8 w-8 p-0 rounded-lg"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 mb-1 group/title">
                                            <div className="font-bold text-slate-800 dark:text-white truncate">
                                                {cleanTitle(guideline.title)}
                                            </div>
                                            <button
                                                onClick={() => handleStartEdit(guideline)}
                                                className="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-primary-500"
                                                title="Переименовать"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(guideline.createdAt)}
                                        </div>
                                        {guideline.source && guideline.source !== 'Минздрав РФ' && (
                                            <Badge variant="outline" size="sm" className="text-[10px]">
                                                {guideline.source}
                                            </Badge>
                                        )}
                                    </div>
                                    {guideline.content && (
                                        <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                            {guideline.content.substring(0, 150)}...
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {guideline.pdfPath && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.electronAPI.openPdfAtPage(guideline.pdfPath!, 1)}
                                            className="rounded-xl"
                                            title="Открыть PDF"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.electronAPI.openPdfAtPage(guideline.pdfPath!, 1)}
                                            className="rounded-xl"
                                            title="Скачать"
                                        >
                                            <Download className="w-4 h-4" />
                                        </Button>
                                    </>
                                )}
                                {onGuidelineSelect && !isSelected && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onGuidelineSelect(guideline)}
                                        className="rounded-xl"
                                    >
                                        Выбрать
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteClick(guideline.id)}
                                    disabled={isDeleting}
                                    className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                    title="Удалить"
                                >
                                    {isDeleting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </Card>
                );
            })}

            <ConfirmDialog
                isOpen={confirmDelete.isOpen}
                title="Удаление файла"
                message="Вы уверены, что хотите удалить этот файл?"
                confirmText="Удалить"
                cancelText="Отмена"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />
        </div>
    );
};
