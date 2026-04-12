import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, Loader2, AlertCircle, BookOpen, Pill, Info, X, Sparkles, Cpu } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { knowledgeQueryService } from '../../../services/knowledgeQuery.service';
import { KnowledgeSource } from '../../../types';
import { knowledgeQueryStore, WidgetState } from '../store/knowledgeQueryStore';

// ─── Markdown renderer ───────────────────────────────────────────────────────

const MarkdownAnswer: React.FC<{ text: string }> = ({ text }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
            h1: ({ children }) => (
                <h1 className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-1 first:mt-0">{children}</h1>
            ),
            h2: ({ children }) => (
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-3 mb-1 first:mt-0">{children}</h2>
            ),
            h3: ({ children }) => (
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2 mb-0.5 first:mt-0">{children}</h3>
            ),
            p: ({ children }) => (
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-2 last:mb-0">{children}</p>
            ),
            ul: ({ children }) => (
                <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>
            ),
            ol: ({ children }) => (
                <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">{children}</ol>
            ),
            li: ({ children }) => (
                <li className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed pl-0.5">{children}</li>
            ),
            strong: ({ children }) => (
                <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>
            ),
            em: ({ children }) => (
                <em className="italic text-slate-600 dark:text-slate-400">{children}</em>
            ),
            blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary-400 pl-3 my-2 text-slate-600 dark:text-slate-400 italic">
                    {children}
                </blockquote>
            ),
            code: ({ children, className }) => {
                const isBlock = className?.includes('language-');
                return isBlock
                    ? <code className="block bg-slate-100 dark:bg-slate-900 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 overflow-auto my-2">{children}</code>
                    : <code className="bg-slate-100 dark:bg-slate-800 rounded px-1 py-0.5 text-xs font-mono text-primary-700 dark:text-primary-300">{children}</code>;
            },
            hr: () => (
                <hr className="my-3 border-slate-200 dark:border-slate-700" />
            ),
            table: ({ children }) => (
                <div className="overflow-x-auto my-2">
                    <table className="min-w-full text-xs border-collapse">{children}</table>
                </div>
            ),
            th: ({ children }) => (
                <th className="border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-1 text-left font-semibold text-slate-700 dark:text-slate-300">{children}</th>
            ),
            td: ({ children }) => (
                <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-300">{children}</td>
            ),
        }}
    >
        {text}
    </ReactMarkdown>
);

// ─── Вспомогательные компоненты ───────────────────────────────────────────────

const SourceLink: React.FC<{ source: KnowledgeSource }> = ({ source }) => {
    const navigate = useNavigate();
    const path = source.type === 'disease'
        ? `/diseases/${source.id}`
        : `/medications/${source.id}`;
    const Icon = source.type === 'disease' ? BookOpen : Pill;

    return (
        <button
            type="button"
            onClick={() => navigate(path)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
                bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-700
                dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-primary-900/30 dark:hover:text-primary-300
                transition-colors duration-150 cursor-pointer"
        >
            <Icon size={11} />
            {source.name}
        </button>
    );
};

const MedicationChip: React.FC<{ source: KnowledgeSource }> = ({ source }) => {
    const navigate = useNavigate();
    return (
        <button
            type="button"
            onClick={() => navigate(`/medications/${source.id}`)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800
                dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-300
                border border-emerald-200 dark:border-emerald-800
                transition-colors duration-150 cursor-pointer"
        >
            <Pill size={11} />
            {source.name}
        </button>
    );
};

// ─── Основной виджет ──────────────────────────────────────────────────────────

export const KnowledgeQueryWidget: React.FC = () => {
    // Local input state — decoupled from store so typing feels instant
    const [query, setQuery] = useState(() => knowledgeQueryStore.getState().submittedQuery);
    // Mirror of store — causes re-renders on store changes
    const [storeSnap, setStoreSnap] = useState(() => knowledgeQueryStore.getState());
    const [elapsedMs, setElapsedMs] = useState(0);

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const timerRef = useRef<number | null>(null);
    // Track whether we've already attempted cache restore for this mount session
    const cacheRestoredRef = useRef(false);

    // ── Subscribe to store ──────────────────────────────────────────────────
    useEffect(() => {
        const unsubscribe = knowledgeQueryStore.subscribe(() => {
            setStoreSnap({ ...knowledgeQueryStore.getState() });
        });
        return unsubscribe;
    }, []);

    // ── Sync local query input when store submittedQuery changes ───────────
    useEffect(() => {
        if (storeSnap.submittedQuery) {
            setQuery(storeSnap.submittedQuery);
        }
    }, [storeSnap.submittedQuery]);

    // ── Timer: start/stop based on store loading state ─────────────────────
    useEffect(() => {
        if (storeSnap.widgetState === 'loading' && storeSnap.startedAtMs) {
            // Might be resuming mid-flight (component remounted) — compute elapsed correctly
            setElapsedMs(Date.now() - storeSnap.startedAtMs);
            if (timerRef.current) window.clearInterval(timerRef.current);
            timerRef.current = window.setInterval(() => {
                const s = knowledgeQueryStore.getState();
                if (s.startedAtMs) setElapsedMs(Date.now() - s.startedAtMs);
            }, 100);
        } else {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
        return () => {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [storeSnap.widgetState, storeSnap.startedAtMs]);

    // ── Cache restore (only on first idle mount) ───────────────────────────
    useEffect(() => {
        if (cacheRestoredRef.current) return;
        cacheRestoredRef.current = true;

        if (knowledgeQueryStore.getState().widgetState !== 'idle') return;

        let active = true;
        const restore = async () => {
            try {
                const cached = await knowledgeQueryService.getLastCached();
                if (!active || !cached?.response?.success) return;
                knowledgeQueryStore.restoreFromCache(cached.query || '', cached.response);
            } catch {
                // Ignore cache restore errors
            }
        };
        restore();
        return () => { active = false; };
    }, []);

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async () => {
        const trimmed = query.trim();
        if (trimmed.length < 3) return;
        await knowledgeQueryStore.startQuery(trimmed);
    }, [query]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleReset = () => {
        knowledgeQueryStore.reset();
        setQuery('');
        setElapsedMs(0);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleCancel = () => {
        knowledgeQueryStore.cancel();
        setQuery('');
        setElapsedMs(0);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const { widgetState: state, result, error } = storeSnap;
    const isLoading = state === 'loading';
    const canSubmit = query.trim().length >= 3 && !isLoading;

    // Этап 1: разделяем sources на две группы (деривация через useMemo)
    const diseaseSources = useMemo(
        () => (result?.sources ?? []).filter(s => s.type === 'disease'),
        [result?.sources]
    );
    // Показываем только препараты, которые ИИ фактически упомянул в тексте ответа
    const medicationSources = useMemo(() => {
        const allMeds = (result?.sources ?? []).filter(s => s.type === 'medication');
        if (!result?.answer || allMeds.length === 0) return allMeds;
        const answerLower = result.answer.toLowerCase();
        const mentioned = allMeds.filter(s => {
            // Берём первое значащее слово названия (≥ 5 символов) и ищем его в ответе
            const firstWord = s.name.toLowerCase().split(/[\s+]+/)[0];
            return firstWord.length >= 5 && answerLower.includes(firstWord);
        });
        // Если ИИ не упомянул ни один препарат — не показываем нерелевантные чипы
        return mentioned;
    }, [result?.sources, result?.answer]);

    const geminiTrace = useMemo(
        () => (result?.trace ?? []).filter(line => line.toLowerCase().includes('gemini')),
        [result?.trace]
    );
    const localTrace = useMemo(
        () => (result?.trace ?? []).filter(line => line.toLowerCase().includes('local')),
        [result?.trace]
    );

    const comparisonSummary = useMemo(() => {
        if (!result) return null;

        const geminiText = (result.geminiAnswer ?? '').trim();
        const localText = (result.localAnswer ?? '').trim();
        const geminiMs = result.geminiDurationMs ?? null;
        const localMs = result.localDurationMs ?? null;

        let speedLine = 'Скорость: недостаточно данных для сравнения.';
        if (geminiMs != null && localMs != null) {
            const diffMs = Math.abs(geminiMs - localMs);
            if (diffMs < 250) {
                speedLine = 'Скорость: практически одинаковая.';
            } else if (geminiMs < localMs) {
                speedLine = `Скорость: Gemini быстрее на ${(diffMs / 1000).toFixed(2)}s.`;
            } else {
                speedLine = `Скорость: Локальная LLM быстрее на ${(diffMs / 1000).toFixed(2)}s.`;
            }
        }

        let qualityLine = 'Полнота: недостаточно данных для сравнения.';
        if (geminiText && localText) {
            const geminiLen = geminiText.length;
            const localLen = localText.length;
            const ratio = Math.max(geminiLen, localLen) / Math.max(1, Math.min(geminiLen, localLen));

            if (ratio < 1.15) {
                qualityLine = 'Полнота: объём ответов сопоставим.';
            } else if (geminiLen > localLen) {
                qualityLine = 'Полнота: Gemini дал более развёрнутый ответ.';
            } else {
                qualityLine = 'Полнота: Локальная LLM дала более развёрнутый ответ.';
            }
        }

        return { speedLine, qualityLine };
    }, [result]);

    return (
        <Card noPadding className="overflow-visible">
            <div className="p-6">
                {/* Заголовок */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/30">
                        <Search size={20} className="text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                            Поиск по базе знаний
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Задайте клинический вопрос — ИИ ответит только на основе вашей БД
                        </p>
                    </div>
                </div>

                {/* Поле ввода + кнопка */}
                <div className="flex items-stretch gap-2">
                    <textarea
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        rows={2}
                        placeholder="Например: «Какие антибиотики при пневмонии у детей до 5 лет?» или «Признаки ларинготрахеита?»"
                        className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700
                            bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white
                            placeholder:text-slate-400 dark:placeholder:text-slate-500
                            text-sm px-4 py-3
                            focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400
                            disabled:opacity-60 transition-all duration-200"
                    />
                    {isLoading ? (
                        <Button
                            type="button"
                            variant="danger"
                            size="md"
                            onClick={handleCancel}
                            className="shrink-0 self-stretch w-10 px-0 rounded-xl"
                            title="Отменить"
                        >
                            <X size={16} />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={handleSubmit}
                            aria-disabled={!canSubmit}
                            className={`shrink-0 self-stretch w-10 px-0 rounded-xl ${
                                canSubmit ? '' : 'opacity-80 saturate-75'
                            }`}
                            title="Найти (Enter)"
                        >
                            <Search size={18} strokeWidth={2.5} />
                        </Button>
                    )}
                </div>

                {/* Состояние loading */}
                {state === 'loading' && (
                    <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Loader2 size={14} className="animate-spin" />
                            <span>Агент анализирует запрос и собирает контекст...</span>
                            <span className="ml-auto text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                                {(elapsedMs / 1000).toFixed(1)}s
                            </span>
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40">
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                Процесс обдумывания
                            </p>
                            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                <p>1. Нормализация запроса</p>
                                <p>2. Поиск по болезням (FTS + LIKE)</p>
                                <p>3. Поиск по препаратам</p>
                                <p>4. Сборка контекста для модели</p>
                                <p>5. Генерация grounded-ответа</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Состояние error */}
                {state === 'error' && (
                    <div className="mt-4 flex items-start gap-2 p-3 rounded-lg
                        bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800">
                        <AlertCircle size={15} className="text-rose-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
                    </div>
                )}

                {/* Состояние ответа */}
                {state === 'answer' && result && (
                    <div className="mt-4 space-y-4">
                        {/* Блок fallback: AI недоступен */}
                        {(result.noAiKey || result.aiErrorMessage) && (
                            <div className="flex items-start gap-2 p-3 rounded-lg
                                bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                                <Info size={14} className="text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                    AI-ответ недоступен ({result.aiErrorMessage ?? 'не настроен API ключ'}). Ниже — найденные источники из базы знаний.
                                </p>
                            </div>
                        )}

                        {/* Сравнение ответов Gemini vs Local LLM */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                        <Sparkles size={13} className="text-amber-500" />
                                        Gemini
                                    </p>
                                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                        {result.geminiDurationMs != null ? `${(result.geminiDurationMs / 1000).toFixed(2)}s` : '—'}
                                    </span>
                                </div>
                                {result.geminiAnswer ? (
                                    <MarkdownAnswer text={result.geminiAnswer} />
                                ) : (
                                    <p className="text-sm text-amber-700 dark:text-amber-400">
                                        {result.geminiErrorMessage ?? 'Ответ от Gemini недоступен для этого запроса.'}
                                    </p>
                                )}
                                {geminiTrace.length > 0 && (
                                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1 max-h-28 overflow-auto">
                                        {geminiTrace.map((line, index) => (
                                            <p key={`gemini-trace-${index}`} className="text-[11px] text-slate-500 dark:text-slate-400 font-mono whitespace-pre-wrap">
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                        <Cpu size={13} className="text-primary-500" />
                                        Локальная LLM
                                    </p>
                                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                        {result.localDurationMs != null ? `${(result.localDurationMs / 1000).toFixed(2)}s` : '—'}
                                    </span>
                                </div>
                                {result.localAnswer ? (
                                    <MarkdownAnswer text={result.localAnswer} />
                                ) : (
                                    <p className="text-sm text-amber-700 dark:text-amber-400">
                                        {result.localErrorMessage ?? 'Ответ от локальной LLM недоступен для этого запроса.'}
                                    </p>
                                )}
                                {localTrace.length > 0 && (
                                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1 max-h-28 overflow-auto">
                                        {localTrace.map((line, index) => (
                                            <p key={`local-trace-${index}`} className="text-[11px] text-slate-500 dark:text-slate-400 font-mono whitespace-pre-wrap">
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {comparisonSummary && (
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40">
                                <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                    Сравнение моделей (эвристика)
                                </p>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-700 dark:text-slate-300">{comparisonSummary.speedLine}</p>
                                    <p className="text-xs text-slate-700 dark:text-slate-300">{comparisonSummary.qualityLine}</p>
                                </div>
                            </div>
                        )}

                        {/* Этап 3: Блок «Упомянутые препараты» — кликабельные чипы */}
                        {medicationSources.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                                    <Pill size={12} />
                                    Упомянутые препараты:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {medicationSources.map((s, i) => (
                                        <MedicationChip key={`med-${s.id}-${i}`} source={s} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Этап 2: Блок «Источники» — только болезни */}
                        {diseaseSources.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                                    Источники из базы знаний:
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {diseaseSources.map((s, i) => (
                                        <SourceLink key={`dis-${s.id}-${i}`} source={s} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Трассировка и тайминг */}
                        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                                    Трассировка агента
                                </p>
                                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                    {((result.durationMs ?? elapsedMs) / 1000).toFixed(2)}s
                                </span>
                            </div>
                            <div className="space-y-1 max-h-36 overflow-auto pr-1">
                                {(result.trace ?? []).map((line, index) => (
                                    <p key={`${line}-${index}`} className="text-xs text-slate-600 dark:text-slate-300 font-mono whitespace-pre-wrap">
                                        {line}
                                    </p>
                                ))}
                            </div>
                        </div>

                        {/* Дисклеймер */}
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic leading-tight">
                            {result.disclaimer}
                        </p>

                        {/* Кнопка сброса */}
                        <div className="pt-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleReset}
                            >
                                Новый запрос
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};
