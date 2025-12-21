import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { templateRegistry } from '../registry';
import { DocumentMetadata, PrintOptions } from '../types';
import { applyPrintStyles, removePrintStyles } from '../utils/printStyles';
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

    const handlePrint = () => {
        setIsPrinting(true);
        onPrint();

        // Небольшая задержка перед вызовом печати
        setTimeout(() => {
            console.log('[PrintPreview] Calling electronAPI.print()...');
            if ((window as any).electronAPI?.print) {
                try {
                    (window as any).electronAPI.print();
                    console.log('[PrintPreview] electronAPI.print() dispatched');
                } catch (err) {
                    console.error('[PrintPreview] IPC Print failed, falling back to window.print():', err);
                    window.print();
                }
            } else {
                console.warn('[PrintPreview] electronAPI.print not found, using window.print()');
                window.print();
            }
            setIsPrinting(false);
            // onClose(); // Опционально: закрывать после печати
        }, 800);
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

        if ((window as any).electronAPI?.exportPDF) {
            try {
                console.log('[PrintPreview] Calling exportPDF with data...');
                // Pass the certificate data to the main process
                await (window as any).electronAPI.exportPDF(data);
                console.log('[PrintPreview] PDF exported and opened');
            } catch (err) {
                console.error('[PrintPreview] PDF Export failed:', err);
                alert('Не удалось создать PDF');
            }
        } else {
            alert('PDF экспорт недоступен в этом окружении');
        }
        setIsPrinting(false);
    };

    if (!isOpen) return null;

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
