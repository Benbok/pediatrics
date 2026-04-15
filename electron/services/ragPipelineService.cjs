'use strict';

/**
 * ragPipelineService.cjs
 *
 * RAG-пайплайн для ответов на вопросы врача по прикреплённым PDF-гайдлайнам болезни.
 *
 * Стратегия:
 *   1. Retrieval: FTS5 по guideline_chunks (надёжный baseline, всегда работает).
 *   2. Embedding re-rank: если у чанков есть embeddingJson И LM Studio отвечает на
 *      /v1/embeddings — пересчитываем косинусное сходство и делаем boost.
 *   3. Generation: localLlmService.generate() → LM Studio /v1/chat/completions.
 *
 * Не зависит от Gemini API.
 */

const { prisma } = require('../prisma-client.cjs');
const { logger } = require('../logger.cjs');
const localLlmService = require('./localLlmService.cjs');
const DEFAULT_LM_STUDIO_URL = 'http://localhost:1234';

// ─── Конфиг ─────────────────────────────────────────────────────────────────

const CFG = {
    topK: 20,            // чанков из FTS (список / сложные вопросы)
    topKAfterRank: 12,   // чанков в контекст после ранжирования
    topKSimple: 10,      // topK для drug/dose/contraindication запросов
    topKAfterRankSimple: 6, // topKAfterRank для простых запросов
    temperature: 0.3,
    maxTokens: 1200,     // fallback
    // LLM query expansion: включать только если FTS вернул мало чанков
    llmExpandMinChunks: 5, // не расширяем через LLM если FTS нашёл >= этого числа
};

// ─── Системный промпт ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — клинический справочный ассистент для врача-педиатра.

КРИТИЧЕСКОЕ ПРАВИЛО — ИСТОЧНИК ДАННЫХ:
- Отвечай ИСКЛЮЧИТЕЛЬНО на основе текста из раздела [КОНТЕКСТ].
- ЗАПРЕЩЕНО добавлять препараты, дозировки, схемы или факты из своих знаний.
- Если в [КОНТЕКСТ] нет ответа на вопрос — отвечай ТОЛЬКО: «Данные отсутствуют в предоставленных материалах.»

ЦИТИРОВАНИЕ (ОБЯЗАТЕЛЬНО):
- Каждое утверждение в ответе должно содержать номер источника в формате [N], где N — номер чанка из [КОНТЕКСТ].
- Пример: «Парацетамол 15 мг/кг 3–4 раза в день [1], Ибупрофен 10 мг/кг [2]»
- Несколько фактов из одного чанка — один номер в конце абзаца.
- Не выдумывай номера — используй только те, что указаны в [КОНТЕКСТ].

ФОРМАТ ОТВЕТА:
- Отвечай ПОЛНО — включай ВСЕ препараты, дозировки, возрастные группы и режимы из контекста.
- Структурируй: нумерованные списки, подзаголовки, группы препаратов.
- Для каждого препарата: название, дозировку (мг/кг), способ и кратность приёма, курс, возрастные ограничения.
- НЕ сокращай. Лучше длинный полный ответ, чем короткий неполный.
- Язык: русский, медицинская терминология.

ПРИМЕР ОТВЕТА:
Вопрос: Какие жаропонижающие препараты применяются у детей?
Ответ:
## Жаропонижающие препараты
1. **Парацетамол** — 10–15 мг/кг на приём, не более 4 раз в сутки. Разрешён с 3 месяцев [1].
2. **Ибупрофен** — 5–10 мг/кг, не более 3 раз в сутки, с 6 месяцев [2].`;

// ─── Стоп-слова ────────────────────────────────────────────────────────

// Стоп-слова для FTS-запроса: только структурные русские слова — НЕ медицинские термины
const FTS_STOPWORDS = new Set([
    'какой', 'какая', 'какие', 'какое', 'что', 'как', 'для', 'при', 'от', 'по',
    'в', 'на', 'и', 'или', 'а', 'но', 'это',
    'ребёнок', 'ребенок', 'дети', 'детей', 'детский', 'пациент',
]);

// Стоп-слова для реранкинга: расширенный список, НЕ применяется к FTS
const RERANK_STOPWORDS = new Set([
    ...FTS_STOPWORDS,
    'лечение', 'терапия', 'терапии',
    'симптомы', 'симптом', 'признаки', 'признак', 'лечить', 'назначить',
    'препараты', 'препарат', 'лекарства', 'лекарство',
]);

// ─── LM Studio embedding ─────────────────────────────────────────────────────

// Кэш эмбеддингов на время сессии (FIFO-вытеснение, макс. EMBED_CACHE_MAX записей)
const _embedCache = new Map();
const EMBED_CACHE_MAX = 50;

// Circuit breaker: отключаем embed endpoint при недоступности (60s retry)
let _embedDisabled = false;
let _embedDisabledUntil = 0;

/**
 * Получить embedding вектора для текста через LM Studio /v1/embeddings.
 * Возвращает float[] или null (если LM Studio недоступен или нет модели embeddingов).
 * Результат кэшируется для повторных запросов в рамках текущей сессии.
 */
async function embedTextViaLmStudio(text) {
    // Circuit breaker: skip если endpoint недавно не отвечал
    if (_embedDisabled && Date.now() < _embedDisabledUntil) return null;
    if (_embedDisabled && Date.now() >= _embedDisabledUntil) {
        _embedDisabled = false; // пробуем снова после паузы
    }

    const cacheKey = String(text || '').slice(0, 200);
    if (_embedCache.has(cacheKey)) return _embedCache.get(cacheKey);

    try {
        const baseUrl = getLmStudioBaseUrl();
        const model = process.env.EMBED_MODEL || 'nomic-embed-text';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${baseUrl}/v1/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, input: text }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
            _embedDisabled = true;
            _embedDisabledUntil = Date.now() + 60_000;
            return null;
        }
        const data = await res.json();
        const embedding = data?.data?.[0]?.embedding;
        if (Array.isArray(embedding) && embedding.length > 0) {
            if (_embedCache.size >= EMBED_CACHE_MAX) {
                _embedCache.delete(_embedCache.keys().next().value);
            }
            _embedCache.set(cacheKey, embedding);
            return embedding;
        }
        return null;
    } catch {
        _embedDisabled = true;
        _embedDisabledUntil = Date.now() + 60_000;
        return null;
    }
}

// ─── Косинусное сходство ─────────────────────────────────────────────────────

function cosine(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

// ─── FTS retrieval ───────────────────────────────────────────────────────────

/**
 * Карта медицинских синонимов для расширения FTS-запросов.
 * Ключ — корень/форма из запроса, значения — дополнительные термины для поиска.
 * Работает через простое вхождение подстроки — не требует NLP.
 */
const MEDICAL_SYNONYMS = new Map([
    // Жаропонижающие
    ['жаропониж', ['антипиретик', 'парацетамол', 'ибупрофен', 'температур']],
    ['температур', ['жаропониж', 'антипиретик', 'лихорадк', 'фебрил']],
    ['антипиретик', ['жаропониж', 'парацетамол', 'ибупрофен']],
    ['лихорадк', ['температур', 'жаропониж', 'фебрил', 'антипиретик']],
    ['фебрил', ['лихорадк', 'температур', 'жаропониж']],
    // Антибиотики
    ['антибиотик', ['антибактериальн', 'противомикробн', 'бета-лактам', 'цефалоспорин', 'пенициллин', 'макролид', 'амоксициллин']],
    ['антибактериальн', ['антибиотик', 'противомикробн']],
    // Кашель / муколитики
    ['кашел', ['противокашлев', 'муколитик', 'отхаркивающ', 'амброксол', 'бромгексин']],
    ['муколитик', ['кашел', 'отхаркивающ', 'мокрот', 'амброксол', 'карбоцистеин', 'ацетилцистеин']],
    ['отхаркивающ', ['муколитик', 'кашел', 'мокрот']],
    ['мокрот', ['муколитик', 'отхаркивающ', 'кашел']],
    // Бронходилататоры / астма
    ['бронходилатат', ['бронхолитик', 'сальбутамол', 'беродуал', 'ипратропи', 'бронхоспазм']],
    ['бронхолитик', ['бронходилатат', 'сальбутамол', 'бронхоспазм']],
    ['бронхоспазм', ['бронходилатат', 'бронхолитик', 'обструкци']],
    ['обструкци', ['бронхоспазм', 'бронходилатат', 'стеноз']],
    // ОРВИ / простуда
    ['орви', ['острая респираторн', 'простуд', 'назофарингит', 'ринит', 'фарингит']],
    ['простуд', ['орви', 'острая респираторн', 'ринит']],
    // Антигистаминные / аллергия
    ['аллерги', ['антигистаминн', 'гиперчувствительн', 'крапивниц']],
    ['антигистаминн', ['аллерги', 'цетиризин', 'лоратадин', 'дезлоратадин']],
    // ГКС
    ['гкс', ['глюкокортикостероид', 'глюкокортикоид', 'кортикостероид', 'преднизолон', 'будесонид', 'дексаметазон']],
    ['кортикостероид', ['гкс', 'глюкокортикостероид', 'преднизолон']],
    ['глюкокортик', ['гкс', 'кортикостероид', 'преднизолон', 'будесонид']],
    // Ингаляции
    ['ингаляци', ['небулайзер', 'ингалятор', 'аэрозол']],
    ['небулайзер', ['ингаляци', 'ингалятор']],
    // Пневмония
    ['пневмони', ['воспаление лёгких', 'внебольничн', 'антибиотик']],
    // Общие клинические
    ['доз', ['дозировк', 'режим', 'кратност']],
    ['дозировк', ['доз', 'режим']],
    ['первая линия', ['стартов', 'препарат выбор', 'эмпирическ']],
    ['стартов', ['первая линия', 'препарат выбор', 'начальн']],
    ['профилактик', ['превентивн', 'предупрежден']],
]);

/**
 * Расширяет запрос медицинскими синонимами.
 * Возвращает расширенную строку для дополнительного FTS-прохода или null.
 */
function expandQueryWithSynonyms(query) {
    const q = String(query || '').toLowerCase();
    const extra = new Set();
    for (const [trigger, synonyms] of MEDICAL_SYNONYMS) {
        if (q.includes(trigger)) {
            for (const s of synonyms) extra.add(s);
        }
    }
    if (extra.size === 0) return null;
    // Собираем дополнительные термины (макс. 6) в формат FTS-запроса
    // Убираем спецсимволы FTS5: " * / \ ( ) { } ^ ~
    const terms = [...extra]
        .slice(0, 6)
        .map(t => t.replace(/["*\/\\(){}^~:]/g, ' ').trim())
        .filter(t => t.length >= 3);
    return terms.map(t => `${t}*`).join(' OR ');
}

/**
 * Строит FTS5-запрос: токены ≥ 3 символов, суффикс *.
 */
function buildFtsQuery(text) {
    const tokens = String(text || '')
        .toLowerCase()
        .split(/[\s,;.()\[\]{}"'«»\-—]+/)
        .map(t => t.trim())
        // Убираем спецсимволы FTS5 перед фильтрацией
        .map(t => t.replace(/[\"*\\/\\\\(){}^~:]/g, '').trim())
        .filter(t => t.length >= 3 && !FTS_STOPWORDS.has(t))
        .map(t => {
            if (t.length >= 7) return t.slice(0, t.length - 2);
            if (t.length >= 5) return t.slice(0, t.length - 1);
            return t;
        })
        .filter(t => t.length >= 3)
        .slice(0, 8);
    return tokens.length > 0 ? tokens.map(t => `${t}*`).join(' OR ') : '';
}

/**
 * FTS5 поиск по guideline_chunks_fts с фильтром по diseaseId.
 * Возвращает до CFG.topK чанков с текстом и метаданными.
 */
async function ftsRetrieve(diseaseId, query, topK = CFG.topK) {
    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) return [];

    try {
        const rows = await prisma.$queryRawUnsafe(
            `SELECT gc.id, gc.text, gc.type, gc.section_title as sectionTitle,
                    gc.evidence_level as evidenceLevel, gc.page_start as pageStart,
                    gc.page_end as pageEnd, gc.guideline_id as guidelineId,
                    gc.embedding_json as embeddingJson,
                    bm25(guideline_chunks_fts) as score
             FROM guideline_chunks_fts gcf
             JOIN guideline_chunks gc ON gc.id = gcf.chunk_id
             WHERE guideline_chunks_fts MATCH ? AND gcf.disease_id = ?
             ORDER BY bm25(guideline_chunks_fts)
             LIMIT ?`,
            ftsQuery,
            Number(diseaseId),
            topK * 2
        );

        return rows
            .slice(0, topK)
            .map(r => ({
                id: Number(r.id),
                text: String(r.text || '').trim(),
                type: String(r.type || 'other'),
                sectionTitle: r.sectionTitle ? String(r.sectionTitle) : null,
                evidenceLevel: r.evidenceLevel ? String(r.evidenceLevel) : null,
                pageStart: r.pageStart ? Number(r.pageStart) : null,
                pageEnd: r.pageEnd ? Number(r.pageEnd) : null,
                guidelineId: r.guidelineId ? Number(r.guidelineId) : null,
                embeddingJson: r.embeddingJson || null,
                score: 0, // будет проставлен при ранжировании
                bm25: Number(r.score),
            }));
    } catch (err) {
        logger.warn('[RAGPipeline] FTS retrieve failed:', err.message);
        return [];
    }
}

/** Экранирует LIKE-спецсимволы % _ \ в пользовательском вводе. */
function escapeLike(s) {
    return String(s).replace(/[\\%_]/g, c => '\\' + c);
}

/**
 * Прямой поиск по guideline_chunks без FTS (fallback если FTS таблица не заполнена).
 */
async function directRetrieve(diseaseId, query) {
    const words = String(query || '')
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length >= 4 && !RERANK_STOPWORDS.has(w))
        .slice(0, 5);
    if (words.length === 0) return [];

    try {
        const rows = await prisma.$queryRawUnsafe(
            `SELECT id, text, type, section_title as sectionTitle,
                    evidence_level as evidenceLevel, page_start as pageStart,
                    page_end as pageEnd, guideline_id as guidelineId,
                    embedding_json as embeddingJson
             FROM guideline_chunks
             WHERE disease_id = ?
               AND (${words.map(() => "text LIKE ? ESCAPE '\\\\'").join(' OR ')})
             LIMIT ?`,
            Number(diseaseId),
            ...words.map(w => `%${escapeLike(w)}%`),
            CFG.topK
        );
        return rows.map(r => ({
            id: Number(r.id),
            text: String(r.text || '').trim(),
            type: String(r.type || 'other'),
            sectionTitle: r.sectionTitle ? String(r.sectionTitle) : null,
            evidenceLevel: r.evidenceLevel ? String(r.evidenceLevel) : null,
            pageStart: r.pageStart ? Number(r.pageStart) : null,
            pageEnd: r.pageEnd ? Number(r.pageEnd) : null,
            guidelineId: r.guidelineId ? Number(r.guidelineId) : null,
            embeddingJson: r.embeddingJson || null,
            score: 0,
            bm25: -1,
        }));
    } catch (err) {
        logger.warn('[RAGPipeline] Direct retrieve failed:', err.message);
        return [];
    }
}

// ─── Ранжирование ────────────────────────────────────────────────────────────

/**
 * Реранкинг по ключевым словам + уровню доказательности.
 * BM25 уже упоминает релевантность, boost добавляет контекст.
 *
 * @param {object[]} chunks
 * @param {string} query
 * @param {string} [queryType='general'] - тип запроса для условных бустов
 */
function rerankByKeywords(chunks, query, queryType = 'general') {
    const keywords = String(query || '')
        .toLowerCase()
        .split(/[\s,;.()\-—]+/)
        .filter(w => w.length > 3 && !RERANK_STOPWORDS.has(w));

    // Применяем дозировочные бусты только для запросов о препаратах/дозах/списках.
    // Для диагностических запросов они вытесняли бы диагностические чанки.
    const applyDosageBoost = ['drug', 'dose', 'list', 'contraindication'].includes(queryType);
    // Для диагностических запросов буст за разделы с диагностическими ключевыми словами.
    const applyDiagBoost = queryType === 'diagnostic';

    return chunks
        .map(c => {
            let boost = 0;
            const titleLower = (c.sectionTitle || '').toLowerCase();
            const textLower = c.text.toLowerCase();

            for (const kw of keywords) {
                if (titleLower.includes(kw)) boost += 0.12;
                if (textLower.includes(kw)) boost += 0.04;
            }

            // Evidence level boost
            const ev = String(c.evidenceLevel || '');
            if (/УУР\s*[-–—]?\s*[АA]\b|^A-I/i.test(ev)) boost += 0.08;
            else if (/УУР\s*[-–—]?\s*[ВB]\b|^B-II/i.test(ev)) boost += 0.04;
            else if (/УУР\s*[-–—]?\s*[СC]\b|^C-III/i.test(ev)) boost += 0.02;

            if (applyDosageBoost) {
                // Буст за наличие дозировочных шаблонов (цифры + единица)
                if (/\d+\s*(мг|кг|мл|мкг|%)|до\s*\d+|×\s*\d+/i.test(c.text)) boost += 0.15;
                // Буст за дозировочные глаголы/термины
                if (/(доз|примен|разреш|назнач)/i.test(c.text)) boost += 0.08;
            }

            if (applyDiagBoost) {
                // Буст за диагностические разделы и критерии
                if (/диагностик|критери|симптом|признак|клинич|обследован|лаборатор/i.test(titleLower)) boost += 0.18;
                if (/диагностик|критери|симптом|признак/i.test(textLower)) boost += 0.06;
            }

            // Нормализуем BM25 в [0..1]: BM25 отрицателен, ближе к 0 — лучше
            const bm25Norm = c.bm25 < 0 ? Math.min(1, Math.abs(c.bm25) / 5) : 0;

            return { ...c, score: bm25Norm + boost };
        })
        .sort((a, b) => b.score - a.score);
}

/**
 * Гибридный реранкинг: линейный blend BM25-нормы и cosine similarity.
 * Сохраняет сильные FTS-чанки (высокий BM25) даже при слабом эмбеддинге.
 * blend = 0.4 × bm25Norm + 0.6 × cosine; без эмбеддинга → чистый bm25Norm.
 */
function rerankBySemantic(chunks, queryVec) {
    return chunks
        .map(c => {
            let cosineScore = 0;
            if (c.embeddingJson) {
                try {
                    const chunkVec = JSON.parse(c.embeddingJson);
                    cosineScore = cosine(queryVec, chunkVec);
                } catch { /* битый JSON */ }
            }
            // bm25Norm переиспользуем из rerankByKeywords (уже в c.score)
            const bm25Norm = c.bm25 < 0 ? Math.min(1, Math.abs(c.bm25) / 5) : c.score;
            const hybridScore = cosineScore > 0
                ? 0.4 * bm25Norm + 0.6 * cosineScore
                : bm25Norm; // нет эмбеддинга — оставляем BM25
            return { ...c, score: hybridScore };
        })
        .sort((a, b) => b.score - a.score);
}

/**
 * Дедупликация чанков с перекрытием (overlap ~18% при chunk 1400).
 */
function dedup(chunks) {
    const seen = new Set();
    const result = [];
    for (const c of chunks) {
        const fp = c.text.slice(0, 120).trim().toLowerCase();
        if (!seen.has(fp)) {
            seen.add(fp);
            result.push(c);
        }
    }
    return result;
}

// ─── Контекст для LLM ────────────────────────────────────────────────────────

/**
 * Максимальный бюджет символов для контекста.
 *
 * Для русского текста: ~2.5 символа на 1 токен (qwen, llama, mistral с кириллицей).
 * Резерв:
 *   system prompt ~350 tok + grounding ~30 tok + query ~50 tok = ~430 tok overhead
 *   response tokens задаются через maxTokens
 *
 * Пример для 4K ctx: (4096 - 430 overhead - 600 response) * 2.5 = ~7665 chars на контекст
 * Пример для 8K ctx: (8192 - 430 - 800 response) * 2.5 = ~17405 chars
 */
const CHARS_PER_TOKEN = 2.5; // для кириллицы в современных токенайзерах
const PROMPT_OVERHEAD_TOKENS = 700; // system (with few-shot) + grounding + query + formatting
const CONTEXT_BUDGET_FALLBACK = 6000; // ~2400 токенов — безопасный fallback для 4K

// Кеш ctx length живёт до конца сессии — модель не меняется пока LM Studio работает.
// Сбрасывается только при ошибке запроса (модель выгружена/сменена).
let _modelCtxCache = { value: 0, expiresAt: 0 };
const MODEL_CTX_CACHE_TTL_MS = 10 * 60 * 1000; // 10 минут (было 30с)

/** Получить loaded_context_length загруженной модели. */
async function resolveModelCtxLength() {
    const now = Date.now();
    if (now < _modelCtxCache.expiresAt && _modelCtxCache.value > 0) return _modelCtxCache.value;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${getLmStudioBaseUrl()}/api/v0/models`, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
            const data = await res.json();
            const models = Array.isArray(data?.data) ? data.data : [];
            const loadedLlm = models.find(m => m?.state === 'loaded' && m?.type === 'llm');
            const loadedCtx = Number(loadedLlm?.loaded_context_length);
            if (Number.isFinite(loadedCtx) && loadedCtx > 0) {
                _modelCtxCache = { value: loadedCtx, expiresAt: now + MODEL_CTX_CACHE_TTL_MS };
                return loadedCtx;
            }
        }
    } catch {
        // При ошибке сбрасываем кеш — модель могла смениться
        _modelCtxCache = { value: 0, expiresAt: 0 };
    }

    return 0; // unknown
}

/**
 * Вычисляет бюджет символов для контекста и максимальный maxTokens для ответа.
 * Учитывает реальный context length модели.
 *
 * @param {number} desiredMaxTokens - желаемый maxTokens ответа
 * @param {number} historyChars - приблизительно символов истории
 * @returns {{ contextBudget: number, maxTokens: number }}
 */
async function resolveTokenBudgets(desiredMaxTokens, historyChars = 0) {
    const modelCtx = await resolveModelCtxLength();
    if (!modelCtx) {
        // Неизвестный ctx — безопасные значения
        return { contextBudget: CONTEXT_BUDGET_FALLBACK, maxTokens: Math.min(desiredMaxTokens, 600) };
    }

    const historyTokens = Math.ceil(historyChars / CHARS_PER_TOKEN);
    // Сколько токенов осталось на контекст + ответ
    const available = modelCtx - PROMPT_OVERHEAD_TOKENS - historyTokens;

    if (available <= 0) {
        return { contextBudget: 1000, maxTokens: 200 };
    }

    // Делим между контекстом и ответом: минимум 30% на ответ, остальное на контекст
    const maxResponseTokens = Math.min(desiredMaxTokens, Math.floor(available * 0.4));
    const contextTokens = available - maxResponseTokens;
    const contextBudget = Math.max(2000, Math.min(32000, Math.floor(contextTokens * CHARS_PER_TOKEN)));

    logger.info(`[RAGPipeline] token budgets: modelCtx=${modelCtx} available=${available} contextTokens=${contextTokens} contextBudget=${contextBudget} maxTokens=${maxResponseTokens} historyTokens=${historyTokens}`);

    return { contextBudget, maxTokens: maxResponseTokens };
}

/**
 * Умная сборка контекста с динамическим бюджетом.
 * Группирует чанки по разделам, сортирует по уровню доказательности (A→B→C),
 * обрезает отдельные чанки при превышении бюджета — раздел не теряется целиком.
 *
 * @param {object[]} chunks
 * @param {number} budget - бюджет символов (определяется вызывающей стороной)
 */
function buildContextSmart(chunks, budget = CONTEXT_BUDGET_FALLBACK) {
    const BUDGET = budget;

    // Группируем по разделу, сохраняем лучший уровень доказательности раздела
    // Сохраняем исходное упорядочение чанков (по скору) для нумерации
    const orderedChunks = [...chunks];
    const sectionMap = new Map();
    for (const c of orderedChunks) {
        const key = c.sectionTitle || '—';
        if (!sectionMap.has(key)) {
            sectionMap.set(key, { evidenceLevel: c.evidenceLevel, chunks: [] });
        }
        sectionMap.get(key).chunks.push(c);
    }

    function evOrder(ev) {
        const s = String(ev || '');
        if (/УУР\s*[-–—]?\s*[АA]\b|^A/i.test(s)) return 0;
        if (/УУР\s*[-–—]?\s*[ВB]\b|^B/i.test(s)) return 1;
        if (/УУР\s*[-–—]?\s*[СC]\b|^C/i.test(s)) return 2;
        return 3;
    }

    const sections = [...sectionMap.entries()].sort(([, a], [, b]) => {
        const evDiff = evOrder(a.evidenceLevel) - evOrder(b.evidenceLevel);
        if (evDiff !== 0) return evDiff;
        // При одинаковых УД (обычно null) — сортируем по среднему скору раздела
        const avg = arr => arr.chunks.reduce((s, c) => s + c.score, 0) / arr.chunks.length;
        return avg(b) - avg(a);
    });

    const parts = [];
    let used = 0;
    let chunkIndex = 1; // счётчик чанков для цитирования

    for (const [sectionTitle, { chunks: sChunks }] of sections) {
        if (used >= BUDGET) break;
        const sectionLabel = sectionTitle !== '—' ? sectionTitle : null;
        const evLabel = sChunks[0].evidenceLevel ? ` (УД: ${sChunks[0].evidenceLevel})` : '';
        const header = sectionLabel
            ? `[${sectionLabel}]${evLabel}`
            : '';
        const chunkTexts = [];
        for (const c of sChunks) {
            const available = BUDGET - used - header.length - 10;
            if (available <= 40) break;
            // Присваиваем чанку номер для цитирования в ответе
            c._citationIndex = chunkIndex++;
            const pageInfo = c.pageStart ? ` (стр. ${c.pageStart}${c.pageEnd && c.pageEnd !== c.pageStart ? '–' + c.pageEnd : ''})` : '';
            const label = `[${c._citationIndex}]${pageInfo}`;
            // Strip AI-generated metadata prefix (used for FTS/embedding, not needed in generation context)
            const rawText = c.text.replace(/^@@(?:SUMMARY|KEYWORDS):.*\n/gm, '').trimStart();
            const text = rawText.length > available ? rawText.slice(0, available) + '…' : rawText;
            chunkTexts.push(`${label}\n${text}`);
            used += text.length + label.length + 5;
        }
        if (chunkTexts.length > 0) {
            parts.push((header ? header + '\n' : '') + chunkTexts.join('\n'));
        }
    }

    return parts.join('\n\n---\n\n');
}

// ─── Утилиты ────────────────────────────────────────────────────────────────

function getLmStudioBaseUrl() {
    return (process.env.PEDIASSIST_LM_STUDIO_URL || DEFAULT_LM_STUDIO_URL).replace(/\/+$/, '');
}

// ─── Тип вопроса → лимит токенов ─────────────────────────────────────────────
/**
 * Для list-запросов: оставляет только чанки с дозировочными паттернами или клиническими назначениями.
 * Автоматически исключает диагностические/симптоматические чанки.
 * Если после фильтрации осталось < 3 чанков — возвращаем оригинал (fallback).
 */
const DOSAGE_RE = /\d+\s*(мг|мл|кг|мкг|%)|\d+\s*\/\s*кг|в сутки|раз в день/i;
const TREATMENT_SECTION_RE = /лечение|терапия|препарат|дозиров|назначени/i;

function filterTopForList(chunks) {
    const filtered = chunks.filter(c =>
        DOSAGE_RE.test(c.text) ||
        TREATMENT_SECTION_RE.test(c.sectionTitle || '')
    );
    if (filtered.length >= 3) return filtered;
    return chunks; // fallback — если дозировочных чанков слишком мало
}
const MAX_TOKENS_BY_TYPE = {
    drug:            600,   // «какой препарат / первая линия» — название + дозировка + режим
    dose:            800,   // «доза, мг/кг, режим» — все возрастные группы + вес + кратность
    contraindication:600,   // «противопоказан при...» — полный перечень
    list:            1500,  // «список / перечисли» — полное перечисление всех препаратов
    diagnostic:      1000,  // «диагностика / критерии» — клинические критерии + обследования
    general:         1200,  // развёрнутый вопрос
};

/**
 * Определяет тип клинического вопроса для подбора динамического max_tokens.
 */
function detectQueryType(query) {
    const q = String(query || '').toLowerCase();
    // list-запросы проверяем ДО dose: «все препараты с дозировками» содержит «доз», но это list
    if (/список|перечисли|все препарат|все средств|какие препарат|варианты|разреш.*препарат|препарат.*разреш/.test(q)) return 'list';
    if (/какой препарат|какое лекарство|чем лечить|первая линия|второй ряд|стартовый|выбор препарат/.test(q)) return 'drug';
    if (/доз|мг\s*\/|кг\s*\/|сколько|в сутки|раз в день|режим приём|кратность/.test(q)) return 'dose';
    if (/противопоказан|нельзя|запрещ|не назнач|ограничен/.test(q)) return 'contraindication';
    // diagnostic — проверяем ДО general: запросы о диагностике, критериях, симптомах
    if (/диагностик|критери.*диагн|клинич.*признак|симптом|обследован|анализ.*при|лаборатор.*критери/.test(q)) return 'diagnostic';
    return 'general';
}

// ─── Query expansion через LLM ──────────────────────────────────────────────

/**
 * Перефразирует запрос пользователя в медицинские ключевые термины через LLM.
 * Используется ТОЛЬКО если FTS вернул мало чанков (< CFG.llmExpandMinChunks),
 * чтобы не блокировать основную генерацию на 1-5s при достаточном покрытии.
 *
 * Timeout 5s, maxTokens 40 — минимальная нагрузка.
 * При ошибке или timeout возвращает null (не блокирует пайплайн).
 */
async function expandQueryViaLlm(query, initialChunkCount = 0) {
    const q = String(query || '').trim();
    if (q.length < 5) return null;

    // Пропускаем LLM-расширение если FTS уже нашёл достаточно чанков — экономим 1-5s на каждом запросе
    if (initialChunkCount >= CFG.llmExpandMinChunks) {
        logger.info(`[RAGPipeline] LLM expansion skipped: FTS found ${initialChunkCount} chunks (>= ${CFG.llmExpandMinChunks})`);
        return null;
    }

    const prompt = `Перефразируй вопрос врача в 3–5 медицинских ключевых терминов для поиска по клиническим рекомендациям. Верни ТОЛЬКО термины через запятую, без пояснений.

Вопрос: ${q}
Термины:`;

    let result = '';
    try {
        const response = await localLlmService.generate(
            [{ role: 'user', content: prompt }],
            { maxTokens: 40, temperature: 0.1, topP: 0.9, timeoutMs: 5000 },
            (token) => { result += token; }
        );
        const expanded = result.trim().replace(/^термины:\s*/i, '');
        if (response.status === 'completed' && expanded.length >= 5 && expanded.length < 300) {
            logger.info(`[RAGPipeline] LLM query expansion: "${q}" → "${expanded}"`);
            return expanded;
        }
        logger.info(`[RAGPipeline] LLM expansion empty or too short, skipping`);
    } catch (err) {
        logger.warn('[RAGPipeline] LLM query expansion failed:', err.message);
    }
    return null;
}

// ─── Подтягивание соседних чанков ─────────────────────────────────────────────

/**
 * Для каждого top-чанка загружает соседей (id - 1, id + 1) из той же болезни.
 * Это решает проблему «разрыва информации»: начало описания препарата в одном чанке,
 * дозировка — в следующем. Без этого 12 чанков покрывают ~3-6% данных болезни
 * и часто теряют продолжения таблиц / списков.
 *
 * Ограничения:
 *   - Соседи добавляются только если суммарный текст не выходит за 80% бюджета
 *   - Дедупликация: уже выбранные чанки не дублируются
 *   - Соседи получают пониженный score (0.5× от родителя) для корректного ранжирования
 */
async function expandWithNeighbors(topChunks, diseaseId, contextBudget) {
    if (topChunks.length === 0) return topChunks;

    const existingIds = new Set(topChunks.map(c => c.id));
    // Собираем ID соседей, которых ещё нет в top
    const neighborIds = new Set();
    for (const c of topChunks) {
        if (!existingIds.has(c.id - 1)) neighborIds.add(c.id - 1);
        if (!existingIds.has(c.id + 1)) neighborIds.add(c.id + 1);
    }
    // Убираем id которые уже в top
    for (const id of existingIds) neighborIds.delete(id);

    if (neighborIds.size === 0) return topChunks;

    try {
        const idList = [...neighborIds];
        const placeholders = idList.map(() => '?').join(',');
        const rows = await prisma.$queryRawUnsafe(
            `SELECT id, text, type, section_title as sectionTitle,
                    evidence_level as evidenceLevel, page_start as pageStart,
                    page_end as pageEnd, guideline_id as guidelineId,
                    embedding_json as embeddingJson
             FROM guideline_chunks
             WHERE disease_id = ? AND id IN (${placeholders})`,
            Number(diseaseId),
            ...idList
        );

        // Оцениваем, сколько соседей влезет в бюджет (80% — остальное для заголовков/разделителей)
        const charLimit = Math.floor(contextBudget * 0.8);
        let currentChars = topChunks.reduce((sum, c) => sum + c.text.length, 0);

        const neighbors = [];
        for (const r of rows) {
            const text = String(r.text || '').trim();
            if (currentChars + text.length > charLimit) continue;
            // Находим «родительский» чанк для наследования score
            const parentId = existingIds.has(r.id - 1) ? r.id - 1 : r.id + 1;
            const parent = topChunks.find(c => c.id === parentId);
            neighbors.push({
                id: Number(r.id),
                text,
                type: String(r.type || 'other'),
                sectionTitle: r.sectionTitle ? String(r.sectionTitle) : null,
                evidenceLevel: r.evidenceLevel ? String(r.evidenceLevel) : null,
                pageStart: r.pageStart ? Number(r.pageStart) : null,
                pageEnd: r.pageEnd ? Number(r.pageEnd) : null,
                guidelineId: r.guidelineId ? Number(r.guidelineId) : null,
                embeddingJson: r.embeddingJson || null,
                score: parent ? parent.score * 0.5 : 0,
                bm25: -1,
            });
            currentChars += text.length;
        }

        if (neighbors.length > 0) {
            logger.info(`[RAGPipeline] neighbor expansion: +${neighbors.length} adjacent chunks`);
        }

        // Объединяем и пересортировываем по id для логичного порядка в контексте
        return [...topChunks, ...neighbors].sort((a, b) => a.id - b.id);
    } catch (err) {
        logger.warn('[RAGPipeline] neighbor expansion failed:', err.message);
        return topChunks; // fallback — работаем без соседей
    }
}

// ─── Общая логика retrieval + rerank ────────────────────────────────────────────────

const BROAD_PASS_QUERY = 'препарат назначение лечение доза применение терапия элиминация раствор профилактика';

/**
 * FTS → fallback → broad pass → rerank → dedup → filter → buildContext.
 * Единая точка retrieval для ragQuery и ragQueryStream — исключает расхождение логики.
 *
 * @param {object} params
 * @param {number} params.contextBudget - бюджет символов контекста (из resolveTokenBudgets)
 * @param {string|null} params.expandedQuery - перефразированный запрос от LLM (может быть null)
 */
async function retrieveAndRank({ query, diseaseId, queryVec, queryType, initialChunks, contextBudget, expandedQuery }) {
    // topK tuning: для простых запросов (drug/dose/contraindication) меньше чанков — быстрее retrieval
    const isSimple = queryType === 'drug' || queryType === 'dose' || queryType === 'contraindication';
    const effectiveTopK = queryType === 'list' ? CFG.topK * 2 : (isSimple ? CFG.topKSimple : CFG.topK);
    const effectiveTopKAfterRank = queryType === 'list' ? CFG.topKAfterRank * 2 : (isSimple ? CFG.topKAfterRankSimple : CFG.topKAfterRank);

    let chunks = initialChunks;
    if (chunks.length === 0) {
        logger.info('[RAGPipeline] FTS empty, trying direct retrieve');
        chunks = await directRetrieve(diseaseId, query);
    }

    // Расширение запроса медицинскими синонимами для дополнительного FTS-прохода
    const synonymQuery = expandQueryWithSynonyms(query);
    if (synonymQuery && synonymQuery !== buildFtsQuery(query)) {
        const synonymChunks = await ftsRetrieve(diseaseId, synonymQuery, effectiveTopK);
        const existingIds = new Set(chunks.map(c => c.id));
        const newChunks = synonymChunks.filter(c => !existingIds.has(c.id));
        if (newChunks.length > 0) {
            chunks = [...chunks, ...newChunks];
            logger.info(`[RAGPipeline] synonym expansion: +${newChunks.length} new chunks`);
        }
    }

    // Расширение запроса через LLM (перефразировка в медицинские термины)
    if (expandedQuery) {
        const llmFtsQuery = buildFtsQuery(expandedQuery);
        if (llmFtsQuery) {
            const llmChunks = await ftsRetrieve(diseaseId, llmFtsQuery, effectiveTopK);
            const existingIds = new Set(chunks.map(c => c.id));
            const newChunks = llmChunks.filter(c => !existingIds.has(c.id));
            if (newChunks.length > 0) {
                chunks = [...chunks, ...newChunks];
                logger.info(`[RAGPipeline] LLM expansion: +${newChunks.length} new chunks`);
            }
        }
    }

    if (queryType === 'list') {
        const broadChunks = await ftsRetrieve(diseaseId, BROAD_PASS_QUERY, effectiveTopK);
        const existingIds = new Set(chunks.map(c => c.id));
        const newChunks = broadChunks.filter(c =>
            !existingIds.has(c.id) &&
            /\d+\s*(мг|мл|кг|мкг|%)/.test(c.text)
        );
        chunks = [...chunks, ...newChunks];
        logger.info(`[RAGPipeline] list broad pass: +${newChunks.length} new chunks`);
    }

    chunks = rerankByKeywords(chunks, query, queryType);
    if (queryVec && chunks.some(c => c.embeddingJson)) {
        chunks = rerankBySemantic(chunks, queryVec);
    }

    let top = dedup(chunks).slice(0, effectiveTopKAfterRank);
    if (queryType === 'list') top = filterTopForList(top);

    // Подтягиваем соседние чанки (id ± 1) для каждого top-чанка.
    // Решает проблему разрыва информации: если препарат в чанке N,
    // а его дозировка продолжается в N+1, оба попадут в контекст.
    top = await expandWithNeighbors(top, diseaseId, contextBudget || CONTEXT_BUDGET_FALLBACK);

    const context = buildContextSmart(top, contextBudget || CONTEXT_BUDGET_FALLBACK);

    logger.info(`[RAGPipeline] retrieveAndRank done`, {
        totalChunksFound: chunks.length,
        topChunks: top.length,
        contextChars: context.length,
        contextBudget: contextBudget || CONTEXT_BUDGET_FALLBACK,
    });

    return { top, context };
}

// ─── Главная функция: ragQuery ────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string} params.query
 * @param {number} params.diseaseId
 * @param {{ q: string; a: string }[]} [params.history]
 * @returns {Promise<{answer: string, sources: object[], context: string}>}
 */
async function ragQuery({ query, diseaseId, history = [] }) {
    const queryType = detectQueryType(query);
    const isSimple = queryType === 'drug' || queryType === 'dose' || queryType === 'contraindication';
    const effectiveTopK = queryType === 'list' ? CFG.topK * 2 : (isSimple ? CFG.topKSimple : CFG.topK);
    const desiredMaxTokens = MAX_TOKENS_BY_TYPE[queryType] ?? CFG.maxTokens;
    const { contextBudget, maxTokens } = await resolveTokenBudgets(desiredMaxTokens, 0);

    // FTS + embedding параллельно; LLM expansion ПОСЛЕ FTS (чтобы не блокировать модель перед основной генерацией)
    const [initialChunks, queryVec] = await Promise.all([
        ftsRetrieve(diseaseId, query, effectiveTopK),
        embedTextViaLmStudio(String(query || '')),
    ]);
    // LLM expansion последовательно: LM Studio single-threaded, нельзя слать параллельно с генерацией
    const expandedQuery = await expandQueryViaLlm(query, initialChunks.length);

    const { top, context } = await retrieveAndRank({ query, diseaseId, queryVec, queryType, initialChunks, contextBudget, expandedQuery });

    if (top.length === 0) {
        return { answer: 'Данные отсутствуют в предоставленных материалах.', sources: [], context: '' };
    }

    const GROUNDING_REMINDER = 'Отвечай СТРОГО по тексту [КОНТЕКСТ]. Не добавляй данные из своих знаний.';
    const userMessage = `[КОНТЕКСТ]\n${context}\n\n${GROUNDING_REMINDER}\n\n[ВОПРОС]\n${query}`;
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
    ];
    logger.info(`[RAGPipeline] queryType=${queryType} maxTokens=${maxTokens} chunks=${top.length}`);
    logger.debug(`[RAGPipeline] context sent to LLM (${context.length} chars):\n${context.slice(0, 500)}...`);

    let answerText = '';
    let result = await localLlmService.generate(
        messages,
        { maxTokens, temperature: CFG.temperature, topP: 0.9 },
        (token) => { answerText += token; }
    );

    if (result.status === 'error' && /400|context|too many|overflow|exceeded/i.test(result.error || '')) {
        // Fallback: урезанный контекст (50%)
        logger.warn('[RAGPipeline] Context overflow, retrying with halved context');
        answerText = '';
        const shortContext = buildContextSmart(top, Math.floor(contextBudget / 2));
        result = await localLlmService.generate(
            [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: `[КОНТЕКСТ]\n${shortContext}\n\n${GROUNDING_REMINDER}\n\n[ВОПРОС]\n${query}` }],
            { maxTokens: Math.min(maxTokens, 400), temperature: CFG.temperature, topP: 0.9 },
            (token) => { answerText += token; }
        );
    }

    if (result.status === 'error') throw new Error(result.error || 'LM Studio generation failed');
    if (result.status === 'aborted') throw new Error('Generation aborted');

    const answer = answerText.trim() || 'Данные отсутствуют в предоставленных материалах.';
    const sources = top.map(c => ({
        id: c.id, guidelineId: c.guidelineId,
        sectionTitle: c.sectionTitle || null, evidenceLevel: c.evidenceLevel || null,
        pageStart: c.pageStart || null, pageEnd: c.pageEnd || null,
        score: +c.score.toFixed(3),
        preview: c.text.slice(0, 140).replace(/\n/g, ' ') + (c.text.length > 140 ? '…' : ''),
    }));
    logger.info('[RAGPipeline] ragQuery done', { chunks: top.length, answerLength: answer.length });
    return { answer, sources, context };
}

// ─── Streaming: ragQueryStream ────────────────────────────────────────────────

/**
 * Стриминговая версия ragQuery.
 *
 * @param {object} params
 * @param {string} params.query
 * @param {number} params.diseaseId
 * @param {{ q: string; a: string }[]} [params.history]   предыдущие Q/A пары
 * @param {Function} onToken - колбэк для каждого токена (для IPC)
 * @returns {Promise<{sources: object[], context: string}>}
 */
async function ragQueryStream({ query, diseaseId, history = [], onToken }) {
    const queryType = detectQueryType(query);
    const isSimple = queryType === 'drug' || queryType === 'dose' || queryType === 'contraindication';
    const effectiveTopK = queryType === 'list' ? CFG.topK * 2 : (isSimple ? CFG.topKSimple : CFG.topK);
    const desiredMaxTokens = MAX_TOKENS_BY_TYPE[queryType] ?? CFG.maxTokens;
    const { contextBudget, maxTokens } = await resolveTokenBudgets(desiredMaxTokens, 0);
    logger.info('[RAGPipeline] ragQueryStream start', { diseaseId, queryType, effectiveTopK, contextBudget, maxTokens });

    // FTS + embedding параллельно; LLM expansion ПОСЛЕ FTS
    const [initialChunks, queryVec] = await Promise.all([
        ftsRetrieve(diseaseId, query, effectiveTopK),
        embedTextViaLmStudio(String(query || '')),
    ]);
    // LLM expansion последовательно: LM Studio single-threaded
    const expandedQuery = await expandQueryViaLlm(query, initialChunks.length);

    const { top, context } = await retrieveAndRank({ query, diseaseId, queryVec, queryType, initialChunks, contextBudget, expandedQuery });

    if (top.length === 0) {
        const noData = 'Данные отсутствуют в предоставленных материалах.';
        if (typeof onToken === 'function') onToken(noData);
        return { sources: [], context: '' };
    }

    logger.info(`[RAGPipeline] queryType=${queryType} maxTokens=${maxTokens} chunks=${top.length}`);
    logger.debug(`[RAGPipeline] stream context sent to LLM (${context.length} chars):\n${context.slice(0, 500)}...`);
    const GROUNDING_REMINDER = 'Отвечай СТРОГО по тексту [КОНТЕКСТ]. Не добавляй данные из своих знаний.';
    const userMessage = `[КОНТЕКСТ]\n${context}\n\n${GROUNDING_REMINDER}\n\n[ВОПРОС]\n${query}`;
    let messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
    ];

    let result = await localLlmService.generate(
        messages,
        { maxTokens, temperature: CFG.temperature, topP: 0.9 },
        (token) => { if (typeof onToken === 'function') onToken(token); }
    );

    // Graceful fallback: урезанный контекст
    if (result.status === 'error' && /400|context|too many|overflow|exceeded/i.test(result.error || '')) {
        logger.warn('[RAGPipeline] Still overflow, retrying with halved context');
        const shortContext = buildContextSmart(top, Math.floor(contextBudget / 2));
        messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `[КОНТЕКСТ]\n${shortContext}\n\n${GROUNDING_REMINDER}\n\n[ВОПРОС]\n${query}` },
        ];
        result = await localLlmService.generate(
            messages,
            { maxTokens: Math.min(maxTokens, 400), temperature: CFG.temperature, topP: 0.9 },
            (token) => { if (typeof onToken === 'function') onToken(token); }
        );
    }

    if (result.status === 'error') throw new Error(result.error || 'LM Studio generation failed');

    const sources = top.map(c => ({
        id: c.id, guidelineId: c.guidelineId,
        sectionTitle: c.sectionTitle || null, evidenceLevel: c.evidenceLevel || null,
        pageStart: c.pageStart || null, pageEnd: c.pageEnd || null,
        score: +c.score.toFixed(3),
        preview: c.text.slice(0, 140).replace(/\n/g, ' ') + (c.text.length > 140 ? '…' : ''),
    }));

    return { sources, context };
}

// ─── Реиндексация embedding-ов ────────────────────────────────────────────────

/**
 * Батчевое получение эмбеддингов через LM Studio (вход input: string[]).
 * Возвращает массив (float[] | null)[] — null если embedding недоступен.
 */
async function embedBatchViaLmStudio(texts) {
    if (!texts || texts.length === 0) return [];
    try {
        const baseUrl = getLmStudioBaseUrl();
        const model = process.env.EMBED_MODEL || 'nomic-embed-text';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(`${baseUrl}/v1/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, input: texts }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return texts.map(() => null);
        const data = await res.json();
        if (!Array.isArray(data?.data)) return texts.map(() => null);
        return data.data.map(d => {
            const emb = d?.embedding;
            return Array.isArray(emb) && emb.length > 0 ? emb : null;
        });
    } catch {
        return texts.map(() => null);
    }
}

/**
 * Пересчитать embeddingJson для всех чанков заболевания через LM Studio.
 * Обрабатывает по EMBED_BATCH_SIZE чанков за запрос (вместо 1 за 1).
 */
const EMBED_BATCH_SIZE = 8;

async function reindexGuidelineEmbeddings(diseaseId, onProgress) {
    const chunks = await prisma.guidelineChunk.findMany({
        where: { diseaseId: Number(diseaseId) },
        select: { id: true, text: true },
    });

    const total = chunks.length;
    let done = 0;

    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
        const texts = batch.map(c => String(c.text || '').trim());
        const vecs = await embedBatchViaLmStudio(texts);

        for (let j = 0; j < batch.length; j++) {
            const vec = vecs[j];
            if (vec && texts[j]) {
                await prisma.guidelineChunk.update({
                    where: { id: batch[j].id },
                    data: { embeddingJson: JSON.stringify(vec) },
                });
            }
            done++;
            if (typeof onProgress === 'function') onProgress(done, total);
        }
    }

    logger.info('[RAGPipeline] reindexGuidelineEmbeddings done', { diseaseId, total, indexed: done });
    return { indexed: done };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { ragQuery, ragQueryStream, reindexGuidelineEmbeddings };
