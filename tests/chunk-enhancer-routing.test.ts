import { describe, expect, it, vi } from 'vitest';

const chunkEnhancer = require('../electron/services/chunkEnhancerService.cjs');

describe('chunkEnhancerService provider routing', () => {
  it('uses injected provider for chunk enrichment', async () => {
    const generate = vi.fn(async (_messages: any, _options: any, onToken: (token: string) => void) => {
      onToken('{"summary":"Короткое резюме","keywords":"педиатрия, бронхит, терапия"}');
      return { status: 'completed' };
    });

    const provider = {
      generate,
      healthCheck: vi.fn(async () => ({ available: true })),
      providerType: 'gemini',
    };

    const result = await chunkEnhancer.enrichSingleChunk(
      'Длинный клинический текст для теста обогащения чанка, который должен пройти через кастомный провайдер.',
      provider,
    );

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      summary: 'Короткое резюме',
      keywords: 'педиатрия, бронхит, терапия',
    });
  });
});
