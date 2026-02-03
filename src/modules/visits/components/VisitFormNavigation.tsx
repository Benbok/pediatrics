import React, { useMemo } from 'react';
import { LucideIcon } from 'lucide-react';

export interface NavigationSection {
    id: string;
    label: string;
    icon: LucideIcon;
    isComplete?: boolean;
    isVisible?: boolean;
}

interface VisitFormNavigationProps {
    sections: NavigationSection[];
    activeSection: string;
    onNavigate: (sectionId: string) => void;
}

export const VisitFormNavigation: React.FC<VisitFormNavigationProps> = ({
    sections,
    activeSection,
    onNavigate,
}) => {
    const visibleSections = useMemo(
        () => sections.filter(s => s.isVisible !== false),
        [sections]
    );
    const completedCount = useMemo(
        () => visibleSections.filter(s => s.isComplete).length,
        [visibleSections]
    );
    const progressPercent = useMemo(
        () => (visibleSections.length ? (completedCount / visibleSections.length) * 100 : 0),
        [completedCount, visibleSections.length]
    );

    return (
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[24px] border border-slate-200/50 dark:border-slate-800/50 shadow-lg shadow-slate-900/5">
            <nav
                className="flex items-center gap-1 px-5 py-3 flex-wrap"
                aria-label="Навигация по форме"
            >
                    {visibleSections.map((section) => {
                        const Icon = section.icon;
                        const isActive = activeSection === section.id;

                        return (
                            <button
                                key={section.id}
                                onClick={() => onNavigate(section.id)}
                                className={`
                                    relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg whitespace-nowrap
                                    transition-all duration-200 flex-shrink-0
                                    ${isActive
                                        ? 'bg-blue-600 !text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                                    }
                                `}
                                aria-label={section.label}
                                aria-current={isActive ? 'true' : undefined}
                            >
                                <Icon
                                    className={`w-3.5 h-3.5 ${isActive ? '!text-white' : ''}`}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                                <span className={`text-xs font-semibold hidden sm:inline-block ${isActive ? '!text-white' : ''}`}>
                                    {section.label}
                                </span>

                                {section.isComplete && !isActive && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-slate-900" />
                                )}
                            </button>
                        );
                    })}

                    {/* Progress indicator at the end */}
                    <div className="flex items-center gap-3 ml-auto pl-4 border-l border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Прогресс
                            </span>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                {completedCount}/{visibleSections.length}
                            </span>
                        </div>
                        <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                </nav>
            </div>
    );
};
