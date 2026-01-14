import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Disease, Medication, User } from '../types';
import { dataEvents } from '../services/dataEvents';

interface DataCacheContextType {
    // Кешированные данные
    diseases: Disease[] | null;
    medications: Medication[] | null;
    users: User[] | null;

    // Состояния загрузки
    isLoadingDiseases: boolean;
    isLoadingMedications: boolean;
    isLoadingUsers: boolean;

    // Методы загрузки
    loadDiseases: (force?: boolean) => Promise<Disease[]>;
    loadMedications: (force?: boolean) => Promise<Medication[]>;
    loadUsers: (force?: boolean) => Promise<User[]>;

    // Инвалидация кеша
    invalidate: (type: 'diseases' | 'medications' | 'users' | 'all') => void;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

export const DataCacheProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [diseases, setDiseases] = useState<Disease[] | null>(null);
    const [medications, setMedications] = useState<Medication[] | null>(null);
    const [users, setUsers] = useState<User[] | null>(null);

    const [isLoadingDiseases, setIsLoadingDiseases] = useState(false);
    const [isLoadingMedications, setIsLoadingMedications] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    const loadDiseases = useCallback(async (force = false): Promise<Disease[]> => {
        // Если данные уже есть и не требуется принудительная загрузка - возвращаем кеш
        if (!force && diseases !== null) {
            return diseases;
        }

        setIsLoadingDiseases(true);
        try {
            const data = await window.electronAPI.getDiseases();
            setDiseases(data);
            return data;
        } catch (error) {
            console.error('[DataCache] Failed to load diseases:', error);
            throw error;
        } finally {
            setIsLoadingDiseases(false);
        }
    }, [diseases]);

    const loadMedications = useCallback(async (force = false): Promise<Medication[]> => {
        // Если данные уже есть и не требуется принудительная загрузка - возвращаем кеш
        if (!force && medications !== null) {
            return medications;
        }

        setIsLoadingMedications(true);
        try {
            const data = await window.electronAPI.getMedications();
            setMedications(data);
            return data;
        } catch (error) {
            console.error('[DataCache] Failed to load medications:', error);
            throw error;
        } finally {
            setIsLoadingMedications(false);
        }
    }, [medications]);

    const loadUsers = useCallback(async (force = false): Promise<User[]> => {
        // Если данные уже есть и не требуется принудительная загрузка - возвращаем кеш
        if (!force && users !== null) {
            return users;
        }

        setIsLoadingUsers(true);
        try {
            const data = await window.electronAPI.getAllUsers();
            setUsers(data);
            return data;
        } catch (error) {
            console.error('[DataCache] Failed to load users:', error);
            throw error;
        } finally {
            setIsLoadingUsers(false);
        }
    }, [users]);

    const invalidate = useCallback((type: 'diseases' | 'medications' | 'users' | 'all') => {
        if (type === 'diseases' || type === 'all') {
            setDiseases(null);
        }
        if (type === 'medications' || type === 'all') {
            setMedications(null);
        }
        if (type === 'users' || type === 'all') {
            setUsers(null);
        }
    }, []);

    // Подписка на события изменения данных для автоматической инвалидации кеша
    useEffect(() => {
        const unsubscribe = dataEvents.subscribe((event) => {
            // Инвалидируем кеш при любом изменении данных
            const supportedTypes = ['diseases', 'medications', 'users', 'all'] as const;
            
            if (event.dataType === 'all') {
                invalidate('all');
            } else if (supportedTypes.includes(event.dataType as any)) {
                invalidate(event.dataType as 'diseases' | 'medications' | 'users');
            }
            // Остальные типы (patients и др.) игнорируем - они не кешируются в DataCacheContext
        });

        return unsubscribe;
    }, [invalidate]);

    return (
        <DataCacheContext.Provider
            value={{
                diseases,
                medications,
                users,
                isLoadingDiseases,
                isLoadingMedications,
                isLoadingUsers,
                loadDiseases,
                loadMedications,
                loadUsers,
                invalidate,
            }}
        >
            {children}
        </DataCacheContext.Provider>
    );
};

export const useDataCache = () => {
    const context = useContext(DataCacheContext);
    if (context === undefined) {
        throw new Error('useDataCache must be used within a DataCacheProvider');
    }
    return context;
};
