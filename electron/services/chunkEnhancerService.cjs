'use strict';

/**
 * chunkEnhancerService.cjs
 *
 * Использует LLM (LM Studio) для семантической разбивки текста
 * клинических рекомендаций на смысловые чанки + обогащение
 * (резюме, ключевые слова) для улучшения RAG-поиска.
 *
 * Режим работы:
 *   1. Python-скрипт извлекает из PDF полные секции (--sections-only)
 *   2. Этот сервис разбивает каждую секцию на семантические чанки через LLM
 *   3. К каждому чанку добавляет @@SUMMARY / @@KEYWORDS для FTS и embedding
 *   4. При недоступности LLM → graceful fallback на посимвольную разбивку
 */

const { logger } = require('../logger.cjs');
const localLlm = require('./localLlmService.cjs');

// ── Конфигурация ────────────────────────────────────────────────────────────

const CFG = {
    /** Минимальный размер секции для отправки в LLM (меньше → оставляем как один чанк + enrichment) */
    minSectionCharsForSplit: 200,
    /** Максимальный размер секции для LLM split (больше → fallback char split + enrichment) */
    maxSectionCharsForLlm: 6000,
    /** Целевой размер чанка при fallback split */
    fallbackChunkSize: 1400,
    /** Перекрытие при fallback split */
    fallbackOverlap: 250,
    /** Таймаут на семантический split через LLM (мс) */
    splitTimeoutMs: 30_000,
    /** Таймаут на enrichment одного чанка (мс) — фоновая задача, может ждать */
    enrichTimeoutMs: 60_000,
    /** Температура LLM (низкая для детерминизма) */
    temperature: 0.1,
    /** Макс. токенов для ответа LLM при split */
    splitMaxTokens: 2048,
    /** Макс. токенов для ответа LLM при enrichment */
    enrichMaxTokens: 200,
};

// ── Промпт: семантическая разбивка секции ────────────────────────────────────

function buildSplitPrompt(sectionTitle, sectionText) {
    return [
        {
            role: 'system',
            content: [
                'Ты — медицинский текстовый процессор для системы клинической поддержки (CDSS).',
                'Задача: разбей текст клинических рекомендаций на семантически завершённые фрагменты.',
                '',
                'ПРАВИЛА:',
                '1. Каждый чанк = ОДНА завершённая тема (один препарат, один критерий, одна рекомендация)',
                '2. Препарат + ВСЕ его дозировки/формы/противопоказания → ОДИН чанк',
                '3. Таблицы и нумерованные списки НЕ разрывать',
                '4. Диагностический критерий + пояснение/ссылка → ОДИН чанк',
                '5. Рекомендация + уровень доказательности (УУР/УДД) → ОДИН чанк',
                '6. Размер чанка: 300–2000 символов',
                '',
                'Для КАЖДОГО чанка укажи:',
                '- summary: краткое резюме (1 предложение, до 100 символов)',
                '- keywords: ключевые медицинские термины через запятую (5–10 слов)',
                '',
                'ФОРМАТ ОТВЕТА — строго JSON массив, БЕЗ markdown-обёртки:',
                '[{"summary":"...","keywords":"...","text":"..."}]',
            ].join('\n'),
        },
        {
            role: 'user',
            content: `Раздел: ${sectionTitle || 'Без заголовка'}\n\nТекст:\n${sectionText}`,
        },
    ];
}

// ── Промпт: обогащение одного чанка ──────────────────────────────────────────

function buildEnrichPrompt(chunkText) {
    return [
        {
            role: 'system',
            content: [
                'Ты — медицинский индексатор. Для фрагмента клинических рекомендаций создай:',
                '1. summary — резюме в 1 предложение (до 100 символов)',
                '2. keywords — ключевые медицинские термины через запятую (5–10 слов)',
                '',
                'Ответ СТРОГО в JSON, без markdown:',
                '{"summary":"...","keywords":"..."}',
            ].join('\n'),
        },
        { role: 'user', content: chunkText },
    ];
}

// ── Парсинг JSON из ответа LLM (best effort) ────────────────────────────────

function extractJsonFromResponse(text) {
    const trimmed = (text || '').trim();

    // 1. Direct parse
    try { return JSON.parse(trimmed); } catch { /* noop */ }

    // 2. Markdown code block
    const codeBlock = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlock) {
        try { return JSON.parse(codeBlock[1].trim()); } catch { /* noop */ }
    }

    // 3. First JSON array
    const arrMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrMatch) {
        try { return JSON.parse(arrMatch[0]); } catch { /* noop */ }
    }

    // 4. First JSON object
    const objMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objMatch) {
        try { return JSON.parse(objMatch[0]); } catch { /* noop */ }
    }

    return null;
}

// ── Fallback: sentence-aware character split ─────────────────────────────────

function fallbackCharSplit(text, chunkSize = CFG.fallbackChunkSize, overlap = CFG.fallbackOverlap) {
    if (!text) return [];
    if (text.length <= chunkSize) return [text];

    const chunks = [];
    let start = 0;
    const n = text.length;

    while (start < n) {
        let end = Math.min(n, start + chunkSize);

        // Prefer breaking at sentence end (". ") within last 200 chars
        if (end < n) {
            const searchFrom = Math.max(start, end - 200);
            const segment = text.slice(searchFrom, end);
            const sentEnd = segment.lastIndexOf('. ');
            if (sentEnd > 0) {
                end = searchFrom + sentEnd + 2;
            }
        }

        const chunk = text.slice(start, end).trim();
        if (chunk) chunks.push(chunk);
        if (end >= n) break;
        start = Math.max(0, end - overlap);
    }

    return chunks;
}

// ── Формат метаданных ─────────────────────────────────────────────────────────

/**
 * Prefix enrichment metadata to chunk text.
 * Lines starting with @@SUMMARY / @@KEYWORDS are stripped in RAG generation context
 * but indexed by FTS and embedded for semantic search.
 */
function formatChunkWithMeta(text, summary, keywords) {
    const lines = [];
    if (summary) lines.push(`@@SUMMARY: ${summary}`);
    if (keywords) lines.push(`@@KEYWORDS: ${keywords}`);
    return lines.length > 0 ? lines.join('\n') + '\n' + text : text;
}

/**
 * Strip metadata prefix from chunk text (for RAG generation context).
 */
function stripChunkMeta(text) {
    return (text || '').replace(/^@@(?:SUMMARY|KEYWORDS):.*\n/gm, '').trimStart();
}

// ── LLM-вызовы ──────────────────────────────────────────────────────────────

/**
 * Семантическая разбивка одной секции через LLM.
 * @returns {Promise<Array<{text: string, summary: string, keywords: string}>>}
 */
async function semanticSplitSection(sectionTitle, sectionText) {
    // Too short → keep as single chunk, just enrich
    if (sectionText.length < CFG.minSectionCharsForSplit) {
        const meta = await enrichSingleChunk(sectionText);
        return [{ text: sectionText, summary: meta.summary, keywords: meta.keywords }];
    }

    // Too long for LLM context → fallback split, enrich each
    if (sectionText.length > CFG.maxSectionCharsForLlm) {
        logger.info(`[ChunkEnhancer] Section "${sectionTitle}" too long (${sectionText.length} ch), fallback split + enrich`);
        return fallbackWithEnrich(sectionText);
    }

    // ── LLM semantic split ──
    const messages = buildSplitPrompt(sectionTitle, sectionText);
    let response = '';

    try {
        const result = await localLlm.generate(
            messages,
            {
                temperature: CFG.temperature,
                maxTokens: CFG.splitMaxTokens,
                timeoutMs: CFG.splitTimeoutMs,
                forceNonStream: true,
            },
            (token) => { response += token; },
        );

        if (result.status !== 'completed' || !response.trim()) {
            logger.warn(`[ChunkEnhancer] LLM split failed (${result.status}), fallback for "${sectionTitle}"`);
            return fallbackWithEnrich(sectionText);
        }

        const parsed = extractJsonFromResponse(response);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            logger.warn('[ChunkEnhancer] LLM returned non-array JSON, fallback');
            return fallbackWithEnrich(sectionText);
        }

        // Validate each chunk
        const valid = parsed
            .filter(c => c && typeof c.text === 'string' && c.text.trim().length > 30)
            .map(c => ({
                text: c.text.trim(),
                summary: String(c.summary || '').trim().slice(0, 150),
                keywords: String(c.keywords || '').trim().slice(0, 200),
            }));

        if (valid.length === 0) {
            logger.warn('[ChunkEnhancer] No valid chunks from LLM, fallback');
            return fallbackWithEnrich(sectionText);
        }

        logger.info(`[ChunkEnhancer] LLM split "${sectionTitle}" → ${valid.length} semantic chunks`);
        return valid;
    } catch (err) {
        logger.warn(`[ChunkEnhancer] LLM split error: ${err.message}, fallback`);
        return fallbackWithEnrich(sectionText);
    }
}

/**
 * Обогащение одного чанка: резюме + ключевые слова.
 */
async function enrichSingleChunk(chunkText) {
    if (!chunkText || chunkText.length < 50) {
        return { summary: '', keywords: '' };
    }

    let response = '';
    try {
        const result = await localLlm.generate(
            buildEnrichPrompt(chunkText),
            {
                temperature: 0,
                maxTokens: CFG.enrichMaxTokens,
                timeoutMs: CFG.enrichTimeoutMs,
                forceNonStream: true,
            },
            (token) => { response += token; },
        );

        if (result.status !== 'completed' || !response.trim()) {
            return { summary: '', keywords: '' };
        }

        const parsed = extractJsonFromResponse(response);
        if (!parsed || typeof parsed !== 'object') {
            return { summary: '', keywords: '' };
        }

        return {
            summary: String(parsed.summary || '').trim().slice(0, 150),
            keywords: String(parsed.keywords || '').trim().slice(0, 200),
        };
    } catch {
        return { summary: '', keywords: '' };
    }
}

/**
 * Fallback: character split → enrich each chunk.
 */
async function fallbackWithEnrich(sectionText) {
    const rawChunks = fallbackCharSplit(sectionText);
    const results = [];
    for (const chunk of rawChunks) {
        const meta = await enrichSingleChunk(chunk);
        results.push({ text: chunk, summary: meta.summary, keywords: meta.keywords });
    }
    return results;
}

// ── Главная функция ──────────────────────────────────────────────────────────

/**
 * Обработка массива сырых секций из PDF → готовые чанки для БД.
 *
 * @param {Array<{page?, pageStart?, pageEnd?, sectionTitle, type, text, evidenceLevel?}>} rawSections
 * @param {object} [options]
 * @param {boolean} [options.enableLlm=true]
 * @param {(pct: number, step: string) => void} [options.onProgress]
 * @returns {Promise<Array<{page, pageStart, pageEnd, sectionTitle, type, text, evidenceLevel}>>}
 */
async function processSections(rawSections, options = {}) {
    const enableLlm = options.enableLlm !== false;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

    // ── Check LLM availability ──
    let llmAvailable = false;
    if (enableLlm) {
        try {
            const health = await localLlm.healthCheck();
            llmAvailable = health.available;
        } catch {
            llmAvailable = false;
        }
    }

    if (!llmAvailable && enableLlm) {
        logger.info('[ChunkEnhancer] LLM unavailable — all sections will use fallback char split (no enrichment)');
    }

    const total = rawSections.length;
    const output = [];

    for (let i = 0; i < total; i++) {
        const section = rawSections[i];
        const text = (section.text || '').trim();
        if (!text) continue;

        onProgress(Math.round(((i + 1) / total) * 100), `Семантическая обработка секции ${i + 1}/${total}`);

        let chunks;

        if (llmAvailable) {
            chunks = await semanticSplitSection(section.sectionTitle, text);
        } else {
            // No LLM — plain char split, no enrichment
            const splitTexts = fallbackCharSplit(text);
            chunks = splitTexts.map(t => ({ text: t, summary: '', keywords: '' }));
        }

        // Build output rows (backward-compatible with existing upload code)
        const pageStart = Number(section.pageStart || section.page) || null;
        const pageEnd = Number(section.pageEnd || section.page) || null;

        for (const chunk of chunks) {
            const enrichedText = formatChunkWithMeta(chunk.text, chunk.summary, chunk.keywords);

            output.push({
                page: pageStart,           // backward compat
                pageStart,
                pageEnd,
                sectionTitle: section.sectionTitle,
                type: section.type,
                text: enrichedText,
                evidenceLevel: section.evidenceLevel || null,
            });
        }
    }

    logger.info(`[ChunkEnhancer] ${total} sections → ${output.length} chunks (LLM: ${llmAvailable})`);
    return output;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    processSections,
    semanticSplitSection,
    enrichSingleChunk,
    fallbackCharSplit,
    formatChunkWithMeta,
    stripChunkMeta,
    extractJsonFromResponse,
    CFG,
};
