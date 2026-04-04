import { ReactNode } from 'react';

/**
 * Базовый интерфейс для любого печатаемого документа
 */
export interface PrintableDocument {
    /** Идентификатор типа документа */
    type: string;
    /** Данные документа (типизируются в конкретных шаблонах) */
    data: unknown;
    /** Метаданные документа */
    metadata: DocumentMetadata;
}

/**
 * Метаданные документа
 */
export interface DocumentMetadata {
    [key: string]: unknown;
    /** Название документа */
    title: string;
    /** Дата создания */
    createdAt: Date;
    /** Автор документа */
    author?: string;
    /** Организация-создатель */
    organization?: string;
    /** Дополнительные метаданные */
    custom?: Record<string, unknown>;
}

/**
 * Размеры страницы
 */
export type PageSize = 'A4' | 'A5' | 'A6' | 'Letter';

/**
 * Ориентация страницы
 */
export type PageOrientation = 'portrait' | 'landscape';

/**
 * Отступы страницы (в мм)
 */
export interface PageMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

/**
 * Настройки печати
 */
export interface PrintOptions {
    /** Ориентация страницы */
    orientation: PageOrientation;
    /** Размер страницы */
    pageSize: PageSize;
    /** Отступы страницы */
    margins?: PageMargins;
    /** Показывать ли заголовок */
    showHeader?: boolean;
    /** Показывать ли подвал */
    showFooter?: boolean;
    /** Пользовательские CSS классы */
    customClasses?: string[];
    /** Масштаб (0.5 - 2.0) */
    scale?: number;
}

/**
 * Пропсы для компонента шаблона печати
 */
export interface PrintTemplateProps<TData = unknown> {
    /** Данные для рендеринга */
    data: TData;
    /** Метаданные документа */
    metadata: DocumentMetadata;
    /** Настройки печати */
    options: PrintOptions;
}

/**
 * Функция валидации данных для шаблона
 */
export type DataValidator<TData> = (data: unknown) => data is TData;

/**
 * Интерфейс шаблона печати
 */
export interface PrintTemplate<TData = unknown> {
    /** Уникальный идентификатор шаблона */
    id: string;
    /** Название шаблона */
    name: string;
    /** Описание шаблона */
    description: string;
    /** React компонент для рендеринга */
    component: React.ComponentType<PrintTemplateProps<TData>>;
    /**
     * CSS-стили для печати/предпросмотра, которые можно инлайнить в окно печати.
     *
     * Важно: при `renderToStaticMarkup` импортированные CSS файлы внутри компонента
     * не попадут в новое окно. Для режима прямой печати через `invokeBrowserPrint`
     * используйте это поле, чтобы передать критичные стили строкой.
     */
    styles?: string | string[];
    /** Настройки печати по умолчанию */
    defaultOptions: PrintOptions;
    /** Функция валидации данных */
    validateData: DataValidator<TData>;
    /** Категория шаблона (для группировки) */
    category?: string;
    /** Иконка шаблона */
    icon?: ReactNode;
}

/**
 * Результат операции печати
 */
export interface PrintResult {
    /** Успешность операции */
    success: boolean;
    /** Сообщение об ошибке */
    error?: string;
}

/**
 * Режим работы модуля печати
 */
export enum PrintMode {
    /** Предпросмотр перед печатью */
    PREVIEW = 'preview',
    /** Прямая печать */
    DIRECT = 'direct',
    /** Экспорт в PDF */
    EXPORT_PDF = 'export_pdf',
}

/**
 * Настройки экспорта в PDF
 */
export interface PDFExportOptions extends PrintOptions {
    /** Имя файла */
    filename?: string;
    /** Качество (1-100) */
    quality?: number;
    /** Сжатие */
    compress?: boolean;
}

/**
 * Результат экспорта в PDF (Electron-side generation + сохранение/открытие).
 */
export interface PDFExportResult {
    success: boolean;
    path?: string;
    error?: string;
}
