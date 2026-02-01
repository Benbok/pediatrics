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
        <div className="hidden xl:block shrink-0 w-14">
            <nav
                className="sticky top-32 z-40 flex flex-col gap-1.5 bg-white dark:bg-slate-900 rounded-[20px] shadow-xl border border-slate-200 dark:border-slate-800 p-2"
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
                                relative w-10 h-10 flex items-center justify-center rounded-xl
                                transition-all duration-200 group
                                ${isActive
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300'
                                }
                            `}
                            aria-label={section.label}
                            aria-current={isActive ? 'true' : undefined}
                        >
                            <Icon
                                className="w-5 h-5"
                                strokeWidth={isActive ? 2.5 : 2}
                                stroke={isActive ? '#ffffff' : 'currentColor'}
                            />

                            {section.isComplete && !isActive && (
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" />
                            )}

                            <div
                                className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg
                                           opacity-0 invisible group-hover:opacity-100 group-hover:visible
                                           transition-all duration-150 pointer-events-none whitespace-nowrap
                                           shadow-xl z-[100]"
                            >
                                {section.label}
                                {section.isComplete && (
                                    <span className="ml-1.5 text-green-400">✓</span>
                                )}
                            </div>
                        </button>
                    );
                })}

                <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                    <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-teal-500 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 text-center mt-1">
                        {completedCount}/{visibleSections.length}
                    </div>
                </div>
            </nav>
        </div>
    );
};
