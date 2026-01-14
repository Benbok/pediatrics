/**
 * Standalone версия Vidal парсера для тестирования без Electron
 */

const https = require('https');
const { apiKeyManager } = require('./apiKeyManager-standalone.cjs');

// Простой logger для тестов
const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args)
};

/**
 * Вызов Gemini API с конкретным ключом
 */
function callGeminiAPI(apiKey, prompt) {
    return new Promise((resolve, reject) => {
        const model = process.env.VITE_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
        const urlPath = `/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const hostname = 'generativelanguage.googleapis.com';
        
        const requestBody = {
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }]
        };
        
        const postData = JSON.stringify(requestBody);
        
        const options = {
            hostname,
            port: 443,
            path: urlPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        const error = JSON.parse(data);
                        reject(new Error(`Gemini API error (${res.statusCode}): ${error.error?.message || 'Unknown error'}`));
                        return;
                    }
                    
                    const response = JSON.parse(data);
                    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
                    
                    if (!text) {
                        reject(new Error('No text in Gemini response'));
                        return;
                    }
                    
                    resolve(text);
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        // Таймаут для запроса (60 секунд - баланс скорости и надежности)
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Request timeout after 60 seconds'));
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

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
    // Инициализируем менеджер ключей если еще не инициализирован
    apiKeyManager.initialize();
    
    const poolStatus = apiKeyManager.getPoolStatus();
    logger.info(`[VidalParser] API Keys pool: ${poolStatus.active}/${poolStatus.total} active`);
    
    if (poolStatus.total === 0) {
        throw new Error('GEMINI_API_KEYS не найдены. Установите GEMINI_API_KEYS в .env.local');
    }

    // Извлекаем только релевантные секции для ускорения
    const relevantHtml = extractRelevantSections(html);

    const prompt = `Извлеки данные из HTML Видаль в JSON.

${relevantHtml}

JSON: {nameRu, activeSubstance, atcCode, manufacturer, clinicalPharmGroup, pharmTherapyGroup, packageDescription, forms: [{type, concentration, description}], pediatricDosing: [{minAgeMonths, maxAgeMonths, dosing: {type: "weight_based"/"fixed", mgPerKg или fixedDose: {min, max, unit}}, routeOfAdmin, timesPerDay, maxSingleDose, maxDailyDose, instruction}], adultDosing: [], indications, contraindications, sideEffects, pregnancy, lactation, cautionConditions, interactions, minInterval, maxDosesPerDay, maxDurationDays, routeOfAdmin, icd10Codes: []}

КРИТИЧНО:
1. atcCode - найди код формата N02BE01 (буква-2цифры-буквы-2цифры). Ищи в тексте "АТХ", "ATX", "Код ATC"
2. icd10Codes - массив кодов МКБ-10 из секции "Показания". Формат: R50, R51.0, J06.9 и т.д. Ищи "МКБ-10", "код по МКБ", упоминания болезней с кодами
3. indications - текст показаний (ОБЯЗАТЕЛЬНО)
4. pediatricDosing - все правила из "Дозирование" для детей
5. Дозы в мг (1г=1000мг), возраст в месяцах
6. Экранируй ", валидный JSON`;

    // Используем retryWithRotation для автоматической ротации ключей при ошибках
    try {
        const parsed = await apiKeyManager.retryWithRotation(async (apiKey) => {
            const text = await callGeminiAPI(apiKey, prompt);
            logger.info('[VidalParser] AI response length:', text.length);
            
            // Очистка от markdown и лишних пробелов
            let jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            // Попытка починить распространенные проблемы с JSON
            // 1. Удаляем комментарии если есть
            jsonText = jsonText.replace(/\/\/.*/g, '');
            
            // 2. Попытка парсинга с обработкой ошибок
            try {
                return JSON.parse(jsonText);
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
                    const result = JSON.parse(jsonText);
                    logger.info('[VidalParser] Successfully parsed after cleanup');
                    return result;
                } catch (secondError) {
                    logger.error('[VidalParser] Second parse attempt failed');
                    logger.error('[VidalParser] JSON text (first 500 chars):', jsonText.substring(0, 500));
                    throw new Error(`Невалидный JSON от AI: ${secondError.message}`);
                }
            }
        });
        
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
        
        logger.info('[VidalParser] Successfully parsed medication:', parsed.nameRu);
        return parsed;
        
    } catch (error) {
        logger.error('[VidalParser] Failed to parse with AI:', error);
        throw new Error(`AI парсинг не удался: ${error.message}`);
    }
}

module.exports = { parseVidalWithAI };
