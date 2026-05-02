import React from 'react';
import { Input } from '../../../../components/ui/Input';
import { AutoResizeTextarea } from '../../../../components/ui/AutoResizeTextarea';
import { Baby } from 'lucide-react';
import { BirthData } from '../../../../types';

interface BirthSectionProps {
    data: BirthData | null;
    onChange: (data: BirthData) => void;
}

export const BirthSection: React.FC<BirthSectionProps> = ({ data, onChange }) => {
    const birthData: BirthData = data || {};
    const [gestationalAgeInput, setGestationalAgeInput] = React.useState<string>('');

    // Синхронизируем локальное состояние с данными при загрузке
    React.useEffect(() => {
        if (birthData.gestationalAge !== null && birthData.gestationalAge !== undefined) {
            setGestationalAgeInput(birthData.gestationalAge.toString());
        } else {
            setGestationalAgeInput('');
        }
    }, [birthData.gestationalAge]);

    const handleChange = (field: keyof BirthData, value: any) => {
        onChange({
            ...birthData,
            [field]: value === '' ? null : value,
        });
    };

    /**
     * Обрабатывает изменение значения через спиннеры или прямой ввод
     */
    const handleGestationalAgeChange = (value: string) => {
        if (!value || value.trim() === '') {
            setGestationalAgeInput('');
            handleChange('gestationalAge', null);
            return;
        }

        // Парсим числовое значение (Input type="number" всегда возвращает строку с точкой)
        const numValue = parseFloat(value);

        if (isNaN(numValue)) {
            return; // Игнорируем невалидные значения
        }

        // Обрабатываем значение
        processGestationalAge(numValue, true);
    };

    /**
     * Обрабатывает потерю фокуса - применяет финальную валидацию
     */
    const handleGestationalAgeBlur = () => {
        if (!gestationalAgeInput || gestationalAgeInput.trim() === '') {
            handleChange('gestationalAge', null);
            setGestationalAgeInput('');
            return;
        }

        // Парсим текущее значение
        const normalizedValue = gestationalAgeInput.replace(',', '.');
        const numValue = parseFloat(normalizedValue);

        if (isNaN(numValue)) {
            setGestationalAgeInput('');
            handleChange('gestationalAge', null);
            return;
        }

        // Финальная обработка при потере фокуса
        processGestationalAge(numValue, false);
    };

    /**
     * Обрабатывает числовое значение длительности беременности
     * @param numValue - числовое значение
     * @param isInput - true если это изменение во время ввода, false если потеря фокуса
     */
    const processGestationalAge = (numValue: number, isInput: boolean) => {
        // Ограничиваем диапазон (только при потере фокуса)
        let finalValue = numValue;
        if (!isInput) {
            if (numValue < 20) {
                finalValue = 20;
            } else if (numValue > 45) {
                finalValue = 45;
            }
        }

        // Разделяем на недели и дни
        const weeks = Math.floor(finalValue);
        const daysDecimal = finalValue - weeks;

        // Если нет дробной части, сохраняем как целое число
        if (daysDecimal === 0) {
            const valueToSave = isInput ? finalValue : weeks;
            handleChange('gestationalAge', valueToSave);
            setGestationalAgeInput(valueToSave.toString());
            return;
        }

        // Конвертируем дробную часть в дни (0.1 = 1 день, 0.5 = 5 дней и т.д.)
        let days = Math.round(daysDecimal * 10); // 0.5 -> 5, 0.7 -> 7

        // Если дней >= 7, переводим в следующую неделю
        if (days >= 7) {
            const newWeeks = weeks + 1;
            handleChange('gestationalAge', newWeeks);
            setGestationalAgeInput(newWeeks.toString());
        } else {
            // Сохраняем как есть: недели + дни/10 (например, 38.5)
            const result = weeks + days / 10;
            const normalized = Math.round(result * 10) / 10;
            handleChange('gestationalAge', normalized);
            // Для отображения используем запятую
            setGestationalAgeInput(normalized.toString());
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
                <Baby className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Сведения о беременности и родах
                </h4>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Течение беременности
                    </label>
                    <AutoResizeTextarea
                        value={birthData.pregnancyCourse || ''}
                        onChange={(e) => handleChange('pregnancyCourse', e.target.value)}
                        placeholder="Опишите течение беременности..."
                        rows={3}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm text-slate-800 dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Акушерский анамнез
                    </label>
                    <AutoResizeTextarea
                        value={birthData.obstetricalHistory || ''}
                        onChange={(e) => handleChange('obstetricalHistory', e.target.value)}
                        placeholder="Акушерский анамнез..."
                        rows={3}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm text-slate-800 dark:text-white"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Способ родоразрешения
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors flex-1">
                            <input
                                type="radio"
                                name="deliveryMethod"
                                checked={birthData.deliveryMethod === 'natural'}
                                onChange={() => handleChange('deliveryMethod', 'natural')}
                                className="w-4 h-4 text-primary-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Естественные роды</span>
                        </label>
                        <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors flex-1">
                            <input
                                type="radio"
                                name="deliveryMethod"
                                checked={birthData.deliveryMethod === 'cesarean'}
                                onChange={() => handleChange('deliveryMethod', 'cesarean')}
                                className="w-4 h-4 text-primary-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Кесарево сечение</span>
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Длительность беременности (недель)
                        </label>
                        <Input
                            type="number"
                            step="0.1"
                            min="20"
                            max="45"
                            value={gestationalAgeInput}
                            onChange={(e) => handleGestationalAgeChange(e.target.value)}
                            onBlur={handleGestationalAgeBlur}
                            placeholder="38.5"
                            className="w-full"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Формат: недели.дни (например: 38.5 = 38 недель и 5 дней, максимум 6 дней)
                        </p>
                    </div>

                    <Input
                        label="Масса при рождении (г)"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={birthData.birthWeight?.toString() || ''}
                        onChange={(e) => {
                            const sanitizedValue = e.target.value.replace(/\D/g, '').slice(0, 4);
                            handleChange('birthWeight', sanitizedValue ? parseInt(sanitizedValue, 10) : null);
                        }}
                        placeholder="3500"
                        min={500}
                        max={7000}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Рост при рождении (см)"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        value={birthData.birthHeight?.toString() || ''}
                        onChange={(e) => {
                            const sanitizedValue = e.target.value.replace(/\D/g, '').slice(0, 2);
                            handleChange('birthHeight', sanitizedValue ? parseInt(sanitizedValue, 10) : null);
                        }}
                        placeholder="50"
                        min={20}
                        max={70}
                    />

                    <Input
                        label="Оценка по шкале Апгар"
                        type="text"
                        value={birthData.apgarScore || ''}
                        onChange={(e) => handleChange('apgarScore', e.target.value || null)}
                        placeholder="8/8 или 8/8/8"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Период новорожденности: осложнений
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors flex-1">
                            <input
                                type="radio"
                                name="neonatalComplications"
                                checked={birthData.neonatalComplications === false}
                                onChange={() => handleChange('neonatalComplications', false)}
                                className="w-4 h-4 text-primary-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Не было</span>
                        </label>
                        <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors flex-1">
                            <input
                                type="radio"
                                name="neonatalComplications"
                                checked={birthData.neonatalComplications === true}
                                onChange={() => handleChange('neonatalComplications', true)}
                                className="w-4 h-4 text-primary-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Было</span>
                        </label>
                    </div>
                    {birthData.neonatalComplications && (
                        <Input
                            label="Описание осложнений"
                            value={birthData.neonatalComplicationsDetails || ''}
                            onChange={(e) => handleChange('neonatalComplicationsDetails', e.target.value)}
                            placeholder="Опишите осложнения периода новорожденности..."
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
