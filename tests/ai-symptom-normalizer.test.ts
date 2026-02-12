/**
 * Unit tests for AI Symptom Normalizer: circuit breaker, dictionary path, and normalizeWithAI contract.
 * Setup injects mock logger so CJS require() gets it (avoids Electron); does not call real Gemini API.
 */
import './setup-ai-normalizer.cjs';

import { describe, it, expect, beforeEach } from 'vitest';
import * as normalizer from '../electron/services/aiSymptomNormalizer.cjs';

const { normalizeWithAI, setCircuitOpen, circuitBreaker, getVersion } = normalizer;

describe('AI Symptom Normalizer', () => {
    beforeEach(() => {
        setCircuitOpen(false);
    });

    describe('normalizeWithAI contract', () => {
        it('returns normalized array and source/aiUsed for empty input', async () => {
            const result = await normalizeWithAI([]);
            expect(result).toEqual({
                normalized: [],
                source: 'dictionary',
                aiUsed: false,
            });
        });

        it('returns object with keys normalized, source, aiUsed for null input', async () => {
            const result = await normalizeWithAI(null as unknown as string[]);
            expect(result).toHaveProperty('normalized');
            expect(result).toHaveProperty('source');
            expect(result).toHaveProperty('aiUsed');
            expect(Array.isArray(result.normalized)).toBe(true);
            expect(result.normalized).toHaveLength(0);
        });

        it('with circuit open returns dictionary-only result (no AI)', async () => {
            setCircuitOpen(true);
            const result = await normalizeWithAI(['температура', 'кашель']);
            expect(result.source).toBe('dictionary');
            expect(result.aiUsed).toBe(false);
            expect(Array.isArray(result.normalized)).toBe(true);
            expect(result.normalized.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('circuit breaker', () => {
        it('setCircuitOpen(true) makes circuit unavailable', () => {
            setCircuitOpen(true);
            expect(circuitBreaker.isAvailable()).toBe(false);
        });

        it('setCircuitOpen(false) makes circuit available', () => {
            setCircuitOpen(true);
            setCircuitOpen(false);
            expect(circuitBreaker.isAvailable()).toBe(true);
        });

        it('recordFailure 3 times opens circuit', () => {
            setCircuitOpen(false);
            expect(circuitBreaker.isAvailable()).toBe(true);
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            expect(circuitBreaker.isAvailable()).toBe(true);
            circuitBreaker.recordFailure();
            expect(circuitBreaker.isAvailable()).toBe(false);
        });

        it('recordSuccess resets failure count', () => {
            setCircuitOpen(false);
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            circuitBreaker.recordSuccess();
            circuitBreaker.recordFailure();
            expect(circuitBreaker.isAvailable()).toBe(true);
            circuitBreaker.recordFailure();
            circuitBreaker.recordFailure();
            expect(circuitBreaker.isAvailable()).toBe(false);
        });
    });

    describe('getVersion', () => {
        it('returns a number', () => {
            const v = getVersion();
            expect(typeof v).toBe('number');
            expect(v).toBeGreaterThanOrEqual(1);
        });
    });
});
