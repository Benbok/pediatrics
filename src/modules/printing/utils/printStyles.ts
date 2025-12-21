import { PageSize, PageOrientation, PageMargins, PrintOptions } from '../types';

/**
 * Генерирует CSS стили для печати на основе настроек
 */
export function generatePrintStyles(options: PrintOptions): string {
    const { pageSize, orientation, margins, scale } = options;

    const marginStyles = margins
        ? `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`
        : '20mm 15mm 20mm 15mm';

    return `
    @media print {
      @page {
        size: ${pageSize} ${orientation};
        margin: ${marginStyles};
      }

      body {
        margin: 0;
        padding: 0;
        ${scale ? `transform: scale(${scale});` : ''}
        ${scale ? `transform-origin: top left;` : ''}
      }

      /* Скрыть элементы UI */
      .no-print,
      button,
      nav,
      header.app-header,
      footer.app-footer {
        display: none !important;
      }

      /* Разрывы страниц */
      .page-break {
        page-break-after: always;
        break-after: page;
      }

      .page-break-before {
        page-break-before: always;
        break-before: page;
      }

      .avoid-break {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      /* Таблицы */
      table {
        page-break-inside: auto;
        break-inside: auto;
      }

      tr {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      thead {
        display: table-header-group;
      }

      tfoot {
        display: table-footer-group;
      }

      /* Убрать фоновые изображения и цвета для экономии чернил */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* Оптимизация шрифтов */
      body {
        font-family: 'Times New Roman', Times, serif;
        font-size: 12pt;
        line-height: 1.4;
        color: #000;
      }

      h1 { font-size: 18pt; }
      h2 { font-size: 16pt; }
      h3 { font-size: 14pt; }
      h4 { font-size: 12pt; }

      /* Ссылки */
      a {
        text-decoration: underline;
        color: #000;
      }

      a[href]:after {
        content: "";
      }
    }

    @media screen {
      .print-only {
        display: none;
      }
    }
  `;
}

/**
 * Применяет стили печати к документу
 */
export function applyPrintStyles(options: PrintOptions): HTMLStyleElement {
    const styleElement = document.createElement('style');
    styleElement.id = 'print-styles';
    styleElement.textContent = generatePrintStyles(options);
    document.head.appendChild(styleElement);
    return styleElement;
}

/**
 * Удаляет примененные стили печати
 */
export function removePrintStyles(): void {
    const styleElement = document.getElementById('print-styles');
    if (styleElement) {
        styleElement.remove();
    }
}

/**
 * Размеры страниц в пикселях (при 96 DPI)
 */
export const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
    A4: { width: 794, height: 1123 },
    A5: { width: 559, height: 794 },
    A6: { width: 397, height: 559 },
    Letter: { width: 816, height: 1056 },
};

/**
 * Получает размеры страницы с учетом ориентации
 */
export function getPageDimensions(
    pageSize: PageSize,
    orientation: PageOrientation
): { width: number; height: number } {
    const dimensions = PAGE_SIZES[pageSize];

    if (orientation === 'landscape') {
        return {
            width: dimensions.height,
            height: dimensions.width,
        };
    }

    return dimensions;
}

/**
 * Конвертирует миллиметры в пиксели
 */
export function mmToPx(mm: number, dpi: number = 96): number {
    return (mm * dpi) / 25.4;
}

/**
 * Конвертирует пиксели в миллиметры
 */
export function pxToMm(px: number, dpi: number = 96): number {
    return (px * 25.4) / dpi;
}

/**
 * Вычисляет доступную область для контента с учетом отступов
 */
export function getContentArea(
    pageSize: PageSize,
    orientation: PageOrientation,
    margins: PageMargins
): { width: number; height: number } {
    const pageDimensions = getPageDimensions(pageSize, orientation);

    const marginLeft = mmToPx(margins.left);
    const marginRight = mmToPx(margins.right);
    const marginTop = mmToPx(margins.top);
    const marginBottom = mmToPx(margins.bottom);

    return {
        width: pageDimensions.width - marginLeft - marginRight,
        height: pageDimensions.height - marginTop - marginBottom,
    };
}

/**
 * Создает CSS класс для предотвращения разрыва элемента
 */
export const avoidBreakClass = 'avoid-break';

/**
 * Создает CSS класс для принудительного разрыва после элемента
 */
export const pageBreakClass = 'page-break';

/**
 * Создает CSS класс для принудительного разрыва перед элементом
 */
export const pageBreakBeforeClass = 'page-break-before';

/**
 * Создает CSS класс для скрытия при печати
 */
export const noPrintClass = 'no-print';

/**
 * Создает CSS класс для отображения только при печати
 */
export const printOnlyClass = 'print-only';
