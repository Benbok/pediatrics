'use strict';

/**
 * geminiLlmAdapter.cjs
 *
 * Implements the same interface as localLlmService so it can be used
 * as a drop-in replacement for any feature routed to "gemini".
 *
 * Interface:
 *   generate(messages, options, onToken) → Promise<{status, error?}>
 *   healthCheck()                        → Promise<{available, endpoint?}>
 *   abort()                              → void
 *   getStatus()                          → {activeGenerations, isGenerating, endpoint}
 *
 * messages format: OpenAI-style [{role: 'system'|'user'|'assistant', content: string}]
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { logger } = require('../logger.cjs');

// ── ApiKeyManager (lazy) ─────────────────────────────────────────────────────

let _apiKeyManager = null;
function _getManager() {
    if (!_apiKeyManager) {
        try { _apiKeyManager = require('./apiKeyManager.cjs').apiKeyManager; } catch {}
    }
    return _apiKeyManager;
}

function _getActiveKeyAndModel() {
    const manager = _getManager();
    if (!manager) throw new Error('ApiKeyManager недоступен');
    const key = manager.getActiveKey();
    if (!key) throw new Error('Нет активных Gemini API ключей. Добавьте ключ в Настройках → API');
    const model = manager.getActiveKeyModel() || 'gemini-2.5-flash';
    return { key, model };
}

function _getBaseUrl() {
    return (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
}

// ── OpenAI → Gemini message conversion ──────────────────────────────────────

/**
 * Convert OpenAI-style messages array to Gemini request body.
 * System messages → systemInstruction
 * user/assistant → contents with role 'user'/'model'
 */
function _toGeminiBody(messages, options = {}) {
    let systemText = '';
    const contents = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemText += (systemText ? '\n' : '') + msg.content;
        } else {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            });
        }
    }

    const body = { contents };
    if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };

    body.generationConfig = {};
    if (options.maxTokens) body.generationConfig.maxOutputTokens = options.maxTokens;
    if (options.temperature !== undefined) body.generationConfig.temperature = options.temperature;
    if (options.topP !== undefined) body.generationConfig.topP = options.topP;

    // Gemini 2.5 models use thinking by default which consumes output tokens.
    // For deterministic tasks (spelling/punctuation) disable it so all tokens
    // go to actual output.
    if (options.thinkingBudget !== undefined) {
        body.generationConfig.thinkingConfig = { thinkingBudget: options.thinkingBudget };
    }

    return body;
}

// ── Abort controller ─────────────────────────────────────────────────────────

let _currentController = null;
let _isGenerating = false;

// ── Core streaming generate ──────────────────────────────────────────────────

/**
 * Stream-generate content using Gemini API.
 * Same return contract as localLlmService.generate().
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]  maxTokens, temperature, topP, timeoutMs
 * @param {Function} [onToken] called for each streamed token
 * @returns {Promise<{status: 'completed'|'aborted'|'error', error?: string}>}
 */
async function generate(messages, options = {}, onToken = null) {
    let key, model;
    try {
        ({ key, model } = _getActiveKeyAndModel());
    } catch (err) {
        return { status: 'error', error: err.message };
    }

    const baseUrl = _getBaseUrl();
    const url = new URL(
        `/v1beta/models/${model}:streamGenerateContent?key=${encodeURIComponent(key)}&alt=sse`,
        baseUrl
    );
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const bodyStr = JSON.stringify(_toGeminiBody(messages, options));
    const timeoutMs = options.timeoutMs || 120_000;

    const controller = new AbortController();
    _currentController = controller;
    _isGenerating = true;

    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    return new Promise((resolve) => {
        if (controller.signal.aborted) {
            clearTimeout(timeoutHandle);
            _isGenerating = false;
            return resolve({ status: 'aborted' });
        }

        const done = (result) => {
            clearTimeout(timeoutHandle);
            _isGenerating = false;
            if (_currentController === controller) _currentController = null;
            resolve(result);
        };

        try {
            const req = transport.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(bodyStr),
                },
            }, (res) => {
                // Error status — collect body for message
                if (res.statusCode >= 400) {
                    const chunks = [];
                    res.on('data', c => chunks.push(c));
                    res.on('end', () => {
                        let errMsg = `HTTP ${res.statusCode}`;
                        try {
                            const raw = Buffer.concat(chunks).toString('utf8');
                            const parsed = JSON.parse(raw);
                            errMsg = parsed?.error?.message || errMsg;
                        } catch {}
                        logger.warn('[GeminiAdapter] API error', { statusCode: res.statusCode, errMsg });
                        done({ status: 'error', error: errMsg });
                    });
                    return;
                }

                // Parse SSE stream
                let sseBuffer = '';
                let _totalTokens = 0;
                let _totalDataEvents = 0;

                res.on('data', (chunk) => {
                    if (controller.signal.aborted) { res.destroy(); return; }
                    sseBuffer += chunk.toString('utf8');
                    const lines = sseBuffer.split('\n');
                    sseBuffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(':')) continue;
                        if (trimmed === 'data: [DONE]') return;
                        if (!trimmed.startsWith('data: ')) continue;

                        _totalDataEvents++;
                        const jsonStr = trimmed.slice(6);
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const candidate = parsed?.candidates?.[0];
                            const text = candidate?.content?.parts?.[0]?.text;
                            const finishReason = candidate?.finishReason;

                            if (finishReason && finishReason !== 'STOP') {
                                logger.warn('[GeminiAdapter] Non-STOP finishReason', { finishReason });
                            }

                            if (text && onToken) {
                                _totalTokens++;
                                onToken(text);
                            } else if (!text && _totalDataEvents <= 3) {
                                // Log first few events without text for diagnostics
                                logger.info('[GeminiAdapter] SSE event without text', {
                                    eventIndex: _totalDataEvents,
                                    hasCandidate: !!candidate,
                                    finishReason: finishReason || null,
                                    keys: Object.keys(parsed || {}),
                                });
                            }
                        } catch (parseErr) {
                            logger.warn('[GeminiAdapter] SSE JSON parse error', {
                                error: parseErr.message,
                                snippet: jsonStr.slice(0, 120),
                            });
                        }
                    }
                });

                res.on('end', () => {
                    logger.info('[GeminiAdapter] Stream ended', {
                        totalDataEvents: _totalDataEvents,
                        totalTokens: _totalTokens,
                    });
                    if (controller.signal.aborted) {
                        done({ status: 'aborted' });
                    } else {
                        done({ status: 'completed' });
                    }
                });

                res.on('error', (err) => {
                    done({ status: 'error', error: err.message });
                });
            });

            req.on('error', (err) => {
                if (controller.signal.aborted) {
                    done({ status: 'aborted' });
                } else {
                    done({ status: 'error', error: err.message });
                }
            });

            controller.signal.addEventListener('abort', () => {
                req.destroy();
                done({ status: 'aborted' });
            }, { once: true });

            req.write(bodyStr);
            req.end();
        } catch (err) {
            done({ status: 'error', error: err.message });
        }
    });
}

// ── Health check ─────────────────────────────────────────────────────────────

async function healthCheck() {
    const manager = _getManager();
    if (!manager) return { available: false, endpoint: _getBaseUrl() };
    try {
        const key = manager.getActiveKey();
        return {
            available: Boolean(key),
            endpoint: _getBaseUrl(),
            models: key ? [manager.getActiveKeyModel() || 'gemini-2.5-flash'] : [],
        };
    } catch {
        return { available: false, endpoint: _getBaseUrl() };
    }
}

// ── Abort ─────────────────────────────────────────────────────────────────────

function abort() {
    if (_currentController) {
        _currentController.abort();
        _currentController = null;
    }
}

// ── Status ───────────────────────────────────────────────────────────────────

function getStatus() {
    return {
        activeGenerations: _isGenerating ? 1 : 0,
        isGenerating: _isGenerating,
        endpoint: _getBaseUrl(),
    };
}

module.exports = { generate, healthCheck, abort, getStatus, providerType: 'gemini' };
