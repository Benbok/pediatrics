import React, { ReactNode } from 'react';
import { ChevronLeft, Calendar, Clock } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import type { ChildProfile } from '../types';
import { getFormattedAge } from '../utils/ageUtils';

interface PatientModuleHeaderProps {
    child: ChildProfile;
    /** Module title, e.g. "Питание" or "Вакцинация" */
    title: string;
    /** Icon element rendered inside the colored icon box */
    icon: ReactNode;
    /** Tailwind bg class for the icon box, e.g. "bg-emerald-600" */
    iconBgClass?: string;
    /** Tailwind shadow class for the icon box, e.g. "shadow-emerald-500/25" */
    iconShadowClass?: string;
    /** Called when the Back button is clicked */
    onBack: () => void;
    /** Optional badge shown next to the Back button (e.g. progress badge) */
    badge?: ReactNode;
    /** Optional action buttons rendered on the right side of the top bar */
    actions?: ReactNode;
}

export const PatientModuleHeader: React.FC<PatientModuleHeaderProps> = ({
    child,
    title,
    icon,
    iconBgClass = 'bg-slate-600',
    iconShadowClass = 'shadow-slate-500/25',
    onBack,
    badge,
    actions,
}) => {
    const formattedAge = getFormattedAge(child.birthDate);
    const formattedBirth = new Date(child.birthDate).toLocaleDateString('ru-RU');
    const fullName = [child.surname, child.name, child.patronymic].filter(Boolean).join(' ');
    const genderLabel = child.gender === 'male' ? 'Мальчик' : 'Девочка';
    const genderClass =
        child.gender === 'male'
            ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
            : 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900';

    return (
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-900/5">
            {/* Top Row: Navigation & Actions */}
            <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        onClick={onBack}
                        className="rounded-xl h-10 px-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        Назад
                    </Button>
                    {badge && (
                        <>
                            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                            {badge}
                        </>
                    )}
                </div>
                {actions && (
                    <div className="flex items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>

            {/* Bottom Row: Module Info & Patient Details */}
            <div className="px-5 py-4 flex items-center justify-between min-w-0 gap-4 flex-wrap">
                {/* Left: Coloured icon + Module title + Patient name */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div
                        className={`flex-shrink-0 w-12 h-12 rounded-2xl ${iconBgClass} flex items-center justify-center shadow-lg ${iconShadowClass}`}
                    >
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                            {title}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                Пациент:
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {fullName}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right: Birthdate / Age / Gender pill */}
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {formattedBirth}
                        </span>
                    </div>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {formattedAge}
                        </span>
                    </div>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
                    <Badge variant="default" className={`text-xs font-bold ${genderClass}`}>
                        {genderLabel}
                    </Badge>
                </div>
            </div>
        </div>
    );
};
