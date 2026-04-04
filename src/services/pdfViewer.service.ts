import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { logger } from './logger';
import { PDF_THUMBNAIL_CACHE_LIMIT, PDF_THUMBNAIL_SCALE_DEFAULT } from '../constants';

// Configure worker - use version from package
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

export interface PdfSearchResult {
    page: number;
    text: string;
}

export interface PdfOutlineItem {
    title: string;
    page: number | null;
    items: PdfOutlineItem[];
}

export interface RenderTextLayerOptions {
    scale?: number;
    searchQuery?: string;
}

export interface RenderPageResult {
    page: PDFPageProxy;
    width: number;
    height: number;
}

const thumbnailCache = new Map<string, string>();

const getCacheValue = (key: string): string | undefined => {
    if (!thumbnailCache.has(key)) return undefined;
    const value = thumbnailCache.get(key);
    if (value) {
        thumbnailCache.delete(key);
        thumbnailCache.set(key, value);
    }
    return value;
};

const setCacheValue = (key: string, value: string): void => {
    if (thumbnailCache.has(key)) {
        thumbnailCache.delete(key);
    }
    thumbnailCache.set(key, value);
    if (thumbnailCache.size > PDF_THUMBNAIL_CACHE_LIMIT) {
        const firstKey = thumbnailCache.keys().next().value;
        if (firstKey) {
            thumbnailCache.delete(firstKey);
        }
    }
};

const buildThumbnailKey = (docKey: string, pageNum: number, scale: number): string =>
    `${docKey}::${pageNum}::${scale}`;

const extractSnippet = (text: string, query: string, radius = 50): string => {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, radius * 2);
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + query.length + radius);
    return text.substring(start, end);
};

const mapOutlineItems = async (
    pdf: PDFDocumentProxy,
    items: any[]
): Promise<PdfOutlineItem[]> => {
    if (!items?.length) return [];
    const mapped: PdfOutlineItem[] = [];

    for (const item of items) {
        let page: number | null = null;
        try {
            const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
            if (dest?.[0]) {
                const pageIndex = await pdf.getPageIndex(dest[0]);
                page = pageIndex + 1;
            }
        } catch (error) {
            logger.warn('[PDF] Failed to resolve outline destination', { error, title: item.title });
        }

        const children = await mapOutlineItems(pdf, item.items || []);
        mapped.push({
            title: item.title || 'Без названия',
            page,
            items: children
        });
    }

    return mapped;
};

export const pdfViewerService = {
    clearThumbnailCache(docKey?: string): void {
        if (!docKey) {
            thumbnailCache.clear();
            return;
        }
        for (const key of thumbnailCache.keys()) {
            if (key.startsWith(`${docKey}::`)) {
                thumbnailCache.delete(key);
            }
        }
    },

    async loadPdf(filePath: string): Promise<PDFDocumentProxy> {
        try {
            const fileData = await window.electronAPI.readPdfFile(filePath);
            const loadingTask = pdfjsLib.getDocument({ data: fileData });
            return await loadingTask.promise;
        } catch (error) {
            logger.error('[PDF] Failed to load PDF', { error, filePath });
            throw error;
        }
    },

    async renderPage(
        pdf: PDFDocumentProxy,
        pageNum: number,
        canvas: HTMLCanvasElement,
        textLayer: HTMLDivElement,
        scale: number,
        options?: RenderTextLayerOptions
    ): Promise<RenderPageResult> {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error('Canvas context is not available');
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport
        } as any).promise;

        textLayer.innerHTML = '';
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();
        textContent.items.forEach((item: any) => {
            if (!item?.str) return;
            const fontHeight = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
            const x = item.transform[4] * scale;
            const y = viewport.height - (item.transform[5] * scale) - (fontHeight * scale);

            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.left = `${x}px`;
            div.style.top = `${y}px`;
            div.style.fontSize = `${fontHeight * scale}px`;
            div.style.fontFamily = 'sans-serif';
            div.style.color = 'transparent';
            div.style.whiteSpace = 'nowrap';
            div.textContent = item.str;

            const query = options?.searchQuery;
            if (query && item.str.toLowerCase().includes(query.toLowerCase())) {
                div.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
            }

            textLayer.appendChild(div);
        });

        return { page, width: viewport.width, height: viewport.height };
    },

    async renderThumbnail(
        pdf: PDFDocumentProxy,
        pageNum: number,
        scale = PDF_THUMBNAIL_SCALE_DEFAULT,
        docKey = 'default'
    ): Promise<string> {
        const cacheKey = buildThumbnailKey(docKey, pageNum, scale);
        const cached = getCacheValue(cacheKey);
        if (cached) return cached;

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error('Canvas context is not available');
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport
        } as any).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setCacheValue(cacheKey, dataUrl);
        return dataUrl;
    },

    async search(pdf: PDFDocumentProxy, query: string, totalPages: number): Promise<PdfSearchResult[]> {
        if (!query.trim()) return [];
        const results: PdfSearchResult[] = [];

        for (let i = 1; i <= totalPages; i += 1) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            if (pageText.toLowerCase().includes(query.toLowerCase())) {
                results.push({ page: i, text: extractSnippet(pageText, query) });
            }
        }

        return results;
    },

    async getOutline(pdf: PDFDocumentProxy): Promise<PdfOutlineItem[]> {
        try {
            const outline = await pdf.getOutline();
            return await mapOutlineItems(pdf, outline || []);
        } catch (error) {
            logger.warn('[PDF] Failed to load outline', { error });
            return [];
        }
    }
};
