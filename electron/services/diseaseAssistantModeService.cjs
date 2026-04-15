'use strict';

/**
 * diseaseAssistantModeService.cjs
 *
 * Единая точка маршрутизации запросов AI assistant для diseases:
 * - mode=rag    -> retrieval + grounding (ragPipelineService)
 * - mode=direct -> прямой запрос в local LLM без RAG-контекста
 */

const { logger } = require('../logger.cjs');
const localLlmService = require('./localLlmService.cjs');

const DIRECT_SYSTEM_PROMPT = `Ты — медицинский ассистент для врача-педиатра.

Правила ответа:
- Отвечай по-русски, структурированно и практично.
- Если данных недостаточно для точного клинического решения, явно укажи ограничения.
- Не выдавай ответ как окончательный диагноз; отмечай необходимость клинической верификации.
- Если уместно, давай краткие пункты: ключевые риски, что уточнить, что мониторировать.`;

const DIRECT_MAX_HISTORY_TURNS = 6;

function normalizeAssistantMode(mode) {
    return mode === 'direct' ? 'direct' : 'rag';
}

function getRagPipelineService() {
    return require('./ragPipelineService.cjs');
}

function buildDirectMessages(query, history = []) {
    const normalizedHistory = Array.isArray(history) ? history.slice(-DIRECT_MAX_HISTORY_TURNS) : [];
    const historyMessages = normalizedHistory.flatMap((turn) => {
        const question = String(turn?.q || '').trim();
        const answer = String(turn?.a || '').trim();
        const out = [];
        if (question) out.push({ role: 'user', content: question });
        if (answer) out.push({ role: 'assistant', content: answer });
        return out;
    });

    return [
        { role: 'system', content: DIRECT_SYSTEM_PROMPT },
        ...historyMessages,
        { role: 'user', content: String(query || '').trim() },
    ];
}

async function runAssistantQuery({ query, diseaseId, history = [], mode = 'rag' }, deps = {}) {
    const normalizedMode = normalizeAssistantMode(mode);
    const ragService = deps.ragPipelineService || getRagPipelineService();
    const llmService = deps.localLlmService || localLlmService;

    if (normalizedMode === 'rag') {
        const result = await ragService.ragQuery({ query, diseaseId, history });
        return { ...result, mode: normalizedMode };
    }

    logger.info('[DiseaseAssistant] direct mode query', {
        diseaseId: Number(diseaseId),
        historyTurns: Array.isArray(history) ? history.length : 0,
    });

    const messages = buildDirectMessages(query, history);
    let answerText = '';
    const generation = await llmService.generate(
        messages,
        { maxTokens: 900, temperature: 0.3, topP: 0.9 },
        (token) => { answerText += token; }
    );

    if (generation.status === 'error') {
        throw new Error(generation.error || 'LM Studio generation failed');
    }
    if (generation.status === 'aborted') {
        throw new Error('Generation aborted');
    }

    return {
        answer: answerText.trim() || 'Не удалось получить ответ от локальной модели.',
        sources: [],
        context: '',
        mode: normalizedMode,
    };
}

async function runAssistantQueryStream({ query, diseaseId, history = [], mode = 'rag', onToken }, deps = {}) {
    const normalizedMode = normalizeAssistantMode(mode);
    const ragService = deps.ragPipelineService || getRagPipelineService();
    const llmService = deps.localLlmService || localLlmService;

    if (normalizedMode === 'rag') {
        const result = await ragService.ragQueryStream({ query, diseaseId, history, onToken });
        return { ...result, mode: normalizedMode };
    }

    logger.info('[DiseaseAssistant] direct mode stream', {
        diseaseId: Number(diseaseId),
        historyTurns: Array.isArray(history) ? history.length : 0,
    });

    const messages = buildDirectMessages(query, history);
    const generation = await llmService.generate(
        messages,
        { maxTokens: 900, temperature: 0.3, topP: 0.9 },
        (token) => {
            if (typeof onToken === 'function') onToken(token);
        }
    );

    if (generation.status === 'error') {
        throw new Error(generation.error || 'LM Studio generation failed');
    }
    if (generation.status === 'aborted') {
        throw new Error('Generation aborted');
    }

    return { sources: [], context: '', mode: normalizedMode };
}

module.exports = {
    normalizeAssistantMode,
    runAssistantQuery,
    runAssistantQueryStream,
};
