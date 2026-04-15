import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Square, ChevronDown, ChevronUp, Loader2, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '../../../components/ui/Button';
import { useRagQuery } from '../hooks/useRagQuery';
import { RagSource, QaCacheEntry, QaTemplate } from '../../../types';
import { clsx } from 'clsx';

interface Props {
    diseaseId: number;
}

const MarkdownAnswer: React.FC<{ text: string }> = ({ text }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
            h1: ({ children }) => (
                <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-4 mb-1 first:mt-0">{children}</h1>
            ),
            h2: ({ children }) => (
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 mt-3 mb-1 first:mt-0">{children}</h2>
            ),
            h3: ({ children }) => (
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-2 mb-0.5 first:mt-0">{children}</h3>
            ),
            p: ({ children }) => (
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-2 last:mb-0">{children}</p>
            ),
            ul: ({ children }) => (
                <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>
            ),
            ol: ({ children }) => (
                <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">{children}</ol>
            ),
            li: ({ children }) => (
                <li className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed pl-0.5">{children}</li>
            ),
            strong: ({ children }) => (
                <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
            ),
            em: ({ children }) => (
                <em className="italic text-gray-600 dark:text-gray-400">{children}</em>
            ),
            blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-indigo-300 dark:border-indigo-700 pl-3 my-2 text-gray-600 dark:text-gray-400 italic">
                    {children}
                </blockquote>
            ),
            code: ({ children, className }) => {
                const isBlock = className?.includes('language-');
                return isBlock
                    ? <code className="block bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-auto my-2">{children}</code>
                    : <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-xs font-mono text-indigo-700 dark:text-indigo-300">{children}</code>;
            },
            hr: () => (
                <hr className="my-3 border-gray-200 dark:border-gray-700" />
            ),
            table: ({ children }) => (
                <div className="overflow-x-auto my-2">
                    <table className="min-w-full text-xs border-collapse">{children}</table>
                </div>
            ),
            th: ({ children }) => (
                <th className="border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-300">{children}</th>
            ),
            td: ({ children }) => (
                <td className="border border-gray-200 dark:border-gray-700 px-2 py-1 text-gray-700 dark:text-gray-300">{children}</td>
            ),
        }}
    >
        {text}
    </ReactMarkdown>
);

function SourceItem({ source }: { source: RagSource }) {
    const title = source.sectionTitle ?? 'Раздел документа';
    const pages = source.pageStart != null
        ? source.pageEnd != null && source.pageEnd !== source.pageStart
            ? `стр. ${source.pageStart}–${source.pageEnd}`
            : `стр. ${source.pageStart}`
        : null;
    const level = source.evidenceLevel;

    return (
        <div className="flex flex-col gap-0.5 px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-tight">{title}</span>
                {level && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                        УД: {level}
                    </span>
                )}
                {pages && (
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{pages}</span>
                )}
            </div>
            {source.preview && (
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug line-clamp-2 mt-0.5">
                    {source.preview}
                </p>
            )}
        </div>
    );
}

export const DiseaseAiAssistant: React.FC<Props> = ({ diseaseId }) => {
    const [inputValue, setInputValue] = useState('');
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const answerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // QA chips state
    const [qaTemplates, setQaTemplates] = useState<QaTemplate[]>([]);
    const [qaCache, setQaCache] = useState<QaCacheEntry[]>([]);
    const [loadingChip, setLoadingChip] = useState<Record<string, boolean>>({});
    const [activeChip, setActiveChip] = useState<QaCacheEntry | null>(null);
    const [chipSourcesOpen, setChipSourcesOpen] = useState(false);

    const {
        answer,
        sources,
        loading,
        streaming,
        error,
        sendQueryStream,
        abortStream,
        reset,
        clearHistory,
        historyLength,
    } = useRagQuery(diseaseId);

    // Auto-scroll answer while streaming
    useEffect(() => {
        if (streaming && answerRef.current) {
            answerRef.current.scrollTop = answerRef.current.scrollHeight;
        }
    }, [answer, streaming]);

    // Load QA templates and cache on mount / diseaseId change
    useEffect(() => {
        let cancelled = false;
        Promise.all([
            window.electronAPI.rag.qaTemplates().catch(() => []),
            window.electronAPI.rag.qaList({ diseaseId }).catch(() => []),
        ]).then(([templates, entries]) => {
            if (!cancelled) {
                setQaTemplates(templates);
                setQaCache(entries);
            }
        });
        return () => { cancelled = true; };
    }, [diseaseId]);

    const handleTriggerPrecompute = useCallback(async () => {
        setQaLoading(true);
        try {
            await window.electronAPI.rag.qaTrigger({ diseaseId });
            // Poll once after a short delay to pick up fast answers
            setTimeout(async () => {
                const entries = await window.electronAPI.rag.qaList({ diseaseId }).catch(() => []);
                setQaCache(entries);
                setQaLoading(false);
            }, 3000);
        } catch {
            setQaLoading(false);
        }
    }, [diseaseId]);

    const handleChipClick = useCallback(async (template: QaTemplate) => {
        // Check if we have cached answer
        const cached = qaCache.find(c => c.templateId === template.templateId);
        if (cached) {
            setActiveChip(prev => prev?.templateId === cached.templateId ? null : cached);
            setChipSourcesOpen(false);
            return;
        }

        // Start computing
        setLoadingChip(prev => ({ ...prev, [template.templateId]: true }));
        try {
            const entry = await window.electronAPI.rag.qaComputeSingle({ diseaseId, templateId: template.templateId });
            if (entry) {
                setQaCache(prev => [...prev.filter(c => c.templateId !== entry.templateId), entry]);
                setActiveChip(entry);
                setChipSourcesOpen(false);
            }
        } catch (err) {
            console.warn('Failed to compute QA entry:', err);
        } finally {
            setLoadingChip(prev => ({ ...prev, [template.templateId]: false }));
        }
    }, [diseaseId, qaCache]);

    const handleSend = () => {
        const q = inputValue.trim();
        if (!q || loading || streaming) return;
        setInputValue('');
        setSourcesOpen(false);
        sendQueryStream(q);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isBusy = loading || streaming;

    return (
        <div className="flex flex-col h-full min-h-[420px] gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">ИИ помощник</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">— отвечает только на основе прикреплённых документов</span>
                </div>
            </div>

            {/* Quick-answer chips */}
            {qaTemplates.length > 0 ? (
                <div className="flex flex-col gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                        {qaTemplates.map(template => {
                            const cached = qaCache.find(c => c.templateId === template.templateId);
                            const isLoading = loadingChip[template.templateId];
                            return (
                                <button
                                    key={template.templateId}
                                    onClick={() => handleChipClick(template)}
                                    disabled={isLoading}
                                    className={clsx(
                                        'text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1',
                                        cached && activeChip?.templateId === template.templateId
                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                            : cached
                                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:border-green-400'
                                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400',
                                        isLoading && 'opacity-70 cursor-not-allowed'
                                    )}
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : cached ? (
                                        <Zap className="h-3 w-3" />
                                    ) : null}
                                    {template.label}
                                </button>
                            );
                        })}
                    </div>
                    {activeChip && (
                        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-3 text-sm">
                            <MarkdownAnswer text={activeChip.answer} />
                            {activeChip.sources.length > 0 && (
                                <div className="mt-2 border-t border-indigo-100 dark:border-indigo-900 pt-2">
                                    <button
                                        onClick={() => setChipSourcesOpen(o => !o)}
                                        className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                                    >
                                        Источники ({activeChip.sources.length})
                                        {chipSourcesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    </button>
                                    {chipSourcesOpen && (
                                        <div className="flex flex-col gap-1 mt-1.5 max-h-36 overflow-y-auto">
                                            {activeChip.sources.map(src => (
                                                <SourceItem key={src.id} source={src} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : null}

            {/* Answer area */}
            <div
                ref={answerRef}
                className={clsx(
                    'flex-1 overflow-y-auto rounded-lg border p-4 text-sm leading-relaxed min-h-[200px]',
                    'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900',
                    'text-gray-800 dark:text-gray-200',
                    !answer && !error && !isBusy && 'flex items-center justify-center'
                )}
            >
                {!answer && !error && !isBusy && (
                    <div className="text-center text-gray-400 dark:text-gray-500 select-none">
                        <Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Задайте вопрос по прикреплённым клиническим руководствам</p>
                    </div>
                )}

                {isBusy && !answer && (
                    <div className="flex items-center gap-2 text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Поиск и генерация ответа...</span>
                    </div>
                )}

                {answer && (
                    <div>
                        <MarkdownAnswer text={answer} />
                        {streaming && (
                            <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-500 animate-pulse rounded-sm align-middle" />
                        )}
                    </div>
                )}

                {error && (
                    <div className="text-red-500 dark:text-red-400 text-xs">
                        <strong>Ошибка:</strong> {error}
                    </div>
                )}
            </div>

            {/* Sources */}
            {sources.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setSourcesOpen(o => !o)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                    >
                        <span>Источники ({sources.length})</span>
                        {sourcesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {sourcesOpen && (
                        <div className="flex flex-col gap-1.5 p-2 max-h-48 overflow-y-auto">
                            {sources.map(src => (
                                <SourceItem key={src.id} source={src} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Input */}
            <div className="flex gap-2 items-end">
                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isBusy}
                    rows={2}
                    placeholder="Введите вопрос... (Enter — отправить, Shift+Enter — новая строка)"
                    className={clsx(
                        'flex-1 resize-none rounded-lg border px-3 py-2 text-sm',
                        'border-gray-300 dark:border-gray-600',
                        'bg-white dark:bg-gray-900',
                        'text-gray-800 dark:text-gray-200',
                        'placeholder-gray-400 dark:placeholder-gray-600',
                        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                        'disabled:opacity-50'
                    )}
                />
                {streaming ? (
                    <Button
                        onClick={abortStream}
                        variant="secondary"
                        size="sm"
                        title="Остановить генерацию"
                        className="shrink-0 h-[56px]"
                    >
                        <Square className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || loading}
                        size="sm"
                        title="Отправить (Enter)"
                        className="shrink-0 h-[56px]"
                    >
                        {loading
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Send className="h-4 w-4" />
                        }
                    </Button>
                )}
            </div>

            {answer && !streaming && (
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { reset(); setInputValue(''); setSourcesOpen(false); }}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        Очистить ответ
                    </button>
                    {historyLength > 0 && (
                        <button
                            onClick={() => { clearHistory(); reset(); setInputValue(''); setSourcesOpen(false); }}
                            className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            title="Сбросить историю диалога"
                        >
                            Очистить историю ({historyLength})
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
