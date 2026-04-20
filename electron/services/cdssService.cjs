/**
 * Сервис для работы с Gemini AI в контексте CDSS (Clinical Decision Support System)
 * Используется для парсинга жалоб и ранжирования диагнозов
 */

const { logger, logDegradation } = require('../logger.cjs');
const { normalizeWithAI } = require('./aiSymptomNormalizer.cjs');
const { normalizeSymptoms } = require('../utils/cdssVocabulary.cjs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Lazy load apiKeyManager (will be initialized after app ready)
let apiKeyManager = null;
function getApiKeyManager() {
    if (!apiKeyManager) {
        try {
            const manager = require('./apiKeyManager.cjs');
            apiKeyManager = manager.apiKeyManager;
        } catch (error) {
            logger.warn('[CDSSService] ApiKeyManager not available, using fallback');
        }
    }
    return apiKeyManager;
}

/**
 * Получает API ключ Gemini через apiKeyManager
 */
function getApiKey() {
    const manager = getApiKeyManager();
    if (manager) {
        try {
            return manager.getActiveKey();
        } catch (error) {
            logger.warn('[CDSSService] Failed to get key from manager:', error.message);
        }
    }
    return null;
}

/**
 * Получает базовый URL для API
 */
function getBaseUrl() {
    return process.env.GEMINI_BASE_URL || null;
}

/**
 * Получает имя модели — сначала из активного ключа, затем из env
 */
function getModelName() {
    const manager = getApiKeyManager();
    if (manager) {
        try {
            return manager.getActiveKeyModel();
        } catch (_) { /* fall through */ }
    }
    return process.env.VITE_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

/**
 * Внутренняя функция для выполнения запроса к Gemini API с конкретным ключом
 */
function _callGeminiAPIWithKey(apiKey, prompt, systemInstruction = null) {
    return new Promise((resolve, reject) => {
        const baseUrl = getBaseUrl() || 'https://generativelanguage.googleapis.com';
        const model = getModelName();
        const urlPath = `/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const url = new URL(urlPath, baseUrl);

        const requestBody = {
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }]
        };

        if (systemInstruction) {
            requestBody.systemInstruction = {
                parts: [{ text: systemInstruction }]
            };
        }

        const postData = JSON.stringify(requestBody);

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const client = url.protocol === 'https:' ? https : http;

        const req = client.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        const error = JSON.parse(data);
                        logger.error('[CDSSService] API error:', error);
                        reject(new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`));
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
                    logger.error('[CDSSService] Failed to parse response:', error);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            logger.error('[CDSSService] Request error:', error);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Выполняет запрос к Gemini API с автоматической ротацией ключей
 */
async function callGeminiAPI(prompt, systemInstruction = null) {
    const manager = getApiKeyManager();

    // Используем apiKeyManager с ротацией, если доступен
    if (manager) {
        try {
            return await manager.retryWithRotation(async (apiKey) => {
                return await _callGeminiAPIWithKey(apiKey, prompt, systemInstruction);
            });
        } catch (error) {
            logger.error('[CDSSService] Failed with key rotation:', error);
            throw error;
        }
    } else {
        // Fallback на старую логику
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('Gemini API key not found');
        }
        return await _callGeminiAPIWithKey(apiKey, prompt, systemInstruction);
    }
}

/**
 * Парсит жалобы пациента в структурированные симптомы
 * @param {string} complaintsText - Текст жалоб пациента
 * @param {number} childAgeMonths - Возраст ребенка в месяцах
 * @param {number} childWeight - Вес ребенка в кг (опционально)
 * @returns {Promise<{symptoms: string[], severity: string}>}
 */
async function parseComplaints(complaintsText, childAgeMonths, childWeight = null) {
    if (!complaintsText || complaintsText.trim().length === 0) {
        throw new Error('Жалобы не могут быть пустыми');
    }

    const prompt = `Ты - медицинский ассистент. Извлеки из жалоб пациента список симптомов.

Жалобы: "${complaintsText}"
Возраст ребенка: ${childAgeMonths} месяцев
${childWeight ? `Вес ребенка: ${childWeight} кг` : ''}

Верни ТОЛЬКО валидный JSON без каких-либо пояснений и markdown-разметки:
{
  "symptoms": ["симптом1", "симптом2"],
  "severity": "low|medium|high"
}

Симптомы должны быть краткими медицинскими терминами на русском языке (например: "температура", "кашель", "одышка", "головная боль").`;

    try {
        const response = await callGeminiAPI(prompt);

        // Извлекаем JSON из ответа (может быть обернут в markdown)
        let jsonText = response.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '').trim();
        }

        const parsed = JSON.parse(jsonText);

        if (!parsed.symptoms || !Array.isArray(parsed.symptoms)) {
            throw new Error('Invalid response format: symptoms array not found');
        }

        if (!parsed.severity || !['low', 'medium', 'high'].includes(parsed.severity)) {
            parsed.severity = 'medium'; // Default
        }

        logger.info(`[CDSSService] Parsed ${parsed.symptoms.length} symptoms, severity: ${parsed.severity}`);
        logDegradation('parse', 'AI');
        return parsed;

    } catch (error) {
        logger.warn('[CDSSService] AI parsing failed, using split + normalization');
        const rawSymptoms = complaintsText.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
        const { normalized } = await normalizeWithAI(rawSymptoms);
        logDegradation('parse', 'Fallback');
        return {
            symptoms: normalized.length > 0 ? normalized : rawSymptoms,
            severity: 'medium',
            fallback: true
        };
    }
}

/**
 * Enhanced fallback ranking: canonical symptom matching via vocabulary, confidence cap 0.9.
 * @private
 */
function _enhancedFallbackRanking(symptoms, diseases, patientContext = {}) {
    const queryCanonical = new Set(normalizeSymptoms(symptoms).map(n => n.toLowerCase().trim()));

    return diseases
        .map((d) => {
            const dSymptoms = Array.isArray(d.symptoms) ? d.symptoms : JSON.parse(d.symptoms || '[]');
            const dCanonical = new Set(normalizeSymptoms(dSymptoms).map(n => n.toLowerCase().trim()));
            const matchedSymptoms = [...queryCanonical].filter((qs) => dCanonical.has(qs));
            let confidence = matchedSymptoms.length / Math.max(symptoms.length, 1);
            confidence = Math.min(0.9, confidence);
            return {
                diseaseId: d.id,
                confidence,
                reasoning: `Совпало ${matchedSymptoms.length} из ${symptoms.length} симптомов (словарь)`,
                matchedSymptoms
            };
        })
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
}

/**
 * Ранжирует диагнозы на основе симптомов и контекста пациента
 * @param {string[]} symptoms - Массив симптомов
 * @param {Array} diseases - Массив заболеваний-кандидатов
 * @param {object} patientContext - Контекст пациента {ageMonths, weight, height}
 * @returns {Promise<Array>} Массив с {diseaseId, confidence, reasoning, matchedSymptoms}
 */
async function rankDiagnoses(symptoms, diseases, patientContext = {}) {
    if (!symptoms || symptoms.length === 0 || !diseases || diseases.length === 0) {
        return [];
    }

    const symptomsText = symptoms.join(', ');
    const ageText = patientContext.ageMonths
        ? `${patientContext.ageMonths} месяцев`
        : 'возраст не указан';

    // Формируем список кандидатов в JSON формате для более надежного парсинга
    const diseasesList = diseases.map((d) => {
        const dSymptoms = Array.isArray(d.symptoms) ? d.symptoms : JSON.parse(d.symptoms || '[]');
        return {
            id: d.id,
            name: d.nameRu,
            icd10: d.icd10Code,
            symptoms: dSymptoms
        };
    });

    const prompt = `На основе симптомов оцени вероятность каждого диагноза для ребенка.

Симптомы пациента: ${symptomsText}
Возраст: ${ageText}
${patientContext.weight ? `Вес: ${patientContext.weight} кг` : ''}
${patientContext.height ? `Рост: ${patientContext.height} см` : ''}

Список кандидатов (JSON):
${JSON.stringify(diseasesList, null, 2)}

Верни ТОЛЬКО валидный JSON массив без каких-либо пояснений и markdown-разметки.
Для каждого диагноза укажи его id (число из поля "id" выше), confidence (от 0.0 до 1.0), 
reasoning (краткое объяснение на русском) и matchedSymptoms (массив совпавших симптомов).

Пример ответа:
[
  {
    "diseaseId": 42,
    "confidence": 0.85,
    "reasoning": "Симптомы соответствуют клинической картине",
    "matchedSymptoms": ["лихорадка", "кашель"]
  }
]

ВАЖНО: diseaseId должен быть числом из поля "id" кандидата, например 42, а не строкой и не null.`;

    try {
        const response = await callGeminiAPI(prompt);
        logger.info('[CDSSService] Raw AI response (first 500 chars):', response.substring(0, 500));

        // Извлекаем JSON из ответа
        let jsonText = response.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '').trim();
        }

        logger.info('[CDSSService] Extracted JSON:', jsonText.substring(0, 500));

        const rankings = JSON.parse(jsonText);
        logger.info(`[CDSSService] Parsed rankings array, length: ${rankings?.length || 0}`);

        if (!Array.isArray(rankings)) {
            throw new Error('Invalid response format: expected array');
        }

        // Валидация и нормализация
        const validated = rankings
            .map((r, idx) => {
                const diseaseId = Number(r.diseaseId);
                const isValid = diseaseId && !isNaN(diseaseId);

                if (!isValid) {
                    logger.warn(`[CDSSService] Invalid diseaseId at index ${idx}:`, r.diseaseId);
                }

                return {
                    diseaseId,
                    confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0)),
                    reasoning: r.reasoning || 'Нет объяснения',
                    matchedSymptoms: Array.isArray(r.matchedSymptoms) ? r.matchedSymptoms : []
                };
            })
            .filter(r => {
                const isValid = r.diseaseId && !isNaN(r.diseaseId);
                if (!isValid) {
                    logger.warn(`[CDSSService] Filtered out invalid result:`, r);
                }
                return isValid;
            })
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5); // Топ-5

        logger.info(`[CDSSService] Ranked ${validated.length} diagnoses (from ${rankings.length} raw results)`);
        if (validated.length > 0) {
            logger.debug('[CDSSService] Top result:', validated[0]);
        }
        logDegradation('rank', 'AI');
        return validated;

    } catch (error) {
        logger.warn('[CDSSService] AI ranking failed, using enhanced scoring');
        logDegradation('rank', 'Simple');
        return _enhancedFallbackRanking(symptoms, diseases, patientContext);
    }
}

module.exports = {
    callGeminiAPI,
    parseComplaints,
    rankDiagnoses
};
