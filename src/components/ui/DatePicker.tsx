import React, { useState, useRef, useEffect } from 'react';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import clsx from 'clsx';

interface DatePickerProps {
    value?: string; // ISO string YYYY-MM-DD
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    required?: boolean;
    className?: string;
    placement?: 'bottom' | 'top' | 'right' | 'left';
}

const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type ViewMode = 'days' | 'months' | 'years';

export const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    label,
    placeholder = 'дд.мм.гггг',
    required,
    className,
    placement = 'bottom'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('days');
    const [inputValue, setInputValue] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const placementStyles = {
        bottom: "top-full mt-3 left-0 animate-in zoom-in-95 slide-in-from-top-2 origin-top",
        top: "bottom-full mb-3 left-0 animate-in zoom-in-95 slide-in-from-bottom-2 origin-bottom",
        right: "left-full ml-4 top-1/2 -translate-y-1/2 animate-in zoom-in-95 slide-in-from-left-2 origin-left",
        left: "right-full mr-4 top-1/2 -translate-y-1/2 animate-in zoom-in-95 slide-in-from-right-2 origin-right"
    };

    // Sync input value when user selects a date (value prop updates)
    useEffect(() => {
        if (value) {
            const d = new Date(value);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            setInputValue(`${day}.${month}.${year}`);
            setViewDate(d);
        } else {
            setInputValue('');
        }
    }, [value]);

    // Reset view mode when opening
    useEffect(() => {
        if (isOpen) {
            setViewMode('days');
            setViewDate(value ? new Date(value) : new Date());
        }
    }, [isOpen, value]);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setInputValue(raw);

        // Validation for DD.MM.YYYY
        const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            const year = parseInt(match[3], 10);
            const date = new Date(year, month, day);

            if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                onChange(isoDate);
                setViewDate(date);
            }
        } else if (raw === '') {
            onChange('');
        }
    };

    const handleInputBlur = () => {
        // If invalid date on blur, revert to valid value
        if (value) {
            const d = new Date(value);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            setInputValue(`${day}.${month}.${year}`);
        } else {
            setInputValue('');
        }
    };

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Adjust for Monday start
    };

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

    const days = [];
    // Last month days
    const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
        days.push({ day: prevMonthDays - i, month: 'prev' });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, month: 'current' });
    }
    // Next month days
    const remaining = 42 - days.length; // 6 rows
    for (let i = 1; i <= remaining; i++) {
        days.push({ day: i, month: 'next' });
    }

    const handleDateSelect = (day: number, monthOffset: number) => {
        const selectedDate = new Date(currentYear, currentMonth + monthOffset, day);
        // Correct for timezone offset to ensure the date string is local
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(selectedDate.getDate()).padStart(2, '0');

        onChange(`${year}-${month}-${dayStr}`);
        setIsOpen(false);
    };

    const changeMonth = (offset: number) => {
        setViewDate(new Date(currentYear, currentMonth + offset, 1));
    };

    const changeYear = (offset: number) => {
        setViewDate(new Date(currentYear + offset, currentMonth, 1));
    };

    const handleToday = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        onChange(`${year}-${month}-${day}`);
        setIsOpen(false);
    };

    const handleClear = () => {
        onChange('');
        setIsOpen(false);
    };

    // Years for the year view (12 years grid)
    const startYear = Math.floor(currentYear / 12) * 12;
    const years = Array.from({ length: 12 }, (_, i) => startYear + i);

    return (
        <div className={clsx("relative w-full", className)} ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            <div
                className={clsx(
                    "relative w-full h-14 bg-white dark:bg-slate-900 border rounded-2xl flex items-center transition-all duration-300 shadow-sm",
                    isOpen ? "ring-4 ring-primary-500/10 border-primary-500" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                )}
            >
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    className="w-full h-full pl-4 pr-12 bg-transparent border-none focus:ring-0 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-medium rounded-2xl outline-none"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-slate-400 hover:text-primary-600 transition-colors focus:outline-none"
                    tabIndex={-1}
                >
                    <CalendarIcon size={20} />
                </button>
            </div>

            {isOpen && (
                <div className={clsx(
                    "absolute z-[110] w-80 bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl border border-slate-200 dark:border-slate-800 p-5 fade-in duration-200 overflow-hidden",
                    placementStyles[placement]
                )}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div
                            className="flex items-center gap-1 group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 px-2 py-1 rounded-lg transition-colors"
                            onClick={() => setViewMode(viewMode === 'days' ? 'months' : viewMode === 'months' ? 'years' : 'days')}
                        >
                            <span className="text-base font-black text-slate-900 dark:text-white capitalize">
                                {viewMode === 'days' && `${MONTHS[currentMonth]} ${currentYear}`}
                                {viewMode === 'months' && `${currentYear}`}
                                {viewMode === 'years' && `${startYear} - ${startYear + 11}`}
                            </span>
                            {viewMode === 'days' ? (
                                <ChevronDown size={16} className="text-slate-400 group-hover:text-primary-600 transition-colors" />
                            ) : (
                                <ChevronUp size={16} className="text-slate-400 group-hover:text-primary-600 transition-colors" />
                            )}
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (viewMode === 'days') changeMonth(-1);
                                    else if (viewMode === 'months') changeYear(-1);
                                    else changeYear(-12);
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                                type="button"
                            >
                                <ChevronLeft size={20} strokeWidth={2.5} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (viewMode === 'days') changeMonth(1);
                                    else if (viewMode === 'months') changeYear(1);
                                    else changeYear(12);
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                                type="button"
                            >
                                <ChevronRight size={20} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {/* View: Days */}
                    {viewMode === 'days' && (
                        <>
                            <div className="grid grid-cols-7 mb-2">
                                {WEEKDAYS.map(day => (
                                    <div key={day} className="text-center text-[11px] font-black text-slate-400 uppercase tracking-wider">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {days.map((item, idx) => {
                                    const date = new Date(currentYear, currentMonth + (item.month === 'prev' ? -1 : item.month === 'next' ? 1 : 0), item.day);
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const dayStr = String(date.getDate()).padStart(2, '0');
                                    const dateStr = `${year}-${month}-${dayStr}`;

                                    const isToday = new Date().toISOString().split('T')[0] === dateStr;
                                    const isSelected = value === dateStr;

                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDateSelect(item.day, item.month === 'prev' ? -1 : item.month === 'next' ? 1 : 0);
                                            }}
                                            className={clsx(
                                                "h-9 w-full rounded-xl flex items-center justify-center text-sm font-bold transition-all",
                                                item.month === 'current'
                                                    ? "text-slate-700 dark:text-slate-200"
                                                    : "text-slate-400/50 dark:text-slate-600",
                                                isSelected
                                                    ? "bg-primary-600 text-white shadow-lg shadow-primary-500/40 scale-110 !z-10"
                                                    : item.month === 'current' && "hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600",
                                                isToday && !isSelected && "text-primary-600 border border-primary-200 dark:border-primary-800"
                                            )}
                                        >
                                            {item.day}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* View: Months */}
                    {viewMode === 'months' && (
                        <div className="grid grid-cols-3 gap-3">
                            {MONTHS.map((month, idx) => (
                                <button
                                    key={month}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setViewDate(new Date(currentYear, idx, 1));
                                        setViewMode('days');
                                    }}
                                    className={clsx(
                                        "h-12 rounded-xl text-sm font-bold transition-all border border-transparent",
                                        idx === currentMonth
                                            ? "bg-primary-50 text-primary-600 border-primary-100"
                                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                    )}
                                >
                                    {month}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* View: Years */}
                    {viewMode === 'years' && (
                        <div className="grid grid-cols-3 gap-3">
                            {years.map((year) => (
                                <button
                                    key={year}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setViewDate(new Date(year, currentMonth, 1));
                                        setViewMode('months');
                                    }}
                                    className={clsx(
                                        "h-12 rounded-xl text-sm font-bold transition-all border border-transparent",
                                        year === currentYear
                                            ? "bg-primary-600 text-white shadow-md shadow-primary-500/20"
                                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                    )}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleClear(); }}
                            className="text-xs font-black text-rose-500 hover:text-rose-600 transition-colors uppercase tracking-widest"
                            type="button"
                        >
                            Удалить
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleToday(); }}
                            className="text-xs font-black text-primary-600 hover:text-primary-700 transition-colors uppercase tracking-widest"
                            type="button"
                        >
                            Сегодня
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
