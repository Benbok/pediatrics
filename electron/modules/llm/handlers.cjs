'use strict';

const { performance } = require('node:perf_hooks');
const { ipcMain } = require('electron');
const { z } = require('zod');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logger } = require('../../logger.cjs');
const localLlmService = require('../../services/localLlmService.cjs');
const llmRouter = require('../../services/llmRouter.cjs');
const {
    ALLOWED_REFINE_FIELDS,
    buildSpellingMessages,
    buildPunctuationMessages,
    buildCombinedRefineMessages,
    buildCombinedGenerationOptions,
    buildSpellingGenerationOptions,
    buildPunctuationGenerationOptions,
    calcRefineMaxTokens,
} = require('./refine.constants.cjs');



// ── Zod schemas ───────────────────────────────────────────────────────────────

const LlmRequestSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1).max(16384),
    })).min(1, 'Необходимо хотя бы одно сообщение'),
    options: z.object({
        maxTokens: z.number().min(1).max(2048).optional(),
        temperature: z.number().min(0).max(1).optional(),
        topP: z.number().min(0).max(1).optional(),
        stop: z.array(z.string()).optional(),
        model: z.string().optional(),
    }).optional(),
});

const LlmRefineFieldSchema = z.object({
    field: z.string().refine((v) => ALLOWED_REFINE_FIELDS.includes(v), {
        message: 'Invalid field name',
    }),
    text: z
        .string({ required_error: 'Текст обязателен' })
        .min(1, 'Текст не может быть пустым')
        .max(4096, 'Текст слишком длинный'),
    options: z.object({
        maxTokens: z.number().min(1).max(1024).optional(),
    }).optional(),
});

function normalizeDateLikeSequences(text) {
    return String(text ?? '').replace(/\b(\d{1,2})([.\-/\s]+)(\d{1,2})([.\-/\s]+)(\d{2,4})\b/g, (match, day, _sep1, month, _sep2, year) => {
        const dayNum = Number(day);
        const monthNum = Number(month);
        if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
            return match;
        }

        return `${String(dayNum).padStart(2, '0')}.${String(monthNum).padStart(2, '0')}.${year}`;
    });
}

function collapseWhitespace(text) {
    return String(text ?? '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function capitalizeSentenceStart(text) {
    return String(text ?? '').replace(/^(\s*)([a-zа-яё])/u, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function ensureSentenceEnding(text) {
    const normalized = String(text ?? '').trim();
    if (!normalized) return '';
    return /[.!?…]$/.test(normalized) ? normalized : `${normalized}.`;
}

function isJoinerFragment(text) {
    return /^(с|без|при|после|до|от|из|в|во|на|к|ко|по|под|над|об|обо|для)\b/u.test(String(text ?? '').trim());
}

function mergeMultilineFragments(text) {
    const fragments = String(text ?? '')
        .split(/\r?\n+/)
        .map((fragment) => collapseWhitespace(fragment))
        .filter(Boolean);

    if (fragments.length <= 1) {
        return collapseWhitespace(fragments[0] || text);
    }

    const sentences = [];

    for (const rawFragment of fragments) {
        if (isJoinerFragment(rawFragment) && sentences.length > 0) {
            const previous = sentences.pop().replace(/[.!?…]$/, '');
            sentences.push(`${previous}, ${rawFragment}.`);
            continue;
        }

        sentences.push(ensureSentenceEnding(capitalizeSentenceStart(rawFragment)));
    }

    return sentences.join(' ');
}

function postProcessRefinementOutput(text) {
    const singleLine = mergeMultilineFragments(normalizeDateLikeSequences(text));

    return normalizeDateLikeSequences(collapseWhitespace(singleLine));
}

function buildSafeFallbackText(text) {
    return postProcessRefinementOutput(text);
}

// Split text into chunks of whole sentences, each under maxChunkChars.
// This prevents token overflow for long inputs and improves per-sentence quality.
const REFINE_CHUNK_CHARS = 160;

function splitIntoChunks(text, maxChunkChars = REFINE_CHUNK_CHARS) {
    // Split on sentence boundaries: ". ", "! ", "? " or end of string
    const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
    const chunks = [];
    let current = '';
    for (const sentence of sentences) {
        if (current.length + sentence.length > maxChunkChars && current.length > 0) {
            chunks.push(current.trimEnd());
            current = sentence;
        } else {
            current += sentence;
        }
    }
    if (current.trim()) chunks.push(current.trimEnd());
    return chunks.length > 0 ? chunks : [text];
}

function extractNumericValues(text) {
    return (normalizeDateLikeSequences(String(text ?? '')).match(/\d+(?:[.,]\d+)?/g) ?? [])
        .map((token) => token.replace(',', '.'));
}

// Minimal validation: trust the model for grammar/spelling, only guard against
// empty output and changed numeric values (critical in medical context).
function validateRefinementOutput(sourceText, candidateText) {
    const validationStartedAt = performance.now();
    const source = String(sourceText ?? '').trim();
    const candidate = String(candidateText ?? '').trim();

    const finalizeValidation = (result) => {
        logger.info('[LlmHandlers] Refinement validation completed', {
            reason: result.reason,
            isSafe: result.isSafe,
            durationMs: Number((performance.now() - validationStartedAt).toFixed(2)),
            sourceLength: source.length,
            candidateLength: candidate.length,
        });
        return result;
    };

    if (!candidate) {
        logger.warn('[LlmHandlers] Empty refine output received', { sourceLength: source.length });
        return finalizeValidation({ isSafe: false, reason: 'empty-output' });
    }

    // Guard against truncated model outputs (typically max-tokens cut).
    // Punctuation stage can shrink text a bit, but drastic drops are suspicious.
    if (source.length > 40 && candidate.length < source.length * 0.6) {
        logger.warn('[LlmHandlers] Refine output is unexpectedly short', {
            sourceLength: source.length,
            candidateLength: candidate.length,
            ratio: Number((candidate.length / source.length).toFixed(3)),
        });
        return finalizeValidation({ isSafe: false, reason: 'too-short-output' });
    }

    const sourceNumericValues = extractNumericValues(source);
    const candidateNumericValues = extractNumericValues(candidate);
    if (sourceNumericValues.join('|') !== candidateNumericValues.join('|')) {
        logger.warn('[LlmHandlers] Numeric values changed by model', {
            source: sourceNumericValues,
            candidate: candidateNumericValues,
        });
        return finalizeValidation({ isSafe: false, reason: 'numeric-values-changed' });
    }

    return finalizeValidation({ isSafe: true, reason: 'validated' });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function setupLlmHandlers() {
    // ── Health check ──────────────────────────────────────────────────────────
    ipcMain.handle('llm:health-check', ensureAuthenticated(async () => {
        return localLlmService.healthCheck();
    }));

    // Routing-aware health check for a specific feature
    ipcMain.handle('llm:check-feature', ensureAuthenticated(async (_, { featureId }) => {
        return llmRouter.checkFeatureHealth(featureId);
    }));

    ipcMain.handle('llm:get-status', ensureAuthenticated(async () => {
        return localLlmService.getStatus();
    }));

    ipcMain.handle('llm:generate', ensureAuthenticated(async (event, params) => {
        try {
            const { messages, options } = LlmRequestSchema.parse(params);
            logger.info('[LlmHandlers] generate request', { messageCount: messages.length });

            const result = await localLlmService.generate(messages, options ?? {}, (text) => {
                if (event.sender && !event.sender.isDestroyed()) {
                    event.sender.send('llm:token', text);
                }
            });

            logger.info('[LlmHandlers] generate finished', { status: result.status });
            return result;
        } catch (err) {
            if (err.name === 'ZodError') {
                const message = err.errors.map((e) => e.message).join(', ');
                logger.warn('[LlmHandlers] Validation error', { message });
                return { status: 'error', error: message };
            }

            logger.error('[LlmHandlers] Unexpected error', { error: err?.message || err });
            if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('llm:error', err?.message || 'LLM generation error');
            }
            return { status: 'error', error: err?.message || 'LLM generation error' };
        }
    }));

    ipcMain.handle('llm:abort', ensureAuthenticated(async () => {
        llmRouter.abortAll();
        return { success: true };
    }));

    // ── Field refinement ──────────────────────────────────────────────────────

    ipcMain.handle('llm:refine-field', ensureAuthenticated(async (event, params) => {
        // Валидация + allowlist
        let validated;
        try {
            validated = LlmRefineFieldSchema.parse(params);
        } catch (err) {
            const message = err.errors?.map((e) => e.message).join(', ') ?? 'Validation failed';
            logger.warn('[LlmHandlers] refine-field validation error', { message });
            return { status: 'error', error: message };
        }

        const { field, text, options = {} } = validated;
        const normalizedSourceText = buildSafeFallbackText(text);

        logger.info('[LlmHandlers] Starting two-stage field refinement', { field, textLength: text.length });

        try {
            // Resolve provider once per request (local or Gemini based on routing)
            const llmProvider = await llmRouter.getProvider('refine-field');

            const sendToken = (token) => {
                if (event.sender && !event.sender.isDestroyed()) {
                    event.sender.send('llm:field-refine-token', { field, token });
                }
            };

            // ── Cloud LLM (Gemini): single combined pass ──────────────────────
            // Two-stage spelling→punctuation pipeline causes truncation with cloud
            // models (they stop after the first sentence). Use one combined prompt.
            if (llmProvider.providerType === 'gemini') {
                logger.info('[LlmHandlers] Using single-pass refine for cloud provider', { field });
                const flatText = collapseWhitespace(text);
                const messages = buildCombinedRefineMessages(field, flatText);
                const maxTokens = calcRefineMaxTokens(flatText.length);
                let combined = '';

                const result = await llmProvider.generate(
                    messages,
                    buildCombinedGenerationOptions(flatText, maxTokens),
                    (token) => {
                        combined += token;
                        sendToken(token);
                    }
                );

                if (result.status !== 'completed') {
                    logger.info('[LlmHandlers] Combined refine aborted', { field, status: result.status });
                    return result;
                }

                const normalizedCombined = postProcessRefinementOutput(combined);
                logger.info('[LlmHandlers] Combined refine raw output', {
                    field,
                    rawLength: combined.length,
                    normalizedLength: normalizedCombined.length,
                    raw: combined.slice(0, 200),
                });
                const validation = validateRefinementOutput(flatText, normalizedCombined);
                if (!validation.isSafe) {
                    logger.warn('[LlmHandlers] Combined refine unsafe, using safe fallback', {
                        field, reason: validation.reason,
                    });
                    return { status: 'completed', text: normalizedSourceText, usedFallback: true };
                }

                logger.info('[LlmHandlers] Single-pass refinement completed', {
                    field, originalLength: text.length, finalLength: normalizedCombined.length,
                });
                return { status: 'completed', text: normalizedCombined, usedFallback: false };
            }

            // ── Local LLM: two-stage pipeline ─────────────────────────────────
            // ── Stage 1: Spelling correction (per chunk) ─────────────────────
            const chunks = splitIntoChunks(text);
            const spellingCorrectedChunks = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                // Flatten newlines to spaces: spelling is word-level only and
                // embedded line breaks cause cloud models to stop after the first line.
                const flatChunk = collapseWhitespace(chunk);
                const messages = buildSpellingMessages(flatChunk);
                const maxTokens = calcRefineMaxTokens(flatChunk.length);
                let corrected = '';

                const result = await llmProvider.generate(
                    messages,
                    buildSpellingGenerationOptions(flatChunk, maxTokens),
                    (token) => { corrected += token; }
                );

                if (result.status !== 'completed') {
                    logger.info('[LlmHandlers] Spelling stage chunk aborted', { field, chunk: i, status: result.status });
                    return result;
                }

                const trimmed = collapseWhitespace(corrected);
                // Validate: numbers must be preserved
                const validation = validateRefinementOutput(flatChunk, trimmed);
                if (!validation.isSafe) {
                    logger.warn('[LlmHandlers] Spelling stage unsafe, using source chunk', {
                        field, chunk: i, reason: validation.reason,
                    });
                    spellingCorrectedChunks.push(flatChunk);
                } else {
                    spellingCorrectedChunks.push(trimmed);
                    logger.info('[LlmHandlers] Spelling stage chunk completed', { field, chunk: i, original: flatChunk, corrected: trimmed });
                }
            }

            const spellingCorrectedText = spellingCorrectedChunks.join(' ');

            // ── Stage 2: Punctuation and formatting ──────────────────────────
            const punctChunks = splitIntoChunks(spellingCorrectedText);
            const finalChunks = [];

            for (let i = 0; i < punctChunks.length; i++) {
                const chunk = punctChunks[i];
                const messages = buildPunctuationMessages(field, chunk);
                const maxTokens = calcRefineMaxTokens(chunk.length);
                let formatted = '';

                const result = await llmProvider.generate(
                    messages,
                    buildPunctuationGenerationOptions(chunk, maxTokens),
                    (token) => {
                        formatted += token;
                        sendToken(token);
                    }
                );

                if (result.status !== 'completed') {
                    logger.info('[LlmHandlers] Punctuation stage chunk aborted', { field, chunk: i, status: result.status });
                    return result;
                }

                const normalizedChunk = postProcessRefinementOutput(formatted);
                const validation = validateRefinementOutput(chunk, normalizedChunk);
                if (!validation.isSafe) {
                    logger.warn('[LlmHandlers] Punctuation stage unsafe, using spelling-only chunk', {
                        field, chunk: i, reason: validation.reason,
                    });
                    finalChunks.push(buildSafeFallbackText(chunk));
                } else {
                    finalChunks.push(normalizedChunk);
                }
            }

            const finalText = finalChunks.join(' ');
            logger.info('[LlmHandlers] Two-stage refinement completed', {
                field, chunks: chunks.length, originalLength: text.length, finalLength: finalText.length,
            });
            return { status: 'completed', text: finalText, usedFallback: false };
        } catch (err) {
            logger.error('[LlmHandlers] Field refine error', { field, error: err?.message || err });
            if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('llm:field-refine-error', {
                    field,
                    error: err?.message || 'Refinement failed',
                });
            }
            return { status: 'error', error: err?.message || 'Refinement failed' };
        }
    }));
}

module.exports = {
    setupLlmHandlers,
};
