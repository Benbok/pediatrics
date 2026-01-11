import React from 'react';
import { Users, Calendar, Activity, AlertCircle, Syringe, Clock, MapPin, ChevronRight, Bookmark } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const Dashboard: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Рабочий стол</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Обзор текущих показателей и задач</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" className="hidden md:flex">
                        Настройки вида
                    </Button>
                    <Badge variant="primary" className="px-3 py-1">
                        Сегодня: {new Date().toLocaleDateString('ru-RU')}
                    </Badge>
                </div>
            </header>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Пациенты сегодня', value: '12', icon: Users, variant: 'primary' },
                    { label: 'Вакцинации', value: '5', icon: Syringe, variant: 'teal' },
                    { label: 'Отклонения', value: '2', icon: AlertCircle, variant: 'danger' },
                    { label: 'Часы приема', value: '08:00 - 16:00', icon: Clock, variant: 'indigo' },
                ].map((stat, i) => (
                    <Card key={i} className="hover:shadow-lg transition-shadow duration-300 overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <div className={`p-3 rounded-xl transition-colors duration-300 ${stat.variant === 'primary' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' :
                                    stat.variant === 'teal' ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400' :
                                        stat.variant === 'danger' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                                            'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                <stat.icon size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</span>
                        </div>
                        <h3 className="text-slate-500 dark:text-slate-400 font-semibold mt-4 text-sm uppercase tracking-wider">{stat.label}</h3>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Appointments List */}
                <Card className="lg:col-span-2 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary-600" />
                            Ближайшие приемы
                        </h2>
                        <Button variant="ghost" size="sm" className="text-primary-600 hover:text-primary-700">
                            Все приемы <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {[
                            { name: 'Иванов Петя', age: '3 мес', note: 'Плановый осмотр + АКДС-1', time: '14:30', room: '204', initial: 'И', color: 'bg-primary-100 text-primary-700' },
                            { name: 'Сидорова Аня', age: '1 год', note: 'Реакция Манту', time: '15:00', room: '204', initial: 'С', color: 'bg-teal-100 text-teal-700' },
                            { name: 'Кузнецов Максим', age: '6 лет', note: 'Справка в школу', time: '15:45', room: '201', initial: 'К', color: 'bg-indigo-100 text-indigo-700' },
                        ].map((apt, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                                <div className={`w-12 h-12 rounded-full ${apt.color} flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-transform`}>
                                    {apt.initial}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-900 dark:text-white">{apt.name} <span className="text-slate-400 dark:text-slate-500 font-medium text-sm">({apt.age})</span></h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                        <Activity className="w-3.5 h-3.5" /> {apt.note}
                                    </p>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1">
                                    <Badge variant="default" className="font-bold tabular-nums">
                                        {apt.time}
                                    </Badge>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> Каб. {apt.room}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Notes and Quick Tasks */}
                <div className="space-y-6">
                    <Card className="shadow-sm border-primary-100 dark:border-primary-900/30">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                            <Bookmark className="w-5 h-5 text-primary-600" />
                            Заметки
                        </h2>
                        <textarea
                            className="w-full h-40 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 border focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 resize-none transition-all outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm"
                            placeholder="Запишите важные мысли на сегодня..."
                        />
                        <Button className="w-full mt-4" size="md">
                            Сохранить заметку
                        </Button>
                    </Card>

                    <Card className="bg-gradient-to-br from-primary-600 to-indigo-700 text-white border-transparent">
                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                            Статистика за неделю
                        </h3>
                        <p className="text-primary-100 text-sm leading-relaxed mb-4">
                            Принято 68 пациентов, проведено 24 вакцинации. Положительная динамика по плановым осмотрам.
                        </p>
                        <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-white w-3/4 shadow-sm" />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
