import React from 'react';
import { Users, Calendar, Activity, AlertCircle } from 'lucide-react';

export const Dashboard: React.FC = () => {
    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Обзор</h1>
                <p className="text-slate-500 dark:text-slate-400">Добро пожаловать, Доктор.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Пациенты сегодня', value: '12', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20' },
                    { label: 'Вакцинации', value: '5', icon: SyringeIcon, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/20' },
                    { label: 'Отклонения', value: '2', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/20' },
                    { label: 'Следующий прием', value: '14:30', icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/20' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</span>
                        </div>
                        <h3 className="text-slate-500 dark:text-slate-400 font-medium">{stat.label}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Ближайшие приемы</h2>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">И</div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-900 dark:text-white">Иванов Петя (3 мес)</h4>
                                <p className="text-sm text-slate-500">Плановый осмотр + АКДС-1</p>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-slate-900 dark:text-white">14:30</div>
                                <div className="text-xs text-slate-500">Кабинет 204</div>
                            </div>
                        </div>
                        {/* Mock items */}
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="w-12 h-12 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-bold">С</div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-900 dark:text-white">Сидорова Аня (1 год)</h4>
                                <p className="text-sm text-slate-500">Реакция Манту</p>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-slate-900 dark:text-white">15:00</div>
                                <div className="text-xs text-slate-500">Кабинет 204</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Заметки</h2>
                    <textarea className="w-full h-32 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none resize-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" placeholder="Напишите заметку..." />
                </div>
            </div>
        </div>
    );
};

// Icon helper
function SyringeIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m18 2 4 4" />
            <path d="m17 7 3-3" />
            <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" />
            <path d="m9 11 4 4" />
            <path d="m5 19-3 3" />
            <path d="m14 4 6 6" />
        </svg>
    );
}
