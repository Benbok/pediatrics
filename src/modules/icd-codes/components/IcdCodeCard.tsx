import React from 'react';
import { IcdCode } from '../../../types';
import { FileText, ExternalLink } from 'lucide-react';

interface IcdCodeCardProps {
    code: IcdCode;
    onClick?: () => void;
}

export const IcdCodeCard: React.FC<IcdCodeCardProps> = ({ code, onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`
                p-5 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800
                transition-all duration-200 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700
                cursor-pointer group
                ${onClick ? 'hover:scale-[1.02] active:scale-[0.98]' : ''}
            `}
        >
            <div className="flex items-start gap-4">
                <div className="p-2.5 bg-primary-100 dark:bg-primary-900/40 rounded-xl group-hover:bg-primary-200 dark:group-hover:bg-primary-900/60 transition-colors">
                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg font-bold text-sm font-mono">
                            {code.code}
                        </span>
                        {onClick && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ExternalLink className="w-3 h-3" />
                                Перейти к заболеванию
                            </span>
                        )}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                        {code.name}
                    </h3>
                </div>
            </div>
        </div>
    );
};
