import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { diseaseService } from './services/diseaseService';
import { Disease } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
    ChevronLeft,
    ChevronRight,
    Save,
    Plus,
    X,
    Activity,
    Upload,
    FileText,
    AlertCircle,
    CheckCircle2,
    FileUp,
    Sparkles,
    Trash2
} from 'lucide-react';

export const DiseaseFormPage: React.FC = () => {
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [formData, setFormData] = useState<Partial<Disease>>({
        nameRu: '',
        icd10Code: '',
        icd10Codes: [],
        description: '',
        symptoms: [],
    });
    const [importedPdfPath, setImportedPdfPath] = useState<string | null>(null);

    const [newSymptom, setNewSymptom] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isEdit) {
            loadDisease();
        }
    }, [isEdit]);

    const loadDisease = async () => {
        try {
            const data = await diseaseService.getDisease(Number(id));

            // Parse JSON strings from SQLite
            const parsed = {
                ...data,
                symptoms: typeof data.symptoms === 'string' ? JSON.parse(data.symptoms) : (data.symptoms || []),
                icd10Codes: typeof data.icd10Codes === 'string' ? JSON.parse(data.icd10Codes) : (data.icd10Codes || []),
            };

            setFormData(parsed);
        } catch (err) {
            setError('Не удалось загрузить данные заболевания');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            const savedDisease = await diseaseService.upsertDisease(formData as Disease);

            // If we have an imported PDF, link it to the disease now
            if (importedPdfPath && savedDisease.id) {
                await diseaseService.uploadGuideline(savedDisease.id, importedPdfPath);
            }

            setSuccess(true);
            setTimeout(() => navigate(`/diseases/${savedDisease.id}`), 1500);
        } catch (err: any) {
            setError(err.message || 'Произошла ошибка при сохранении');
        } finally {
            setIsSaving(false);
        }
    };

    const addSymptom = () => {
        if (!newSymptom.trim()) return;

        // Split by comma or semicolon and trim each symptom
        const symptomsToAdd = newSymptom
            .split(/[,;]/)
            .map(s => s.trim())
            .filter(s => s.length > 0 && !formData.symptoms?.includes(s));

        if (symptomsToAdd.length > 0) {
            setFormData({
                ...formData,
                symptoms: [...(formData.symptoms || []), ...symptomsToAdd]
            });
            setNewSymptom('');
        }
    };

    const removeSymptom = (symptom: string) => {
        setFormData({
            ...formData,
            symptoms: formData.symptoms?.filter(s => s !== symptom)
        });
    };

    const handleDelete = async () => {
        if (!isEdit || !id) return;

        const confirmed = window.confirm(
            `Вы уверены, что хотите удалить заболевание "${formData.nameRu}"? \nЭто действие нельзя отменить.`
        );

        if (!confirmed) return;

        setIsSaving(true);
        try {
            await diseaseService.deleteDisease(Number(id));
            navigate('/diseases');
        } catch (err: any) {
            setError(err.message || 'Ошибка при удалении');
            setIsSaving(false);
        }
    };

    const handleFileUpload = async () => {
        try {
            const result = await window.electronAPI.openFile({
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
            });

            if (!result.canceled && result.filePaths.length > 0) {
                setIsSaving(true);
                const path = result.filePaths[0];
                if (!isEdit) {
                    setError('Пожалуйста, сначала сохраните основную информацию о заболевании');
                    setIsSaving(false);
                    return;
                }

                await diseaseService.uploadGuideline(Number(id), path);
                loadDisease();
                setSuccess(true);
            }
        } catch (err) {
            setError('Ошибка при загрузке или обработке PDF');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePdfImport = async () => {
        try {
            const result = await window.electronAPI.openFile({
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
            });

            if (!result.canceled && result.filePaths.length > 0) {
                setIsParsing(true);
                setError(null);
                const pdfPath = result.filePaths[0];

                const parsedData = await window.electronAPI.parsePdfOnly(pdfPath);

                // Autofill form with metadata
                setFormData({
                    nameRu: parsedData.nameRu,
                    icd10Code: parsedData.icd10Code,
                    icd10Codes: parsedData.allIcd10Codes,
                    description: parsedData.description,
                    symptoms: parsedData.symptoms,
                });
                setImportedPdfPath(pdfPath);

                // Show AI warning if fallback was used
                if (parsedData.aiWarning) {
                    setError(parsedData.aiWarning);
                    setTimeout(() => setError(null), 5000);
                }

                // Log all found ICD codes
                if (parsedData.allIcd10Codes && parsedData.allIcd10Codes.length > 1) {
                    const allCodes = parsedData.allIcd10Codes.join(', ');
                    console.info(`[PDF Import] Найдено кодов МКБ-10: ${allCodes}. Использован: ${parsedData.icd10Code}`);
                }

                // Show success with AI status
                const successMsg = parsedData.aiUsed
                    ? '✨ PDF успешно обработан с помощью AI!'
                    : 'PDF обработан (базовый парсер)';
                console.info(successMsg);

                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            }
        } catch (err: any) {
            setError('Ошибка при парсинге PDF: ' + (err.message || 'Неизвестная ошибка'));
        } finally {
            setIsParsing(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate('/diseases')} className="rounded-xl">
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Назад
                </Button>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white-800">
                    {isEdit ? 'Редактировать заболевание' : 'Новое заболевание'}
                </h1>
                <div className="flex gap-2">
                    {isEdit && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleDelete}
                            className="h-12 px-6 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all font-bold"
                        >
                            <Trash2 className="w-5 h-5 mr-2" />
                            Удалить
                        </Button>
                    )}
                    {!isEdit && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handlePdfImport}
                            isLoading={isParsing}
                            className="h-12 px-6 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 hover:border-purple-400 transition-all shadow-sm font-bold"
                        >
                            <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
                            {isParsing ? 'Парсинг...' : 'Импорт из PDF'}
                        </Button>
                    )}
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-xl overflow-hidden relative">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Название заболевания (RU) *
                            </label>
                            <Input
                                value={formData.nameRu}
                                onChange={e => setFormData({ ...formData, nameRu: e.target.value })}
                                placeholder="Например: Острый ларингит"
                                required
                                className="h-14 rounded-2xl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Код МКБ-10 *
                            </label>
                            <Input
                                value={formData.icd10Code}
                                onChange={e => setFormData({ ...formData, icd10Code: e.target.value.toUpperCase() })}
                                placeholder="Например: J04.0"
                                required
                                className="h-14 rounded-2xl font-mono"
                            />
                            {formData.icd10Codes && formData.icd10Codes.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {formData.icd10Codes.map(code => (
                                        <Badge
                                            key={code}
                                            variant={code === formData.icd10Code ? "primary" : "outline"}
                                            size="sm"
                                            className="cursor-pointer"
                                            onClick={() => setFormData({ ...formData, icd10Code: code })}
                                        >
                                            {code}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                                Краткое описание
                            </label>
                            <textarea
                                value={formData.description || ''}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full min-h-[120px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-slate-900 dark:text-white"
                                placeholder="Общая информация о заболевании, этиология..."
                            />
                        </div>
                    </div>
                </Card>

                {/* Symptoms Section */}
                <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-primary-500" />
                        Симптомы и клинические признаки
                    </h2>

                    <div className="flex gap-2 mb-4">
                        <Input
                            value={newSymptom}
                            onChange={e => setNewSymptom(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSymptom())}
                            placeholder="Введите симптом или несколько через запятую..."
                            className="h-12 rounded-xl"
                        />
                        <Button type="button" onClick={addSymptom} variant="secondary" className="h-12 w-12 rounded-xl p-0">
                            <Plus className="w-6 h-6" />
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {formData.symptoms?.map((symptom, idx) => (
                            <Badge
                                key={idx}
                                variant="primary"
                                className="pl-3 pr-1 py-1.5 rounded-xl flex items-center gap-2 group border-none shadow-sm"
                            >
                                <span>{symptom}</span>
                                <button
                                    type="button"
                                    onClick={() => removeSymptom(symptom)}
                                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </Badge>
                        ))}
                        {(!formData.symptoms || formData.symptoms.length === 0) && (
                            <p className="text-sm text-slate-400 italic">Симптомы еще не добавлены</p>
                        )}
                    </div>
                </Card>

                {/* Clinical Guideline List (ReadOnly in Form) */}
                {isEdit && (
                    <Card className="p-6 rounded-[32px] border-slate-200 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileText className="w-6 h-6 text-teal-500" />
                                Клинические рекомендации (PDF)
                            </h2>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={handleFileUpload}
                                isLoading={isSaving}
                                className="rounded-xl"
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Загрузить PDF
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {(formData as any).guidelines?.map((guide: any) => (
                                <div key={guide.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                            <FileText className="w-5 h-5 text-red-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">{guide.title}</h4>
                                            <p className="text-xs text-slate-500 italic">Загружено {new Date(guide.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => window.electronAPI.openExternalPath(guide.pdfPath)}
                                    >
                                        Открыть
                                    </Button>
                                </div>
                            ))}
                            {(!(formData as any).guidelines || (formData as any).guidelines.length === 0) && (
                                <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                                    <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-400">Нет загруженных PDF-рекомендаций</p>
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {/* Status Messages */}
                <div className="space-y-4">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="font-bold text-sm tracking-tight">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-green-600 animate-in fade-in zoom-in duration-300">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                            <p className="font-bold text-sm tracking-tight">Заболевание успешно сохранено!</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4 pb-12">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => navigate('/diseases')}
                        className="h-14 px-8 rounded-2xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
                    >
                        Отмена
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSaving}
                        variant="primary"
                        className="h-14 px-12 rounded-2xl shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.02]"
                    >
                        <Save className="w-5 h-5 mr-2" />
                        {isEdit ? 'Сохранить изменения' : 'Создать заболевание'}
                    </Button>
                </div>
            </form>
        </div>
    );
};
