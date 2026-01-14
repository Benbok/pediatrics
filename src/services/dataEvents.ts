/**
 * Централизованная система событий для уведомления об изменениях данных
 * Используется для автоматической инвалидации кеша после CRUD операций
 */

type DataType = 'medications' | 'diseases' | 'users' | 'patients' | 'all';
type EventType = 'created' | 'updated' | 'deleted';

interface DataChangeEvent {
    dataType: DataType;
    eventType: EventType;
    id?: number;
}

type DataChangeListener = (event: DataChangeEvent) => void;

class DataEventEmitter {
    private listeners: Set<DataChangeListener> = new Set();

    /**
     * Подписаться на события изменения данных
     */
    subscribe(listener: DataChangeListener): () => void {
        this.listeners.add(listener);
        // Возвращаем функцию отписки
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Уведомить всех подписчиков об изменении данных
     */
    emit(event: DataChangeEvent): void {
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('[DataEvents] Listener error:', error);
            }
        });
    }

    /**
     * Удобные методы для уведомления о конкретных событиях
     */
    notifyCreated(dataType: DataType, id?: number): void {
        this.emit({ dataType, eventType: 'created', id });
    }

    notifyUpdated(dataType: DataType, id?: number): void {
        this.emit({ dataType, eventType: 'updated', id });
    }

    notifyDeleted(dataType: DataType, id?: number): void {
        this.emit({ dataType, eventType: 'deleted', id });
    }
}

// Singleton экземпляр
export const dataEvents = new DataEventEmitter();
