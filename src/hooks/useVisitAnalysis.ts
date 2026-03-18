import { useState, useCallback, useRef } from 'react';
import { logger } from '../services/logger';

interface UseVisitAnalysisOptions {
  maxConcurrentAnalyses?: number;
  cooldownMs?: number;
}

interface UseVisitAnalysisReturn {
  isAnalyzing: boolean;
  canAnalyze: boolean;
  timeUntilNextAnalysis: number;
  runAnalysis: <T>(analysisFn: () => Promise<T>) => Promise<T>;
  cancelAnalysis: () => void;
}

/**
 * Хук для управления rate limiting анализа визитов
 * Предотвращает одновременные запросы и перегрузку
 */
export const useVisitAnalysis = (
  options: UseVisitAnalysisOptions = {}
): UseVisitAnalysisReturn => {
  const {
    maxConcurrentAnalyses = 1,
    cooldownMs = 1000
  } = options;

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number>(0);
  const activeAnalysesRef = useRef<Set<Promise<any>>>(new Set());

  const canAnalyze = !isAnalyzing && (Date.now() - lastAnalysisTime) >= cooldownMs;
  const timeUntilNextAnalysis = Math.max(0, cooldownMs - (Date.now() - lastAnalysisTime));

  const runAnalysis = useCallback(async <T,>(analysisFn: () => Promise<T>): Promise<T> => {
    // Проверяем rate limiting
    if (isAnalyzing) {
      const error = new Error('Анализ уже выполняется. Дождитесь завершения.');
      logger.warn('[useVisitAnalysis] Concurrent analysis blocked', { activeAnalyses: activeAnalysesRef.current.size });
      throw error;
    }

    if (!canAnalyze) {
      const error = new Error(`Подождите ${Math.ceil(timeUntilNextAnalysis / 1000)} сек. перед следующим анализом`);
      logger.warn('[useVisitAnalysis] Rate limit exceeded', { timeUntilNext: timeUntilNextAnalysis });
      throw error;
    }

    // Проверяем лимит одновременных анализов
    if (activeAnalysesRef.current.size >= maxConcurrentAnalyses) {
      const error = new Error('Слишком много одновременных анализов. Попробуйте позже.');
      logger.warn('[useVisitAnalysis] Max concurrent analyses exceeded', { max: maxConcurrentAnalyses, current: activeAnalysesRef.current.size });
      throw error;
    }

    setIsAnalyzing(true);
    setLastAnalysisTime(Date.now());

    const analysisPromise = analysisFn()
      .finally(() => {
        // Удаляем из активных анализов
        activeAnalysesRef.current.delete(analysisPromise);
        // Если это был последний анализ, сбрасываем состояние
        if (activeAnalysesRef.current.size === 0) {
          setIsAnalyzing(false);
        }
      });

    // Добавляем в активные анализы
    activeAnalysesRef.current.add(analysisPromise);

    try {
      logger.info('[useVisitAnalysis] Starting analysis', {
        activeCount: activeAnalysesRef.current.size,
        maxConcurrent: maxConcurrentAnalyses
      });

      const result = await analysisPromise;
      return result;
    } catch (error) {
      logger.error('[useVisitAnalysis] Analysis failed', { error: error.message });
      throw error;
    }
  }, [isAnalyzing, canAnalyze, timeUntilNextAnalysis, maxConcurrentAnalyses]);

  const cancelAnalysis = useCallback(() => {
    // Отменяем все активные анализы (на практике Promise нельзя отменить,
    // но мы можем сбросить состояние UI)
    activeAnalysesRef.current.clear();
    setIsAnalyzing(false);
    logger.info('[useVisitAnalysis] Analysis cancelled by user');
  }, []);

  return {
    isAnalyzing,
    canAnalyze,
    timeUntilNextAnalysis,
    runAnalysis,
    cancelAnalysis
  };
};