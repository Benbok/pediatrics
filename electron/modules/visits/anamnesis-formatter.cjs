/**
 * Форматирует структурированный анамнез жизни 025/у для AI
 */
class AnamnesisFormatter {
    /**
     * Форматирует данные наследственности
     */
    static formatHeredity(heredityData) {
        if (!heredityData) return null;
        
        const data = typeof heredityData === 'string' 
            ? JSON.parse(heredityData) 
            : heredityData;
        
        const conditions = [];
        if (data.tuberculosis) conditions.push('туберкулез');
        if (data.diabetes) conditions.push('диабет');
        if (data.hypertension) conditions.push('гипертония');
        if (data.oncology) conditions.push('онкология');
        if (data.allergies) conditions.push('аллергические заболевания');
        if (data.other) conditions.push(data.other);
        
        if (conditions.length === 0) return null;
        
        return `Отягощенная наследственность: ${conditions.join(', ')}`;
    }
    
    /**
     * Форматирует данные о беременности и родах
     */
    static formatBirthData(birthData) {
        if (!birthData) return null;
        
        const data = typeof birthData === 'string'
            ? JSON.parse(birthData)
            : birthData;
        
        const parts = [];
        
        if (data.gestationalAge && data.gestationalAge < 37) {
            parts.push(`недоношенность (${data.gestationalAge} недель)`);
        }
        
        if (data.birthWeight && data.birthWeight < 2500) {
            parts.push(`низкая масса при рождении (${data.birthWeight}г)`);
        }
        
        if (data.apgarScore && data.apgarScore < 7) {
            parts.push(`низкая оценка по Апгар (${data.apgarScore} баллов)`);
        }
        
        if (data.neonatalComplications && data.neonatalComplicationsDetails) {
            parts.push(`осложнения в неонатальном периоде: ${data.neonatalComplicationsDetails}`);
        }
        
        if (parts.length === 0) return null;
        
        return `Перинатальный анамнез: ${parts.join(', ')}`;
    }
    
    /**
     * Форматирует данные о вскармливании
     */
    static formatFeedingData(feedingData) {
        if (!feedingData) return null;
        
        const data = typeof feedingData === 'string'
            ? JSON.parse(feedingData)
            : feedingData;
        
        const parts = [];
        
        if (data.breastfeeding === false) {
            parts.push('искусственное вскармливание с рождения');
        } else if (data.breastfeeding && data.breastfeedingTo) {
            parts.push(`грудное вскармливание до ${data.breastfeedingTo}`);
        }
        
        if (data.complementaryFoodAge && data.complementaryFoodAge < 4) {
            parts.push(`ранний прикорм (${data.complementaryFoodAge} мес)`);
        }
        
        if (data.nutritionFeatures) {
            parts.push(data.nutritionFeatures);
        }
        
        if (parts.length === 0) return null;
        
        return `Вскармливание: ${parts.join(', ')}`;
    }
    
    /**
     * Форматирует данные о перенесенных инфекциях
     */
    static formatInfectiousDiseases(infectiousData) {
        if (!infectiousData) return null;
        
        const data = typeof infectiousData === 'string'
            ? JSON.parse(infectiousData)
            : infectiousData;
        
        const diseases = [];
        
        if (data.measles?.had) diseases.push('корь');
        if (data.chickenpox?.had) diseases.push('ветрянка');
        if (data.rubella?.had) diseases.push('краснуха');
        if (data.pertussis?.had) diseases.push('коклюш');
        if (data.scarletFever?.had) diseases.push('скарлатина');
        
        if (data.tonsillitis?.had) {
            const perYear = data.tonsillitis.perYear;
            if (perYear && perYear >= 4) {
                diseases.push(`частые ангины (${perYear} раз/год)`);
            } else {
                diseases.push('ангина');
            }
        }
        
        if (data.other) diseases.push(data.other);
        
        if (diseases.length === 0) return null;
        
        return `Перенесенные инфекции: ${diseases.join(', ')}`;
    }
    
    /**
     * Форматирует аллергологический статус
     */
    static formatAllergyStatus(allergyData) {
        if (!allergyData) return null;
        
        const data = typeof allergyData === 'string'
            ? JSON.parse(allergyData)
            : allergyData;
        
        const allergies = [];
        
        if (data.food) allergies.push(`пищевая: ${data.food}`);
        if (data.medication) allergies.push(`лекарственная: ${data.medication}`);
        if (data.materials) allergies.push(`на материалы: ${data.materials}`);
        if (data.insectBites) allergies.push(`на укусы: ${data.insectBites}`);
        if (data.seasonal) allergies.push(`сезонная: ${data.seasonal}`);
        
        if (allergies.length === 0) return null;
        
        return `Аллергологический статус: ${allergies.join('; ')}`;
    }
    
    /**
     * Форматирует весь анамнез жизни
     */
    static formatFullAnamnesis(visit) {
        const sections = [];
        
        const heredity = this.formatHeredity(visit.heredityData);
        if (heredity) sections.push(heredity);
        
        const birth = this.formatBirthData(visit.birthData);
        if (birth) sections.push(birth);
        
        const feeding = this.formatFeedingData(visit.feedingData);
        if (feeding) sections.push(feeding);
        
        const infectious = this.formatInfectiousDiseases(visit.infectiousDiseasesData);
        if (infectious) sections.push(infectious);
        
        const allergy = this.formatAllergyStatus(visit.allergyStatusData);
        if (allergy) sections.push(allergy);
        
        return sections;
    }
}

module.exports = { AnamnesisFormatter };
