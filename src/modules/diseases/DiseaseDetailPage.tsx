import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { diseaseService } from './services/diseaseService';
import { Disease } from '../../types';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Edit,
    FileText,
    Link as LinkIcon,
    AlertCircle,
    Loader2,
    Trash2
} from 'lucide-react';
import { DiseaseKnowledgeView } from './components/DiseaseKnowledgeView';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export const DiseaseDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [disease, setDisease] = useState<Disease | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        loadDisease();
    }, [id]);

    const loadDisease = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const data = await diseaseService.getDisease(Number(id));
            if (data) {
                // Parse symptoms and icd10Codes if they are strings
                const parsed = {
                    ...data,
                    symptoms: typeof data.symptoms === 'string' ? JSON.parse(data.symptoms) : data.symptoms,
                    icd10Codes: typeof data.icd10Codes === 'string' ? JSON.parse(data.icd10Codes) : data.icd10Codes,
                };
                setDisease(parsed as Disease);
            } else {
                setError('Заболевание не найдено');
            }
        } catch (err: any) {
            setError(err.message || 'Ошибка при загрузке данных');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = async () => {
        if (!disease?.id) return;
        
        setShowDeleteConfirm(false);
        setIsDeleting(true);
        try {
            const success = await diseaseService.deleteDisease(disease.id);
            if (success) {
                navigate('/diseases');
            } else {
                setError('Не удалось удалить заболевание');
            }
        } catch (err: any) {
            setError(err.message || 'Ошибка при удалении');
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
                <p className="text-slate-500 font-medium">Загрузка базы знаний...</p>
            </div>
        );
    }

    if (error || !disease) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="bg-rose-50 border border-rose-100 p-8 rounded-[32px] text-center">
                    <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-rose-900 mb-2">Упс! Что-то пошло не так</h2>
                    <p className="text-rose-700 mb-6">{error || 'Заболевание не найдено'}</p>
                    <Button onClick={() => navigate('/diseases')} variant="secondary" className="rounded-xl">
                        Вернуться к списку
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate('/diseases')} className="rounded-xl">
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    К списку
                </Button>

                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => navigate(`/diseases/edit/${disease.id}`)}
                        className="rounded-xl"
                    >
                        <Edit className="w-5 h-5 mr-2" />
                        Редактировать
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={handleDeleteClick}
                        isLoading={isDeleting}
                        className="rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/10"
                    >
                        <Trash2 className="w-5 h-5 mr-2" />
                        Удалить
                    </Button>
                </div>
            </div>

            <DiseaseKnowledgeView disease={disease} />

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Удаление заболевания"
                message={`Вы уверены, что хотите удалить заболевание "${disease?.nameRu}"?\n\nЭто действие нельзя отменить.`}
                confirmText="Удалить"
                cancelText="Отмена"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
};
