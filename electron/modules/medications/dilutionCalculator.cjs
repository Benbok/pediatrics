/**
 * Калькулятор разведения инфузионных препаратов
 */
class DilutionCalculator {
    /**
     * Рассчитать параметры разведения
     * @param {Object} params
     * @param {number} params.doseNeeded - Нужная доза (мг)
     * @param {number} params.concentration - Концентрация ампулы (мг/мл)
     * @param {number} params.dilutionVolumeMin - Мин объем разведения (мл)
     * @param {number} params.dilutionVolumeMax - Макс объем разведения (мл)
     * @param {number} params.infusionDurationMin - Мин время инфузии (минуты)
     * @param {number} params.infusionDurationMax - Макс время инфузии (минуты)
     */
    calculate(params) {
        const {
            doseNeeded,
            concentration,
            dilutionVolumeMin = 50,
            dilutionVolumeMax = 100,
            infusionDurationMin = 15,
            infusionDurationMax = 30
        } = params;

        // Объем препарата
        const drugVolume = doseNeeded / concentration;

        // Общий объем после разведения
        const totalVolumeMin = dilutionVolumeMin + drugVolume;
        const totalVolumeMax = dilutionVolumeMax + drugVolume;

        // Скорость инфузии (мл/час)
        const rateMin = (totalVolumeMin / infusionDurationMax) * 60;
        const rateMax = (totalVolumeMax / infusionDurationMin) * 60;

        // Финальная концентрация
        const finalConcentrationMin = doseNeeded / totalVolumeMax;
        const finalConcentrationMax = doseNeeded / totalVolumeMin;

        return {
            drugVolume: Math.round(drugVolume * 10) / 10,
            dilutionVolume: {
                min: dilutionVolumeMin,
                max: dilutionVolumeMax
            },
            totalVolume: {
                min: Math.round(totalVolumeMin),
                max: Math.round(totalVolumeMax)
            },
            infusionRate: {
                min: Math.round(rateMin),
                max: Math.round(rateMax),
                unit: 'мл/час'
            },
            infusionDuration: {
                min: infusionDurationMin,
                max: infusionDurationMax,
                unit: 'минут'
            },
            finalConcentration: {
                min: Math.round(finalConcentrationMin * 100) / 100,
                max: Math.round(finalConcentrationMax * 100) / 100,
                unit: 'мг/мл'
            }
        };
    }

    /**
     * Генерировать инструкцию по разведению
     */
    generateInstruction(calculation, drugName) {
        return `
📝 Инструкция по разведению ${drugName}

1. Взять ${calculation.drugVolume} мл препарата
2. Развести в ${calculation.dilutionVolume.min}-${calculation.dilutionVolume.max} мл растворителя (обычно NaCl 0.9% или Глюкоза 5%)
3. Общий объем: ${calculation.totalVolume.min}-${calculation.totalVolume.max} мл
4. Вводить в/в капельно со скоростью ${calculation.infusionRate.min}-${calculation.infusionRate.max} мл/час
5. Длительность введения: ${calculation.infusionDuration.min}-${calculation.infusionDuration.max} минут

Финальная концентрация: ${calculation.finalConcentration.min}-${calculation.finalConcentration.max} мг/мл
        `.trim();
    }
}

module.exports = { DilutionCalculator };
