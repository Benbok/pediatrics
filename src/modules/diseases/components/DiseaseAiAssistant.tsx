import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Square, RefreshCcw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useRagQuery } from '../hooks/useRagQuery';
import { RagSource } from '../../../types';
import { clsx } from 'clsx';

interface Props {
    diseaseId: number;
}

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

    const {
        answer,
        sources,
        loading,
        streaming,
        error,
        reindexing,
        reindexProgress,
        sendQueryStream,
        abortStream,
        reindex,
        reset,
    } = useRagQuery(diseaseId);

    // Auto-scroll answer while streaming
    useEffect(() => {
        if (streaming && answerRef.current) {
            answerRef.current.scrollTop = answerRef.current.scrollHeight;
        }
    }, [answer, streaming]);

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
                <button
                    onClick={() => reindex()}
                    disabled={reindexing || isBusy}
                    title="Переиндексировать чанки через LM Studio embeddings (опционально)"
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40 transition-colors"
                >
                    <RefreshCcw className={clsx('h-3 w-3', reindexing && 'animate-spin')} />
                    {reindexing
                        ? reindexProgress
                            ? `${reindexProgress.done}/${reindexProgress.total}`
                            : 'Индексация...'
                        : 'Переиндекс.'
                    }
                </button>
            </div>

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
                    <div className="whitespace-pre-wrap">
                        {answer}
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
                <button
                    onClick={() => { reset(); setInputValue(''); setSourcesOpen(false); }}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 self-start transition-colors"
                >
                    Очистить
                </button>
            )}
        </div>
    );
};
