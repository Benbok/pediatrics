import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertCircle, Pill, Beaker, Calculator } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Medication } from '../../../types';
import type { MatchingRuleSummary, CalculationBreakdown } from '../../../types/medication.types';
import { getRouteLabel, requiresDilution, ROUTE_LABELS, RouteOfAdmin } from '../../../utils/routeOfAdmin';
import { getDiluentLabel, DILUENT_LABELS, DiluentType } from '../../../utils/diluentTypes';
import { calculateDilution, validateDilutionInput } from '../services/medicationDoseCalcService';
import { formatAgeLabel } from '../../../utils/ageUtils';

interface MedicationDoseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (doseData: DoseData) => void;
    medication: Medication | null;
    initialDoseData?: Partial<DoseData>;
    patientWeight?: number;
    patientAgeMonths?: number;
    patientHeight?: number | null;
    /** Подходящие правила для выбора (если несколько) */
    matchingRulesSummary?: MatchingRuleSummary[];
    /** Индекс применённого правила */
    appliedRuleIndex?: number;
    /** Пошаговый расчёт для отображения */
    calculationBreakdown?: CalculationBreakdown | null;
    /** Вызов при смене правила (родитель пересчитает дозу) */
    onRuleChange?: (ruleIndex: number) => void;
}

export interface DoseData {
    dosing: string;
    duration: string;
    singleDoseMg?: number | null;
    timesPerDay?: number | null;
    routeOfAdmin?: string | null;
    packagingDescription?: string | null;
    dilution?: {
        enabled: boolean;
        drugAmountMg?: number | null;
        diluentType?: 'nacl_0_9' | 'glucose_5' | 'glucose_10' | 'water_inj' | null;
        diluentVolumeMl?: number | null;
        concentrationMgPerMl?: number | null;
        volumeToDrawMl?: number | null;
    } | null;
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
    matchingRulesSummary,
    appliedRuleIndex,
    calculationBreakdown,
    onRuleChange,
}) => {
    const [dosing, setDosing] = useState(initialDoseData?.dosing || '');
    const [duration, setDuration] = useState(initialDoseData?.duration || '5-7 дней');
    const [singleDoseMg, setSingleDoseMg] = useState<string>(initialDoseData?.singleDoseMg?.toString() || '');
    const [timesPerDay, setTimesPerDay] = useState<string>(initialDoseData?.timesPerDay?.toString() || '');
    const [routeOfAdmin, setRouteOfAdmin] = useState<string>(initialDoseData?.routeOfAdmin || medication?.routeOfAdmin || '');
    const [packagingDescription, setPackagingDescription] = useState(initialDoseData?.packagingDescription || '');

    // Dilution state
    const [dilutionEnabled, setDilutionEnabled] = useState(initialDoseData?.dilution?.enabled || false);
    const [drugAmountMg, setDrugAmountMg] = useState<string>(initialDoseData?.dilution?.drugAmountMg?.toString() || '');
    const [diluentType, setDiluentType] = useState<DiluentType | ''>(initialDoseData?.dilution?.diluentType || '');
    const [diluentVolumeMl, setDiluentVolumeMl] = useState<string>(initialDoseData?.dilution?.diluentVolumeMl?.toString() || '');

    // Check if route requires dilution
    const canShowDilution = useMemo(() => requiresDilution(routeOfAdmin), [routeOfAdmin]);

    // Calculate dilution results
    const dilutionResult = useMemo(() => {
        if (!dilutionEnabled || !canShowDilution || !singleDoseMg || !drugAmountMg || !diluentVolumeMl || !diluentType) {
            return null;
        }

        const singleDose = parseFloat(singleDoseMg);
        const drugAmount = parseFloat(drugAmountMg);
        const volume = parseFloat(diluentVolumeMl);

        if (isNaN(singleDose) || isNaN(drugAmount) || isNaN(volume) || singleDose <= 0 || drugAmount <= 0 || volume <= 0) {
            return null;
        }

        const result = calculateDilution({
            singleDoseMg: singleDose,
            drugAmountMg: drugAmount,
            diluentType: diluentType as DiluentType,
            diluentVolumeMl: volume
        });

        if ('message' in result) {
            return null; // Error, don't show result
        }

        return result;
    }, [dilutionEnabled, canShowDilution, singleDoseMg, drugAmountMg, diluentVolumeMl, diluentType]);

    // Обновляем поля при изменении initialDoseData или medication
    useEffect(() => {
        if (initialDoseData) {
            setDosing(initialDoseData.dosing || '');
            setDuration(initialDoseData.duration || '5-7 дней');
            setSingleDoseMg(initialDoseData.singleDoseMg?.toString() || '');
            setTimesPerDay(initialDoseData.timesPerDay?.toString() || '');
            setRouteOfAdmin(initialDoseData.routeOfAdmin || medication?.routeOfAdmin || '');
            setPackagingDescription(initialDoseData.packagingDescription || medication?.packageDescription || '');
            setDilutionEnabled(initialDoseData.dilution?.enabled || false);
            setDrugAmountMg(initialDoseData.dilution?.drugAmountMg?.toString() || '');
            setDiluentType(initialDoseData.dilution?.diluentType || '');
            setDiluentVolumeMl(initialDoseData.dilution?.diluentVolumeMl?.toString() || '');
        } else if (medication) {
            setRouteOfAdmin(medication.routeOfAdmin || '');
            setPackagingDescription(medication.packageDescription || '');
        }
    }, [initialDoseData, medication]);

    // Сброс при закрытии
    useEffect(() => {
        if (!isOpen) {
            setDosing('');
            setDuration('5-7 дней');
            setSingleDoseMg('');
            setTimesPerDay('');
            setPackagingDescription('');
            setDilutionEnabled(false);
            setDrugAmountMg('');
            setDiluentType('');
            setDiluentVolumeMl('');
        }
    }, [isOpen]);

    if (!isOpen || !medication) return null;

    const handleConfirm = () => {
        const doseData: DoseData = {
            dosing: dosing.trim(),
            duration: duration.trim() || '5-7 дней',
            singleDoseMg: singleDoseMg ? parseFloat(singleDoseMg) : null,
            timesPerDay: timesPerDay ? parseInt(timesPerDay) : null,
            routeOfAdmin: routeOfAdmin || null,
            packagingDescription: packagingDescription.trim() || null,
            dilution: dilutionEnabled && canShowDilution ? {
                enabled: true,
                drugAmountMg: drugAmountMg ? parseFloat(drugAmountMg) : null,
                diluentType: (diluentType || null) as DiluentType | null,
                diluentVolumeMl: diluentVolumeMl ? parseFloat(diluentVolumeMl) : null,
                concentrationMgPerMl: dilutionResult?.concentrationMgPerMl || null,
                volumeToDrawMl: dilutionResult?.volumeToDrawMl || null,
            } : null,
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
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
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
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-500">Способ:</span>
                                    <select
                                        value={routeOfAdmin}
                                        onChange={(e) => setRouteOfAdmin(e.target.value)}
                                        className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:underline"
                                    >
                                        <option value="">Не указано</option>
                                        {Object.entries(ROUTE_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {patientWeight ? `Вес: ${patientWeight} кг` : <span className="text-amber-600 dark:text-amber-400 font-medium">Вес не указан!</span>}
                                    {patientAgeMonths !== undefined && patientAgeMonths !== null && ` • Возраст: ${formatAgeLabel(patientAgeMonths)}`}
                                    {patientHeight && ` • Рост: ${patientHeight} см`}
                                </p>
                                {!patientWeight && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Укажите вес в разделе "Антропометрия" для корректного расчета
                                    </p>
                                )}
                            </div>
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
                    {/* Выбор правила при нескольких подходящих */}
                    {matchingRulesSummary && matchingRulesSummary.length > 1 && onRuleChange && (
                        <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Выберите правило дозирования
                            </label>
                            <div className="space-y-2">
                                {matchingRulesSummary.map(({ ruleIndex, label }) => (
                                    <label
                                        key={ruleIndex}
                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                            appliedRuleIndex === ruleIndex
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="dosingRule"
                                            checked={appliedRuleIndex === ruleIndex}
                                            onChange={() => onRuleChange(ruleIndex)}
                                            className="mt-1 text-primary-600"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Как рассчитана доза */}
                    {calculationBreakdown?.steps?.length ? (
                        <div className="space-y-2 p-4 bg-primary-50 dark:bg-primary-950/20 rounded-xl border border-primary-200 dark:border-primary-900/40">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                <Calculator className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                Как рассчитана доза
                            </div>
                            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-none">
                                {calculationBreakdown.steps.map((step, i) => (
                                    <li key={i}>{step}</li>
                                ))}
                            </ul>
                        </div>
                    ) : matchingRulesSummary?.length ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                            Итоговые значения можно скорректировать вручную.
                        </p>
                    ) : null}

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
                            rows={3}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 text-slate-900 dark:text-white"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Полная инструкция по применению препарата
                        </p>
                    </div>

                    {/* Описание упаковки */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Описание формы выпуска и упаковки
                        </label>
                        <Input
                            type="text"
                            value={packagingDescription}
                            onChange={(e) => setPackagingDescription(e.target.value)}
                            placeholder="Например: Флакон 500 мг + растворитель 10 мл"
                            className="w-full"
                        />
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

                    {/* Разведение препарата (только для IV/IM) */}
                    {canShowDilution && (
                        <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Beaker className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Разведение препарата
                                    </label>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={dilutionEnabled}
                                        onChange={(e) => {
                                            setDilutionEnabled(e.target.checked);
                                            if (!e.target.checked) {
                                                setDiluentType('');
                                                setDiluentVolumeMl('');
                                            }
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
                                </label>
                            </div>

                            {dilutionEnabled && (
                                <div className="space-y-4 mt-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Количество сухого вещества (мг)
                                        </label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={drugAmountMg}
                                            onChange={(e) => setDrugAmountMg(e.target.value)}
                                            placeholder="Например: 500"
                                            className="w-full"
                                        />
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Общее количество действующего вещества в ампуле/флаконе
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Растворитель
                                            </label>
                                            <select
                                                value={diluentType}
                                                onChange={(e) => setDiluentType(e.target.value as DiluentType | '')}
                                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 text-slate-900 dark:text-white"
                                            >
                                                <option value="">Выберите растворитель</option>
                                                {Object.entries(DILUENT_LABELS).map(([key, label]) => (
                                                    <option key={key} value={key}>
                                                        {label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Объем растворителя (мл)
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                value={diluentVolumeMl}
                                                onChange={(e) => setDiluentVolumeMl(e.target.value)}
                                                placeholder="Например: 10"
                                                className="w-full"
                                            />
                                        </div>
                                    </div>

                                    {dilutionResult && (
                                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-primary-200 dark:border-primary-900/40">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                                Расчетные параметры:
                                            </p>
                                            <div className="text-xs">
                                                <span className="text-slate-500 dark:text-slate-400">Объем для набора:</span>
                                                <span className="ml-2 font-semibold text-primary-600 dark:text-primary-400 text-sm">
                                                    {dilutionResult.volumeToDrawMl} мл
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
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
