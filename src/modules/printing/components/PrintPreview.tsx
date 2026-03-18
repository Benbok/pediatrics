import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { templateRegistry } from '../registry';
import { DocumentMetadata, PrintOptions } from '../types';
import { applyPrintStyles, removePrintStyles } from '../utils/printStyles';
import { logger } from '../../../services/logger';
import { printService } from '../PrintService';
import './PrintPreview.css';

interface PrintPreviewProps {
    isOpen: boolean;
    templateId: string;
    data: unknown;
    metadata: DocumentMetadata;
    options: PrintOptions;
    onClose: () => void;
    onPrint: () => void;
}

/**
 * Модальное окно предпросмотра перед печатью
 */
export const PrintPreview: React.FC<PrintPreviewProps> = ({
    isOpen,
    templateId,
    data,
    metadata,
    options,
    onClose,
    onPrint,
}) => {
    const [isPrinting, setIsPrinting] = useState(false);

    const template = templateRegistry.get(templateId);

    useEffect(() => {
        if (isOpen) {
            // Применяем стили печати для предпросмотра
            applyPrintStyles(options);

            // Блокируем скролл body
            document.body.style.overflow = 'hidden';
        }

        return () => {
            removePrintStyles();
            document.body.style.overflow = '';
        };
    }, [isOpen, options]);

    const handlePrint = async () => {
        if (!template) return;
        setIsPrinting(true);
        onPrint();

        try {
            // Render the template to static HTML
            const templateCss = Array.isArray(template.styles)
                ? template.styles.filter(Boolean).join('\n')
                : (template.styles ?? '');

            const html = renderToStaticMarkup(
                React.createElement(template.component, { data, metadata, options })
            );

            logger.info('[PrintPreview] Sending document to hidden-window print', { templateId });

            if (window.electronAPI?.printDocument) {
                const result = await window.electronAPI.printDocument({
                    templateId,
                    html,
                    styles: templateCss,
                    metadata,
                    options,
                });
                if (!result.success) {
                    logger.warn('[PrintPreview] Print cancelled or failed', { error: result.error, templateId });
                } else if (result.fallback === 'pdf') {
                    logger.info('[PrintPreview] No printer found — document opened as PDF in system viewer', { templateId, path: result.path });
                } else {
                    logger.info('[PrintPreview] Document printed successfully', { templateId });
                }
            } else {
                // Fallback for non-Electron environments
                logger.warn('[PrintPreview] electronAPI.printDocument not available, using window.print()', { templateId });
                window.print();
            }
        } catch (err) {
            logger.error('[PrintPreview] Print failed', { error: err, templateId });
        }

        setIsPrinting(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen || !template) {
        return null;
    }

    const TemplateComponent = template.component;

    const handlePDF = async () => {
        setIsPrinting(true);
        onPrint();

        try {
            logger.info('[PrintPreview] Exporting PDF via PrintService', { templateId });
            const result = await printService.exportToPDF(templateId, data, metadata, options);
            if (!result.success) {
                logger.error('[PrintPreview] PDF Export failed', { error: result.error, templateId });
                alert(result.error || 'Не удалось создать PDF');
            } else {
                logger.info('[PrintPreview] PDF exported and opened', { templateId, path: result.path });
            }
        } catch (err) {
            logger.error('[PrintPreview] PDF Export failed', { error: err, templateId });
            alert('Не удалось создать PDF');
        }
        setIsPrinting(false);
    };

    return ReactDOM.createPortal(
        <div id="printOverlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div id="printModal" className="bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div id="printHeader" className="flex items-center justify-between p-4 border-b bg-blue-600 text-white">
                    <div>
                        <h2 className="text-xl font-bold">{metadata.title}</h2>
                        <p className="text-sm opacity-90">{template.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                        >
                            ✕ Отмена
                        </button>
                        <button
                            onClick={handlePDF}
                            disabled={isPrinting}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded text-white font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isPrinting ? '⏳ ...' : '📄 Открыть PDF'}
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="px-6 py-2 bg-green-500 hover:bg-green-600 rounded text-white font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isPrinting ? '⌛ Подготовка...' : '🖨️ Печать'}
                        </button>
                    </div>
                </div>

                {/* Контент для предпросмотра */}
                <div id="printContent" className="print-preview-content">
                    <div className="print-preview-paper">
                        <TemplateComponent
                            data={data}
                            metadata={metadata}
                            options={options}
                        />
                    </div>
                </div>

                {/* Футер с информацией */}
                <div id="printFooter" className="print-preview-footer no-print">
                    <div className="preview-info">
                        <span>Размер: {options.pageSize}</span>
                        <span>•</span>
                        <span>Ориентация: {options.orientation === 'portrait' ? 'Книжная' : 'Альбомная'}</span>
                        <span>•</span>
                        <span>Дата: {new Date().toLocaleDateString('ru-RU')}</span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
