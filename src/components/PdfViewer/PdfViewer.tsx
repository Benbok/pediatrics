import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search, X, Grid3x3, BookOpen, Columns2, Maximize, MessageSquare, Trash2, Pencil } from 'lucide-react';
import { Button } from '../ui/Button';
import { pdfViewerService, PdfOutlineItem } from '../../services/pdfViewer.service';
import { pdfNoteService } from '../../services/pdfNote.service';
import type { PdfNote } from '../../types';
import { PDF_THUMBNAIL_ITEM_HEIGHT, PDF_THUMBNAIL_SCALE_DEFAULT } from '../../constants';

interface PdfViewerProps {
    filePath: string;
    initialPage?: number;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ filePath, initialPage = 1 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const canvasRefRight = useRef<HTMLCanvasElement>(null);
    const textLayerRefRight = useRef<HTMLDivElement>(null);
    const pageContainerRef = useRef<HTMLDivElement>(null);
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.5);
    const [scaleMode, setScaleMode] = useState<'manual' | 'fitWidth'>('manual');
    const [fitScale, setFitScale] = useState<number | null>(null);
    const [layoutMode, setLayoutMode] = useState<'single' | 'spread'>('single');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Array<{ page: number, text: string }>>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [searching, setSearching] = useState(false);
    const [pageMatches, setPageMatches] = useState<HTMLElement[]>([]);
    const [currentPageMatchIndex, setCurrentPageMatchIndex] = useState(0);

    // UI state
    const [pageInput, setPageInput] = useState(String(initialPage));
    const [showSidebar, setShowSidebar] = useState(false);
    const [sidebarMode, setSidebarMode] = useState<'thumbnails' | 'outline'>('thumbnails');
    const [thumbnails, setThumbnails] = useState<{ [key: number]: string }>({});
    const [thumbnailsProgress, setThumbnailsProgress] = useState<{ loaded: number; total: number }>({
        loaded: 0,
        total: 0
    });
    const [thumbnailsError, setThumbnailsError] = useState<string | null>(null);
    const thumbnailsTaskRef = useRef(0);
    const thumbnailsContainerRef = useRef<HTMLDivElement>(null);
    const [thumbnailsViewport, setThumbnailsViewport] = useState({ scrollTop: 0, height: 0 });
    const [outlineItems, setOutlineItems] = useState<PdfOutlineItem[]>([]);
    const [outlineLoading, setOutlineLoading] = useState(false);
    const [outlineError, setOutlineError] = useState<string | null>(null);
    const [showNotes, setShowNotes] = useState(false);
    const [notes, setNotes] = useState<PdfNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [notesError, setNotesError] = useState<string | null>(null);
    const [noteDraft, setNoteDraft] = useState('');
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

    useEffect(() => {
        loadPdf();
        pdfViewerService.clearThumbnailCache(filePath);
    }, [filePath]);

    useEffect(() => {
        if (pdf) {
            renderPage(currentPage);
            setPageInput(String(currentPage));
        }
    }, [pdf, currentPage, scale, scaleMode, fitScale, layoutMode, searchQuery]);

    useEffect(() => {
        if (pdf && showSidebar && sidebarMode === 'thumbnails') {
            generateThumbnails();
        } else {
            thumbnailsTaskRef.current += 1;
        }
    }, [pdf, showSidebar, sidebarMode, totalPages]);

    useEffect(() => {
        if (!showSidebar || sidebarMode !== 'thumbnails') return;
        const container = thumbnailsContainerRef.current;
        if (!container) return;

        const measure = () => {
            const rect = container.getBoundingClientRect();
            setThumbnailsViewport(prev => ({
                ...prev,
                height: rect.height
            }));
        };

        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [showSidebar, sidebarMode]);

    useEffect(() => {
        if (!pdf) return;
        loadOutline();
    }, [pdf]);

    useEffect(() => {
        if (!showNotes) return;
        loadNotes();
    }, [showNotes, currentPage, filePath]);

    useEffect(() => {
        if (!pdf || scaleMode !== 'fitWidth') return;
        const container = pageContainerRef.current;
        if (!container) return;

        const computeFitScale = async () => {
            const rect = container.getBoundingClientRect();
            const availableWidth = Math.max(0, rect.width - 64);
            const page = await pdf.getPage(currentPage);
            const viewport = page.getViewport({ scale: 1 });
            const gap = layoutMode === 'spread' ? 24 : 0;
            const pagesCount = layoutMode === 'spread' ? 2 : 1;
            const totalWidth = viewport.width * pagesCount + gap;
            const nextScale = Math.min(3, Math.max(0.5, availableWidth / totalWidth));
            setFitScale(nextScale);
        };

        computeFitScale();
        window.addEventListener('resize', computeFitScale);
        return () => window.removeEventListener('resize', computeFitScale);
    }, [pdf, currentPage, scaleMode, layoutMode]);

    const loadPdf = async () => {
        setLoading(true);
        setError(null);
        try {
            const pdfDoc = await pdfViewerService.loadPdf(filePath);
            setPdf(pdfDoc);
            setTotalPages(pdfDoc.numPages);
            setLoading(false);
        } catch (err: any) {
            setError(err.message || 'Ошибка загрузки PDF');
            setLoading(false);
        }
    };

    const renderPage = async (pageNum: number) => {
        if (!pdf || !canvasRef.current || !textLayerRef.current) return;

        const effectiveScale = scaleMode === 'fitWidth' && fitScale ? fitScale : scale;
        const canvas = canvasRef.current;
        const textLayer = textLayerRef.current;
        await pdfViewerService.renderPage(pdf, pageNum, canvas, textLayer, effectiveScale, { searchQuery });
        updatePageMatches();

        if (layoutMode === 'spread') {
            const rightPage = pageNum + 1;
            const rightCanvas = canvasRefRight.current;
            const rightTextLayer = textLayerRefRight.current;
            if (rightCanvas && rightTextLayer) {
                if (rightPage <= totalPages) {
                    await pdfViewerService.renderPage(pdf, rightPage, rightCanvas, rightTextLayer, effectiveScale, { searchQuery });
                } else {
                    rightTextLayer.innerHTML = '';
                    rightCanvas.width = 0;
                    rightCanvas.height = 0;
                }
            }
        } else if (canvasRefRight.current && textLayerRefRight.current) {
            textLayerRefRight.current.innerHTML = '';
            canvasRefRight.current.width = 0;
            canvasRefRight.current.height = 0;
        }
    };

    const updatePageMatches = () => {
        const layer = textLayerRef.current;
        if (!layer || !searchQuery.trim()) {
            setPageMatches([]);
            setCurrentPageMatchIndex(0);
            return;
        }

        const matches = Array.from(layer.children).filter((el) => {
            const text = (el as HTMLElement).innerText || '';
            return text.toLowerCase().includes(searchQuery.toLowerCase());
        }) as HTMLElement[];

        setPageMatches(matches);
        setCurrentPageMatchIndex(0);
        highlightCurrentMatch(0, matches);
    };

    const highlightCurrentMatch = (index: number, matches = pageMatches) => {
        matches.forEach((el, idx) => {
            const isActive = idx === index;
            el.style.backgroundColor = isActive ? 'rgba(255, 165, 0, 0.6)' : 'rgba(255, 255, 0, 0.5)';
        });
    };

    const scrollToMatch = (index: number) => {
        const container = pageContainerRef.current;
        const match = pageMatches[index];
        if (!container || !match) return;

        const containerRect = container.getBoundingClientRect();
        const matchRect = match.getBoundingClientRect();
        const delta = matchRect.top - containerRect.top - 60;
        container.scrollBy({ top: delta, behavior: 'smooth' });
    };

    const goToPageMatch = (nextIndex: number) => {
        if (!pageMatches.length) return;
        const index = Math.max(0, Math.min(pageMatches.length - 1, nextIndex));
        setCurrentPageMatchIndex(index);
        highlightCurrentMatch(index);
        scrollToMatch(index);
    };

    const generateThumbnails = async () => {
        if (!pdf) return;
        const taskId = thumbnailsTaskRef.current + 1;
        thumbnailsTaskRef.current = taskId;
        setThumbnails({});
        setThumbnailsError(null);
        setThumbnailsProgress({ loaded: 0, total: totalPages });

        const batchSize = 4;
        for (let i = 1; i <= totalPages; i += batchSize) {
            if (thumbnailsTaskRef.current !== taskId) return;

            const batchEnd = Math.min(totalPages, i + batchSize - 1);
            const batchPages = Array.from({ length: batchEnd - i + 1 }, (_, idx) => i + idx);
            const batchThumbs: { [key: number]: string } = {};

            try {
                await Promise.all(
                    batchPages.map(async (pageNum) => {
                        batchThumbs[pageNum] = await pdfViewerService.renderThumbnail(
                            pdf,
                            pageNum,
                            PDF_THUMBNAIL_SCALE_DEFAULT,
                            filePath
                        );
                    })
                );
            } catch (err: any) {
                setThumbnailsError(err?.message || 'Ошибка загрузки превью страниц');
                return;
            }

            if (thumbnailsTaskRef.current !== taskId) return;

            setThumbnails(prev => ({ ...prev, ...batchThumbs }));
            setThumbnailsProgress(prev => ({
                loaded: prev.loaded + batchPages.length,
                total: totalPages
            }));

            await new Promise(resolve => setTimeout(resolve, 0));
        }
    };

    const loadOutline = async () => {
        if (!pdf) return;
        setOutlineLoading(true);
        setOutlineError(null);
        try {
            const outline = await pdfViewerService.getOutline(pdf);
            setOutlineItems(outline);
        } catch (err: any) {
            setOutlineError(err?.message || 'Ошибка загрузки оглавления');
        } finally {
            setOutlineLoading(false);
        }
    };

    const loadNotes = async () => {
        setNotesLoading(true);
        setNotesError(null);
        try {
            const data = await pdfNoteService.list(filePath, currentPage);
            setNotes(data);
        } catch (err: any) {
            setNotesError(err?.message || 'Ошибка загрузки заметок');
        } finally {
            setNotesLoading(false);
        }
    };

    const saveNote = async () => {
        if (!noteDraft.trim()) return;
        try {
            if (editingNoteId) {
                await pdfNoteService.update(editingNoteId, { content: noteDraft.trim() });
            } else {
                await pdfNoteService.create({
                    pdfPath: filePath,
                    page: currentPage,
                    content: noteDraft.trim()
                });
            }
            setNoteDraft('');
            setEditingNoteId(null);
            await loadNotes();
        } catch (err: any) {
            setNotesError(err?.message || 'Ошибка сохранения заметки');
        }
    };

    const startEditNote = (noteId: number, content: string) => {
        setEditingNoteId(noteId);
        setNoteDraft(content);
    };

    const cancelEditNote = () => {
        setEditingNoteId(null);
        setNoteDraft('');
    };

    const deleteNote = async (noteId: number) => {
        try {
            await pdfNoteService.remove(noteId);
            await loadNotes();
        } catch (err: any) {
            setNotesError(err?.message || 'Ошибка удаления заметки');
        }
    };

    const searchInPdf = async () => {
        if (!pdf || !searchQuery.trim()) return;

        setSearching(true);
        const results = await pdfViewerService.search(pdf, searchQuery, totalPages);

        setSearchResults(results);
        setCurrentSearchIndex(0);
        setSearching(false);

        if (results.length > 0) {
            setCurrentPage(results[0].page);
        }
    };

    const goToSearchResult = (index: number) => {
        if (searchResults[index]) {
            setCurrentPage(searchResults[index].page);
            setCurrentSearchIndex(index);
        }
    };

    const OutlineNode: React.FC<{
        item: PdfOutlineItem;
        onSelect: (page: number | null) => void;
        depth?: number;
    }> = ({ item, onSelect, depth = 0 }) => {
        const hasChildren = item.items && item.items.length > 0;
        return (
            <div className="space-y-1">
                <button
                    type="button"
                    onClick={() => onSelect(item.page)}
                    className={`w-full text-left truncate hover:text-white transition-colors ${
                        item.page ? 'text-slate-200' : 'text-slate-500 cursor-default'
                    }`}
                    style={{ paddingLeft: depth * 8 }}
                    disabled={!item.page}
                >
                    {item.title}
                </button>
                {hasChildren && (
                    <div className="space-y-1">
                        {item.items.map((child: any, index: number) => (
                            <OutlineNode
                                key={`${child.title}-${index}`}
                                item={child}
                                onSelect={onSelect}
                                depth={depth + 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const nextPage = () => {
        const step = layoutMode === 'spread' ? 2 : 1;
        if (currentPage + step <= totalPages) {
            setCurrentPage(currentPage + step);
        }
    };

    const prevPage = () => {
        const step = layoutMode === 'spread' ? 2 : 1;
        if (currentPage - step >= 1) {
            setCurrentPage(currentPage - step);
        }
    };

    const goToPage = () => {
        const num = parseInt(pageInput, 10);
        if (!isNaN(num) && num >= 1 && num <= totalPages) {
            setCurrentPage(num);
        } else {
            setPageInput(String(currentPage));
        }
    };

    const zoomIn = () => {
        setScaleMode('manual');
        setScale(s => Math.min(s + 0.25, 3));
    };
    const zoomOut = () => {
        setScaleMode('manual');
        setScale(s => Math.max(s - 0.25, 0.5));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-900 text-white">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p>Загрузка документа...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-900 text-white">
                <div className="text-center">
                    <p className="text-red-400 text-lg mb-2">Ошибка загрузки PDF</p>
                    <p className="text-slate-400 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-900">
            {/* Sidebar */}
            {showSidebar && (
                <div className="w-48 bg-slate-800 border-r border-slate-700 overflow-hidden p-2 flex flex-col">
                    {sidebarMode === 'thumbnails' && (
                        <>
                            <div className="flex items-center justify-between text-xs text-slate-300 px-1 mb-2">
                                <span>Превью страниц</span>
                                {thumbnailsProgress.total > 0 && (
                                    <span>{thumbnailsProgress.loaded}/{thumbnailsProgress.total}</span>
                                )}
                            </div>
                            {thumbnailsError && (
                                <div className="text-xs text-red-400 bg-slate-900/60 border border-red-500/30 rounded p-2 mb-2">
                                    {thumbnailsError}
                                </div>
                            )}
                            <div
                                ref={thumbnailsContainerRef}
                                onScroll={(event) => {
                                    const target = event.currentTarget;
                                    setThumbnailsViewport(prev => ({
                                        ...prev,
                                        scrollTop: target.scrollTop
                                    }));
                                }}
                                className="flex-1 overflow-y-auto"
                            >
                                {(() => {
                                    const itemHeight = PDF_THUMBNAIL_ITEM_HEIGHT;
                                    const buffer = 5;
                                    const visibleCount = Math.max(1, Math.ceil(thumbnailsViewport.height / itemHeight));
                                    const start = Math.max(1, Math.floor(thumbnailsViewport.scrollTop / itemHeight) - buffer);
                                    const end = Math.min(totalPages, start + visibleCount + buffer * 2);
                                    const topSpacerHeight = (start - 1) * itemHeight;
                                    const bottomSpacerHeight = (totalPages - end) * itemHeight;
                                    const pages = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);

                                    return (
                                        <>
                                            {topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} />}
                                            {pages.map((pageNum) => {
                                                const dataUrl = thumbnails[pageNum];
                                                const isActive = currentPage === pageNum;
                                                return (
                                                    <div
                                                        key={pageNum}
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className={`cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${isActive
                                                            ? 'border-primary-500 shadow-lg'
                                                            : 'border-slate-600 hover:border-slate-500'
                                                            }`}
                                                        style={{ height: itemHeight }}
                                                    >
                                                        {dataUrl ? (
                                                            <img src={dataUrl} alt={`Page ${pageNum}`} className="w-full" />
                                                        ) : (
                                                            <div className="w-full aspect-[3/4] bg-slate-700 animate-pulse" />
                                                        )}
                                                        <div className="text-center text-xs text-slate-300 py-1 bg-slate-700">
                                                            {pageNum}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} />}
                                        </>
                                    );
                                })()}
                            </div>
                        </>
                    )}

                    {sidebarMode === 'outline' && (
                        <>
                            <div className="text-xs text-slate-300 px-1 mb-2">Оглавление</div>
                            {outlineError && (
                                <div className="text-xs text-red-400 bg-slate-900/60 border border-red-500/30 rounded p-2 mb-2">
                                    {outlineError}
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto text-xs text-slate-200 space-y-1">
                                {outlineLoading && <div className="text-slate-400">Загрузка...</div>}
                                {!outlineLoading && outlineItems.length === 0 && (
                                    <div className="text-slate-400">Нет оглавления</div>
                                )}
                                {!outlineLoading && outlineItems.length > 0 && (
                                    <div className="space-y-1">
                                        {outlineItems.map((item, idx) => (
                                            <OutlineNode
                                                key={`${item.title}-${idx}`}
                                                item={item}
                                                onSelect={(page) => page && setCurrentPage(page)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="flex-1 flex flex-col">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 gap-4 flex-wrap">
                    {/* Navigation */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={prevPage}
                            disabled={currentPage <= 1}
                            className="text-white hover:bg-slate-700"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>

                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={pageInput}
                                onChange={(e) => setPageInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && goToPage()}
                                onBlur={goToPage}
                                className="w-16 px-2 py-1 text-center bg-slate-700 text-white border border-slate-600 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                            <span className="text-white font-medium">
                                / {totalPages}
                            </span>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={nextPage}
                            disabled={currentPage >= totalPages}
                            className="text-white hover:bg-slate-700"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Search */}
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                        <div className="relative flex-1 flex items-center">
                            <div className="absolute left-3 flex items-center justify-center pointer-events-none">
                                <Search className="w-4 h-4 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && searchInPdf()}
                                placeholder="Поиск в документе..."
                                className="w-full h-10 pl-10 pr-10 bg-slate-700 text-white border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none placeholder:text-slate-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSearchResults([]);
                                    }}
                                    className="absolute right-3 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                    type="button"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={searchInPdf}
                            disabled={searching || !searchQuery.trim()}
                            className="whitespace-nowrap"
                        >
                            {searching ? 'Поиск...' : 'Найти'}
                        </Button>
                    </div>

                    {/* Zoom & Tools */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (sidebarMode !== 'thumbnails') {
                                    setSidebarMode('thumbnails');
                                    setShowSidebar(true);
                                } else {
                                    setShowSidebar(!showSidebar);
                                }
                            }}
                            className={`text-white hover:bg-slate-700 ${showSidebar && sidebarMode === 'thumbnails' ? 'bg-slate-700' : ''}`}
                        >
                            <Grid3x3 className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (sidebarMode !== 'outline') {
                                    setSidebarMode('outline');
                                    setShowSidebar(true);
                                } else {
                                    setShowSidebar(!showSidebar);
                                }
                            }}
                            className={`text-white hover:bg-slate-700 ${showSidebar && sidebarMode === 'outline' ? 'bg-slate-700' : ''}`}
                        >
                            <BookOpen className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowNotes(!showNotes)}
                            className={`text-white hover:bg-slate-700 ${showNotes ? 'bg-slate-700' : ''}`}
                        >
                            <MessageSquare className="w-5 h-5" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLayoutMode(layoutMode === 'single' ? 'spread' : 'single')}
                            className={`text-white hover:bg-slate-700 ${layoutMode === 'spread' ? 'bg-slate-700' : ''}`}
                        >
                            <Columns2 className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setScaleMode(scaleMode === 'fitWidth' ? 'manual' : 'fitWidth')}
                            className={`text-white hover:bg-slate-700 ${scaleMode === 'fitWidth' ? 'bg-slate-700' : ''}`}
                        >
                            <Maximize className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={zoomOut}
                            disabled={scaleMode === 'fitWidth' || scale <= 0.5}
                            className="text-white hover:bg-slate-700"
                        >
                            <ZoomOut className="w-5 h-5" />
                        </Button>
                        <span className="text-white font-medium px-2 min-w-[60px] text-center">
                            {Math.round((scaleMode === 'fitWidth' && fitScale ? fitScale : scale) * 100)}%
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={zoomIn}
                            disabled={scaleMode === 'fitWidth' || scale >= 3}
                            className="text-white hover:bg-slate-700"
                        >
                            <ZoomIn className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Search Results */}
                {(searchResults.length > 0 || (searchQuery && pageMatches.length > 0)) && (
                    <div className="bg-slate-800 border-b border-slate-700 px-4 py-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">
                                {searchResults.length > 0
                                    ? `Найдено: ${searchResults.length} ${searchResults.length === 1 ? 'результат' : 'результатов'}`
                                    : 'Поиск по странице'}
                            </span>
                            {searchResults.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => goToSearchResult(Math.max(0, currentSearchIndex - 1))}
                                        disabled={currentSearchIndex <= 0}
                                        className="text-white hover:bg-slate-700"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <span className="text-sm text-white">
                                        {currentSearchIndex + 1} / {searchResults.length}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => goToSearchResult(Math.min(searchResults.length - 1, currentSearchIndex + 1))}
                                        disabled={currentSearchIndex >= searchResults.length - 1}
                                        className="text-white hover:bg-slate-700"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                        {pageMatches.length > 0 && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                                <span>Совпадения на странице:</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => goToPageMatch(currentPageMatchIndex - 1)}
                                    disabled={currentPageMatchIndex <= 0}
                                    className="text-white hover:bg-slate-700"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="text-white">
                                    {currentPageMatchIndex + 1} / {pageMatches.length}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => goToPageMatch(currentPageMatchIndex + 1)}
                                    disabled={currentPageMatchIndex >= pageMatches.length - 1}
                                    className="text-white hover:bg-slate-700"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                        {searchResults.length > 0 && (
                            <div className="mt-2 text-xs text-slate-400 italic">
                                "{searchResults[currentSearchIndex]?.text}..."
                            </div>
                        )}
                    </div>
                )}

                {/* PDF Canvas with Text Layer */}
                <div ref={pageContainerRef} className="flex-1 overflow-auto bg-slate-900 flex items-start justify-center p-8">
                    <div className={`relative shadow-2xl ${layoutMode === 'spread' ? 'flex gap-6' : ''}`}>
                        <div className="relative">
                            <canvas
                                ref={canvasRef}
                                className="block"
                                style={{ maxWidth: '100%', height: 'auto' }}
                            />
                            <div
                                ref={textLayerRef}
                                className="absolute top-0 left-0 select-text"
                            />
                        </div>
                        {layoutMode === 'spread' && (
                            <div className="relative">
                                <canvas
                                    ref={canvasRefRight}
                                    className="block"
                                    style={{ maxWidth: '100%', height: 'auto' }}
                                />
                                <div
                                    ref={textLayerRefRight}
                                    className="absolute top-0 left-0 select-text"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showNotes && (
                <div className="w-80 bg-slate-800 border-l border-slate-700 p-3 flex flex-col">
                    <div className="text-xs text-slate-300 mb-2">
                        Заметки к странице {currentPage}
                    </div>
                    {notesError && (
                        <div className="text-xs text-red-400 bg-slate-900/60 border border-red-500/30 rounded p-2 mb-2">
                            {notesError}
                        </div>
                    )}
                    <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Добавить заметку..."
                        className="w-full min-h-[90px] bg-slate-700 text-white border border-slate-600 rounded p-2 text-sm resize-none mb-2"
                    />
                    <div className="flex items-center gap-2 mb-3">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={saveNote}
                            disabled={!noteDraft.trim()}
                        >
                            {editingNoteId ? 'Сохранить' : 'Добавить'}
                        </Button>
                        {editingNoteId && (
                            <Button variant="ghost" size="sm" onClick={cancelEditNote} className="text-white">
                                Отмена
                            </Button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {notesLoading && <div className="text-xs text-slate-400">Загрузка...</div>}
                        {!notesLoading && notes.length === 0 && (
                            <div className="text-xs text-slate-400">Заметок пока нет</div>
                        )}
                        {!notesLoading && notes.map(note => (
                            <div key={note.id} className="bg-slate-700/60 rounded p-2 text-xs text-slate-200">
                                <div className="whitespace-pre-wrap">{note.content}</div>
                                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                                    <span>{new Date(note.createdAt).toLocaleString()}</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => startEditNote(note.id, note.content)}
                                            className="text-slate-300 hover:text-white"
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteNote(note.id)}
                                            className="text-slate-300 hover:text-white"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
