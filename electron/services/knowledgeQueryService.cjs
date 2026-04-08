/**
 * Knowledge Query Service — RAG-пайплайн для ответов на клинические вопросы.
 * Собирает данные из базы болезней и препаратов, передаёт контекст в Gemini с
 * жёстким grounding-промптом. Ответ формируется исключительно на основе
 * найденных данных.
 */

'use strict';

const { prisma } = require('../prisma-client.cjs');
const { logger } = require('../logger.cjs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Lazy load apiKeyManager
let _apiKeyManager = null;
function getApiKeyManager() {
    if (!_apiKeyManager) {
        try {
            const m = require('./apiKeyManager.cjs');
            _apiKeyManager = m.apiKeyManager;
        } catch (err) {
            logger.warn('[KnowledgeQueryService] ApiKeyManager not available');
        }
    }
    return _apiKeyManager;
}

function getModelName() {
    return process.env.VITE_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

function getBaseUrl() {
    return process.env.GEMINI_BASE_URL || null;
}

function nowIso() {
    return new Date().toISOString();
}

function safePreview(value, maxLen = 1200) {
    const text = String(value || '');
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)} ...[truncated ${text.length - maxLen} chars]`;
}

// ─── In-memory TTL-кэш ───────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа
const CACHE_MAX_SIZE = 200;

class QueryCache {
    constructor() {
        this._map = new Map(); // key → { result, expiresAt }
    }

    _normalizeKey(query) {
        return String(query || '').toLowerCase().trim().replace(/\s+/g, ' ');
    }

    get(query) {
        const key = this._normalizeKey(query);
        const entry = this._map.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._map.delete(key);
            return null;
        }
        return entry.result;
    }

    set(query, result) {
        const key = this._normalizeKey(query);
        // LRU eviction: удаляем самую старую запись при достижении лимита
        if (this._map.size >= CACHE_MAX_SIZE) {
            const firstKey = this._map.keys().next().value;
            this._map.delete(firstKey);
        }
        this._map.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    }
}

const queryCache = new QueryCache();

// ─── FTS helper ──────────────────────────────────────────────────────────────

// Слова, которые часто встречаются в медицинских запросах, но не являются
// названиями нозологий — их присутствие в FTS-запросе даёт шум
const MEDICAL_QUERY_STOPWORDS = new Set([
    'лечение', 'лечить', 'лечится', 'терапия', 'терапии', 'терапию',
    'симптомы', 'симптом', 'симптоматика', 'признаки', 'признак',
    'диагностика', 'диагноз', 'диагностировать', 'диагностику',
    'препараты', 'препарат', 'лекарства', 'лекарство', 'лекарственный',
    'какой', 'какая', 'какие', 'какое', 'что', 'как', 'при', 'для',
    'нужно', 'надо', 'можно', 'нельзя', 'чем', 'про', 'это',
    'назначить', 'назначение', 'назначения', 'применение', 'применять',
    'ребёнок', 'ребенок', 'ребёнка', 'ребенка', 'дети', 'детей', 'детский',
    'пациент', 'пациента', 'больной', 'больного',
]);

/**
 * Строит FTS5 запрос с:
 * - фильтрацией медицинских стоп-слов
 * - суффиксом `*` для морфологической гибкости (пневмони* → пневмония/пневмонии/пневмонию)
 */
function buildFtsQuery(text) {
    const tokens = String(text || '')
        .toLowerCase()
        .split(/[\s,;.()\[\]{}"'«»\-—]+/)
        .map(t => t.trim())
        .filter(t => t.length >= 3 && !MEDICAL_QUERY_STOPWORDS.has(t))
        .map(t => {
            // Обрезаем окончание для поиска от стемма
            if (t.length >= 7) return t.slice(0, t.length - 2);
            if (t.length >= 5) return t.slice(0, t.length - 1);
            return t;
        })
        .filter(t => t.length >= 3)
        .slice(0, 8);

    if (tokens.length === 0) return '';

    // Добавляем * к каждому токену для префиксного поиска (морфология)
    return tokens.map(t => `${t}*`).join(' OR ');
}

/**
 * Извлекает значимые медицинские термины из запроса (без стоп-слов).
 * Обрезает русские падежные окончания для LIKE-поиска без стеммера.
 * Например: "бронхита" → "бронхит", "пневмонии" → "пневмони"
 */
function extractMedicalTerms(text) {
    return String(text || '')
        .toLowerCase()
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length >= 3 && !MEDICAL_QUERY_STOPWORDS.has(t))
        .map(t => {
            // Обрезаем до ~стемма: для слов ≥7 символов убираем 2 последних,
            // для 5-6 символов — 1 последний (приближение к именительному падежу)
            if (t.length >= 7) return t.slice(0, t.length - 2);
            if (t.length >= 5) return t.slice(0, t.length - 1);
            return t;
        })
        .filter(t => t.length >= 3)
        .slice(0, 5);
}

// Regex для извлечения уровня доказательности из текста чанка (аналог Python extract_evidence_level)
// Real МЗ РФ format: «(УУР - C; УДД - 5)» — dash and spaces between acronym and value
const EVIDENCE_RE = /УУР\s*[-–—]?\s*[А-ЯA-Z](?:\s*[;,]\s*УДД\s*[-–—]?\s*[IVXivx0-9]+)?|УДД\s*[-–—]?\s*[IVXivx0-9]+|\b[A-Ca-c]-[IVXivx]{1,4}\b/u;

function extractEvidenceFromText(text) {
    const m = EVIDENCE_RE.exec(text || '');
    return m ? m[0].trim() : null;
}

// ─── Поиск болезней через FTS ─────────────────────────────────────────────────

/**
 * FTS-поиск по гайдлайн-чанкам.
 * Возвращает уникальные disease_id по релевантности И тексты совпавших чанков.
 * Тексты чанков — это реальный клинический контент (протоколы, рекомендации),
 * который должен попасть в промпт для LLM.
 */
async function searchDiseasesByFts(query) {
    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) return { ids: [], chunksByDisease: new Map() };

    try {
        const rows = await prisma.$queryRawUnsafe(
            `SELECT disease_id as diseaseId, text, bm25(guideline_chunks_fts) as score
             FROM guideline_chunks_fts
             WHERE guideline_chunks_fts MATCH ?
             ORDER BY bm25(guideline_chunks_fts)
             LIMIT 60`,
            ftsQuery
        );
        const seenIds = new Set();
        const ids = [];
        const chunksByDisease = new Map();
        // Фильтр BM25: берём только записи с релевантным скором.
        // bm25() возвращает отрицательные числа, чем меньше — тем релевантнее.
        // -0.5 = хорошая оценка, -0.01 = слабая (шум).
        // Порог: если все записи по disease слабые (скор > -0.1) — болезнь нерелевантна.
        const SCORE_THRESHOLD = -0.1;
        const diseaseScores = new Map(); // disease_id → лучший score

        for (const r of rows) {
            const id = Number(r.diseaseId);
            const score = Number(r.score);
            if (!id) continue;
            const best = diseaseScores.get(id);
            if (best === undefined || score < best) diseaseScores.set(id, score);
        }

        // Оставляем только болезни с score <= SCORE_THRESHOLD (релевантные)
        const relevantIds = new Set(
            [...diseaseScores.entries()]
                .filter(([, s]) => s <= SCORE_THRESHOLD)
                .sort((a, b) => a[1] - b[1])
                .slice(0, 5)
                .map(([id]) => id)
        );

        for (const r of rows) {
            const id = Number(r.diseaseId);
            if (!id || !relevantIds.has(id)) continue;
            if (!seenIds.has(id)) { seenIds.add(id); ids.push(id); }
            // Сохраняем текст чанка (до 5 на болезнь, до 900 символов)
            const existing = chunksByDisease.get(id) || [];
            if (existing.length < 5) {
                const text = String(r.text || '').trim();
                if (text.length > 30) existing.push(text.slice(0, 900));
                chunksByDisease.set(id, existing);
            }
        }

        return { ids: ids.slice(0, 5), chunksByDisease };
    } catch (err) {
        logger.warn('[KnowledgeQueryService] FTS search failed:', err.message);
        return { ids: [], chunksByDisease: new Map() };
    }
}

// ─── Поиск болезней через Prisma LIKE (fallback + дополнение) ────────────────

async function searchDiseasesByLike(query) {
    const term = String(query || '').trim();
    if (!term) return [];

    const words = extractMedicalTerms(term);
    if (words.length === 0) return [];

    try {
        // SQLite LIKE чувствителен к регистру для кириллицы: 'орви' != 'ОРВИ'.
        // Добавляем оба варианта — нижний регистр и ВЕРХНИЙ — для аббревиатур.
        const orConditions = words.flatMap(w => {
            const up = w.toUpperCase();
            const variants = up !== w ? [w, up] : [w];
            return variants.flatMap(v => [
                { nameRu: { contains: v } },
                { icd10Code: { contains: v } },
                { description: { contains: v } },
            ]);
        });
        const diseases = await prisma.disease.findMany({
            where: { OR: orConditions },
            select: {
                id: true,
                nameRu: true,
                description: true,
                symptoms: true,
                treatmentPlan: true,
                icd10Code: true,
            },
            take: 5,
        });
        return diseases;
    } catch (err) {
        logger.warn('[KnowledgeQueryService] Disease LIKE search failed:', err.message);
        return [];
    }
}

// ─── Cross-search: препараты по названиям болезней ─────────────────────────

/**
 * Извлекает кандидатов названий препаратов из текстов чанков и ищет их в таблице medications.
 * Не использует жёсткозахардкоженных списков — работает для любой специальности и любого препарата.
 * Стратегия: все кириллические слова ≥ 5 символов (и с заглавной, и со строчной) просчитываются
 * как потенциальные названия препаратов в обоих вариантах регистра.
 */
async function searchMedicationsByChunkMentions(allChunkTexts) {
    if (!allChunkTexts || allChunkTexts.length === 0) return [];
    const combined = allChunkTexts.join('\n');

    // Извлекаем все кириллические слова ≥ 5 символов (и с большой, и со строчной —
    // гайдлайны пишут названия по-разному: Амброксол / амброксол)
    const wordRe = /[\u0400-\u04FF]{5,}/g;
    const rawWords = new Set();
    let m;
    while ((m = wordRe.exec(combined)) !== null) {
        rawWords.add(m[0]);
    }
    if (rawWords.size === 0) return [];

    // Для каждого слова пробуем два варианта: как есть + с заглавной буквы
    // (Prisma contains на SQLite чувствительн к регистру для кириллицы)
    const variants = new Set();
    for (const w of rawWords) {
        variants.add(w);
        variants.add(w.charAt(0).toUpperCase() + w.slice(1));
    }

    try {
        const orConds = [...variants].map(name => ({ nameRu: { contains: name } }));
        return await prisma.medication.findMany({
            where: { AND: [{ OR: orConds }, { childUsing: { not: 'Not' } }] },
            select: {
                id: true,
                nameRu: true,
                clinicalPharmGroup: true,
                indications: true,
                childDosing: true,
                childUsing: true,
                contraindications: true,
                sideEffects: true,
            },
            take: 12,
        });
    } catch (err) {
        logger.warn('[KnowledgeQueryService] Chunk-mention medication search failed:', err.message);
        return [];
    }
}

async function searchMedicationsByDiseaseNames(diseaseNames) {
    if (!diseaseNames || diseaseNames.length === 0) return [];
    try {
        const orConditions = diseaseNames.flatMap(name => {
            // Берём первое значимое слово из названия болезни (≥4 символа)
            const stem = name
                .toLowerCase()
                .split(/\s+/)
                .find(w => w.length >= 4 && !MEDICAL_QUERY_STOPWORDS.has(w));
            if (!stem) return [];
            // Для cross-search не обрезаем — название болезни уже в именительном падеже
            return [
                { indications: { contains: stem } },
                { clinicalPharmGroup: { contains: stem } },
            ];
        });
        if (orConditions.length === 0) return [];
        return await prisma.medication.findMany({
            where: { AND: [{ OR: orConditions }, { childUsing: { not: 'Not' } }] },
            select: {
                id: true,
                nameRu: true,
                clinicalPharmGroup: true,
                indications: true,
                childDosing: true,
                childUsing: true,
                contraindications: true,
                sideEffects: true,
            },
            take: 5,
        });
    } catch (err) {
        logger.warn('[KnowledgeQueryService] Cross-search medications failed:', err.message);
        return [];
    }
}

// ─── Rule-based intent classifier ───────────────────────────────────────────

/**
 * Быстрая классификация типичных клинических запросов по regex-паттернам.
 * Покрывает ~80% реальных запросов без вызова LLM (~400ms экономии).
 * Возвращает plan-объект или null (LLM fallback).
 */
const INTENT_RULES = [
    {
        intent: 'dosing',
        pattern: /доз[аиуе]?|мг\s*\/?кг|режим\s+дозир|сколько\s+(дав|мл)|кратност|раз\s+в\s+день|суточн|курс\s+лечени/i,
        needsMedications: true,
        needsDosing: true,
        needsContraindications: false,
    },
    {
        intent: 'treatment',
        pattern: /лечи[тьл]|терапи[яию]|антибиот|препарат|назнач|чем\s+лечить|что\s+(дать|назначить)|схем[аыу]\s+(лечени|терапи)|первая\s+линия|стартов/i,
        needsMedications: true,
        needsDosing: true,
        needsContraindications: false,
    },
    {
        intent: 'diagnosis',
        pattern: /симптом|диагност|признак|как\s+отличить|дифференциальн|критери[йи]\s+диагноз|клиническ(ая|ие)\s+картин/i,
        needsMedications: false,
        needsDosing: false,
        needsContraindications: false,
    },
    {
        intent: 'contraindication',
        pattern: /противопоказан|нельзя\s+(давать|назначать|применять)|запрещ[ёе]н|не\s+применя/i,
        needsMedications: true,
        needsDosing: false,
        needsContraindications: true,
    },
];

function classifyIntentByRules(query) {
    const q = String(query || '');
    for (const rule of INTENT_RULES) {
        if (rule.pattern.test(q)) {
            return {
                intent: rule.intent,
                searchTerms: [],
                needsMedications: rule.needsMedications,
                needsDosing: rule.needsDosing,
                needsContraindications: rule.needsContraindications,
                focus: '',
                _source: 'rules',
            };
        }
    }
    return null;
}

// ─── LLM query expansion ─────────────────────────────────────────────────────

/**
 * Structured query planning — один быстрый LLM-вызов возвращает план поиска.
 *
 * Возвращает объект:
 * {
 *   intent: 'treatment' | 'diagnosis' | 'dosing' | 'contraindication' | 'general',
 *   searchTerms: string[],   // нозологии + МКБ-коды для FTS/LIKE
 *   needsMedications: bool,  // искать ли препараты
 *   needsDosing: bool,       // нужны ли данные о дозировках
 *   needsContraindications: bool,
 *   focus: string            // краткий фокус запроса (1-3 слова) для доп. LIKE-поиска
 * }
 *
 * При любой ошибке — null (silent fallback на raw query).
 */
async function planQueryWithLLM(query) {
    // Быстрая rule-based классификация — без LLM-вызова
    const rulePlan = classifyIntentByRules(query);
    if (rulePlan) {
        logger.info('[KnowledgeQueryService] PLAN_SOURCE: rules, intent:', rulePlan.intent);
        return rulePlan;
    }

    const manager = getApiKeyManager();
    const apiKey = manager ? null : (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY);
    if (!manager && !apiKey) return null;

    const prompt = `Ты — медицинский поисковый планировщик. Проанализируй клинический вопрос и верни JSON-объект с планом поиска.

Вопрос: "${query}"

Верни ТОЛЬКО валидный JSON без пояснений:
{
  "intent": "<treatment|diagnosis|dosing|contraindication|general>",
  "searchTerms": ["<нозология1>", "<МКБ-код>", "<препарат>"],
  "needsMedications": <true|false>,
  "needsDosing": <true|false>,
  "needsContraindications": <true|false>,
  "focus": "<1-3 слова — ключевой аспект вопроса>"
}

Правила:
- searchTerms: только нозологии, МКБ-коды, названия препаратов или патогенов. Максимум 6.
- intent: "treatment" если спрашивают что назначить/чем лечить; "dosing" если спрашивают дозу; "diagnosis" если симптомы/диагностика; "contraindication" если противопоказания; иначе "general"
- needsMedications: true если вопрос про лечение, препараты, схему терапии
- needsDosing: true если вопрос про дозу, режим, курс
- focus: самое главное в вопросе, например "затяжной бактериальный бронхит" или "ОРВИ профилактика"`;

    try {
        let raw;
        if (manager) {
            raw = await manager.retryWithRotation(apiKey_ => callGeminiWithKey(apiKey_, prompt));
        } else {
            raw = await callGeminiWithKey(apiKey, prompt);
        }
        // Вырезаем JSON-объект из ответа
        const match = raw.match(/\{[\s\S]*?\}/);
        if (!match) return null;
        const plan = JSON.parse(match[0]);
        if (!plan || !Array.isArray(plan.searchTerms)) return null;
        // Нормализуем
        plan.searchTerms = plan.searchTerms
            .map(t => String(t).trim())
            .filter(t => t.length >= 2)
            .slice(0, 6);
        plan.intent = plan.intent || 'general';
        plan.needsMedications = !!plan.needsMedications;
        plan.needsDosing = !!plan.needsDosing;
        plan.needsContraindications = !!plan.needsContraindications;
        plan.focus = String(plan.focus || '').trim().slice(0, 60);
        // Если LLM вернул пустой focus — используем сырой запрос
        if (!plan.focus) plan.focus = query.trim().slice(0, 60);
        // Если LLM не дал термины — используем сырой запрос как единственный терм
        if (plan.searchTerms.length === 0) plan.searchTerms = [query.trim().slice(0, 60)];
        // При лечебной / дозировочной интенции дозировки всегда нужны
        if (plan.intent === 'treatment' || plan.intent === 'dosing') {
            plan.needsMedications = true;
            plan.needsDosing = true;
        }
        return plan;
    } catch {
        return null; // тихий fallback
    }
}

// ─── Поиск препаратов через Prisma LIKE ──────────────────────────────────────

async function searchMedicationsByLike(query) {
    const term = String(query || '').trim();
    if (!term) return [];

    const words = extractMedicalTerms(term);
    if (words.length === 0) return [];

    try {
        // SQLite LIKE кирилица case-sensitive: добавляем верхний регистр для аббревиатур
    const orMedConditions = words.flatMap(w => {
            const up = w.toUpperCase();
            const variants = up !== w ? [w, up] : [w];
            return variants.flatMap(v => [
                { nameRu: { contains: v } },
                { clinicalPharmGroup: { contains: v } },
                { indications: { contains: v } },
            ]);
        });
        const meds = await prisma.medication.findMany({
            where: { AND: [{ OR: orMedConditions }, { childUsing: { not: 'Not' } }] },
            select: {
                id: true,
                nameRu: true,
                clinicalPharmGroup: true,
                indications: true,
                childDosing: true,
                childUsing: true,
                contraindications: true,
                sideEffects: true,
            },
            take: 5,
        });
        return meds;
    } catch (err) {
        logger.warn('[KnowledgeQueryService] Medication LIKE search failed:', err.message);
        return [];
    }
}

// ─── Получение полных данных болезни по id ────────────────────────────────────

async function fetchDiseaseById(id) {
    try {
        return await prisma.disease.findUnique({
            where: { id },
            select: {
                id: true,
                nameRu: true,
                icd10Code: true,
                description: true,
                symptoms: true,
                treatmentPlan: true,
                diagnosticPlan: true,
                redFlags: true,
                clinicalRecommendations: true,
            },
        });
    } catch (err) {
        logger.warn('[KnowledgeQueryService] fetchDiseaseById failed:', err.message);
        return null;
    }
}

// ─── Сборка текстового контекста ─────────────────────────────────────────────

function safeJsonParse(value, defaultValue = []) {
    if (!value) return defaultValue;
    if (typeof value !== 'string') return defaultValue;
    try {
        return JSON.parse(value);
    } catch {
        return defaultValue;
    }
}

function buildContext(diseases, medications, chunksByDisease = new Map(), plan = null) {
    const isTreatment = plan?.intent === 'treatment' || plan?.intent === 'dosing' || plan?.needsMedications;
    const parts = [];

    for (const d of diseases) {
        // Для лечебных запросов: сначала клинические чанки (конкретные рекомендации),
        // затем структурированные метаданные.
        const chunks = chunksByDisease.get(d.id) || [];
        let chunkBlock = '';
        if (chunks.length > 0) {
            chunkBlock = `\n--- Фрагменты клинического гайдлайна ---`;
            for (const chunk of chunks) {
                const ev = extractEvidenceFromText(chunk);
                const prefix = ev ? `[${ev}] ` : '';
                chunkBlock += `\n${prefix}${chunk}`;
            }
        }

        let text = `=== ЗАБОЛЕВАНИЕ: ${d.nameRu} (${d.icd10Code || '—'}) ===`;

        // При лечебной интенции — чанки сразу после заголовка заболевания
        if (isTreatment && chunkBlock) {
            text += chunkBlock;
            chunkBlock = ''; // не дублируем ниже
        }

        if (d.description) text += `\nОписание: ${d.description}`;

        const symptoms = safeJsonParse(d.symptoms, [])
            .slice(0, 8)
            .map(s => `  - ${s.text || JSON.stringify(s)}`)
            .join('\n');
        if (symptoms) text += `\nСимптомы:\n${symptoms}`;

        const treatment = safeJsonParse(d.treatmentPlan, [])
            .slice(0, 8)
            .map(t => `  - [${t.category || t.type || ''}] ${t.description || t.text || JSON.stringify(t)}`)
            .join('\n');
        if (treatment) text += `\nЛечение:\n${treatment}`;

        const diagPlan = safeJsonParse(d.diagnosticPlan, []);
        if (diagPlan.length > 0) {
            const diagText = diagPlan.slice(0, 5)
                .map(dp => `  - ${dp.description || dp.text || JSON.stringify(dp)}`)
                .join('\n');
            text += `\nДиагностика:\n${diagText}`;
        }

        const redFlags = safeJsonParse(d.redFlags, []);
        if (redFlags.length > 0) {
            text += `\nТревожные признаки (немедленная госпитализация):\n${redFlags.slice(0, 4).map(r => `  ! ${r}`).join('\n')}`;
        }

        // Клинические рекомендации (структурированный текст или JSON)
        if (d.clinicalRecommendations) {
            const cr = safeJsonParse(d.clinicalRecommendations, null);
            if (Array.isArray(cr)) {
                const crText = cr.slice(0, 5).map(r => `  - ${r.text || r.recommendation || JSON.stringify(r)}`).join('\n');
                text += `\nКлинические рекомендации:\n${crText}`;
            } else if (typeof cr === 'string' && cr.length > 0) {
                text += `\nКлинические рекомендации: ${cr.slice(0, 600)}`;
            } else if (cr && typeof d.clinicalRecommendations === 'string') {
                text += `\nКлинические рекомендации: ${d.clinicalRecommendations.slice(0, 600)}`;
            }
        }

        // Тексты чанков из клинических гайдлайнов (для нелечебных запросов — в конце)
        if (chunkBlock) {
            text += chunkBlock;
        }

        parts.push(text);
    }

    for (const m of medications) {
        let text = `=== ПРЕПАРАТ: ${m.nameRu} ===`;
        if (m.clinicalPharmGroup) text += `\nФармакологическая группа: ${m.clinicalPharmGroup}`;

        // indications: JSON в формате Vidal [{condition, icdCodes}] или простой строкой
        if (m.indications) {
            const ind = safeJsonParse(m.indications, null);
            if (Array.isArray(ind)) {
                const indText = ind.slice(0, 6).map(i =>
                    typeof i === 'string' ? i :
                    `${i.condition || i.name || ''}${i.icdCodes ? ` (${i.icdCodes.join(', ')})` : ''}`
                ).filter(Boolean).join('; ');
                if (indText) text += `\nПоказания: ${indText}`;
            } else {
                text += `\nПоказания: ${String(m.indications).slice(0, 500)}`;
            }
        }

        // Дозирование у детей (расширенное HTML-поле Vidal)
        if (m.childDosing) {
            // Убираем HTML-теги для читаемости
            const clean = String(m.childDosing).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            text += `\nДозирование у детей: ${clean.slice(0, 600)}`;
        } else if (m.pediatricDosing) {
            const pd = safeJsonParse(m.pediatricDosing, null);
            if (pd) text += `\nДозирование (педиатрическое): ${JSON.stringify(pd).slice(0, 400)}`;
        }

        if (m.contraindications) {
            const clean = String(m.contraindications).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            text += `\nПротивопоказания: ${clean.slice(0, 300)}`;
        }
        if (m.sideEffects) {
            const clean = String(m.sideEffects).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            text += `\nПобочные эффекты: ${clean.slice(0, 200)}`;
        }

        parts.push(text);
    }

    return parts.join('\n\n');
}

// ─── Вызов Gemini API ─────────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Ты — клинический справочный ассистент для врача-педиатра. Врач — специалист, лишние слова ему не нужны.

ПРАВИЛА:
- Отвечай ИСКЛЮЧИТЕЛЬНО по данным базы знаний. Ничего от себя не добавляй.
- Если данных нет — одна фраза: "Данных по этому вопросу в базе не найдено."
- Дозы указывай ТОЛЬКО если есть в контексте, без пометок.
- Источник INLINE после утверждения: [Острый бронхит J20].
- НЕ делай разделы по заболеваниям. Синтезируй всё в единый ответ.
- НЕ повторяй одно и то же. Не пиши "в базе знаний не найдено" если данные есть.
- ЗАПРЕЩЕНО: вода, вводные фразы, пересказ вопроса, объяснения очевидного.

ФОРМАТ (строго, без отступлений):
**Вывод:** 1-2 предложения — прямой ответ.
**Препараты:** (только при вопросе о лечении/препаратах)
- **Название** (группа): доза у детей · показание · ключевые ограничения [Источник]
(если дозы нет в данных — не упоминай препарат или укажи без дозы одной строкой)
**Доп. рекомендации:** только если есть критически важное из контекста, 1-3 пункта максимум.

Язык: русский.`;

function callGeminiWithKey(apiKey, userPrompt) {
    return new Promise((resolve, reject) => {
        const baseUrl = getBaseUrl() || 'https://generativelanguage.googleapis.com';
        const model = getModelName();
        const url = new URL(`/v1beta/models/${model}:generateContent?key=${apiKey}`, baseUrl);

        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            generationConfig: { maxOutputTokens: 16384 },
        };

        const postData = JSON.stringify(requestBody);
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const client = url.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        const err = JSON.parse(data);
                        reject(new Error(`Gemini API error: ${err.error?.message || 'Unknown error'}`));
                        return;
                    }
                    const response = JSON.parse(data);
                    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!text) {
                        reject(new Error('No text in Gemini response'));
                        return;
                    }
                    resolve(text);
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function generateAnswer(query, context, plan = null) {
    const manager = getApiKeyManager();
    // Добавляем контекст плана в промпт для более точного форматирования ответа
    const intentHint = plan ? `\nКОНТЕКСТ ЗАПРОСА: intent=${plan.intent}, focus="${plan.focus}"${plan.needsDosing ? ', ТРЕБУЮТСЯ ДОЗИРОВКИ' : ''}${plan.needsContraindications ? ', ТРЕБУЮТСЯ ПРОТИВОПОКАЗАНИЯ' : ''}` : '';
    const prompt = `ДАННЫЕ ИЗ БАЗЫ ЗНАНИЙ:\n${context}\n\nВОПРОС ВРАЧА:\n${query}${intentHint}`;

    if (manager) {
        return await manager.retryWithRotation(async (apiKey) => {
            return await callGeminiWithKey(apiKey, prompt);
        });
    }

    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key not found');
    return await callGeminiWithKey(apiKey, prompt);
}

/**
 * Определяет, содержит ли запрос лечебную интенцию (назначить препарат / схему лечения).
 * Используется для дополнительного DQL-поиска чанков с дозировками/препаратами.
 */
function hasTreatmentIntent(rawQuery) {
    const lower = rawQuery.toLowerCase();
    return [
        'препарат', 'препараты', 'лечение', 'лечить', 'терапия',
        'антибиотик', 'назначить', 'назначение', 'лекарство', 'дозировка',
        'доза', 'схема', 'курс', 'рекоменд', 'посовет',
        'чем лечить', 'что дать', 'что назначить', 'что лучше',
    ].some(w => lower.includes(w));
}

/**
 * Чистит текст чанка:
 * - Удаляет box-drawing символы и псевдографику (артефакты PDF-таблиц)
 * - Сжимает повторяющиеся пробелы
 * - Возвращает null только если после чистки осталось < 30 значащих символов
 */
function cleanChunkText(text) {
    let s = String(text || '').trim();
    if (s.length === 0) return null;
    // Удаляем box-drawing (U+2500–U+257F), block elements (U+2580–U+259F),
    // braille (U+2800–U+28FF), другие псевдографические символы
    s = s.replace(/[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u2800-\u28FF]/g, ' ');
    // Удаляем replacement-chars
    s = s.replace(/\uFFFD/g, '');
    // Сжимаем множественные пробелы
    s = s.replace(/  +/g, ' ').trim();
    // Если после чистки слишком мало значащего текста — отбрасываем
    const meaningful = (s.match(/[\u0400-\u04FF\w]/g) || []).length;
    return meaningful >= 30 ? s : null;
}

/**
 * Целевой поиск наиболее релевантных чанков для каждой болезни.
 * После первичного поиска (который даёт топ-5 чанков глобально),
 * делаем отдельный FTS-запрос под каждую болезнь к конкретному запросу,
 * чтобы найти чанк именно про нужную тему (напр. "затяжной бронхит").
 * Если запрос содержит лечебную интенцию — добавляем чанки с дозировками/препаратами напрямую через LIKE.
 */
async function fetchChunksForDiseases(query, diseaseIds, plan = null) {
    if (!diseaseIds.length) return new Map();
    const ftsQuery = buildFtsQuery(query);

    // Если у нас есть plan.focus — используем его для более точного FTS
    const focusFtsQuery = plan?.focus ? buildFtsQuery(plan.focus) : null;

    // Основной FTS запрос: focus если есть, иначе исходный запрос
    const primaryFts = focusFtsQuery || ftsQuery;
    if (!primaryFts) return new Map();

    const treatmentQuery = hasTreatmentIntent(query) || plan?.needsMedications || plan?.needsDosing;
    const result = new Map();

    await Promise.all(diseaseIds.map(async (diseaseId) => {
        try {
            const chunks = [];
            const seenTexts = new Set();

            // Шаг 1A: FTS по focus (самая точная часть запроса)
            const ftsRows = await prisma.$queryRawUnsafe(
                `SELECT text, bm25(guideline_chunks_fts) as score
                 FROM guideline_chunks_fts
                 WHERE guideline_chunks_fts MATCH ? AND disease_id = ?
                 ORDER BY bm25(guideline_chunks_fts)
                 LIMIT 30`,
                primaryFts,
                diseaseId
            );

            for (const r of ftsRows) {
                const cleaned = cleanChunkText(r.text);
                if (!cleaned || cleaned.length < 30) continue;
                const preview = cleaned.slice(0, 80);
                if (seenTexts.has(preview)) continue;
                seenTexts.add(preview);
                chunks.push(cleaned.slice(0, 3000));
            }

            // Шаг 1B: если был focus и он отличается от raw query — доп. FTS по raw query
            if (focusFtsQuery && ftsQuery && focusFtsQuery !== ftsQuery) {
                const rawRows = await prisma.$queryRawUnsafe(
                    `SELECT text FROM guideline_chunks_fts
                     WHERE guideline_chunks_fts MATCH ? AND disease_id = ?
                     ORDER BY bm25(guideline_chunks_fts)
                     LIMIT 15`,
                    ftsQuery,
                    diseaseId
                );
                for (const r of rawRows) {
                    const cleaned = cleanChunkText(r.text);
                    if (!cleaned || cleaned.length < 30) continue;
                    const preview = cleaned.slice(0, 80);
                    if (seenTexts.has(preview)) continue;
                    seenTexts.add(preview);
                    chunks.push(cleaned.slice(0, 3000));
                }
            }

            // Шаг 2: если лечебная/дозировочная интенция — дополнительно ищем чанки с дозировками/препаратами
            if (treatmentQuery) {
                // Безопасность: пропускаем только слова из кириллицы/латиницы/цифр — блокируем SQL-спецсимволы
                const focusWords = (plan?.focus || '')
                    .split(/\s+/)
                    .map(w => w.trim())
                    .filter(w => w.length >= 4 && /^[\u0400-\u04FF\u0410-\u042Fa-zA-Z0-9-]+$/.test(w))
                    .slice(0, 3);
                // Шаг 2: основные LIKE по ключевым маркерам дозировок (параметризованный запрос)
                const treatRows = await prisma.$queryRawUnsafe(
                    `SELECT gc.text
                     FROM guideline_chunks gc
                     WHERE gc.disease_id = ?
                     AND (
                       gc.text LIKE '%мг/кг%' OR gc.text LIKE '%мг/сут%'
                       OR gc.text LIKE '%пероральн%' OR gc.text LIKE '%внутрь %'
                       OR gc.text LIKE '%антибакт%' OR gc.text LIKE '%антибиот%'
                       OR gc.text LIKE '%Клавул%' OR gc.text LIKE '%амоксиц%'
                       OR gc.text LIKE '%макролид%' OR gc.text LIKE '%азитромиц%'
                     )
                     ORDER BY gc.id
                     LIMIT 25`,
                    diseaseId
                );
                for (const r of treatRows) {
                    const cleaned = cleanChunkText(r.text);
                    if (!cleaned || cleaned.length < 30) continue;
                    const preview = cleaned.slice(0, 80);
                    if (seenTexts.has(preview)) continue;
                    seenTexts.add(preview);
                    chunks.push(cleaned.slice(0, 3000));
                }

                // Шаг 2B: параметризованные LIKE по каждому focus-слову (раздельно — нет интерполяции)
                for (const word of focusWords) {
                    const focusRows = await prisma.$queryRaw`
                        SELECT gc.text FROM guideline_chunks gc
                        WHERE gc.disease_id = ${diseaseId}
                          AND gc.text LIKE ${'%' + word + '%'}
                        ORDER BY gc.id LIMIT 10`;
                    for (const r of focusRows) {
                        const cleaned = cleanChunkText(r.text);
                        if (!cleaned || cleaned.length < 30) continue;
                        const preview = cleaned.slice(0, 80);
                        if (seenTexts.has(preview)) continue;
                        seenTexts.add(preview);
                        chunks.push(cleaned.slice(0, 3000));
                    }
                }
            }

            if (chunks.length > 0) result.set(diseaseId, chunks);
        } catch (err) {
            logger.warn('[KnowledgeQueryService] fetchChunksForDiseases error for disease', diseaseId, ':', err.message);
        }
    }));
    return result;
}

// ─── Главный оркестратор ──────────────────────────────────────────────────────

/**
 * @param {string} query
 * @returns {Promise<{
 *   answer: string | null,
 *   sources: Array<{type: 'disease'|'medication', name: string, id: number}>,
 *   disclaimer: string,
 *   searchedAt: string,
 *   noAiKey: boolean
 * }>}
 */
async function queryKnowledge(query) {
    const startedAtMs = Date.now();
    const startedAt = nowIso();
    const searchedAt = new Date().toISOString();
    const disclaimer = 'Информация предоставлена исключительно для медицинского персонала на основе внутренней базы знаний. Не является заменой консультации специалиста.';
    const trace = [];

    trace.push(`[${nowIso()}] START query received`);
    logger.info('[KnowledgeQueryService] QUERY_TEXT:', query);

    // Cache check: повторные запросы отдаём мгновенно
    const _cached = queryCache.get(query);
    if (_cached) {
        const durationMs = Date.now() - startedAtMs;
        logger.info('[KnowledgeQueryService] CACHE_HIT durationMs:', durationMs);
        return { ..._cached, searchedAt, startedAt, finishedAt: nowIso(), durationMs, trace: [`[${nowIso()}] CACHE_HIT`] };
    }

    // 1. ПАРАЛЛЕЛЬНО: query plan (LLM) + базовый FTS/LIKE по сырому запросу
    const [plan, ftsResultRaw, likeDiseasesRaw, likeMedsRaw] = await Promise.all([
        planQueryWithLLM(query),
        searchDiseasesByFts(query),
        searchDiseasesByLike(query),
        searchMedicationsByLike(query),
    ]);

    const planTerms = plan?.searchTerms ?? [];
    const searchQuery = planTerms.length > 0 ? planTerms.join(' ') : query;
    trace.push(`[${nowIso()}] QUERY_PLAN: intent=${plan?.intent ?? 'none'}, focus="${plan?.focus ?? ''}", terms=[${planTerms.join(', ')}], needsMeds=${plan?.needsMedications}, needsDosing=${plan?.needsDosing}`);
    logger.info('[KnowledgeQueryService] QUERY_PLAN:', plan ?? '(null, fallback)');

    // 2. Если план даёт термины отличные от сырого запроса — доп. поиск
    let { ids: ftsDiseaseIds, chunksByDisease } = ftsResultRaw;
    let additionalMeds = [];

    if (planTerms.length > 0 && searchQuery.toLowerCase() !== query.toLowerCase()) {
        const [ftsExtra, likeExtra, medsExtra] = await Promise.all([
            searchDiseasesByFts(searchQuery),
            searchDiseasesByLike(searchQuery),
            (plan.needsMedications || plan.needsDosing) ? searchMedicationsByLike(searchQuery) : Promise.resolve([]),
        ]);
        // Merge FTS: приоритет у более длинного совпадения
        for (const id of ftsExtra.ids) {
            if (!ftsDiseaseIds.includes(id)) ftsDiseaseIds.push(id);
        }
        for (const [id, chunks] of ftsExtra.chunksByDisease) {
            if (!chunksByDisease.has(id)) chunksByDisease.set(id, chunks);
        }
        // Merge LIKE болезней
        for (const d of likeExtra) {
            if (!likeDiseasesRaw.find(x => x.id === d.id)) likeDiseasesRaw.push(d);
        }
        additionalMeds = medsExtra;
    }

    trace.push(`[${nowIso()}] SEARCH completed: ftsDiseaseIds=${ftsDiseaseIds.length}, likeDiseases=${likeDiseasesRaw.length}, likeMedications=${likeMedsRaw.length}`);
    logger.info('[KnowledgeQueryService] SEARCH_RESULTS:', {
        ftsDiseaseIds,
        likeDiseaseNames: likeDiseasesRaw.map(d => d.nameRu),
        likeMedicationNames: likeMedsRaw.map(m => m.nameRu),
    });

    // Дедупликация: LIKE-болезни приоритетнее FTS (точные совпадения по названию)
    const likeIds = likeDiseasesRaw.map(d => d.id);
    const allDiseaseIds = [...new Set([...likeIds, ...ftsDiseaseIds])].slice(0, 5);

    // 3. Получаем полные данные болезней + целевые чанки (параллельно)
    const [diseases, targetedChunks] = await Promise.all([
        Promise.all(allDiseaseIds.map(id => fetchDiseaseById(id))).then(r => r.filter(Boolean)),
        fetchChunksForDiseases(query, allDiseaseIds, plan),
    ]);

    // Merging: targeted per-disease search overrides global FTS chunks (more relevant)
    for (const [id, chunks] of targetedChunks) {
        chunksByDisease.set(id, chunks);
    }

    // 4. Препараты: для лечебных запросов — ищем препараты, прямо упомянутые в чанках гайдлайнов.
    // Для нелечебных — стандартный LIKE.
    const isTreatmentQuery = plan?.intent === 'treatment' || plan?.intent === 'dosing' || plan?.needsMedications;
    let medications = [];

    if (plan?.needsMedications === false && plan?.intent === 'diagnosis') {
        medications = []; // диагностический запрос — препараты не нужны
    } else if (isTreatmentQuery) {
        // Первичный источник: чанки гайдлайнов сами указывают на препараты
        const allChunkTexts = [...chunksByDisease.values()].flat();
        const chunkMeds = await searchMedicationsByChunkMentions(allChunkTexts);
        if (chunkMeds.length > 0) {
            medications = chunkMeds;
        } else {
            // Фоллбэк: если чанки не дали препаратов — используем LIKE + cross
            const diseaseNamesForCross = diseases.map(d => d.nameRu);
            const crossMeds = await searchMedicationsByDiseaseNames(diseaseNamesForCross);
            const allMedIds = new Set(likeMedsRaw.map(m => m.id));
            const mergedMeds = [...likeMedsRaw];
            for (const m of [...additionalMeds, ...crossMeds]) {
                if (!allMedIds.has(m.id)) { mergedMeds.push(m); allMedIds.add(m.id); }
            }
            medications = mergedMeds.slice(0, 12);
        }
    } else {
        // Нелечебный запрос: LIKE + cross
        const diseaseNamesForCross = diseases.map(d => d.nameRu);
        const crossMeds = await searchMedicationsByDiseaseNames(diseaseNamesForCross);
        const allMedIds = new Set(likeMedsRaw.map(m => m.id));
        const mergedMeds = [...likeMedsRaw];
        for (const m of [...additionalMeds, ...crossMeds]) {
            if (!allMedIds.has(m.id)) { mergedMeds.push(m); allMedIds.add(m.id); }
        }
        medications = mergedMeds.slice(0, 8);
    }

    trace.push(`[${nowIso()}] MERGE completed: diseases=${diseases.length}, medications=${medications.length} (chunks=${[...chunksByDisease.values()].reduce((a, c) => a + c.length, 0)})`);

    // 5. Формируем список источников
    const sources = [
        ...diseases.map(d => ({ type: 'disease', name: d.nameRu, id: d.id })),
        ...medications.map(m => ({ type: 'medication', name: m.nameRu, id: m.id })),
    ];

    if (diseases.length === 0 && medications.length === 0) {
        logger.info('[KnowledgeQueryService] No sources found for query:', query);
        trace.push(`[${nowIso()}] NO_SOURCES: returning fallback answer`);
        const durationMs = Date.now() - startedAtMs;
        logger.info('[KnowledgeQueryService] TRACE:', trace);
        logger.info('[KnowledgeQueryService] DONE durationMs:', durationMs);
        return {
            answer: 'В базе знаний достаточных данных по этому вопросу не найдено.',
            sources: [],
            disclaimer,
            searchedAt,
            noAiKey: false,
            startedAt,
            finishedAt: nowIso(),
            durationMs,
            trace,
        };
    }

    // 6. Строим полный контекст: данные болезней + тексты чанков + препараты
    const rawContext = buildContext(diseases, medications, chunksByDisease, plan);
    // Передаём всё доступное; жёсткий лимит — 1 000 000 символов (~250K токенов, Gemini-2.5-flash держит 1M)
    const CONTEXT_CAP = 1_000_000;
    const context = rawContext.length > CONTEXT_CAP
        ? rawContext.slice(0, CONTEXT_CAP) + `\n...[контекст обрезан до ${CONTEXT_CAP} символов]`
        : rawContext;
    trace.push(`[${nowIso()}] CONTEXT built: length=${context.length}`);
    logger.info('[KnowledgeQueryService] CONTEXT_PREVIEW:', safePreview(context));

    // 6. Генерируем ответ через Gemini
    let answer = null;
    let noAiKey = false;
    let aiErrorMessage = null;

    try {
        trace.push(`[${nowIso()}] LLM_CALL start`);
        answer = await generateAnswer(query, context, plan);
        trace.push(`[${nowIso()}] LLM_CALL success: answerLength=${answer.length}`);
        logger.info('[KnowledgeQueryService] Answer generated, length:', answer.length);
        logger.info('[KnowledgeQueryService] ANSWER_TEXT:', answer);
    } catch (err) {
        logger.warn('[KnowledgeQueryService] Gemini unavailable:', err.message);
        trace.push(`[${nowIso()}] LLM_CALL failed: ${err.message}`);
        const errMsg = err.message || '';
        if (errMsg.includes('key not found') || errMsg.includes('No API key') || errMsg.toLowerCase().includes('api key')) {
            noAiKey = true;
            aiErrorMessage = 'API ключ не настроен';
        } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('ECONNREFUSED') || errMsg.includes('ETIMEDOUT') || errMsg.includes('socket hang up')) {
            aiErrorMessage = 'Нет соединения с сервисом ИИ';
        } else {
            aiErrorMessage = 'Ошибка сервиса ИИ';
        }
        answer = null;
    }

    const durationMs = Date.now() - startedAtMs;
    trace.push(`[${nowIso()}] DONE durationMs=${durationMs}`);
    logger.info('[KnowledgeQueryService] TRACE:', trace);
    logger.info('[KnowledgeQueryService] DONE_META:', {
        startedAt,
        finishedAt: nowIso(),
        durationMs,
        noAiKey,
        sourcesCount: sources.length,
    });

    // Cache set: сохраняем только успешные ответы
    if (answer) {
        queryCache.set(query, { answer, sources, disclaimer, noAiKey: false, aiErrorMessage: null });
    }

    return {
        answer,
        sources,
        disclaimer,
        searchedAt,
        noAiKey,
        aiErrorMessage,
        startedAt,
        finishedAt: nowIso(),
        durationMs,
        trace,
    };
}

module.exports = { queryKnowledge };
