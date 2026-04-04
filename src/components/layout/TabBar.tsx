import React, { useState } from 'react';
import { X, FileText, AlertCircle, BookOpen, Pill } from 'lucide-react';
import { useTabs, TabData, MODULE_TAB_CONFIGS, ModuleTabType } from '../../context/TabsContext';
import { UnsavedChangesModal, UnsavedChangesResult } from '../ui/UnsavedChangesModal';
import { MaxTabsWarningModal } from '../ui/MaxTabsWarningModal';
import { draftService } from '../../services/draftService';

/** Иконка модульной вкладки по типу */
const MODULE_ICONS: Record<ModuleTabType, React.FC<{ className?: string }>> = {
    medications: Pill,
    diseases: BookOpen,
    'icd-codes': FileText,
};

/**
 * TabBar — панель вкладок.
 * Отображает модульные вкладки (Препараты, База знаний, Коды МКБ)
 * и вкладки форм приёма. Показывается когда открыта хоть одна вкладка.
 */
export const TabBar: React.FC = () => {
    const { 
        tabs, 
        activeTabId, 
        setActiveTab, 
        closeTab, 
        getVisitTabs,
        getModuleTabs,
        requestSave,
        showMaxTabsWarning,
        setShowMaxTabsWarning,
        pendingTabData,
        setPendingTabData
    } = useTabs();
    
    // Состояние для модального окна подтверждения закрытия
    const [tabToClose, setTabToClose] = useState<TabData | null>(null);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    
    const visitTabs = getVisitTabs();
    const moduleTabs = getModuleTabs();
    
    // Не показываем TabBar если нет открытых вкладок
    if (visitTabs.length === 0 && moduleTabs.length === 0) {
        return null;
    }
    
    /**
     * Обработка закрытия вкладки
     */
    const handleCloseClick = (e: React.MouseEvent, tab: TabData) => {
        e.stopPropagation();
        
        if (tab.isDirty) {
            // Показываем модальное окно подтверждения
            setTabToClose(tab);
            setShowUnsavedModal(true);
        } else {
            // Закрываем без подтверждения
            closeTabAndCleanup(tab);
        }
    };
    
    /**
     * Закрытие вкладки с очисткой черновика
     */
    const closeTabAndCleanup = (tab: TabData) => {
        // Удаляем черновик из localStorage
        if (tab.metadata?.childId) {
            const draftKey = draftService.getVisitDraftKey(
                tab.metadata.childId, 
                tab.metadata.visitId
            );
            draftService.removeDraft(draftKey);
        }
        
        closeTab(tab.id);
    };
    
    /**
     * Обработка результата модального окна несохраненных изменений
     */
    const handleUnsavedModalResult = async (result: UnsavedChangesResult) => {
        if (!tabToClose) {
            setShowUnsavedModal(false);
            return;
        }
        
        switch (result) {
            case 'save':
                await requestSave(tabToClose.id);
                closeTab(tabToClose.id);
                break;
            case 'discard':
                closeTabAndCleanup(tabToClose);
                break;
            case 'cancel':
                break;
        }
        
        setTabToClose(null);
        setShowUnsavedModal(false);
    };
    
    /**
     * Обработка навигации к вкладке из модального окна лимита
     */
    const handleNavigateFromMaxModal = (tabId: string) => {
        setActiveTab(tabId);
    };
    
    /**
     * Обработка закрытия вкладки из модального окна лимита
     */
    const handleCloseFromMaxModal = (tabId: string) => {
        const tab = tabs.find(t => t.id === tabId);
        if (tab) {
            if (tab.isDirty) {
                setTabToClose(tab);
                setShowUnsavedModal(true);
            } else {
                closeTabAndCleanup(tab);
            }
        }
    };
    
    /**
     * Закрытие модального окна лимита
     */
    const handleMaxTabsModalClose = () => {
        setShowMaxTabsWarning(false);
        setPendingTabData(null);
    };
    
    /**
     * Получение времени последнего сохранения для модального окна
     */
    const getLastSavedTime = (tab: TabData | null): string | undefined => {
        if (!tab?.metadata?.childId) return undefined;
        
        const draftKey = draftService.getVisitDraftKey(
            tab.metadata.childId,
            tab.metadata.visitId
        );
        const timestamp = draftService.getDraftTimestamp(draftKey);
        
        return timestamp ? draftService.formatDraftTime(timestamp) : undefined;
    };
    
    return (
        <>
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">

                    {/* ── Модульные вкладки (Препараты, База знаний, Коды МКБ) ── */}
                    {moduleTabs.map((tab) => {
                        const moduleConfig = MODULE_TAB_CONFIGS.find(c => c.type === tab.type);
                        const Icon = MODULE_ICONS[tab.type as ModuleTabType] ?? FileText;
                        const isActive = activeTabId === tab.id;
                        return (
                            <div
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
                                    transition-all duration-200 min-w-0 max-w-[200px]
                                    ${isActive
                                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                                    }
                                `}
                                title={`Вернуться: ${tab.label}`}
                            >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span className="text-sm font-medium truncate">{tab.label}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                                    className="p-1 rounded-md transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    title="Закрыть вкладку"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}

                    {/* Разделитель между модульными и вкладками приёма */}
                    {moduleTabs.length > 0 && visitTabs.length > 0 && (
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 flex-shrink-0" />
                    )}

                    {/* ── Вкладки форм приёма ── */}
                    {visitTabs.map((tab) => (
                        <div
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
                                transition-all duration-200 min-w-0 max-w-[250px]
                                ${activeTabId === tab.id 
                                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' 
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }
                            `}
                        >
                            {/* Icon */}
                            <FileText className="w-4 h-4 flex-shrink-0" />
                            
                            {/* Label */}
                            <span className="text-sm font-medium truncate">
                                {tab.label}
                            </span>
                            
                            {/* Dirty indicator */}
                            {tab.isDirty && (
                                <span 
                                    className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0"
                                    title="Есть несохраненные изменения"
                                />
                            )}
                            
                            {/* Close button */}
                            <button
                                onClick={(e) => handleCloseClick(e, tab)}
                                className={`
                                    p-1 rounded-md transition-colors flex-shrink-0
                                    opacity-0 group-hover:opacity-100
                                    hover:bg-slate-200 dark:hover:bg-slate-700
                                    ${tab.isDirty ? 'text-amber-600 hover:text-amber-700' : ''}
                                `}
                                title={tab.isDirty ? 'Закрыть (есть несохраненные изменения)' : 'Закрыть'}
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                    
                    {/* Счётчик вкладок приёма */}
                    {visitTabs.length > 0 && (
                        <div className="flex items-center gap-1 px-2 text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                            <AlertCircle className="w-3 h-3" />
                            <span>{visitTabs.length}/2</span>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Modal for unsaved changes */}
            <UnsavedChangesModal
                isOpen={showUnsavedModal}
                onClose={handleUnsavedModalResult}
                patientName={tabToClose?.metadata?.childName}
                lastSavedTime={getLastSavedTime(tabToClose)}
            />
            
            {/* Modal for max tabs warning */}
            <MaxTabsWarningModal
                isOpen={showMaxTabsWarning}
                onClose={handleMaxTabsModalClose}
                openTabs={tabs}
                onNavigateToTab={handleNavigateFromMaxModal}
                onCloseTab={handleCloseFromMaxModal}
            />
        </>
    );
};
