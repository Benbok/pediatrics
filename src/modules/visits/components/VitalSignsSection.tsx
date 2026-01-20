import React, { useMemo } from 'react';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Activity, Heart, Droplet, Thermometer, Wind } from 'lucide-react';
import { Visit } from '../../../types';
import { BP_NORMS, PULSE_NORMS, BPNorm, PulseNorm } from '../constants';

interface VitalSignsSectionProps {
    formData: Partial<Visit>;
    onChange: (field: keyof Visit, value: any) => void;
    errors?: Record<string, string>;
    ageMonths?: number;
}

// Получить норму пульса для возраста
const getPulseNorm = (ageMonths?: number): PulseNorm | null => {
    if (ageMonths === undefined || ageMonths === null) return null;
    return PULSE_NORMS.find(norm => ageMonths >= norm.minAgeMonths && ageMonths < norm.maxAgeMonths) || null;
};

// Получить норму АД для возраста
const getBPNorm = (ageMonths?: number): BPNorm | null => {
    if (ageMonths === undefined || ageMonths === null) return null;
    return BP_NORMS.find(norm => ageMonths >= norm.minAgeMonths && ageMonths < norm.maxAgeMonths) || null;
};

// Валидация пульса
const validatePulse = (pulse: number | null | undefined, ageMonths?: number): { status: 'normal' | 'warning' | 'abnormal'; label: string } | null => {
    if (pulse === null || pulse === undefined || ageMonths === undefined || ageMonths === null) return null;

    const norm = getPulseNorm(ageMonths);
    if (!norm) return null;

    if (pulse < norm.min) {
        return { status: 'abnormal', label: 'Брадикардия' };
    } else if (pulse > norm.max) {
        return { status: 'abnormal', label: 'Тахикардия' };
    } else {
        return { status: 'normal', label: 'Норма' };
    }
};

// Валидация АД
const validateBP = (sys: number | null | undefined, dia: number | null | undefined, ageMonths?: number): { status: 'normal' | 'warning' | 'abnormal'; label: string } | null => {
    if ((sys === null || sys === undefined) && (dia === null || dia === undefined) || ageMonths === undefined || ageMonths === null) return null;

    const norm = getBPNorm(ageMonths);
    if (!norm) return null;

    let hasAbnormal = false;
    let hasWarning = false;
    const issues: string[] = [];

    if (sys !== null && sys !== undefined) {
        if (sys < norm.sysMin) {
            hasAbnormal = true;
            issues.push('САД ↓');
        } else if (sys > norm.sysMax) {
            hasAbnormal = true;
            issues.push('САД ↑');
        }
    }

    if (dia !== null && dia !== undefined) {
        if (dia < norm.diaMin) {
            hasAbnormal = true;
            issues.push('ДАД ↓');
        } else if (dia > norm.diaMax) {
            hasAbnormal = true;
            issues.push('ДАД ↑');
        }
    }

    if (hasAbnormal) {
        return { status: 'abnormal', label: issues.join(' ') };
    } else {
        return { status: 'normal', label: 'Норма' };
    }
};

// Валидация сатурации
const validateOxygenSaturation = (spo2: number | null | undefined): { status: 'normal' | 'warning' | 'abnormal'; label: string } | null => {
    if (spo2 === null || spo2 === undefined) return null;

    if (spo2 >= 95) {
        return { status: 'normal', label: 'Норма' };
    } else if (spo2 >= 90) {
        return { status: 'warning', label: 'Требует оценки' };
    } else {
        return { status: 'abnormal', label: 'Гипоксемия' };
    }
};

// Валидация ЧДД
const getNormalRespiratoryRate = (ageMonths?: number): string => {
    if (ageMonths === undefined || ageMonths === null) return '20-30';
    if (ageMonths < 12) return '30-60';
    if (ageMonths < 24) return '24-40';
    if (ageMonths < 60) return '22-34';
    if (ageMonths < 120) return '18-30';
    return '16-24';
};

const validateRespiratoryRate = (rate: number | null | undefined): { status: 'normal' | 'warning' | 'abnormal'; label: string } | null => {
    if (rate === null || rate === undefined) return null;

    if (rate > 60) {
        return { status: 'abnormal', label: 'Тахипноэ' };
    }

    // Дополнительные проверки можно добавить по возрасту, если нужно
    return { status: 'normal', label: 'Норма' };
};

// Валидация температуры
const validateTemperature = (temp: number | null | undefined): { status: 'normal' | 'warning' | 'abnormal'; label: string } | null => {
    if (temp === null || temp === undefined) return null;

    if (temp >= 38.0) {
        return { status: 'abnormal', label: 'Лихорадка' };
    } else if (temp >= 37.0) {
        return { status: 'warning', label: 'Субфебрилитет' };
    } else {
        return { status: 'normal', label: 'Норма' };
    }
};

// Компонент для отображения статуса
const StatusBadge: React.FC<{ status: 'normal' | 'warning' | 'abnormal'; label: string }> = ({ status, label }) => {
    const styles = {
        normal: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
        warning: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
        abnormal: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    };

    return (
        <div className={`text-xs font-semibold px-2.5 py-1 rounded-lg border flex-shrink-0 whitespace-nowrap ${styles[status]}`}>
            {label}
        </div>
    );
};

export const VitalSignsSection: React.FC<VitalSignsSectionProps> = ({
    formData,
    onChange,
    errors = {},
    ageMonths,
}) => {
    const pulseNorm = getPulseNorm(ageMonths);
    const bpNorm = getBPNorm(ageMonths);
    const pulseValidation = validatePulse(formData.pulse, ageMonths);
    const bpValidation = validateBP(formData.bloodPressureSystolic, formData.bloodPressureDiastolic, ageMonths);
    const spo2Validation = validateOxygenSaturation(formData.oxygenSaturation);
    const rrValidation = validateRespiratoryRate(formData.respiratoryRate);
    const tempValidation = validateTemperature(formData.temperature);

    // Рассчет среднего АД (Mean Arterial Pressure)
    const mapValue = useMemo(() => {
        if (
            formData.bloodPressureSystolic !== undefined &&
            formData.bloodPressureSystolic !== null &&
            formData.bloodPressureDiastolic !== undefined &&
            formData.bloodPressureDiastolic !== null
        ) {
            // Formula: (Sys + 2 * Dia) / 3
            return Math.round((formData.bloodPressureSystolic + 2 * formData.bloodPressureDiastolic) / 3);
        }
        return null;
    }, [formData.bloodPressureSystolic, formData.bloodPressureDiastolic]);

    return (
        <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                    <Activity className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Показатели жизнедеятельности
                </h3>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Row 1: BP (7 cols) and Pulse (5 cols) */}

                {/* Артериальное давление */}
                <div className="col-span-12 lg:col-span-7 space-y-3">
                    <div className="flex items-center justify-between h-8">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <Heart className="w-4 h-4 text-slate-500" />
                            Артериальное давление
                        </label>
                        {bpValidation && bpValidation.status !== 'normal' && (
                            <StatusBadge status={bpValidation.status} label={bpValidation.label} />
                        )}
                    </div>
                    {bpNorm && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Норма: {bpNorm.sysMin}-{bpNorm.sysMax} / {bpNorm.diaMin}-{bpNorm.diaMax}
                        </p>
                    )}
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            placeholder="САД"
                            value={formData.bloodPressureSystolic || ''}
                            onChange={(e) => onChange('bloodPressureSystolic', e.target.value ? parseInt(e.target.value) : null)}
                            error={errors.bloodPressureSystolic}
                            className="flex-1"
                        />
                        <span className="text-slate-400 font-medium">/</span>
                        <Input
                            type="number"
                            placeholder="ДАД"
                            value={formData.bloodPressureDiastolic || ''}
                            onChange={(e) => onChange('bloodPressureDiastolic', e.target.value ? parseInt(e.target.value) : null)}
                            error={errors.bloodPressureDiastolic}
                            className="flex-1"
                        />
                        <span className="text-slate-500 text-sm font-medium whitespace-nowrap">мм.рт.ст</span>
                    </div>
                    {mapValue !== null && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
                            <span>Среднее АД:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{mapValue}</span>
                        </div>
                    )}
                </div>

                {/* Пульс */}
                <div className="col-span-12 lg:col-span-5 space-y-3">
                    <div className="flex items-center justify-between h-8">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <Activity className="w-4 h-4 text-slate-500" />
                            Пульс (ЧСС)
                        </label>
                        {pulseValidation && pulseValidation.status !== 'normal' && (
                            <StatusBadge status={pulseValidation.status} label={pulseValidation.label} />
                        )}
                    </div>
                    {pulseNorm && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Норма: {pulseNorm.min}-{pulseNorm.max} (ср. {pulseNorm.average})
                        </p>
                    )}
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            placeholder="уд/мин"
                            value={formData.pulse || ''}
                            onChange={(e) => onChange('pulse', e.target.value ? parseInt(e.target.value) : null)}
                            error={errors.pulse}
                            leftIcon={<Activity className="w-4 h-4" />}
                            className="flex-1"
                        />
                    </div>
                </div>

                {/* Row 2: Temp (4 cols), RR (4 cols), SpO2 (4 cols) */}

                {/* Температура */}
                <div className="col-span-12 lg:col-span-4 space-y-3">
                    <div className="flex items-center justify-between h-8">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <Thermometer className="w-4 h-4 text-slate-500" />
                            Температура
                        </label>
                        {tempValidation && tempValidation.status !== 'normal' && (
                            <StatusBadge status={tempValidation.status} label={tempValidation.label} />
                        )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Норма: &lt; 37.0 °C
                    </p>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            step="0.1"
                            placeholder="°C"
                            value={formData.temperature || ''}
                            onChange={(e) => onChange('temperature', e.target.value ? parseFloat(e.target.value) : null)}
                            error={errors.temperature}
                            leftIcon={<Thermometer className="w-4 h-4" />}
                            className="flex-1"
                        />
                    </div>
                </div>

                {/* Частота дыхательных движений */}
                <div className="col-span-12 lg:col-span-4 space-y-3">
                    <div className="flex items-center justify-between h-8">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <Wind className="w-4 h-4 text-slate-500 whitespace-nowrap" />
                            ЧДД
                        </label>
                        {rrValidation && rrValidation.status !== 'normal' && (
                            <StatusBadge status={rrValidation.status} label={rrValidation.label} />
                        )}
                    </div>
                    {ageMonths !== undefined && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Норма: {getNormalRespiratoryRate(ageMonths)}
                        </p>
                    )}
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            placeholder="в минуту"
                            value={formData.respiratoryRate || ''}
                            onChange={(e) => onChange('respiratoryRate', e.target.value ? parseInt(e.target.value) : null)}
                            error={errors.respiratoryRate}
                            leftIcon={<Wind className="w-4 h-4" />}
                            className="flex-1"
                        />
                    </div>
                </div>

                {/* Сатурация кислорода */}
                <div className="col-span-12 lg:col-span-4 space-y-3">
                    <div className="flex items-center justify-between h-8">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <Droplet className="w-4 h-4 text-slate-500" />
                            SpO2
                        </label>
                        {spo2Validation && spo2Validation.status !== 'normal' && (
                            <StatusBadge status={spo2Validation.status} label={spo2Validation.label} />
                        )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Норма: ≥95%
                    </p>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            placeholder="%"
                            min="0"
                            max="100"
                            value={formData.oxygenSaturation || ''}
                            onChange={(e) => onChange('oxygenSaturation', e.target.value ? parseInt(e.target.value) : null)}
                            error={errors.oxygenSaturation}
                            leftIcon={<Droplet className="w-4 h-4" />}
                            className="flex-1"
                        />
                    </div>
                </div>
            </div>
        </Card>
    );
};
