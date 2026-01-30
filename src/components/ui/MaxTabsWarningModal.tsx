import React from 'react';
import { X, AlertCircle, ExternalLink, XCircle, FileText } from 'lucide-react';
import { Button } from './Button';
import { TabData, MAX_VISIT_TABS } from '../../context/TabsContext';

interface MaxTabsWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    openTabs: TabData[];
    onNavigateToTab: (tabId: string) => void;
    onCloseTab: (tabId: string) => void;
}

export const MaxTabsWarningModal: React.FC<MaxTabsWarningModalProps> = ({
    isOpen,
    onClose,
    openTabs,
    onNavigateToTab,
    onCloseTab,
}) => {
    if (!isOpen) return null;

    const visitTabs = openTabs.filter(t => t.type === 'visit-form');

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        >
            <div 
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 bg-blue-50 dark:bg-blue-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl">
                            <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                                Достигнут лимит открытых приемов
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Максимум {MAX_VISIT_TABS} формы приема одновременно
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-slate-700 dark:text-slate-300 mb-4">
                        Вы можете работать максимум с {MAX_VISIT_TABS} формами приема одновременно. 
                        Закройте или сохраните одну из открытых форм, чтобы открыть новую.
                    </p>

                    {/* List of open tabs */}
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                            Открытые формы приема:
                        </p>
                        {visitTabs.map((tab) => (
                            <div 
                                key={tab.id}
                                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl"
                            >
                                <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg">
                                    <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                        {tab.label}
                                    </p>
                                    {tab.isDirty && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            Есть несохраненные изменения
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            onNavigateToTab(tab.id);
                                            onClose();
                                        }}
                                        className="p-2 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-lg transition-colors text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"
                                        title="Перейти к форме"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onCloseTab(tab.id)}
                                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                                        title="Закрыть форму"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <Button
                        variant="primary"
                        onClick={onClose}
                        className="min-w-[120px]"
                    >
                        Понятно
                    </Button>
                </div>
            </div>
        </div>
    );
};
