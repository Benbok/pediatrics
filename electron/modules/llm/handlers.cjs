'use strict';

const { performance } = require('node:perf_hooks');
const { ipcMain } = require('electron');
const { z } = require('zod');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logger } = require('../../logger.cjs');
const localLlmService = require('../../services/localLlmService.cjs');
const {
    ALLOWED_REFINE_FIELDS,
    buildRefineMessages,
    buildRefineGenerationOptions,
} = require('./refine.constants.cjs');

const REFINE_TOKEN_RETENTION_THRESHOLD = 0.6;
const REFINE_CHAR_SIMILARITY_THRESHOLD = 0.55;
const REFINE_TOKEN_COUNT_DRIFT_RATIO = 0.35;
const PROTECTED_TOKEN_PATTERN = /\d+(?:[.,]\d+)?\s*(?:°C|мм\s*рт\.?\s*ст\.?|%|мл|мг|кг|см|ммоль\/л|уд\/?мин|SpO2|pH|ICD-\d{1,2}(?:\.\d+)?|[A-ZА-ЯЁ]{2,}\s*\d+)|[A-Za-zА-Яа-яЁё]*\d+[A-Za-zА-Яа-яЁё\^%/+-]*|[A-ZА-ЯЁ]{2,}[A-ZА-ЯЁ0-9\^%/+-]*|\d+[\^%/+-]*|[A-Za-z]{2,}[A-Z0-9][A-Za-z0-9\^%/+-]*/gu;
const UNIT_TOKEN_PATTERN = /°C|мм\s*рт\.?\s*ст\.?|ммоль\/л|мг\/кг|мкг\/кг|мг|мкг|г|мл|л|кг|г\/л|см|мм|%|уд\/?мин|SpO2|pH|дн(?:я|ей)?|сут(?:ки|ок)?|ч(?:ас(?:а|ов)?)?/giu;

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
        maxTokens: z.number().min(1).max(512).optional(),
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

function normalizeForComparison(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeForComparison(text) {
    return normalizeForComparison(text).match(/[\p{L}\p{N}\^%/+-]+/gu) ?? [];
}

function extractProtectedTokens(text) {
    return Array.from(new Set(
        (String(text ?? '').match(PROTECTED_TOKEN_PATTERN) ?? [])
            .map((token) => token.toLowerCase().replace(/\s+/g, ' ').trim())
    ));
}

function extractNumericValues(text) {
    return (normalizeDateLikeSequences(String(text ?? '')).match(/\d+(?:[.,]\d+)?/g) ?? [])
        .map((token) => token.replace(',', '.'));
}

function extractUnitTokens(text) {
    return (String(text ?? '').match(UNIT_TOKEN_PATTERN) ?? [])
        .map((token) => token.toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '').trim());
}

function arraysEqual(left, right) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
}

function levenshteinDistance(left, right) {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;

    const prev = Array.from({ length: right.length + 1 }, (_, index) => index);
    const curr = new Array(right.length + 1);

    for (let i = 1; i <= left.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= right.length; j++) {
            const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                curr[j - 1] + 1,
                prev[j] + 1,
                prev[j - 1] + substitutionCost
            );
        }
        for (let j = 0; j <= right.length; j++) {
            prev[j] = curr[j];
        }
    }

    return prev[right.length];
}

function estimateRefineMaxTokens(sourceText, requestedMaxTokens) {
    // Русский текст: ~2 символа/токен; добавляем 40% запас на исправления и форматирование
    const charsPerToken = 2;
    const safetyFactor = 1.4;
    const sourceChars = String(sourceText ?? '').length;
    const adaptiveCap = Math.max(32, Math.ceil((sourceChars / charsPerToken) * safetyFactor));
    return requestedMaxTokens != null
        ? Math.min(requestedMaxTokens, adaptiveCap)
        : adaptiveCap;
}

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

    const sourceNormalized = normalizeForComparison(source);
    const candidateNormalized = normalizeForComparison(candidate);

    if (sourceNormalized === candidateNormalized) {
        return finalizeValidation({ isSafe: true, reason: 'unchanged' });
    }

    const protectedTokens = extractProtectedTokens(source);
    const missingProtectedToken = protectedTokens.find((token) => !candidateNormalized.includes(token));
    if (missingProtectedToken) {
        return finalizeValidation({ isSafe: false, reason: `missing-protected-token:${missingProtectedToken}` });
    }

    const sourceNumericValues = extractNumericValues(source);
    const candidateNumericValues = extractNumericValues(candidate);
    if (!arraysEqual(sourceNumericValues, candidateNumericValues)) {
        return finalizeValidation({ isSafe: false, reason: 'numeric-values-changed' });
    }

    const sourceUnitTokens = extractUnitTokens(source);
    const candidateUnitTokens = extractUnitTokens(candidate);
    if (!arraysEqual(sourceUnitTokens, candidateUnitTokens)) {
        return finalizeValidation({ isSafe: false, reason: 'measurement-units-changed' });
    }

    const sourceTokens = tokenizeForComparison(source);
    const candidateTokens = tokenizeForComparison(candidate);
    const significantSourceTokens = sourceTokens.filter((token) => token.length >= 3);
    const retainedTokenCount = significantSourceTokens.filter((token) => candidateTokens.includes(token)).length;
    const retainedRatio = significantSourceTokens.length > 0
        ? retainedTokenCount / significantSourceTokens.length
        : 1;

    if (retainedRatio < REFINE_TOKEN_RETENTION_THRESHOLD) {
        return finalizeValidation({ isSafe: false, reason: `low-token-retention:${retainedRatio.toFixed(2)}` });
    }

    const tokenCountDelta = Math.abs(candidateTokens.length - sourceTokens.length);
    if (sourceTokens.length > 0 && tokenCountDelta > Math.max(3, Math.ceil(sourceTokens.length * REFINE_TOKEN_COUNT_DRIFT_RATIO))) {
        return finalizeValidation({ isSafe: false, reason: 'token-count-drift' });
    }

    const charDistance = levenshteinDistance(sourceNormalized, candidateNormalized);
    const charSimilarity = 1 - (charDistance / Math.max(sourceNormalized.length, candidateNormalized.length, 1));
    if (charSimilarity < REFINE_CHAR_SIMILARITY_THRESHOLD) {
        return finalizeValidation({ isSafe: false, reason: `low-char-similarity:${charSimilarity.toFixed(2)}` });
    }

    return finalizeValidation({ isSafe: true, reason: 'validated' });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function setupLlmHandlers() {
    // ── Health check ──────────────────────────────────────────────────────────
    ipcMain.handle('llm:health-check', ensureAuthenticated(async () => {
        return localLlmService.healthCheck();
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
        localLlmService.abort();
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

        // messages array — LM Studio applies chat template automatically
        const messages = buildRefineMessages(field, text);

        logger.info('[LlmHandlers] Starting field refinement', { field, textLength: text.length });

        try {
            const maxTokens = estimateRefineMaxTokens(text, options.maxTokens);
            let refinedText = '';

            const result = await localLlmService.generate(
                messages,
                buildRefineGenerationOptions(field, text, maxTokens),
                (token) => {
                    refinedText += token;
                    if (event.sender && !event.sender.isDestroyed()) {
                        event.sender.send('llm:field-refine-token', { field, token });
                    }
                }
            );

            if (result.status === 'completed') {
                const normalizedRefinedText = postProcessRefinementOutput(refinedText);
                const validation = validateRefinementOutput(text, normalizedRefinedText);
                if (!validation.isSafe) {
                    logger.warn('[LlmHandlers] Unsafe refinement output rejected, falling back to source text', {
                        field,
                        reason: validation.reason,
                        sourceText: text,
                        refinedText: normalizedRefinedText,
                    });

                    return {
                        status: 'completed',
                        text: normalizedSourceText,
                        usedFallback: true,
                    };
                }

                return {
                    status: 'completed',
                    text: normalizedRefinedText,
                    usedFallback: false,
                };
            }

            logger.info('[LlmHandlers] Field refinement completed', { field, status: result.status });
            return result;
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
