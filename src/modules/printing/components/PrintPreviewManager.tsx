import React, { useState, useEffect } from 'react';
import { PrintPreview } from './PrintPreview';
import { DocumentMetadata, PrintOptions } from '../types';

interface PrintPreviewEvent {
    templateId: string;
    data: unknown;
    metadata: DocumentMetadata;
    options: PrintOptions;
}

/**
 * Менеджер предпросмотра печати
 * 
 * Этот компонент слушает глобальные события открытия предпросмотра
 * и управляет отображением модального окна.
 */
export const PrintPreviewManager: React.FC = () => {
    const [previewState, setPreviewState] = useState<{
        isOpen: boolean;
        templateId: string;
        data: unknown;
        metadata: DocumentMetadata;
        options: PrintOptions;
    } | null>(null);

    useEffect(() => {
        const handleOpenPreview = (event: Event) => {
            const customEvent = event as CustomEvent<PrintPreviewEvent>;
            const { templateId, data, metadata, options } = customEvent.detail;

            setPreviewState({
                isOpen: true,
                templateId,
                data,
                metadata,
                options,
            });
        };

        window.addEventListener('openPrintPreview', handleOpenPreview);

        return () => {
            window.removeEventListener('openPrintPreview', handleOpenPreview);
        };
    }, []);

    const handleClose = () => {
        setPreviewState(null);
    };

    const handlePrint = () => {
        console.log('[PrintPreviewManager] Initiating print...');
    };

    if (!previewState) {
        return null;
    }

    return (
        <PrintPreview
            isOpen={previewState.isOpen}
            templateId={previewState.templateId}
            data={previewState.data}
            metadata={previewState.metadata}
            options={previewState.options}
            onClose={handleClose}
            onPrint={handlePrint}
        />
    );
};
