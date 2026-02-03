import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '../services/logger';

/**
 * Лимит одновременно открытых форм приема
 * Рекомендуется 2: основной пациент + срочный случай
 */
export const MAX_VISIT_TABS = 2;

/**
 * Тип вкладки
 */
export type TabType = 'visit-form' | 'other';

/**
 * Метаданные вкладки
 */
export interface TabMetadata {
    childId?: number;
    childName?: string;
    visitId?: number | null;
}

/**
 * Данные вкладки
 */
export interface TabData {
    id: string;
    type: TabType;
    route: string;
    label: string;
    isDirty: boolean;
    metadata?: TabMetadata;
    createdAt: number;
}

/**
 * Интерфейс контекста вкладок
 */
interface TabsContextType {
    tabs: TabData[];
    activeTabId: string | null;
    
    // Методы управления вкладками
    openTab: (tabData: Omit<TabData, 'createdAt'>) => boolean;
    closeTab: (tabId: string) => void;
    setActiveTab: (tabId: string) => void;
    
    // Методы для работы с состоянием "грязности"
    markDirty: (tabId: string, isDirty: boolean) => void;
    
    // Геттеры
    getTab: (tabId: string) => TabData | undefined;
    getVisitTabs: () => TabData[];
    canOpenVisitTab: () => boolean;
    
    // Модальные окна
    showMaxTabsWarning: boolean;
    setShowMaxTabsWarning: (show: boolean) => void;
    pendingTabData: Omit<TabData, 'createdAt'> | null;
    setPendingTabData: (data: Omit<TabData, 'createdAt'> | null) => void;
}

const STORAGE_KEY = 'open_tabs';

const TabsContext = createContext<TabsContextType | undefined>(undefined);

/**
 * Генерация уникального ID вкладки для формы приема
 */
export const generateVisitTabId = (childId: number, visitId?: number | null): string => {
    return visitId ? `visit-${childId}-${visitId}` : `visit-${childId}-new`;
};

/**
 * Провайдер контекста вкладок
 */
export const TabsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Состояние вкладок - восстанавливаем из localStorage при старте
    const [tabs, setTabs] = useState<TabData[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Ensure all tabs have the required properties
                return parsed.map((tab: any) => ({
                    ...tab,
                    createdAt: tab.createdAt || Date.now()
                }));
            }
        } catch (error) {
            logger.error('[TabsContext] Failed to restore tabs from localStorage', { error });
        }
        return [];
    });
    
    const [activeTabId, setActiveTabId] = useState<string | null>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.length > 0) {
                    // Return the ID of the last tab as the active one
                    return parsed[parsed.length - 1]?.id || null;
                }
            }
        } catch (error) {
            logger.error('[TabsContext] Failed to restore active tab from localStorage', { error });
        }
        return null;
    });
    const [showMaxTabsWarning, setShowMaxTabsWarning] = useState(false);
    const [pendingTabData, setPendingTabData] = useState<Omit<TabData, 'createdAt'> | null>(null);
    
    // Сохранение в localStorage при изменении вкладок
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
        } catch (error) {
            logger.error('[TabsContext] Failed to save tabs to localStorage', { error });
        }
    }, [tabs]);
    
    // Обновление активной вкладки при изменении роута
    useEffect(() => {
        const currentPath = location.pathname;
        const matchingTab = tabs.find(t => t.route === currentPath);
        
        // Если текущий путь соответствует какой-то вкладке, делаем её активной
        if (matchingTab) {
            setActiveTabId(matchingTab.id);
        }
        // Если нет активной вкладки, но есть открытые вкладки, 
        // устанавливаем последнюю как активную (но не навигируем)
        else if (tabs.length > 0 && !activeTabId) {
            const lastTab = tabs[tabs.length - 1];
            setActiveTabId(lastTab.id);
        }
        // ВАЖНО: Не делаем принудительную навигацию к активной вкладке,
        // если пользователь находится на другой странице
    }, [location.pathname, tabs, activeTabId]);


    
    /**
     * Получить только вкладки форм приема
     */
    const getVisitTabs = useCallback((): TabData[] => {
        return tabs.filter(t => t.type === 'visit-form');
    }, [tabs]);
    
    /**
     * Проверить, можно ли открыть новую вкладку формы приема
     */
    const canOpenVisitTab = useCallback((): boolean => {
        const visitTabs = getVisitTabs();
        return visitTabs.length < MAX_VISIT_TABS;
    }, [getVisitTabs]);
    
    /**
     * Открыть новую вкладку
     * @returns true если вкладка успешно открыта, false если достигнут лимит
     */
    const openTab = useCallback((tabData: Omit<TabData, 'createdAt'>): boolean => {
        // Проверяем, не открыта ли уже эта вкладка
        const existing = tabs.find(t => t.id === tabData.id);
        if (existing) {
            setActiveTabId(existing.id);
            // Навигируем к существующей вкладке
            if (existing.route !== location.pathname) {
                navigate(existing.route);
            }
            logger.info('[TabsContext] Tab already exists, activating', { tabId: tabData.id });
            return true;
        }
        
        // Проверяем лимит для форм приема
        if (tabData.type === 'visit-form') {
            const visitTabs = getVisitTabs();
            
            if (visitTabs.length >= MAX_VISIT_TABS) {
                logger.warn('[TabsContext] Max visit tabs limit reached', { 
                    current: visitTabs.length, 
                    max: MAX_VISIT_TABS 
                });
                // Сохраняем данные ожидающей вкладки и показываем предупреждение
                setPendingTabData(tabData);
                setShowMaxTabsWarning(true);
                return false;
            }
        }
        
        // Создаем новую вкладку
        const newTab: TabData = {
            ...tabData,
            createdAt: Date.now()
        };
        
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        
        logger.info('[TabsContext] Tab opened', { tabId: newTab.id, label: newTab.label });
        return true;
    }, [tabs, getVisitTabs, location.pathname, navigate]);
    
    /**
     * Закрыть вкладку
     */
    const closeTab = useCallback((tabId: string): void => {
        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== tabId);
            
            // Если закрываем активную вкладку, сбрасываем activeTabId
            if (activeTabId === tabId) {
                if (newTabs.length > 0) {
                    // Устанавливаем последнюю оставшуюся вкладку как активную,
                    // но НЕ навигируем к ней автоматически
                    setActiveTabId(newTabs[newTabs.length - 1].id);
                } else {
                    setActiveTabId(null);
                }
            }
            
            logger.info('[TabsContext] Tab closed', { tabId });
            return newTabs;
        });
    }, [activeTabId]);
    
    /**
     * Установить активную вкладку
     */
    const setActiveTab = useCallback((tabId: string): void => {
        const tab = tabs.find(t => t.id === tabId);
        if (tab) {
            setActiveTabId(tabId);
            if (tab.route !== location.pathname) {
                navigate(tab.route);
            }
        }
    }, [tabs, location.pathname, navigate]);
    
    /**
     * Пометить вкладку как "грязную" (с несохраненными изменениями)
     */
    const markDirty = useCallback((tabId: string, isDirty: boolean): void => {
        setTabs(prev => prev.map(t => 
            t.id === tabId ? { ...t, isDirty } : t
        ));
    }, []);
    
    /**
     * Получить данные вкладки по ID
     */
    const getTab = useCallback((tabId: string): TabData | undefined => {
        return tabs.find(t => t.id === tabId);
    }, [tabs]);
    
    const value: TabsContextType = {
        tabs,
        activeTabId,
        openTab,
        closeTab,
        setActiveTab,
        markDirty,
        getTab,
        getVisitTabs,
        canOpenVisitTab,
        showMaxTabsWarning,
        setShowMaxTabsWarning,
        pendingTabData,
        setPendingTabData
    };
    
    return (
        <TabsContext.Provider value={value}>
            {children}
        </TabsContext.Provider>
    );
};

/**
 * Хук для использования контекста вкладок
 */
export const useTabs = (): TabsContextType => {
    const context = useContext(TabsContext);
    if (!context) {
        throw new Error('useTabs must be used within a TabsProvider');
    }
    return context;
};

/**
 * Хук-помощник для работы с вкладкой формы приема
 */
export const useVisitTab = (childId: number, childName: string, visitId?: number | null) => {
    const { openTab, closeTab, markDirty, getTab, canOpenVisitTab } = useTabs();
    
    const tabId = generateVisitTabId(childId, visitId);
    const route = visitId 
        ? `/patients/${childId}/visits/${visitId}` 
        : `/patients/${childId}/visits/new`;
    
    const registerTab = useCallback((): boolean => {
        return openTab({
            id: tabId,
            type: 'visit-form',
            route,
            label: `Прием: ${childName}`,
            isDirty: false,
            metadata: {
                childId,
                childName,
                visitId
            }
        });
    }, [openTab, tabId, route, childName, childId, visitId]);
    
    const unregisterTab = useCallback((): void => {
        const tab = getTab(tabId);
        // Закрываем только если нет несохраненных изменений
        if (tab && !tab.isDirty) {
            closeTab(tabId);
        }
    }, [closeTab, getTab, tabId]);
    
    const setDirty = useCallback((isDirty: boolean): void => {
        markDirty(tabId, isDirty);
    }, [markDirty, tabId]);
    
    const currentTab = getTab(tabId);
    
    return {
        tabId,
        registerTab,
        unregisterTab,
        setDirty,
        isDirty: currentTab?.isDirty ?? false,
        canOpen: canOpenVisitTab()
    };
};
