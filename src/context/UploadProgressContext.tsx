import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UploadProgress } from '../types';

interface UploadProgressContextValue {
    /** Global map of all in-flight / recently finished upload jobs (jobId → progress). */
    progressMap: Map<string, UploadProgress>;
    /**
     * Register a new upload batch so the context can associate its jobs with a disease.
     * Call this right after `uploadGuidelinesAsync` returns.
     */
    registerBatch: (diseaseId: number, jobs: Array<{ jobId: string; fileName: string }>) => void;
    /**
     * Returns the progress entries for all jobs that belong to the given disease.
     * Is stable across renders (ref-based lookup) and re-creates when `progressMap` changes.
     */
    getProgressForDisease: (diseaseId: number) => UploadProgress[];
    /**
     * Remove completed/failed entries for a disease (call on re-mount after upload
     * so stale "Загружено успешно" cards don't show up on the next visit).
     */
    clearCompletedForDisease: (diseaseId: number) => void;
}

const UploadProgressContext = createContext<UploadProgressContextValue | null>(null);

export const UploadProgressProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    // State: triggers re-renders in consumers whenever any job changes status / progress.
    const [progressMap, setProgressMap] = useState<Map<string, UploadProgress>>(new Map());

    // Ref: diseaseId → Set of jobIds that belong to that disease.
    // Using a ref (not state) because mutations here must never trigger extra renders;
    // consumers re-render via `progressMap` changes.
    const diseaseJobsRef = useRef<Map<number, Set<string>>>(new Map());

    // ── Global Electron IPC subscription (never unsubscribed while the app lives) ──
    useEffect(() => {
        if (!window.electronAPI?.onUploadProgress) return;
        const unsubscribe = window.electronAPI.onUploadProgress((_event: any, progress: UploadProgress) => {
            setProgressMap(prev => {
                const next = new Map(prev);
                const previous = next.get(progress.jobId);
                next.set(progress.jobId, {
                    ...previous,
                    ...progress,
                    jobId: progress.jobId,
                    fileName: progress.fileName || previous?.fileName || 'Файл загружается...'
                });
                return next;
            });
        });
        return () => unsubscribe();
    }, []);

    // ────────────────────────────────────────────────────────────────────────────────

    const registerBatch = useCallback(
        (diseaseId: number, jobs: Array<{ jobId: string; fileName: string }>) => {
            const existing = diseaseJobsRef.current.get(diseaseId) ?? new Set<string>();
            jobs.forEach(j => existing.add(j.jobId));
            diseaseJobsRef.current.set(diseaseId, existing);

            // Initialise all jobs as 'queued' in the progress map.
            setProgressMap(prev => {
                const next = new Map(prev);
                jobs.forEach(job => {
                    if (!next.has(job.jobId)) {
                        next.set(job.jobId, {
                            jobId: job.jobId,
                            fileName: job.fileName,
                            status: 'queued',
                            progress: 0,
                        });
                    }
                });
                return next;
            });
        },
        [],
    );

    const getProgressForDisease = useCallback(
        (diseaseId: number): UploadProgress[] => {
            const jobIds = diseaseJobsRef.current.get(diseaseId);
            if (!jobIds) return [];
            const result: UploadProgress[] = [];
            for (const jobId of jobIds) {
                const p = progressMap.get(jobId);
                if (p) result.push(p);
            }
            return result;
        },
        // Re-create whenever progressMap changes so callers always see fresh data.
        [progressMap],
    );

    const clearCompletedForDisease = useCallback((diseaseId: number) => {
        const jobIds = diseaseJobsRef.current.get(diseaseId);
        if (!jobIds) return;

        setProgressMap(prev => {
            const next = new Map(prev);
            const remaining = new Set<string>();
            for (const jobId of jobIds) {
                const p = prev.get(jobId);
                if (p && (p.status === 'completed' || p.status === 'failed')) {
                    next.delete(jobId);
                } else {
                    remaining.add(jobId);
                }
            }
            // Keep the ref tidy.
            if (remaining.size === 0) {
                diseaseJobsRef.current.delete(diseaseId);
            } else {
                diseaseJobsRef.current.set(diseaseId, remaining);
            }
            return next;
        });
    }, []);

    const value = useMemo<UploadProgressContextValue>(
        () => ({ progressMap, registerBatch, getProgressForDisease, clearCompletedForDisease }),
        [progressMap, registerBatch, getProgressForDisease, clearCompletedForDisease],
    );

    return (
        <UploadProgressContext.Provider value={value}>
            {children}
        </UploadProgressContext.Provider>
    );
};

export function useUploadProgress(): UploadProgressContextValue {
    const ctx = useContext(UploadProgressContext);
    if (!ctx) throw new Error('useUploadProgress must be used within UploadProgressProvider');
    return ctx;
}
