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

        // Небольшая задержка перед вызовом window.print()
        setTimeout(() => {
            window.print();
            setIsPrinting(false);
            // onClose(); // Опционально: закрывать после печати
        }, 500);
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

    return ReactDOM.createPortal(
        <div className="print-preview-overlay no-print" onClick={onClose} onKeyDown={handleKeyDown}>
            <div className="print-preview-modal" onClick={(e) => e.stopPropagation()}>
                {/* Хедер с кнопками управления */}
                <div className="print-preview-header no-print">
                    <div className="preview-title">
                        <h2>{metadata.title}</h2>
                        <p className="preview-subtitle">{template.name}</p>
                    </div>

                    <div className="preview-actions">
                        <button
                            className="preview-btn preview-btn-secondary"
                            onClick={onClose}
                            disabled={isPrinting}
                        >
                            ✕ Отмена
                        </button>
                        <button
                            className="preview-btn preview-btn-primary"
                            onClick={handlePrint}
                            disabled={isPrinting}
                        >
                            {isPrinting ? '⏳ Подготовка...' : '🖨️ Печать'}
                        </button>
                    </div>
                </div>

                {/* Контент для предпросмотра */}
                <div className="print-preview-content">
                    <div className="print-preview-paper">
                        <TemplateComponent
                            data={data}
                            metadata={metadata}
                            options={options}
                        />
                    </div>
                </div>

                {/* Футер с информацией */}
                <div className="print-preview-footer no-print">
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
