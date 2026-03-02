import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Plus, X, Search, FileText, AlertCircle } from 'lucide-react';
import { DiagnosisEntry } from '../../../types';

interface DiagnosisSelectorProps {
    value: DiagnosisEntry | null;
    onChange: (diagnosis: DiagnosisEntry | null) => void;
    label?: string;
    required?: boolean;
    error?: string;
    onOpenIcdSearch?: () => void;
    onOpenDiseaseSearch?: () => void;
}

export const DiagnosisSelector: React.FC<DiagnosisSelectorProps> = ({
    value,
    onChange,
    label = 'Основной диагноз',
    required = false,
    error,
    onOpenIcdSearch,
    onOpenDiseaseSearch,
}) => {
    const [manualMode, setManualMode] = useState(false);
    const [manualCode, setManualCode] = useState(value?.code || '');
    const [manualName, setManualName] = useState(value?.nameRu || '');

    const handleManualSave = () => {
        if (!manualName.trim()) return;
        const icdPattern = /^[A-Z]\d{2}\.?\d{0,2}$/;
        const codeTrimmed = manualCode.trim();
        if (codeTrimmed && !icdPattern.test(codeTrimmed)) return;
        onChange({
            code: codeTrimmed ? codeTrimmed.toUpperCase() : undefined,
            nameRu: manualName.trim(),
            diseaseId: undefined,
        });
        setManualMode(false);
    };

    const handleClear = () => {
        onChange(null);
        setManualCode('');
        setManualName('');
        setManualMode(false);
    };

    if (!manualMode && !value) {
        return (
            <Card className="p-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-900 dark:text-white">
                            {label}
                            {required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <div className="flex gap-2">
                            {onOpenIcdSearch && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={onOpenIcdSearch}
                                    leftIcon={<Search className="w-3 h-3" />}
                                >
                                    Из МКБ
                                </Button>
                            )}
                            {onOpenDiseaseSearch && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={onOpenDiseaseSearch}
                                    leftIcon={<FileText className="w-3 h-3" />}
                                >
                                    Из базы
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setManualMode(true)}
                                leftIcon={<Plus className="w-3 h-3" />}
                            >
                                Вручную
                            </Button>
                        </div>
                    </div>
                    {error && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {error}
                        </p>
                    )}
                </div>
            </Card>
        );
    }

    if (manualMode && !value) {
        const icdPattern = /^[A-Z]\d{2}\.?\d{0,2}$/;
        const isCodeValid = manualCode.trim() === '' || icdPattern.test(manualCode.trim().toUpperCase());

        return (
            <Card className="p-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-900 dark:text-white">
                            {label} - Ручной ввод
                            {required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setManualMode(false);
                                setManualCode('');
                                setManualName('');
                            }}
                        >
                            Отмена
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            label="Код МКБ (необязательно)"
                            placeholder="Например: J45.0 или оставьте пустым"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                            error={!isCodeValid && manualCode.trim() ? 'Неверный формат кода МКБ (например: J45.0)' : undefined}
                        />
                        <Input
                            label="Название диагноза"
                            placeholder="Введите название"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            required={required}
                        />
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Код МКБ можно не заполнять при ручном вводе.
                    </p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            onClick={handleManualSave}
                            disabled={!manualName.trim() || !isCodeValid}
                            size="sm"
                        >
                            Сохранить
                        </Button>
                    </div>
                </div>
            </Card>
        );
    }

    // Отображение выбранного диагноза
    return (
        <Card className="p-4">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-900 dark:text-white">
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        leftIcon={<X className="w-4 h-4" />}
                    >
                        Изменить
                    </Button>
                </div>

                <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-950/20 rounded-xl border border-primary-200 dark:border-primary-900">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg">
                        <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {value.code ? (
                                <Badge variant="primary" size="sm">
                                    {value.code}
                                </Badge>
                            ) : (
                                <Badge variant="outline" size="sm">
                                    Без кода МКБ
                                </Badge>
                            )}
                            {value.diseaseId && (
                                <Badge variant="outline" size="sm">
                                    Из базы знаний
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {value.nameRu}
                        </p>
                    </div>
                </div>

                {error && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                    </p>
                )}
            </div>
        </Card>
    );
};

// Компонент для множественного выбора (осложнения, сопутствующие)
interface MultipleDiagnosisSelectorProps {
    values: DiagnosisEntry[];
    onChange: (diagnoses: DiagnosisEntry[]) => void;
    label: string;
    error?: string;
    onOpenIcdSearch?: () => void;
    onOpenDiseaseSearch?: () => void;
}

export const MultipleDiagnosisSelector: React.FC<MultipleDiagnosisSelectorProps> = ({
    values,
    onChange,
    label,
    error,
    onOpenIcdSearch,
    onOpenDiseaseSearch,
}) => {
    const [manualMode, setManualMode] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [manualName, setManualName] = useState('');
    const icdPattern = /^[A-Z]\d{2}\.?\d{0,2}$/;
    const isCodeValid = !manualCode.trim() || icdPattern.test(manualCode.trim().toUpperCase());

    const handleAdd = (diagnosis: DiagnosisEntry) => {
        // Проверка на дубликаты по коду (только если код указан)
        if (diagnosis.code && values.some(d => d.code === diagnosis.code)) {
            return;
        }
        onChange([...values, diagnosis]);
        setManualCode('');
        setManualName('');
        setManualMode(false);
    };

    const handleManualSave = () => {
        if (!manualName.trim()) return;
        const icdPattern = /^[A-Z]\d{2}\.?\d{0,2}$/;
        const codeTrimmed = manualCode.trim();
        if (codeTrimmed && !icdPattern.test(codeTrimmed)) return;
        handleAdd({
            code: codeTrimmed ? codeTrimmed.toUpperCase() : undefined,
            nameRu: manualName.trim(),
            diseaseId: undefined,
        });
    };

    const handleRemove = (index: number) => {
        onChange(values.filter((_, i) => i !== index));
    };

    return (
        <Card className="p-4">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-900 dark:text-white">
                        {label}
                    </label>
                    <div className="flex gap-2">
                        {!manualMode && (
                            <>
                                {onOpenIcdSearch && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={onOpenIcdSearch}
                                        leftIcon={<Search className="w-3 h-3" />}
                                    >
                                        Из МКБ
                                    </Button>
                                )}
                                {onOpenDiseaseSearch && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={onOpenDiseaseSearch}
                                        leftIcon={<FileText className="w-3 h-3" />}
                                    >
                                        Из базы
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setManualMode(true)}
                                    leftIcon={<Plus className="w-3 h-3" />}
                                >
                                    Вручную
                                </Button>
                            </>
                        )}
                        {manualMode && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setManualMode(false);
                                    setManualCode('');
                                    setManualName('');
                                }}
                            >
                                Отмена
                            </Button>
                        )}
                    </div>
                </div>

                {manualMode && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <Input
                            placeholder="Код МКБ (необязательно)"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                            size="sm"
                        />
                        <div className="flex gap-2">
                            <Input
                                placeholder="Название"
                                value={manualName}
                                onChange={(e) => setManualName(e.target.value)}
                                className="flex-1"
                                size="sm"
                            />
                            <Button
                                type="button"
                                onClick={handleManualSave}
                                disabled={!manualName.trim() || !isCodeValid}
                                size="sm"
                            >
                                Добавить
                            </Button>
                        </div>
                    </div>
                )}

                {values.length > 0 && (
                    <div className="space-y-2">
                        {values.map((diagnosis, index) => (
                            <div
                                key={diagnosis.code ?? `manual-${index}`}
                                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                            >
                                {diagnosis.code ? (
                                    <Badge variant="primary" size="sm">
                                        {diagnosis.code}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" size="sm">
                                        Без кода
                                    </Badge>
                                )}
                                <span className="flex-1 text-sm text-slate-900 dark:text-white">
                                    {diagnosis.nameRu}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemove(index)}
                                    leftIcon={<X className="w-3 h-3" />}
                                >
                                    Удалить
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {values.length === 0 && !manualMode && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                        Нет добавленных диагнозов
                    </p>
                )}

                {error && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                    </p>
                )}
            </div>
        </Card>
    );
};
