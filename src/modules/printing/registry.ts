import { PrintTemplate } from './types';

/**
 * Центральный реестр всех шаблонов печати
 * 
 * Реализует паттерн Registry для управления шаблонами документов.
 * Позволяет регистрировать, получать и управлять шаблонами печати.
 */
class PrintTemplateRegistry {
    private templates = new Map<string, PrintTemplate>();

    /**
     * Регистрирует новый шаблон печати
     * 
     * @param template - Шаблон для регистрации
     * @throws Error если шаблон с таким ID уже зарегистрирован
     */
    register<TData>(template: PrintTemplate<TData>): void {
        if (this.templates.has(template.id)) {
            throw new Error(`Template with id "${template.id}" is already registered`);
        }

        this.templates.set(template.id, template as PrintTemplate);
        console.log(`[PrintRegistry] Registered template: ${template.id} - ${template.name}`);
    }

    /**
     * Получает шаблон по ID
     * 
     * @param templateId - ID шаблона
     * @returns Шаблон или undefined если не найден
     */
    get<TData>(templateId: string): PrintTemplate<TData> | undefined {
        return this.templates.get(templateId) as PrintTemplate<TData> | undefined;
    }

    /**
     * Получает все зарегистрированные шаблоны
     * 
     * @returns Массив всех шаблонов
     */
    getAll(): PrintTemplate[] {
        return Array.from(this.templates.values());
    }

    /**
     * Получает шаблоны по категории
     * 
     * @param category - Категория шаблонов
     * @returns Массив шаблонов в категории
     */
    getByCategory(category: string): PrintTemplate[] {
        return this.getAll().filter(template => template.category === category);
    }

    /**
     * Проверяет, зарегистрирован ли шаблон
     * 
     * @param templateId - ID шаблона
     * @returns true если шаблон зарегистрирован
     */
    has(templateId: string): boolean {
        return this.templates.has(templateId);
    }

    /**
     * Удаляет шаблон из реестра
     * 
     * @param templateId - ID шаблона для удаления
     * @returns true если шаблон был удален, false если не найден
     */
    unregister(templateId: string): boolean {
        const result = this.templates.delete(templateId);
        if (result) {
            console.log(`[PrintRegistry] Unregistered template: ${templateId}`);
        }
        return result;
    }

    /**
     * Очищает весь реестр
     */
    clear(): void {
        this.templates.clear();
        console.log('[PrintRegistry] Cleared all templates');
    }

    /**
     * Получает количество зарегистрированных шаблонов
     */
    get count(): number {
        return this.templates.size;
    }
}

/**
 * Глобальный экземпляр реестра шаблонов
 */
export const templateRegistry = new PrintTemplateRegistry();
