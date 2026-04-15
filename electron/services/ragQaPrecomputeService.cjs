'use strict';

/**
 * ragQaPrecomputeService.cjs
 *
 * Фоновый сервис для предварительного вычисления ответов на стандартные клинические вопросы.
 *
 * При загрузке гайдлайна ставит задачу в FIFO-очередь.
 * Воркер последовательно обрабатывает задачи, чтобы не нагружать LM Studio
 * параллельными запросами.
 *
 * Хранит результаты в таблице disease_qa_cache.
 */

const { prisma } = require('../prisma-client.cjs');
const { logger } = require('../logger.cjs');
const { ragQuery } = require('./ragPipelineService.cjs');

// ─── Стандартные шаблоны вопросов ─────────────────────────────────────────────

/**
 * Набор стандартных клинических вопросов.
 * templateId — стабильный идентификатор, question — текст для кнопки-чипа и RAG-запроса.
 */
const STANDARD_QUESTIONS = [
    {
        templateId: 'treatment_list',
        question: 'Какие препараты применяются для лечения?',
        label: '💊 Все препараты',
    },
    {
        templateId: 'first_line',
        question: 'Какой препарат первой линии?',
        label: '⭐ Первая линия',
    },
    {
        templateId: 'dosing',
        question: 'Какие дозировки препаратов указаны в рекомендациях?',
        label: '📊 Дозировки',
    },
    {
        templateId: 'antibiotics',
        question: 'Какие антибиотики рекомендованы и в каких дозах?',
        label: '💉 Антибиотики',
    },
    {
        templateId: 'contraindications',
        question: 'Какие противопоказания к препаратам?',
        label: '⚠️ Противопоказания',
    },
    {
        templateId: 'diagnostics',
        question: 'Какие диагностические критерии и обследования необходимы?',
        label: '🔬 Диагностика',
    },
    {
        templateId: 'hospitalization',
        question: 'Показания к госпитализации',
        label: '🏥 Госпитализация',
    },
];

/** Экспортируем как константу для UI */
const QA_TEMPLATES = STANDARD_QUESTIONS.map(({ templateId, label }) => ({ templateId, label }));

// ─── Очередь задач ─────────────────────────────────────────────────────────────

/** @type {Array<{diseaseId: number}>} */
const _queue = [];
let _workerRunning = false;

/**
 * Добавляет задачу precompute для diseaseId в очередь.
 * Если задача для этого diseaseId уже есть — не дублирует.
 */
function schedulePrecompute(diseaseId) {
    const id = Number(diseaseId);
    if (!Number.isFinite(id) || id <= 0) return;
    if (_queue.some(t => t.diseaseId === id)) {
        logger.info(`[QaPrecompute] diseaseId=${id} already in queue, skipping duplicate`);
        return;
    }
    _queue.push({ diseaseId: id });
    logger.info(`[QaPrecompute] Scheduled precompute for diseaseId=${id} (queue size: ${_queue.length})`);
    _runWorker();
}

/**
 * Основной воркер: берёт задачи из очереди по одной и выполняет precompute.
 * Запускается при наличии задач, завершается когда очередь пуста.
 */
async function _runWorker() {
    if (_workerRunning) return;
    _workerRunning = true;

    while (_queue.length > 0) {
        const task = _queue.shift();
        try {
            await _precomputeForDisease(task.diseaseId);
        } catch (err) {
            logger.error(`[QaPrecompute] Error precomputing diseaseId=${task.diseaseId}:`, err.message);
        }
    }

    _workerRunning = false;
    logger.info('[QaPrecompute] Worker idle, queue empty');
}

/**
 * Вычисляет ответы на все STANDARD_QUESTIONS для одного diseaseId.
 * Сохраняет/обновляет записи в disease_qa_cache.
 *
 * Все вопросы обрабатываются последовательно — LM Studio single-threaded.
 */
async function _precomputeForDisease(diseaseId) {
    logger.info(`[QaPrecompute] Starting precompute for diseaseId=${diseaseId} (${STANDARD_QUESTIONS.length} questions)`);

    for (const tpl of STANDARD_QUESTIONS) {
        try {
            logger.info(`[QaPrecompute] Generating answer for templateId=${tpl.templateId} diseaseId=${diseaseId}`);
            const result = await ragQuery({ query: tpl.question, diseaseId, history: [] });

            if (!result.answer || result.answer === 'Данные отсутствуют в предоставленных материалах.') {
                logger.info(`[QaPrecompute] No data for templateId=${tpl.templateId} diseaseId=${diseaseId}, skipping cache`);
                continue;
            }

            await prisma.diseaseQaCache.upsert({
                where: { diseaseId_templateId: { diseaseId, templateId: tpl.templateId } },
                update: {
                    answer: result.answer,
                    sources: JSON.stringify(result.sources ?? []),
                    updatedAt: new Date(),
                },
                create: {
                    diseaseId,
                    templateId: tpl.templateId,
                    question: tpl.question,
                    answer: result.answer,
                    sources: JSON.stringify(result.sources ?? []),
                },
            });
            logger.info(`[QaPrecompute] Saved templateId=${tpl.templateId} diseaseId=${diseaseId} (${result.answer.length} chars)`);
        } catch (err) {
            logger.warn(`[QaPrecompute] Failed templateId=${tpl.templateId} diseaseId=${diseaseId}: ${err.message}`);
        }
    }

    logger.info(`[QaPrecompute] Precompute complete for diseaseId=${diseaseId}`);
}

/**
 * Получить доступные pre-computed записи для diseaseId.
 * Возвращает только записи с непустыми ответами, обогащённые label из шаблона.
 *
 * @param {number} diseaseId
 * @returns {Promise<Array<{templateId, label, question, answer, sources, generatedAt}>>}
 */
async function getQaCache(diseaseId) {
    const id = Number(diseaseId);
    if (!Number.isFinite(id) || id <= 0) return [];

    const rows = await prisma.diseaseQaCache.findMany({
        where: { diseaseId: id },
        orderBy: { generatedAt: 'asc' },
    });

    const templateMap = new Map(STANDARD_QUESTIONS.map(t => [t.templateId, t]));

    return rows
        .filter(r => r.answer && r.answer.length > 10)
        .map(r => {
            const tpl = templateMap.get(r.templateId);
            return {
                templateId: r.templateId,
                label: tpl?.label ?? r.templateId,
                question: r.question,
                answer: r.answer,
                sources: (() => { try { return JSON.parse(r.sources); } catch { return []; } })(),
                generatedAt: r.generatedAt.toISOString(),
            };
        });
}

/**
 * Принудительно запустить precompute для diseaseId (например, по кнопке в UI).
 */
async function triggerPrecompute(diseaseId) {
    schedulePrecompute(diseaseId);
}

/**
 * Вычисляет и сохраняет ответ на один вопрос по templateId для diseaseId.
 * Возвращает QaCacheEntry или null при ошибке/отсутствии данных.
 */
async function computeQaCacheEntry(diseaseId, templateId) {
    const id = Number(diseaseId);
    const tpl = STANDARD_QUESTIONS.find(t => t.templateId === templateId);
    if (!Number.isFinite(id) || id <= 0 || !tpl) return null;

    try {
        logger.info(`[QaPrecompute] Computing single answer for templateId=${templateId} diseaseId=${id}`);
        const result = await ragQuery({ query: tpl.question, diseaseId: id, history: [] });

        if (!result.answer || result.answer === 'Данные отсутствуют в предоставленных материалах.') {
            logger.info(`[QaPrecompute] No data for templateId=${templateId} diseaseId=${id}`);
            return null;
        }

        await prisma.diseaseQaCache.upsert({
            where: { diseaseId_templateId: { diseaseId: id, templateId } },
            update: {
                answer: result.answer,
                sources: JSON.stringify(result.sources ?? []),
                updatedAt: new Date(),
            },
            create: {
                diseaseId: id,
                templateId,
                question: tpl.question,
                answer: result.answer,
                sources: JSON.stringify(result.sources ?? []),
            },
        });

        logger.info(`[QaPrecompute] Saved single templateId=${templateId} diseaseId=${id}`);

        // Вернуть готовый entry
        return {
            templateId,
            label: tpl.label,
            question: tpl.question,
            answer: result.answer,
            sources: result.sources ?? [],
            generatedAt: new Date().toISOString(),
        };
    } catch (err) {
        logger.warn(`[QaPrecompute] Failed single templateId=${templateId} diseaseId=${id}: ${err.message}`);
        return null;
    }
}

module.exports = { schedulePrecompute, triggerPrecompute, getQaCache, QA_TEMPLATES, computeQaCacheEntry };
