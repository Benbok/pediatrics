import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Beaker, Calculator } from 'lucide-react';

interface DilutionCalculatorProps {
    medication: any;
    childWeight: number;
    calculatedDose?: number; // Доза в мг
}

export const DilutionCalculator: React.FC<DilutionCalculatorProps> = ({
    medication,
    childWeight,
    calculatedDose
}) => {
    const [calculation, setCalculation] = useState<any>(null);
    const [params, setParams] = useState({
        concentration: 50, // мг/мл
        dilutionVolumeMin: 50,
        dilutionVolumeMax: 100,
        infusionDurationMin: 15,
        infusionDurationMax: 30
    });

    const handleCalculate = () => {
        if (!calculatedDose || calculatedDose <= 0) {
            alert('Сначала рассчитайте дозу для ребенка');
            return;
        }

        const doseNeeded = calculatedDose;

        const drugVolume = doseNeeded / params.concentration;
        const totalVolumeMin = params.dilutionVolumeMin + drugVolume;
        const totalVolumeMax = params.dilutionVolumeMax + drugVolume;
        const rateMin = (totalVolumeMin / params.infusionDurationMax) * 60;
        const rateMax = (totalVolumeMax / params.infusionDurationMin) * 60;

        setCalculation({
            doseNeeded: Math.round(doseNeeded),
            drugVolume: Math.round(drugVolume * 10) / 10,
            dilutionVolume: { min: params.dilutionVolumeMin, max: params.dilutionVolumeMax },
            totalVolume: { min: Math.round(totalVolumeMin), max: Math.round(totalVolumeMax) },
            infusionRate: { min: Math.round(rateMin), max: Math.round(rateMax) }
        });
    };

    return (
        <Card className="p-6 rounded-[24px] border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
                    <Beaker className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Калькулятор разведения
                </h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <Input
                    label="Концентрация ампулы (мг/мл)"
                    type="number"
                    value={params.concentration}
                    onChange={e => setParams({ ...params, concentration: Number(e.target.value) })}
                />
                <Input
                    label="Объем разведения (мл)"
                    type="number"
                    value={params.dilutionVolumeMin}
                    onChange={e => setParams({ ...params, dilutionVolumeMin: Number(e.target.value) })}
                />
            </div>

            <Button onClick={handleCalculate} variant="primary" className="w-full mb-4">
                <Calculator className="w-4 h-4 mr-2" />
                Рассчитать
            </Button>

            {calculation && (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-xl space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-slate-500">Доза:</span>
                            <strong className="block text-lg">{calculation.doseNeeded} мг</strong>
                        </div>
                        <div>
                            <span className="text-slate-500">Взять препарата:</span>
                            <strong className="block text-lg text-blue-600">{calculation.drugVolume} мл</strong>
                        </div>
                        <div>
                            <span className="text-slate-500">Общий объем:</span>
                            <strong className="block text-lg">{calculation.totalVolume.min}-{calculation.totalVolume.max} мл</strong>
                        </div>
                        <div>
                            <span className="text-slate-500">Скорость:</span>
                            <strong className="block text-lg text-green-600">{calculation.infusionRate.min}-{calculation.infusionRate.max} мл/ч</strong>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};
