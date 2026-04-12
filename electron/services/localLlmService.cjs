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
const DEFAULT_REQUEST_TIMEOUT_MS = 300_000;

function getBaseUrl() {
    return (process.env.PEDIASSIST_LM_STUDIO_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function getRequestTimeoutMs(messages, options = {}) {
    if (Number.isFinite(options.timeoutMs) && options.timeoutMs >= 10_000) {
        return Math.floor(options.timeoutMs);
    }

    const envTimeout = Number(process.env.LOCAL_LLM_REQUEST_TIMEOUT_MS);
    if (Number.isFinite(envTimeout) && envTimeout >= 10_000) {
        return Math.floor(envTimeout);
    }

    const promptChars = (Array.isArray(messages)
        ? messages.reduce((sum, m) => sum + String(m?.content || '').length, 0)
        : 0);

    if (promptChars >= 20_000) return 360_000;
    if (promptChars >= 10_000) return 320_000;
    return DEFAULT_REQUEST_TIMEOUT_MS;
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

function buildCompletionBody(messages, options, resolvedModel, stream) {
    const body = {
        messages,
        temperature: options.temperature ?? 0.15,
        max_tokens: options.maxTokens ?? 256,
        top_p: options.topP ?? 0.9,
        stream,
    };

    if (options.stop) body.stop = options.stop;
    if (resolvedModel) body.model = resolvedModel;
    if (options.topK != null || options.repeatPenalty != null) {
        body.extra_body = {};
        if (options.topK != null) {
            body.extra_body.top_k = options.topK;
        }
        if (options.repeatPenalty != null) {
            body.extra_body.repeat_penalty = options.repeatPenalty;
        }
    }

    return body;
}

function extractAssistantText(payload) {
    return payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.text || '';
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
 * @param {number} [options.topK]
 * @param {number} [options.repeatPenalty]
 * @param {string[]} [options.stop]
 * @param {string} [options.model]
 * @param {number} [options.timeoutMs]
 * @param {boolean} [options.forceNonStream]
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
    const requestTimeoutMs = getRequestTimeoutMs(messages, options);
    let timedOut = false;

    // Timeout
    const timeoutId = setTimeout(() => {
        timedOut = true;
        abortController.abort();
        logger.warn(`[LocalLLM] Request timed out after ${requestTimeoutMs}ms | genId=${genId}`);
    }, requestTimeoutMs);

    try {
        const resolvedModel = options.model || (await getCurrentModel());
        const useStream = options.forceNonStream ? false : true;
        const streamBody = buildCompletionBody(messages, options, resolvedModel, useStream);

        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(streamBody),
            signal: abortController.signal,
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            logger.error(`[LocalLLM] LM Studio returned HTTP ${res.status}: ${errText}`);
            const compactErr = String(errText || '').replace(/\s+/g, ' ').trim();
            const details = compactErr ? `: ${compactErr.slice(0, 300)}` : '';
            return { status: 'error', error: `LM Studio HTTP ${res.status}${details}` };
        }

        if (useStream) {
            await parseSSEStream(res.body, (token) => {
                tokenCount++;
                if (typeof onToken === 'function') {
                    onToken(token);
                }
            }, abortController.signal);
        } else {
            const payload = await res.json();
            const content = String(extractAssistantText(payload) || '').trim();
            if (content) {
                tokenCount = 1;
                if (typeof onToken === 'function') {
                    onToken(content);
                }
            }
        }

        // Некоторые сборки LM Studio могут вернуть пустой stream; делаем fallback на non-stream ответ.
        if (tokenCount === 0 && !abortController.signal.aborted) {
            logger.warn(`[LocalLLM] Empty stream response, retrying non-stream mode | genId=${genId}`);

            const nonStreamBody = buildCompletionBody(messages, options, resolvedModel, false);
            const fallbackRes = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nonStreamBody),
                signal: abortController.signal,
            });

            if (!fallbackRes.ok) {
                const fallbackErrText = await fallbackRes.text().catch(() => '');
                logger.error(`[LocalLLM] Non-stream fallback failed HTTP ${fallbackRes.status}: ${fallbackErrText}`);
                const compactErr = String(fallbackErrText || '').replace(/\s+/g, ' ').trim();
                const details = compactErr ? `: ${compactErr.slice(0, 300)}` : '';
                return { status: 'error', error: `LM Studio HTTP ${fallbackRes.status}${details}` };
            }

            const payload = await fallbackRes.json();
            const content = String(extractAssistantText(payload) || '').trim();
            if (content) {
                tokenCount = 1;
                if (typeof onToken === 'function') {
                    onToken(content);
                }
            }
        }

        const durationMs = Date.now() - startTime;
        logger.info(
            `[LocalLLM] Generation completed | genId=${genId} | tokens=${tokenCount} | duration=${durationMs}ms`
        );

        return { status: 'completed' };
    } catch (err) {
        if (err.name === 'AbortError' || abortController.signal.aborted) {
            const durationMs = Date.now() - startTime;
            if (timedOut) {
                logger.warn(
                    `[LocalLLM] Generation timed out | genId=${genId} | tokens=${tokenCount} | duration=${durationMs}ms`
                );
                return { status: 'error', error: `LM Studio timeout after ${requestTimeoutMs}ms` };
            }
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
