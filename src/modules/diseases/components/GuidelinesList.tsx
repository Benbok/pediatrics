import React, { useState, useEffect } from 'react';
import { ClinicalGuideline } from '../../../types';
import { diseaseService } from '../services/diseaseService';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { FileText, Download, Trash2, Calendar, ExternalLink, Loader2 } from 'lucide-react';

interface GuidelinesListProps {
    diseaseId: number;
    onGuidelineSelect?: (guideline: ClinicalGuideline) => void;
    selectedGuidelineId?: number;
}

export const GuidelinesList: React.FC<GuidelinesListProps> = ({
    diseaseId,
    onGuidelineSelect,
    selectedGuidelineId
}) => {
    const [guidelines, setGuidelines] = useState<ClinicalGuideline[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        loadGuidelines();
    }, [diseaseId]);

    const loadGuidelines = async () => {
        setIsLoading(true);
        try {
            const disease = await diseaseService.getDisease(diseaseId);
            setGuidelines(disease.guidelines || []);
        } catch (error) {
            console.error('Failed to load guidelines:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (guidelineId: number) => {
        if (!confirm('Вы уверены, что хотите удалить этот файл?')) {
            return;
        }

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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    if (guidelines.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Нет загруженных файлов</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {guidelines.map((guideline) => {
                const isSelected = selectedGuidelineId === guideline.id;
                const isDeleting = deletingId === guideline.id;

                return (
                    <Card
                        key={guideline.id}
                        className={`p-4 rounded-2xl border-2 transition-all ${
                            isSelected
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
                                    <div className="font-bold text-slate-800 dark:text-white mb-1 truncate">
                                        {guideline.title}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(guideline.createdAt)}
                                        </div>
                                        {guideline.source && (
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
                                {onGuidelineSelect && (
                                    <Button
                                        variant={isSelected ? 'primary' : 'secondary'}
                                        size="sm"
                                        onClick={() => onGuidelineSelect(guideline)}
                                        className="rounded-xl"
                                    >
                                        {isSelected ? 'Выбран' : 'Выбрать'}
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(guideline.id)}
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
        </div>
    );
};
