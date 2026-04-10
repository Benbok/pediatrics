'use strict';

/**
 * localLlmService.cjs
 *
 * HTTP-клиент к LM Studio (OpenAI-совместимый API).
 * Подключается к локальному серверу LM Studio на localhost:1234.
 *
 * API:
 *   healthCheck() — проверка доступности LM Studio
 *   generate(messages, options, onToken) — стриминг через SSE
 *   abort()       — прерывание текущих генераций
 *   getStatus()   — состояние сервиса
 */

const { logger } = require('../logger.cjs');

const DEFAULT_BASE_URL = 'http://localhost:1234';
const REQUEST_TIMEOUT_MS = 45_000;

function getBaseUrl() {
    return (process.env.PEDIASSIST_LM_STUDIO_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

// ── Active generations ───────────────────────────────────────────────────────

/** @type {Map<string, AbortController>} */
const _activeGenerations = new Map();
let _genCounter = 0;


// ── Model Resolution ────────────────────────────────────────────────────────

/**
 * Запрашивает у LM Studio актуальный список загруженных моделей
 * и возвращает первую из них (или null, если ни одна не загружена).
 * Вызывается при каждой генерации, чтобы модель не кэшировалась в коде.
 *
 * @returns {Promise<string|null>}
 */
async function getCurrentModel() {
    const baseUrl = getBaseUrl();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${baseUrl}/v1/models`, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const data = await res.json();
        const models = (data?.data || []).map((m) => m.id);
        return models[0] || null;
    } catch {
        return null;
    }
}

// ── SSE Stream Parser ────────────────────────────────────────────────────────

/**
 * Parses an SSE stream from a fetch Response (OpenAI-compatible format).
 * Calls onToken for each content delta. Respects AbortSignal.
 *
 * @param {ReadableStream<Uint8Array>} body
 * @param {(token: string) => void} onToken
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
 */
async function parseSSEStream(body, onToken, signal) {
    const decoder = new TextDecoder('utf-8');
    const reader = body.getReader();
    let buffer = '';

    try {
        while (true) {
            if (signal.aborted) break;

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete lines
            const lines = buffer.split('\n');
            // Keep incomplete last line in buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(':')) continue;

                if (trimmed === 'data: [DONE]') return;

                if (trimmed.startsWith('data: ')) {
                    const jsonStr = trimmed.slice(6);
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const content = parsed?.choices?.[0]?.delta?.content;
                        if (content) {
                            onToken(content);
                        }
                    } catch {
                        // Malformed JSON chunk — skip
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Проверяет доступность LM Studio и возвращает список загруженных моделей.
 * @returns {Promise<{available: boolean, models?: string[], endpoint?: string}>}
 */
async function healthCheck() {
    const baseUrl = getBaseUrl();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`${baseUrl}/v1/models`, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            logger.warn(`[LocalLLM] Health check failed: HTTP ${res.status}`);
            return { available: false, endpoint: baseUrl };
        }

        const data = await res.json();
        const models = (data?.data || []).map((m) => m.id);

        logger.info('[LocalLLM] Health check OK', { models, endpoint: baseUrl });
        return { available: true, models, endpoint: baseUrl };
    } catch (err) {
        logger.warn(`[LocalLLM] Health check failed: ${err.message}`);
        return { available: false, endpoint: baseUrl };
    }
}

/**
 * Генерация ответа через LM Studio с потоковой передачей токенов (SSE).
 *
 * @param {Array<{role: string, content: string}>} messages - Массив сообщений (system/user/assistant)
 * @param {object} options - Параметры инференса
 * @param {number} [options.maxTokens=256]
 * @param {number} [options.temperature=0.15]
 * @param {number} [options.topP=0.9]
 * @param {string[]} [options.stop]
 * @param {string} [options.model]
 * @param {(token: string) => void} onToken - Колбэк для каждого токена
 * @returns {Promise<{status: 'completed'|'aborted'|'error', error?: string}>}
 */
async function generate(messages, options = {}, onToken) {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('LLM_INVALID_MESSAGES');
    }

    const genId = `gen_${++_genCounter}`;
    const abortController = new AbortController();
    _activeGenerations.set(genId, abortController);

    const startTime = Date.now();
    let tokenCount = 0;
    const baseUrl = getBaseUrl();

    // Timeout
    const timeoutId = setTimeout(() => {
        abortController.abort();
        logger.warn(`[LocalLLM] Request timed out after ${REQUEST_TIMEOUT_MS}ms | genId=${genId}`);
    }, REQUEST_TIMEOUT_MS);

    try {
        const resolvedModel = options.model || (await getCurrentModel());

        const body = {
            messages,
            temperature: options.temperature ?? 0.15,
            max_tokens: options.maxTokens ?? 256,
            top_p: options.topP ?? 0.9,
            stream: true,
        };

        if (options.stop) body.stop = options.stop;
        if (resolvedModel) body.model = resolvedModel;

        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: abortController.signal,
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            logger.error(`[LocalLLM] LM Studio returned HTTP ${res.status}: ${errText}`);
            return { status: 'error', error: `LM Studio HTTP ${res.status}` };
        }

        await parseSSEStream(res.body, (token) => {
            tokenCount++;
            if (typeof onToken === 'function') {
                onToken(token);
            }
        }, abortController.signal);

        const durationMs = Date.now() - startTime;
        logger.info(
            `[LocalLLM] Generation completed | genId=${genId} | tokens=${tokenCount} | duration=${durationMs}ms`
        );

        return { status: 'completed' };
    } catch (err) {
        if (err.name === 'AbortError' || abortController.signal.aborted) {
            const durationMs = Date.now() - startTime;
            logger.info(
                `[LocalLLM] Generation aborted | genId=${genId} | tokens=${tokenCount} | duration=${durationMs}ms`
            );
            return { status: 'aborted' };
        }

        logger.error(`[LocalLLM] Generation error | genId=${genId}: ${err.message}`);
        return { status: 'error', error: err.message || 'LM Studio connection failed' };
    } finally {
        clearTimeout(timeoutId);
        _activeGenerations.delete(genId);
    }
}

/**
 * Прерывает все активные генерации.
 */
function abort() {
    for (const [id, ctrl] of _activeGenerations) {
        ctrl.abort();
        logger.info(`[LocalLLM] Abort signal sent for genId=${id}`);
    }
}

/**
 * Возвращает текущее состояние сервиса.
 * @returns {{ activeGenerations: number, isGenerating: boolean, endpoint: string }}
 */
function getStatus() {
    return {
        activeGenerations: _activeGenerations.size,
        isGenerating: _activeGenerations.size > 0,
        endpoint: getBaseUrl(),
    };
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    healthCheck,
    generate,
    abort,
    getStatus,
};
