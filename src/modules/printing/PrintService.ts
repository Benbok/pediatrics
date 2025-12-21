import { templateRegistry } from './registry';
import {
    DocumentMetadata,
    PrintOptions,
    PrintResult,
    PrintMode,
    PDFExportOptions,
} from './types';

/**
 * Основной сервис управления печатью документов
 * 
 * Предоставляет API для печати, предпросмотра и экспорта документов.
 * Работает с зарегистрированными шаблонами через TemplateRegistry.
 */
class PrintService {
    private currentPrintWindow: Window | null = null;

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
            const template = templateRegistry.get<TData>(templateId);

            if (!template) {
                return {
                    success: false,
                    error: `Template "${templateId}" not found in registry`,
                };
            }

            // Валидация данных
            if (!template.validateData(data)) {
                return {
                    success: false,
                    error: 'Data validation failed for the template',
                };
            }

            // Объединяем настройки
            const finalOptions: PrintOptions = {
                ...template.defaultOptions,
                ...options,
            };

            // Вызываем браузерную печать
            await this.invokeBrowserPrint(template, data, metadata, finalOptions);

            return { success: true };
        } catch (error) {
            console.error('[PrintService] Print error:', error);
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

            // Вызываем событие для открытия модального окна предпросмотра
            this.openPreviewModal(templateId, data, metadata, finalOptions);

            return { success: true };
        } catch (error) {
            console.error('[PrintService] Preview error:', error);
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
    ): Promise<Blob> {
        const template = templateRegistry.get<TData>(templateId);

        if (!template) {
            throw new Error(`Template "${templateId}" not found in registry`);
        }

        if (!template.validateData(data)) {
            throw new Error('Data validation failed for the template');
        }

        // TODO: Реализовать экспорт в PDF через html2pdf или jspdf
        // Пока заглушка
        throw new Error('PDF export is not implemented yet');
    }

    /**
     * Вызывает встроенную браузерную печать
     * 
     * @private
     */
    private async invokeBrowserPrint<TData>(
        template: any,
        data: TData,
        metadata: DocumentMetadata,
        options: PrintOptions
    ): Promise<void> {
        // Создаем временное окно с контентом для печати
        const printWindow = window.open('', '_blank', 'width=800,height=600');

        if (!printWindow) {
            throw new Error('Failed to open print window. Please allow popups.');
        }

        this.currentPrintWindow = printWindow;

        // Рендерим содержимое (это упрощенная версия, в реальности нужно использовать ReactDOM)
        // В продакшене это должно быть реализовано через отдельный компонент
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
          </style>
        </head>
        <body>
          <div id="print-root"></div>
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
        // Создаем событие для React компонента
        const event = new CustomEvent('openPrintPreview', {
            detail: {
                templateId,
                data,
                metadata,
                options,
            },
        });

        window.dispatchEvent(event);
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
