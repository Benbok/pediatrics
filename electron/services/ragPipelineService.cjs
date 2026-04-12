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

// ─── Конфиг ─────────────────────────────────────────────────────────────────

const CFG = {
    topK: 12,           // чанков из FTS
    topKAfterRank: 6,   // чанков в контекст после ранжирования
    minFtsScore: -10,   // порог BM25 (отрицательный; чем меньше — тем лучше)
    embedMin: 0.20,     // минимальное косинусное сходство при embedding-ранжировании
    temperature: 0.05,
    maxTokens: 600,
};

// ─── Системный промпт ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — клинический справочный ассистент для врача-педиатра. Отвечаешь строго по предоставленным материалам.

ПРАВИЛА:
- Отвечать ТОЛЬКО на то, что спросили.
- Использовать ТОЛЬКО информацию из раздела [КОНТЕКСТ].
- Никаких вводных фраз («Согласно руководству…», «На основании…» и т.п.).
- Никаких заключений и оговорок, если не запрошены явно.
- Формат: если запрошен препарат — только препарат или список. Если дозировка — только дозировка.
- Если информация отсутствует в контексте — одна фраза: «Данные отсутствуют в предоставленных материалах.»
- Язык: русский, медицинская терминология.`;

// ─── Стоп-слова для реранкинга ───────────────────────────────────────────────

const RERANK_STOPWORDS = new Set([
    'какой', 'какая', 'какие', 'какое', 'что', 'как', 'для', 'при', 'от', 'по',
    'в', 'на', 'и', 'или', 'а', 'но', 'это', 'лечение', 'терапия', 'терапии',
    'симптомы', 'симптом', 'признаки', 'признак', 'лечить', 'назначить',
    'ребёнок', 'ребенок', 'дети', 'детей', 'детский', 'пациент',
    'препараты', 'препарат', 'лекарства', 'лекарство',
]);

// ─── LM Studio embedding ─────────────────────────────────────────────────────

/**
 * Получить embedding вектора для текста через LM Studio /v1/embeddings.
 * Возвращает float[] или null (если LM Studio недоступен или нет модели embeddingов).
 */
async function embedTextViaLmStudio(text) {
    try {
        const baseUrl = (process.env.PEDIASSIST_LM_STUDIO_URL || 'http://localhost:1234').replace(/\/+$/, '');
        const model = process.env.EMBED_MODEL || 'nomic-embed-text';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${baseUrl}/v1/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, input: text }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const data = await res.json();
        const embedding = data?.data?.[0]?.embedding;
        return Array.isArray(embedding) && embedding.length > 0 ? embedding : null;
    } catch {
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
 * Строит FTS5-запрос: токены ≥ 3 символов, суффикс *.
 */
function buildFtsQuery(text) {
    const tokens = String(text || '')
        .toLowerCase()
        .split(/[\s,;.()\[\]{}"'«»\-—]+/)
        .map(t => t.trim())
        .filter(t => t.length >= 3 && !RERANK_STOPWORDS.has(t))
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
async function ftsRetrieve(diseaseId, query) {
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
            CFG.topK * 2
        );

        return rows
            .filter(r => Number(r.score) <= CFG.minFtsScore || true) // берём всё, фильтруем ниже
            .slice(0, CFG.topK)
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
               AND (${words.map(() => 'text LIKE ?').join(' OR ')})
             LIMIT ?`,
            Number(diseaseId),
            ...words.map(w => `%${w}%`),
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
 */
function rerankByKeywords(chunks, query) {
    const keywords = String(query || '')
        .toLowerCase()
        .split(/[\s,;.()\-—]+/)
        .filter(w => w.length > 3 && !RERANK_STOPWORDS.has(w));

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

            // Нормализуем BM25 в [0..1]: BM25 отрицателен, ближе к 0 — лучше
            const bm25Norm = c.bm25 < 0 ? Math.min(1, Math.abs(c.bm25) / 5) : 0;

            return { ...c, score: bm25Norm + boost };
        })
        .sort((a, b) => b.score - a.score);
}

/**
 * Реранкинг с использованием embedding cosine similarity.
 */
function rerankBySemantic(chunks, queryVec) {
    return chunks
        .map(c => {
            let semScore = 0;
            if (c.embeddingJson) {
                try {
                    const chunkVec = JSON.parse(c.embeddingJson);
                    semScore = cosine(queryVec, chunkVec);
                } catch {
                    // Битый JSON — оставляем 0
                }
            }
            return { ...c, score: semScore > 0 ? semScore : c.score };
        })
        .filter(c => c.score >= CFG.embedMin || c.bm25 < -0.5) // слабые семантически, но сильные FTS — оставляем
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

function buildContext(chunks) {
    return chunks.map(c => {
        let header = '';
        if (c.sectionTitle) header += `[${c.sectionTitle}]`;
        if (c.evidenceLevel) header += (header ? ' ' : '') + `(УД: ${c.evidenceLevel})`;
        return (header ? header + '\n' : '') + c.text;
    }).join('\n\n---\n\n');
}

// ─── Главная функция: ragQuery ────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string} params.query
 * @param {number} params.diseaseId
 * @returns {Promise<{answer: string, sources: object[], context: string}>}
 */
async function ragQuery({ query, diseaseId }) {
    logger.info('[RAGPipeline] ragQuery start', { diseaseId, queryLength: String(query || '').length });

    // 1. FTS retrieval
    let chunks = await ftsRetrieve(diseaseId, query);
    if (chunks.length === 0) {
        logger.info('[RAGPipeline] FTS empty, trying direct retrieve');
        chunks = await directRetrieve(diseaseId, query);
    }

    if (chunks.length === 0) {
        logger.info('[RAGPipeline] No chunks found for diseaseId:', diseaseId);
        return {
            answer: 'Данные отсутствуют в предоставленных материалах.',
            sources: [],
            context: '',
        };
    }

    // 2. Ранжирование по ключевым словам (baseline)
    chunks = rerankByKeywords(chunks, query);

    // 3. Опциональный семантический реранкинг (если LM Studio имеет embedding-модель)
    const queryVec = await embedTextViaLmStudio(String(query || ''));
    if (queryVec && chunks.some(c => c.embeddingJson)) {
        logger.info('[RAGPipeline] Semantic rerank enabled');
        chunks = rerankBySemantic(chunks, queryVec);
    }

    // 4. Дедупликация + топ-K
    const top = dedup(chunks).slice(0, CFG.topKAfterRank);
    const context = buildContext(top);

    // 5. Генерация через LM Studio
    const userMessage = `[КОНТЕКСТ]\n${context}\n\n[ВОПРОС]\n${query}`;
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
    ];

    let answerText = '';
    const result = await localLlmService.generate(
        messages,
        { maxTokens: CFG.maxTokens, temperature: CFG.temperature, topP: 0.9 },
        (token) => { answerText += token; }
    );

    if (result.status === 'error') {
        throw new Error(result.error || 'LM Studio generation failed');
    }
    if (result.status === 'aborted') {
        throw new Error('Generation aborted');
    }

    const answer = answerText.trim() || 'Данные отсутствуют в предоставленных материалах.';

    const sources = top.map(c => ({
        id: c.id,
        guidelineId: c.guidelineId,
        sectionTitle: c.sectionTitle || null,
        evidenceLevel: c.evidenceLevel || null,
        pageStart: c.pageStart || null,
        pageEnd: c.pageEnd || null,
        score: +c.score.toFixed(3),
        preview: c.text.slice(0, 140).replace(/\n/g, ' ') + (c.text.length > 140 ? '…' : ''),
    }));

    logger.info('[RAGPipeline] ragQuery done', {
        chunks: top.length,
        answerLength: answer.length,
        hasSemantic: !!queryVec,
    });

    return { answer, sources, context };
}

// ─── Streaming: ragQueryStream ────────────────────────────────────────────────

/**
 * Стриминговая версия ragQuery.
 * Возвращает AsyncGenerator, yield-ит токены.
 *
 * @param {object} params
 * @param {string} params.query
 * @param {number} params.diseaseId
 * @param {Function} onToken - колбэк для каждого токена (для IPC)
 * @returns {Promise<{sources: object[], context: string}>}
 */
async function ragQueryStream({ query, diseaseId, onToken }) {
    logger.info('[RAGPipeline] ragQueryStream start', { diseaseId });

    // 1. FTS retrieval
    let chunks = await ftsRetrieve(diseaseId, query);
    if (chunks.length === 0) chunks = await directRetrieve(diseaseId, query);

    if (chunks.length === 0) {
        const noData = 'Данные отсутствуют в предоставленных материалах.';
        if (typeof onToken === 'function') onToken(noData);
        return { sources: [], context: '' };
    }

    // 2-4. Ранжирование + дедупликация
    chunks = rerankByKeywords(chunks, query);
    const queryVec = await embedTextViaLmStudio(String(query || ''));
    if (queryVec && chunks.some(c => c.embeddingJson)) {
        chunks = rerankBySemantic(chunks, queryVec);
    }
    const top = dedup(chunks).slice(0, CFG.topKAfterRank);
    const context = buildContext(top);

    // 5. Streaming генерация
    const userMessage = `[КОНТЕКСТ]\n${context}\n\n[ВОПРОС]\n${query}`;
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
    ];

    const result = await localLlmService.generate(
        messages,
        { maxTokens: CFG.maxTokens, temperature: CFG.temperature, topP: 0.9 },
        (token) => {
            if (typeof onToken === 'function') onToken(token);
        }
    );

    if (result.status === 'error') {
        throw new Error(result.error || 'LM Studio generation failed');
    }

    const sources = top.map(c => ({
        id: c.id,
        guidelineId: c.guidelineId,
        sectionTitle: c.sectionTitle || null,
        evidenceLevel: c.evidenceLevel || null,
        pageStart: c.pageStart || null,
        pageEnd: c.pageEnd || null,
        score: +c.score.toFixed(3),
        preview: c.text.slice(0, 140).replace(/\n/g, ' ') + (c.text.length > 140 ? '…' : ''),
    }));

    return { sources, context };
}

// ─── Реиндексация embedding-ов ────────────────────────────────────────────────

/**
 * Пересчитать embeddingJson для всех чанков заболевания через LM Studio.
 * @param {number} diseaseId
 * @param {Function} onProgress - (done, total) => void
 * @returns {Promise<{indexed: number}>}
 */
async function reindexGuidelineEmbeddings(diseaseId, onProgress) {
    const chunks = await prisma.guidelineChunk.findMany({
        where: { diseaseId: Number(diseaseId) },
        select: { id: true, text: true },
    });

    const total = chunks.length;
    let done = 0;

    for (const chunk of chunks) {
        const text = String(chunk.text || '').trim();
        if (!text) { done++; continue; }

        const vec = await embedTextViaLmStudio(text);
        if (vec) {
            await prisma.guidelineChunk.update({
                where: { id: chunk.id },
                data: { embeddingJson: JSON.stringify(vec) },
            });
        }

        done++;
        if (typeof onProgress === 'function') onProgress(done, total);
    }

    logger.info('[RAGPipeline] reindexGuidelineEmbeddings done', { diseaseId, total, indexed: done });
    return { indexed: done };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { ragQuery, ragQueryStream, reindexGuidelineEmbeddings };
