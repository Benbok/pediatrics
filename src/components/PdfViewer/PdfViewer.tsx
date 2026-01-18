import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search, X, Grid3x3 } from 'lucide-react';
import { Button } from '../ui/Button';

// Configure worker - use version from package
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

interface PdfViewerProps {
    filePath: string;
    initialPage?: number;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ filePath, initialPage = 1 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const [pdf, setPdf] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.5);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Array<{ page: number, text: string }>>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [searching, setSearching] = useState(false);

    // UI state
    const [pageInput, setPageInput] = useState(String(initialPage));
    const [showThumbnails, setShowThumbnails] = useState(false);
    const [thumbnails, setThumbnails] = useState<{ [key: number]: string }>({});
    const [thumbnailsProgress, setThumbnailsProgress] = useState<{ loaded: number; total: number }>({
        loaded: 0,
        total: 0
    });
    const [thumbnailsError, setThumbnailsError] = useState<string | null>(null);
    const thumbnailsTaskRef = useRef(0);

    useEffect(() => {
        loadPdf();
    }, [filePath]);

    useEffect(() => {
        if (pdf) {
            renderPage(currentPage);
            setPageInput(String(currentPage));
        }
    }, [pdf, currentPage, scale]);

    useEffect(() => {
        if (pdf && showThumbnails) {
            generateThumbnails();
        } else {
            thumbnailsTaskRef.current += 1;
        }
    }, [pdf, showThumbnails, totalPages]);

    const loadPdf = async () => {
        setLoading(true);
        setError(null);
        try {
            const fileData = await window.electronAPI.readPdfFile(filePath);
            const loadingTask = pdfjsLib.getDocument({ data: fileData });
            const pdfDoc = await loadingTask.promise;
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

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page
        const renderContext = {
            canvasContext: context,
            viewport: viewport,
        };
        await page.render(renderContext).promise;

        // Render text layer for selection and copying
        const textLayer = textLayerRef.current;
        textLayer.innerHTML = '';
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();

        // Create text layer divs manually for text selection
        textContent.items.forEach((item: any) => {
            if (!item.str) return;

            // Get the font height from transform matrix
            const fontHeight = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);

            // Convert PDF coordinates to viewport coordinates properly
            // PDF Y-axis goes up, CSS Y-axis goes down
            const x = item.transform[4] * scale;
            const y = viewport.height - (item.transform[5] * scale) - (fontHeight * scale);

            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.left = `${x}px`;
            div.style.top = `${y}px`;
            div.style.fontSize = `${fontHeight * scale}px`;
            div.style.fontFamily = 'sans-serif';
            div.style.color = 'transparent'; // Make text invisible but selectable
            div.style.whiteSpace = 'nowrap';
            div.textContent = item.str;

            // Highlight if matches search query
            if (searchQuery && item.str.toLowerCase().includes(searchQuery.toLowerCase())) {
                div.style.backgroundColor = 'rgba(255, 255, 0, 0.5)'; // Yellow highlight
            }

            textLayer.appendChild(div);
        });
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
                        const page = await pdf.getPage(pageNum);
                        const viewport = page.getViewport({ scale: 0.2 });

                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        if (!context) return;

                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        await page.render({
                            canvasContext: context,
                            viewport: viewport,
                        }).promise;

                        batchThumbs[pageNum] = canvas.toDataURL();
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

    const searchInPdf = async () => {
        if (!pdf || !searchQuery.trim()) return;

        setSearching(true);
        const results: Array<{ page: number, text: string }> = [];

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');

            if (pageText.toLowerCase().includes(searchQuery.toLowerCase())) {
                // Extract context around match
                const index = pageText.toLowerCase().indexOf(searchQuery.toLowerCase());
                const start = Math.max(0, index - 50);
                const end = Math.min(pageText.length, index + searchQuery.length + 50);
                const snippet = pageText.substring(start, end);

                results.push({ page: i, text: snippet });
            }
        }

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

    const nextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const prevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
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

    const zoomIn = () => setScale(s => Math.min(s + 0.25, 3));
    const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

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
            {/* Thumbnails Sidebar */}
            {showThumbnails && (
                <div className="w-48 bg-slate-800 border-r border-slate-700 overflow-y-auto p-2">
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
                    <div className="space-y-2">
                        {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
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
                    </div>
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
                            onClick={() => setShowThumbnails(!showThumbnails)}
                            className={`text-white hover:bg-slate-700 ${showThumbnails ? 'bg-slate-700' : ''}`}
                        >
                            <Grid3x3 className="w-5 h-5" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={zoomOut}
                            disabled={scale <= 0.5}
                            className="text-white hover:bg-slate-700"
                        >
                            <ZoomOut className="w-5 h-5" />
                        </Button>
                        <span className="text-white font-medium px-2 min-w-[60px] text-center">
                            {Math.round(scale * 100)}%
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={zoomIn}
                            disabled={scale >= 3}
                            className="text-white hover:bg-slate-700"
                        >
                            <ZoomIn className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="bg-slate-800 border-b border-slate-700 px-4 py-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">
                                Найдено: {searchResults.length} {searchResults.length === 1 ? 'результат' : 'результатов'}
                            </span>
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
                        </div>
                        <div className="mt-2 text-xs text-slate-400 italic">
                            "{searchResults[currentSearchIndex]?.text}..."
                        </div>
                    </div>
                )}

                {/* PDF Canvas with Text Layer */}
                <div className="flex-1 overflow-auto bg-slate-900 flex items-start justify-center p-8">
                    <div className="relative shadow-2xl">
                        <canvas
                            ref={canvasRef}
                            className="block"
                            style={{ maxWidth: '100%', height: 'auto' }}
                        />
                        {/* Text layer for selection */}
                        <div
                            ref={textLayerRef}
                            className="absolute top-0 left-0 select-text"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
