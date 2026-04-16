import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Clock } from 'lucide-react';
import clsx from 'clsx';

interface TimePickerProps {
    value?: string; // HH:MM
    onChange: (value: string) => void;
    id?: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export const TimePicker: React.FC<TimePickerProps> = ({
    value,
    onChange,
    id,
    label,
    placeholder = 'ЧЧ:ММ',
    required,
    className,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [view, setView] = useState<'hours' | 'minutes'>('hours');
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; flipUp: boolean }>({
        top: 0, left: 0, flipUp: false,
    });

    const selectedHour = value ? value.split(':')[0] : null;
    const selectedMinute = value ? value.split(':')[1] : null;

    // Reset view to hours when opening
    useEffect(() => {
        if (isOpen) setView('hours');
    }, [isOpen]);

    // Recalculate position
    const recalcPosition = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const DROPDOWN_HEIGHT = 290;
        const DROPDOWN_WIDTH = 224;
        const MARGIN = 8;

        const spaceBelow = window.innerHeight - rect.bottom;
        const flipUp = spaceBelow < DROPDOWN_HEIGHT && rect.top > DROPDOWN_HEIGHT;

        let left = rect.left;
        if (left + DROPDOWN_WIDTH > window.innerWidth - 12) {
            left = window.innerWidth - DROPDOWN_WIDTH - 12;
        }
        if (left < 12) left = 12;

        setDropdownStyle({
            top: flipUp ? rect.top - DROPDOWN_HEIGHT - MARGIN : rect.bottom + MARGIN,
            left,
            flipUp,
        });
    }, []);

    useEffect(() => {
        if (isOpen) recalcPosition();
    }, [isOpen, recalcPosition]);

    // Track scroll / resize while open
    useEffect(() => {
        if (!isOpen) return;
        let rafId: number;
        const update = () => { rafId = requestAnimationFrame(recalcPosition); };
        document.addEventListener('scroll', update, { capture: true, passive: true });
        window.addEventListener('resize', update, { passive: true });
        return () => {
            cancelAnimationFrame(rafId);
            document.removeEventListener('scroll', update, { capture: true });
            window.removeEventListener('resize', update);
        };
    }, [isOpen, recalcPosition]);

    // Sync input display
    useEffect(() => {
        setInputValue(value ?? '');
    }, [value]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const inContainer = containerRef.current?.contains(target) ?? false;
            const inDropdown = dropdownRef.current?.contains(target) ?? false;
            if (!inContainer && !inDropdown) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '');
        let masked = '';
        for (let i = 0; i < Math.min(digits.length, 4); i++) {
            if (i === 2) masked += ':';
            masked += digits[i];
        }
        setInputValue(masked);

        const match = masked.match(/^(\d{2}):(\d{2})$/);
        if (match) {
            const h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            }
        } else if (e.target.value === '') {
            onChange('');
        }
    };

    const handleInputBlur = () => {
        setInputValue(value ?? '');
    };

    const handleSelect = useCallback((h: string, m: string) => {
        onChange(`${h}:${m}`);
        setIsOpen(false);
    }, [onChange]);

    const handleHourClick = (h: string) => {
        if (selectedMinute) {
            handleSelect(h, selectedMinute);
        } else {
            onChange(`${h}:00`);
            setView('minutes');
        }
    };

    const handleMinuteClick = (m: string) => {
        handleSelect(selectedHour || '00', m);
    };

    const handleNow = () => {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        onChange(`${h}:${m}`);
        setIsOpen(false);
    };

    const handleClear = () => {
        onChange('');
        setIsOpen(false);
    };

    const currentHour = selectedHour ?? '';
    const currentMinute = selectedMinute ?? '';

    const gridCellClass = (active: boolean) => clsx(
        'h-8 rounded-xl text-sm font-bold transition-all text-center flex items-center justify-center cursor-pointer select-none',
        active
            ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
            : 'text-slate-700 dark:text-slate-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600'
    );

    return (
        <div className={clsx('relative w-full', className)} ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            <div className={clsx(
                'relative w-full h-14 bg-white dark:bg-slate-900 border rounded-2xl flex items-center transition-all duration-300 shadow-sm',
                isOpen
                    ? 'ring-4 ring-primary-500/10 border-primary-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            )}>
                <input
                    type="text"
                    id={id}
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    maxLength={5}
                    className="w-full h-full pl-4 pr-12 bg-transparent border-none focus:ring-0 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-medium rounded-2xl outline-none"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(v => !v)}
                    className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-slate-400 hover:text-primary-600 transition-colors focus:outline-none"
                    tabIndex={-1}
                >
                    <Clock size={20} />
                </button>
            </div>

            {isOpen && ReactDOM.createPortal(
                <div
                    ref={dropdownRef}
                    style={{ top: dropdownStyle.top, left: dropdownStyle.left }}
                    className={clsx(
                        'fixed z-[9999] w-56 bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden',
                        dropdownStyle.flipUp
                            ? 'animate-in zoom-in-95 slide-in-from-bottom-2 origin-bottom'
                            : 'animate-in zoom-in-95 slide-in-from-top-2 origin-top'
                    )}
                >
                    {/* Tab switcher */}
                    <div className="flex border-b border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setView('hours')}
                            className={clsx(
                                'flex-1 py-2.5 text-xs font-black uppercase tracking-widest transition-colors',
                                view === 'hours'
                                    ? 'text-primary-600 border-b-2 border-primary-600'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            )}
                        >
                            {currentHour || '--'} ч
                        </button>
                        <div className="w-px bg-slate-100 dark:bg-slate-800 my-1" />
                        <button
                            type="button"
                            onClick={() => setView('minutes')}
                            className={clsx(
                                'flex-1 py-2.5 text-xs font-black uppercase tracking-widest transition-colors',
                                view === 'minutes'
                                    ? 'text-primary-600 border-b-2 border-primary-600'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            )}
                        >
                            {currentMinute || '--'} мин
                        </button>
                    </div>

                    {/* Hours grid: 6×4 */}
                    {view === 'hours' && (
                        <div className="grid grid-cols-6 gap-1 p-3">
                            {HOURS.map(h => (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => handleHourClick(h)}
                                    className={gridCellClass(h === currentHour)}
                                >
                                    {h}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Minutes grid: 4×3 */}
                    {view === 'minutes' && (
                        <div className="grid grid-cols-4 gap-1 p-3">
                            {MINUTES.map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => handleMinuteClick(m)}
                                    className={gridCellClass(m === currentMinute)}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs font-black text-rose-500 hover:text-rose-600 transition-colors uppercase tracking-widest"
                        >
                            Удалить
                        </button>
                        <button
                            type="button"
                            onClick={handleNow}
                            className="text-xs font-black text-primary-600 hover:text-primary-700 transition-colors uppercase tracking-widest"
                        >
                            Сейчас
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
