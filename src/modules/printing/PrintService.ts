import { templateRegistry } from './registry';
import {
    DocumentMetadata,
    PrintOptions,
    PrintResult,
    PDFExportOptions,
    PDFExportResult,
} from './types';
import { logger } from '../../services/logger';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PrintTemplate } from './types';
import { printEventBus } from './printEventBus';

/**
 * Основной сервис управления печатью документов
 * 
 * Предоставляет API для печати, предпросмотра и экспорта документов.
 * Работает с зарегистрированными шаблонами через TemplateRegistry.
 */
class PrintService {
    private currentPrintWindow: Window | null = null;

    private getValidatedTemplateAndOptions<TData>(
        templateId: string,
        data: TData,
        options?: Partial<PrintOptions>
    ):
        | { success: true; template: PrintTemplate<TData>; finalOptions: PrintOptions }
        | { success: false; error: string } {
        const template = templateRegistry.get<TData>(templateId);

        if (!template) {
            return {
                success: false,
                error: `Template "${templateId}" not found in registry`,
            };
        }

        if (!template.validateData(data)) {
            return {
                success: false,
                error: 'Data validation failed for the template',
            };
        }

        const finalOptions: PrintOptions = {
            ...template.defaultOptions,
            ...options,
        };

        return { success: true, template, finalOptions };
    }

    /**
     * Печатает документ
     * 
     * @param templateId - ID шаблона документа
     * @param data - Данные для печати
     * @param metadata - Метаданные документа
     * @param options - Настройки печати (опционально)
     * @returns Promise с результатом печати
     */
    async print<TData>(
        templateId: string,
        data: TData,
        metadata: DocumentMetadata,
        options?: Partial<PrintOptions>
    ): Promise<PrintResult> {
        try {
            const validated = this.getValidatedTemplateAndOptions(templateId, data, options);
            if (validated.success === false) return { success: false, error: validated.error };

            // Вызываем браузерную печать
            await this.invokeBrowserPrint(validated.template, data, metadata, validated.finalOptions);

            return { success: true };
        } catch (error) {
            logger.error('[PrintService] Print error', { error, templateId, metadata });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Открывает предпросмотр документа
     * 
     * @param templateId - ID шаблона документа
     * @param data - Данные для предпросмотра
     * @param metadata - Метаданные документа
     * @param options - Настройки печати (опционально)
     * @returns Promise с результатом
     */
    async preview<TData>(
        templateId: string,
        data: TData,
        metadata: DocumentMetadata,
        options?: Partial<PrintOptions>
    ): Promise<PrintResult> {
        try {
            const validated = this.getValidatedTemplateAndOptions(templateId, data, options);
            if (validated.success === false) return { success: false, error: validated.error };

            // Вызываем событие для открытия модального окна предпросмотра
            this.openPreviewModal(templateId, data, metadata, validated.finalOptions);

            return { success: true };
        } catch (error) {
            logger.error('[PrintService] Preview error', { error, templateId, metadata });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Экспортирует документ в PDF
     * 
     * @param templateId - ID шаблона документа
     * @param data - Данные для экспорта
     * @param metadata - Метаданные документа
     * @param options - Настройки экспорта
     * @returns Promise с Blob PDF файла
     */
    async exportToPDF<TData>(
        templateId: string,
        data: TData,
        metadata: DocumentMetadata,
        options?: Partial<PDFExportOptions>
    ): Promise<PDFExportResult> {
        try {
            const validated = this.getValidatedTemplateAndOptions(templateId, data, options);
            if (validated.success === false) return { success: false, error: validated.error };
            const finalOptions = { ...validated.finalOptions, ...options } as PDFExportOptions;

            // Electron PDF export (main process handles rendering + printToPDF)
            if (window.electronAPI?.exportPDF) {
                const templateCss = Array.isArray(validated.template.styles)
                    ? validated.template.styles.filter(Boolean).join('\n')
                    : (validated.template.styles ?? '');

                const html = renderToStaticMarkup(
                    React.createElement(validated.template.component, {
                        data,
                        metadata,
                        options: finalOptions,
                    })
                );

                const result = await window.electronAPI.exportPDF({
                    templateId,
                    data,
                    metadata,
                    options: finalOptions,
                    html,
                    styles: templateCss,
                });
                // normalize potential older return types
                if (typeof result === 'string') {
                    return { success: true, path: result };
                }
                if (result && typeof result === 'object') {
                    return result as PDFExportResult;
                }
                return { success: false, error: 'Unexpected exportPDF result' };
            }

            logger.warn('[PrintService] PDF export requested outside Electron', { templateId, metadata, options: finalOptions });
            return {
                success: false,
                error: 'PDF export is only available in Electron environment',
            };
        } catch (error) {
            logger.error('[PrintService] exportToPDF error', { error, templateId, metadata });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Вызывает встроенную браузерную печать
     * 
     * @private
     */
    private async invokeBrowserPrint<TData>(
        template: PrintTemplate<TData>,
        data: TData,
        metadata: DocumentMetadata,
        options: PrintOptions
    ): Promise<void> {
        const TemplateComponent = template.component;

        const templateCss = Array.isArray(template.styles)
            ? template.styles.filter(Boolean).join('\n')
            : (template.styles ?? '');

        const html = renderToStaticMarkup(
            React.createElement(TemplateComponent, { data, metadata, options })
        );

        // Создаем временное окно с контентом для печати
        const printWindow = window.open('', '_blank', 'width=900,height=700');

        if (!printWindow) {
            throw new Error('Failed to open print window. Please allow popups.');
        }

        this.currentPrintWindow = printWindow;

        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${metadata.title}</title>
          <style>
            @media print {
              @page {
                size: ${options.pageSize} ${options.orientation};
                margin: ${options.margins?.top || 20}mm ${options.margins?.right || 15}mm 
                        ${options.margins?.bottom || 20}mm ${options.margins?.left || 15}mm;
              }
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
            }
            /* Template styles (inlined) */
            ${templateCss}
          </style>
        </head>
        <body>
          <div id="print-root">${html}</div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);

        printWindow.document.close();
    }

    /**
     * Открывает модальное окно предпросмотра
     * 
     * @private
     */
    private openPreviewModal<TData>(
        templateId: string,
        data: TData,
        metadata: DocumentMetadata,
        options: PrintOptions
    ): void {
        printEventBus.emit({ templateId, data, metadata, options });
    }

    /**
     * Закрывает текущее окно печати
     */
    closePrintWindow(): void {
        if (this.currentPrintWindow && !this.currentPrintWindow.closed) {
            this.currentPrintWindow.close();
            this.currentPrintWindow = null;
        }
    }

    /**
     * Получает список всех доступных шаблонов
     */
    getAvailableTemplates() {
        return templateRegistry.getAll();
    }

    /**
     * Проверяет доступность шаблона
     */
    isTemplateAvailable(templateId: string): boolean {
        return templateRegistry.has(templateId);
    }
}

/**
 * Глобальный экземпляр сервиса печати
 */
export const printService = new PrintService();
