import type { DocumentMetadata, PrintOptions } from './types';

export interface PrintPreviewEventPayload {
    templateId: string;
    data: unknown;
    metadata: DocumentMetadata;
    options: PrintOptions;
}

type Handler = (payload: PrintPreviewEventPayload) => void;

class PrintEventBus {
    private handlers = new Set<Handler>();

    on(handler: Handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    emit(payload: PrintPreviewEventPayload) {
        for (const handler of this.handlers) {
            handler(payload);
        }
    }
}

export const printEventBus = new PrintEventBus();

