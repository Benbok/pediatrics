import { describe, it, expect } from 'vitest';
import { createToast } from '../src/services/toastService';

describe('toastService', () => {
    it('creates a valid toast model with defaults', () => {
        const t = createToast('ok', 'success');
        expect(typeof t.id).toBe('string');
        expect(t.id.length).toBeGreaterThan(0);
        expect(t.type).toBe('success');
        expect(t.message).toBe('ok');
        expect(typeof t.durationMs).toBe('number');
        expect((t.durationMs as number)).toBeGreaterThan(0);
    });

    it('rejects empty messages via schema', () => {
        expect(() => createToast('', 'info')).toThrow();
    });
});
