import { ChildProfile } from './types';

declare global {
    interface Window {
        electronAPI: {
            // ... (существующие методы остаются без изменений)
            // SYSTEM API
            openExternalPath: (path: string) => Promise<string>;
            openPdfAtPage: (path: string, page: number) => Promise<{ success: boolean }>;
            readPdfFile: (path: string) => Promise<Uint8Array>;
            // Добавьте сюда остальные методы, если нужна полная типизация
            [key: string]: any;
        };
    }
}

// Типы для импорта JSON модулей
declare module '*.json' {
    const value: any;
    export default value;
}

export { };
