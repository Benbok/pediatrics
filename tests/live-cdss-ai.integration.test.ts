/**
 * Opt-in live integration test for Gemini API.
 *
 * This test is skipped by default to avoid consuming quota and to keep CI deterministic.
 * Enable explicitly:
 *   RUN_LIVE_AI_TESTS=1 GEMINI_API_KEYS=key1,key2,... npx vitest run tests/live-cdss-ai.integration.test.ts
 */

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

import './setup-ai-normalizer.cjs';

import { describe, it, expect } from 'vitest';
import { generateEmbedding } from '../electron/services/embeddingService.cjs';

const RUN_LIVE = process.env.RUN_LIVE_AI_TESTS === '1';

describe('Live CDSS AI integration (Gemini) [opt-in]', () => {
    const liveIt = RUN_LIVE ? it : it.skip;

    liveIt(
        'generateEmbedding returns a numeric vector for a short clinical query',
        { timeout: 60_000 },
        async () => {
            const keys = String(process.env.GEMINI_API_KEYS || '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            expect(keys.length).toBeGreaterThan(0);
            expect(keys[0].length).toBeGreaterThan(10);

            const embedding = await generateEmbedding('кашель, температура 39, хрипы');
            expect(Array.isArray(embedding)).toBe(true);
            expect(embedding.length).toBeGreaterThan(10);

            // Ensure it's numeric
            const sample = embedding.slice(0, 5);
            for (const x of sample) {
                expect(typeof x).toBe('number');
                expect(Number.isFinite(x)).toBe(true);
            }
        }
    );
});
