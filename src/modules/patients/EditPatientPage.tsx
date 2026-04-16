import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Check, Loader } from 'lucide-react';
import { patientService } from '../../services/patient.service';
import { Button } from '../../components/ui/Button';
import { PatientFormFields, PatientFormData } from './components/PatientFormFields';

export const EditPatientPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<PatientFormData>({
        surname: '',
        name: '',
        patronymic: '',
        birthDate: '',
        gender: 'male',
    });

    useEffect(() => {
        if (!id) return;
        setIsFetching(true);
        patientService.getChildById(Number(id))
            .then((child) => {
                setFormData({
                    surname: child.surname,
                    name: child.name,
                    patronymic: child.patronymic ?? '',
                    birthDate: child.birthDate,
                    gender: child.gender,
                });
            })
            .catch((err) => {
                setError(err.message || 'Не удалось загрузить данные пациента');
            })
            .finally(() => setIsFetching(false));
    }, [id]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!id) return;
        setError(null);
        setIsLoading(true);

        try {
            await patientService.updateChild(Number(id), {
                name: formData.name,
                surname: formData.surname,
                patronymic: formData.patronymic || undefined,
                birthDate: formData.birthDate,
                gender: formData.gender,
            });
            navigate(`/patients/${id}`);
        } catch (err: any) {
            console.error('Failed to update child:', err);
            setError(err.message || 'Произошла ошибка при сохранении');
        } finally {
            setIsLoading(false);
        }
    };

    if (isFetching) {
        return (
            <div className="flex items-center justify-center p-16 text-slate-400">
                <Loader className="animate-spin" size={28} />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    onClick={() => navigate(`/patients/${id}`)}
                    className="h-10 w-10 p-0 rounded-full hover:bg-white dark:hover:bg-slate-800"
                >
                    <ArrowLeft size={24} className="text-slate-400" />
                </Button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Редактирование профиля
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Измените данные медицинской карты пациента
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[32px] p-10 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-800">
                {error && (
                    <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex gap-3 items-center animate-in slide-in-from-top-2">
                        <AlertCircle className="text-red-500 shrink-0" size={20} />
                        <div className="text-red-600 dark:text-red-400 text-sm font-bold">{error}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-10">
                    <PatientFormFields data={formData} onChange={setFormData} />

                    <div className="pt-6 flex items-center justify-end gap-4 border-t border-slate-100 dark:border-slate-800">
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={() => navigate(`/patients/${id}`)}
                            className="h-12 px-6 font-bold text-slate-500"
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className="h-12 px-8 text-base rounded-2xl shadow-xl shadow-primary-500/20"
                            leftIcon={<Check size={20} className="stroke-[3]" />}
                        >
                            Сохранить изменения
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
