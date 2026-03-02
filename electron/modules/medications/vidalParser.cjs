const { GoogleGenAI } = require('@google/genai');
const { logger } = require('../../logger.cjs');

/**
 * Извлекает релевантные секции из HTML для уменьшения размера
 */
function extractRelevantSections(html) {
    const sections = [];
    
    // Функция для безопасного добавления секции
    const addSection = (pattern, label) => {
        const match = html.match(pattern);
        if (match) {
            sections.push(`\n=== ${label} ===\n${match[0]}`);
            logger.info(`[VidalParser] Found section: ${label} (${match[0].length} chars)`);
            return true;
        }
        return false;
    };
    
    // Название препарата
    addSection(/<h1[^>]*>(.*?)<\/h1>/i, 'Название');
    
    // Активное вещество (кратко)
    addSection(/Активное вещество[:\s]*<\/dt>[\s\S]{0,200}/i, 'Активное вещество');
    
    // Код АТХ - максимально широкий поиск
    addSection(/(?:АТХ|ATX|ATC)[:\s]*<\/dt>[\s\S]{0,300}/i, 'АТХ') ||
    addSection(/(?:Код\s+)?(?:АТХ|ATX|ATC)[:\s]*([A-Z]\d{2}[A-Z]{2}\d{2})/i, 'АТХ код') ||
    addSection(/[A-Z]\d{2}[A-Z]{2}\d{2}/i, 'АТХ (pattern)');
    
    // Производитель (кратко)
    addSection(/Производитель[:\s]*<\/dt>[\s\S]{0,200}/i, 'Производитель');
    
    // Фармакологические группы (кратко)
    addSection(/Клинико-фармакологическая группа[\s\S]{0,500}/i, 'Клинико-фарм группа');
    addSection(/Фармако-терапевтическая группа[\s\S]{0,500}/i, 'Фарм-терапевт группа');
    
    // Форма выпуска (кратко)
    addSection(/Форм[аы]\s+выпуска[\s\S]{0,1000}/i, 'Форма выпуска');
    
    // ПОКАЗАНИЯ (критично, расширенный поиск для МКБ-10)
    addSection(/Показания[\s\S]{0,2000}/i, 'Показания') ||
    addSection(/Показания\s+к\s+применению[\s\S]{0,2000}/i, 'Показания к применению');
    
    // МКБ-10 коды - дополнительный поиск
    addSection(/(?:МКБ-10|ICD-10|код\s+по\s+МКБ)[\s\S]{0,500}/i, 'МКБ-10 коды');
    
    // РЕЖИМ ДОЗИРОВАНИЯ (критично, но ограничено)
    addSection(/Режим\s+дозирования[\s\S]{0,4000}/i, 'Дозирование');
    addSection(/Максимальные\s+дозы[\s\S]{0,500}/i, 'Макс дозы');
    
    // Противопоказания (кратко)
    addSection(/Противопоказания[\s\S]{0,1000}/i, 'Противопоказания');
    
    // Побочные действия (кратко)
    addSection(/Побочн[ыео][еы]?\s+(?:действия|эффекты)[\s\S]{0,800}/i, 'Побочные');
    
    // Беременность и лактация (кратко)
    addSection(/Беременность[\s\S]{0,600}/i, 'Беременность');
    addSection(/Лактаци[яи][\s\S]{0,600}/i, 'Лактация');
    
    // Особые указания (кратко)
    addSection(/Особые\s+указания[\s\S]{0,800}/i, 'Особые указания');
    
    // Взаимодействие (кратко)
    addSection(/Взаимодействие[\s\S]{0,800}/i, 'Взаимодействие');
    
    const extracted = sections.join('\n\n');
    logger.info(`[VidalParser] Total extracted: ${extracted.length} chars from ${html.length} chars (${Math.round(extracted.length/html.length*100)}%)`);
    logger.info(`[VidalParser] Sections found: ${sections.length}`);
    
    return extracted.slice(0, 12000); // Ограничиваем до 12К для максимальной скорости
}

/**
 * Парсит HTML страницы Видаль с помощью AI
 * @param {string} html - HTML содержимое
 * @returns {Promise<object>} - Структурированные данные препарата
 */
async function parseVidalWithAI(html) {
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY не найден. Установите VITE_GEMINI_API_KEY или GEMINI_API_KEY в .env.local');
    }
    
    const modelName = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || 'gemini-1.5-pro';
    
    const ai = new GoogleGenAI({ apiKey });

    // Извлекаем только релевантные секции для ускорения
    const relevantHtml = extractRelevantSections(html);

    const prompt = `Извлеки данные из HTML Видаль в JSON.

${relevantHtml}

JSON: {nameRu, activeSubstance, atcCode, manufacturer, clinicalPharmGroup, pharmTherapyGroup, packageDescription, forms: [{id, type, concentration, description}], pediatricDosing: [{minAgeMonths, maxAgeMonths, formId, dosing: {type: "weight_based"/"fixed", mgPerKg или fixedDose: {min, max, unit}}, routeOfAdmin, timesPerDay, maxSingleDose, maxDailyDose, instruction}], adultDosing: [], indications, contraindications, sideEffects, pregnancy, lactation, cautionConditions, interactions, minInterval, maxDosesPerDay, maxDurationDays, routeOfAdmin, icd10Codes: []}

КРИТИЧНО:
1. atcCode - найди код формата N02BE01 (буква-2цифры-буквы-2цифры). Ищи в тексте "АТХ", "ATX", "Код ATC"
2. icd10Codes - массив кодов МКБ-10 из секции "Показания". Формат: R50, R51.0, J06.9 и т.д. Ищи "МКБ-10", "код по МКБ", упоминания болезней с кодами
3. indications - текст показаний (ОБЯЗАТЕЛЬНО)
4. forms - у КАЖДОЙ формы ОБЯЗАТЕЛЬНО поле id: уникальный slug на латинице (например "tablet_500mg", "solution_24mgml"). Генерируй из type и concentration.
5. contraindications - ОБЯЗАТЕЛЬНО. Полный текст из секции "Противопоказания к применению". Не оставляй пустым.
6. pediatricDosing - все правила из "Дозирование" для детей. Для каждого правила: maxSingleDose - верхнее значение из "Разовые дозы для детей X-Y лет - A-B мг" (B в мг). maxDailyDose = maxSingleDose × timesPerDay, если не указано иначе.
7. minInterval - интервал между приёмами в ЧАСАХ (не минуты!). Если в тексте "интервал не менее 4 ч" - пиши 4, не 240.
8. Дозы в мг (1г=1000мг), возраст в месяцах
9. Экранируй ", валидный JSON`;

    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: prompt
        });
        const text = result.text;
        
        logger.info('[VidalParser] AI response length:', text.length);
        
        // Очистка от markdown и лишних пробелов
        let jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Попытка починить распространенные проблемы с JSON
        // 1. Удаляем комментарии если есть
        jsonText = jsonText.replace(/\/\/.*/g, '');
        
        // 2. Попытка парсинга
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (parseError) {
            logger.warn('[VidalParser] First parse attempt failed, trying to fix JSON...');
            
            // Логируем фрагмент с ошибкой для отладки
            const errorPos = parseError.message.match(/position (\d+)/)?.[1];
            if (errorPos) {
                const pos = parseInt(errorPos);
                const start = Math.max(0, pos - 100);
                const end = Math.min(jsonText.length, pos + 100);
                logger.error('[VidalParser] Error near:', jsonText.substring(start, end));
            }
            
            // Повторная попытка: очищаем невалидные символы
            jsonText = jsonText
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Убираем control characters
                .replace(/\n/g, ' ') // Заменяем переносы на пробелы
                .replace(/\r/g, ''); // Убираем возвраты каретки
            
            try {
                parsed = JSON.parse(jsonText);
                logger.info('[VidalParser] Successfully parsed after cleanup');
            } catch (secondError) {
                logger.error('[VidalParser] Second parse attempt failed');
                logger.error('[VidalParser] JSON text (first 500 chars):', jsonText.substring(0, 500));
                throw new Error(`Невалидный JSON от AI: ${secondError.message}`);
            }
        }
        
        // Постобработка: убедиться что максимальные дозы в правильных единицах
        if (parsed.pediatricDosing) {
            parsed.pediatricDosing = parsed.pediatricDosing.map(rule => {
                // Конвертация граммов в миллиграммы если нужно
                if (rule.maxSingleDose && rule.maxSingleDose < 10) {
                    rule.maxSingleDose = rule.maxSingleDose * 1000;
                }
                if (rule.maxDailyDose && rule.maxDailyDose < 10) {
                    rule.maxDailyDose = rule.maxDailyDose * 1000;
                }
                return rule;
            });
        }

        // minInterval: если AI вернул минуты (значение > 24), переводим в часы
        if (parsed.minInterval != null && parsed.minInterval > 24) {
            parsed.minInterval = Math.round(parsed.minInterval / 60);
            logger.info('[VidalParser] minInterval converted from minutes to hours:', parsed.minInterval);
        }

        // Автогенерация id для форм, если AI не заполнил
        if (Array.isArray(parsed.forms)) {
            parsed.forms = parsed.forms.map((form, i) => {
                if (!form.id || typeof form.id !== 'string' || form.id.trim() === '') {
                    const base = (form.type || 'form') + '_' + (form.concentration || String(i));
                    const slug = base.toString().replace(/[^a-zA-Z0-9\u0400-\u04FF]/g, '_').toLowerCase().slice(0, 40) || `form_${i}`;
                    form.id = slug;
                    logger.info('[VidalParser] Auto-generated form id:', form.id);
                }
                return form;
            });
        }

        // Fallback: подставить глобальные макс. дозы из текста, если в правилах не указаны
        const globalMaxes = extractMaxDoses(relevantHtml);
        if (Array.isArray(parsed.pediatricDosing)) {
            parsed.pediatricDosing = parsed.pediatricDosing.map(rule => {
                if (!rule.maxSingleDose && globalMaxes.maxSingleDose) {
                    rule.maxSingleDose = globalMaxes.maxSingleDose;
                }
                if (!rule.maxDailyDose && globalMaxes.maxDailyDose) {
                    rule.maxDailyDose = globalMaxes.maxDailyDose;
                }
                return rule;
            });
        }
        if (!parsed.maxDurationDays && globalMaxes.maxDurationDays) {
            parsed.maxDurationDays = globalMaxes.maxDurationDays;
        }
        
        logger.info('[VidalParser] Successfully parsed medication:', parsed.nameRu);
        return parsed;
        
    } catch (error) {
        logger.error('[VidalParser] Failed to parse with AI:', error);
        throw new Error(`AI парсинг не удался: ${error.message}`);
    }
}

/**
 * Извлечь максимальные дозы из текста
 * Fallback метод если AI не справился
 */
function extractMaxDoses(text) {
    const result = {
        maxSingleDose: null,
        maxDailyDose: null,
        maxDurationDays: null
    };
    
    // Паттерн: "Максимальные дозы: разовая - 1 г, суточная - 4 г"
    const maxDosesPattern = /Максимальные дозы[:\s]+разовая\s*-\s*(\d+(?:\.\d+)?)\s*(г|мг)[,\s]+суточная\s*-\s*(\d+(?:\.\d+)?)\s*(г|мг)/i;
    const match = text.match(maxDosesPattern);
    
    if (match) {
        const singleDose = parseFloat(match[1]);
        const singleUnit = match[2];
        const dailyDose = parseFloat(match[3]);
        const dailyUnit = match[4];
        
        result.maxSingleDose = singleUnit === 'г' ? singleDose * 1000 : singleDose;
        result.maxDailyDose = dailyUnit === 'г' ? dailyDose * 1000 : dailyDose;
    }
    
    // Паттерн: "Максимальная продолжительность лечения - 5-7 дней"
    const durationPattern = /Максимальная продолжительность лечения\s*-\s*(\d+)(?:-\d+)?\s*дн/i;
    const durationMatch = text.match(durationPattern);
    
    if (durationMatch) {
        result.maxDurationDays = parseInt(durationMatch[1]);
    }
    
    return result;
}

module.exports = { parseVidalWithAI, extractMaxDoses };
