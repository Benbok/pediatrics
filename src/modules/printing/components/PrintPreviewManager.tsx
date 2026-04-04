import React, { useState, useEffect } from 'react';
import { PrintPreview } from './PrintPreview';
import { DocumentMetadata, PrintOptions } from '../types';
import { printEventBus, PrintPreviewEventPayload } from '../printEventBus';

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
        const cleanup = printEventBus.on((payload: PrintPreviewEventPayload) => {
            const { templateId, data, metadata, options } = payload;
            setPreviewState({ isOpen: true, templateId, data, metadata, options });
        });
        return () => { cleanup(); };
    }, []);

    const handleClose = () => {
        setPreviewState(null);
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
            onPrint={() => {}}
        />
    );
};
