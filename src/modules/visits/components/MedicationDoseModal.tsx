import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Pill } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Medication } from '../../../types';

interface MedicationDoseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (doseData: DoseData) => void;
    medication: Medication | null;
    initialDoseData?: Partial<DoseData>;
    patientWeight?: number;
    patientAgeMonths?: number;
    patientHeight?: number | null;
}

export interface DoseData {
    dosing: string;
    duration: string;
    singleDoseMg?: number | null;
    timesPerDay?: number | null;
}

export const MedicationDoseModal: React.FC<MedicationDoseModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    medication,
    initialDoseData,
    patientWeight,
    patientAgeMonths,
    patientHeight,
}) => {
    const [dosing, setDosing] = useState(initialDoseData?.dosing || '');
    const [duration, setDuration] = useState(initialDoseData?.duration || '5-7 дней');
    const [singleDoseMg, setSingleDoseMg] = useState<string>(initialDoseData?.singleDoseMg?.toString() || '');
    const [timesPerDay, setTimesPerDay] = useState<string>(initialDoseData?.timesPerDay?.toString() || '');

    // Обновляем поля при изменении initialDoseData
    useEffect(() => {
        if (initialDoseData) {
            setDosing(initialDoseData.dosing || '');
            setDuration(initialDoseData.duration || '5-7 дней');
            setSingleDoseMg(initialDoseData.singleDoseMg?.toString() || '');
            setTimesPerDay(initialDoseData.timesPerDay?.toString() || '');
        }
    }, [initialDoseData]);

    // Сброс при закрытии
    useEffect(() => {
        if (!isOpen) {
            setDosing('');
            setDuration('5-7 дней');
            setSingleDoseMg('');
            setTimesPerDay('');
        }
    }, [isOpen]);

    if (!isOpen || !medication) return null;

    const handleConfirm = () => {
        const doseData: DoseData = {
            dosing: dosing.trim(),
            duration: duration.trim() || '5-7 дней',
            singleDoseMg: singleDoseMg ? parseFloat(singleDoseMg) : null,
            timesPerDay: timesPerDay ? parseInt(timesPerDay) : null,
        };
        onConfirm(doseData);
    };

    const hasChanges = dosing.trim() !== (initialDoseData?.dosing || '').trim() ||
        duration.trim() !== (initialDoseData?.duration || '5-7 дней').trim() ||
        singleDoseMg !== (initialDoseData?.singleDoseMg?.toString() || '') ||
        timesPerDay !== (initialDoseData?.timesPerDay?.toString() || '');

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 bg-primary-50 dark:bg-primary-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-2xl">
                            <Pill className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                Настройка дозировки
                            </h3>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {medication.nameRu}
                            </p>
                            {(patientWeight || patientAgeMonths) && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {patientWeight && `Вес: ${patientWeight} кг`}
                                    {patientAgeMonths && ` • Возраст: ${patientAgeMonths} мес.`}
                                    {patientHeight && ` • Рост: ${patientHeight} см`}
                                </p>
                            )}
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Дозировка */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <AlertCircle className="w-4 h-4 text-slate-500" />
                            Инструкция по применению
                        </label>
                        <textarea
                            value={dosing}
                            onChange={(e) => setDosing(e.target.value)}
                            placeholder="Например: По 10 мг/кг каждые 12 часов..."
                            rows={4}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 text-slate-900 dark:text-white"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Полная инструкция по применению препарата
                        </p>
                    </div>

                    {/* Длительность */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Длительность приема
                        </label>
                        <Input
                            type="text"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="5-7 дней"
                            className="w-full"
                        />
                    </div>

                    {/* Детали дозировки (опционально) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Разовая доза (мг)
                            </label>
                            <Input
                                type="number"
                                step="0.1"
                                value={singleDoseMg}
                                onChange={(e) => setSingleDoseMg(e.target.value)}
                                placeholder="Не указано"
                                className="w-full"
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Опционально, для точного расчета
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Кратность приема (раз/день)
                            </label>
                            <Input
                                type="number"
                                value={timesPerDay}
                                onChange={(e) => setTimesPerDay(e.target.value)}
                                placeholder="Не указано"
                                className="w-full"
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Опционально, для точного расчета
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="min-w-[120px]"
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        className="min-w-[120px]"
                        disabled={!dosing.trim()}
                    >
                        Подтвердить
                    </Button>
                </div>
            </div>
        </div>
    );
};
