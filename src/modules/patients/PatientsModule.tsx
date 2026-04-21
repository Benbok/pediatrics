import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
    UserPlus,
    Search,
    Calendar,
    Weight,
    Users as UsersIcon,
    ChevronRight,
    X
} from 'lucide-react';
import { ChildProfile } from '../../types';
import { useChild } from '../../context/ChildContext';
import { patientService } from '../../services/patient.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export const PatientsModule: React.FC = () => {
    const navigate = useNavigate();
    const { setSelectedChild } = useChild();
    const [children, setChildren] = useState<ChildProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadChildren();
    }, []);

    const loadChildren = async () => {
        try {
            const data = await patientService.getAllChildren();
            setChildren(data);
        } catch (error) {
            console.error('Failed to load children:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectPatient = (child: ChildProfile) => {
        setSelectedChild(child);
        navigate(`/patients/${child.id}`);
    };

    const filteredChildren = children.filter(child => {
        const full = `${child.surname} ${child.name} ${child.patronymic || ''}`.toLowerCase();
        return full.includes(searchQuery.toLowerCase());
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <Badge variant="outline" className="text-primary-600 border-primary-100 bg-primary-50/50 mb-2">
                        Реестр пациентов
                    </Badge>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                        Пациенты
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Всего в базе: <span className="text-slate-900 dark:text-white font-bold">{children.length}</span>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Input
                        placeholder="Поиск по ФИО..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        leftIcon={<Search size={18} className="text-slate-500" />}
                        rightIcon={searchQuery ? <X size={16} /> : undefined}
                        onRightIconClick={searchQuery ? () => setSearchQuery('') : undefined}
                        className="w-full md:w-80 h-12 !rounded-2xl"
                    />
                    <Button
                        onClick={() => navigate('/patients/new')}
                        className="h-12 px-6 rounded-2xl shadow-xl shadow-primary-500/20 shrink-0"
                        leftIcon={<UserPlus size={20} strokeWidth={2.5} />}
                    >
                        Новый пациент
                    </Button>
                </div>
            </div>

            {/* Empty State */}
            {filteredChildren.length === 0 && (
                <Card className="flex flex-col items-center justify-center p-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-xl mb-6">
                        <UsersIcon size={40} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        {searchQuery ? 'Никого не нашли' : 'Картотека пуста'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs mx-auto font-medium">
                        {searchQuery
                            ? 'Попробуйте изменить параметры поиска или добавьте нового пациента'
                            : 'Начните работу с добавления первого пациента в базу данных системы'
                        }
                    </p>
                    <Button
                        variant="secondary"
                        onClick={() => { searchQuery ? setSearchQuery('') : navigate('/patients/new') }}
                    >
                        {searchQuery ? 'Сбросить поиск' : 'Завести первую карточку'}
                    </Button>
                </Card>
            )}

            {/* Patients Grid */}
            {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-2xl" />
                    ))}
                </div>
            ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredChildren.map((child, index) => (
                    <Card
                        key={child.id}
                        hoverable
                        onClick={() => handleSelectPatient(child)}
                        className="relative p-6 border-slate-200 dark:border-slate-800/50 group overflow-hidden flex flex-col transition-all duration-300 active:scale-[0.98] before:content-[''] before:absolute before:inset-0 before:rounded-xl before:border-2 before:border-primary-500/80 dark:before:border-primary-400/70 before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100 before:pointer-events-none"
                        style={{
                            animation: `slideIn 0.3s ease-out ${index * 0.05}s both`
                        }}
                    >
                        {/* Status Dots or Indicators could go here */}
                        <div className="flex items-start gap-5">
                            <div className={clsx(
                                "w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
                                child.gender === 'male'
                                    ? "bg-blue-600 text-white shadow-blue-500/30"
                                    : "bg-rose-500 text-white shadow-rose-500/30"
                            )}>
                                {child.surname.charAt(0)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="font-black text-slate-900 dark:text-white text-xl truncate leading-tight mb-1">
                                    {child.surname} {child.name}
                                </h3>
                                <div className="text-sm font-bold text-primary-600 dark:text-primary-400 mb-4">
                                    {patientService.getAgeLabel(child.birthDate)}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[13px] font-bold text-slate-500 dark:text-slate-400">
                                        <Calendar size={14} className="opacity-70" />
                                        {new Date(child.birthDate).toLocaleDateString('ru-RU')}
                                    </div>
                                </div>
                            </div>

                            <div className="self-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover:bg-primary-600 group-hover:text-white transition-all text-slate-400">
                                <ChevronRight size={20} strokeWidth={3} />
                            </div>
                        </div>

                        {/* Hover Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </Card>
                ))}
            </div>
            )}
        </div>
    );
};
