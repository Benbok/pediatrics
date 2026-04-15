/**
 * analysisRegistry — module-level singleton.
 *
 * Keeps a running AI-analysis Promise alive across VisitFormPage
 * mount/unmount cycles so that navigating away and back does not lose
 * the in-progress analysis or its result.
 *
 * Usage:
 *   // When starting:
 *   analysisRegistry.set(visitId, promise);
 *
 *   // On component mount — re-attach if still running:
 *   const pending = analysisRegistry.get(visitId);
 *   if (pending) { setIsAnalyzing(true); pending.then(results => { ... }); }
 *
 *   // Registry clears itself automatically when the promise settles.
 */

import type { DiagnosisSuggestion } from '../types';

interface RegistryEntry {
    visitId: number;
    promise: Promise<DiagnosisSuggestion[]>;
    startedAt: number;
}

const _registry = new Map<number, RegistryEntry>();

export const analysisRegistry = {
    /** Register an in-flight analysis promise for a given visitId. */
    set(visitId: number, promise: Promise<DiagnosisSuggestion[]>): void {
        const entry: RegistryEntry = { visitId, promise, startedAt: Date.now() };
        _registry.set(visitId, entry);
        // Auto-remove when promise settles (success or error)
        promise.finally(() => {
            if (_registry.get(visitId)?.promise === promise) {
                _registry.delete(visitId);
            }
        });
    },

    /** Return the active entry for visitId, or undefined if none. */
    get(visitId: number): RegistryEntry | undefined {
        return _registry.get(visitId);
    },

    /** True if an analysis is currently in flight for this visitId. */
    isRunning(visitId: number): boolean {
        return _registry.has(visitId);
    },

    /** Manually remove an entry (e.g. on error recovery). */
    clear(visitId: number): void {
        _registry.delete(visitId);
    },
};
