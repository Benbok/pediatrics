import React, { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
  value: string;
  min?: string;
  onChange: (date: string) => void;
  className?: string;
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const DatePicker: React.FC<DatePickerProps> = ({ value, min, onChange, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse value or default to today
  const dateValue = value ? new Date(value) : new Date();
  
  // View state for calendar (year/month) - initialized to the selected date's month
  const [viewDate, setViewDate] = useState(new Date(dateValue.getFullYear(), dateValue.getMonth(), 1));

  // Sync view when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
          setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  }, [value]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewDate(new Date(viewDate.getFullYear(), parseInt(e.target.value), 1));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewDate(new Date(parseInt(e.target.value), viewDate.getMonth(), 1));
  };

  const handleDayClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    if (min && dateStr < min) return;
    
    onChange(dateStr);
    setIsOpen(false);
  };

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  // Adjust so Monday is 0
  const firstDayOfWeek = (new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() + 6) % 7; 

  const daysArray = [];
  for (let i = 0; i < firstDayOfWeek; i++) daysArray.push(null);
  for (let i = 1; i <= daysInMonth; i++) daysArray.push(i);

  const displayDate = value ? new Date(value).toLocaleDateString('ru-RU') : 'Выберите дату';

  // Generate years range (e.g., current year - 50 to + 20)
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 50; 
  const endYear = currentYear + 20;
  const years = Array.from({length: endYear - startYear + 1}, (_, i) => startYear + i);

  return (
    <div className={`relative ${className || ''}`} ref={containerRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-slate-700 dark:text-slate-200"
      >
        <span>{displayDate}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-400 ml-2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-4 w-72 animate-in fade-in zoom-in-95 duration-100">
           {/* Header */}
           <div className="flex justify-between items-center mb-4">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                   <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              
              <div className="flex items-center gap-1">
                <select 
                  value={viewDate.getMonth()}
                  onChange={handleMonthChange}
                  className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-200 p-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none text-center"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i} className="bg-white dark:bg-slate-900">{m}</option>
                  ))}
                </select>
                <select 
                  value={viewDate.getFullYear()}
                  onChange={handleYearChange}
                  className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-200 p-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                >
                  {years.map((y) => (
                    <option key={y} value={y} className="bg-white dark:bg-slate-900">{y}</option>
                  ))}
                </select>
              </div>

              <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                   <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                 </svg>
              </button>
           </div>
           
           {/* Grid */}
           <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {WEEKDAYS.map(d => (
                 <div key={d} className="text-xs font-medium text-slate-400">{d}</div>
              ))}
           </div>
           <div className="grid grid-cols-7 gap-1">
              {daysArray.map((day, idx) => {
                 if (!day) return <div key={`empty-${idx}`} />;
                 
                 const currentDayDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                 const yyyy = currentDayDate.getFullYear();
                 const mm = String(currentDayDate.getMonth() + 1).padStart(2, '0');
                 const dd = String(day).padStart(2, '0');
                 const dateStr = `${yyyy}-${mm}-${dd}`;
                 
                 const isSelected = value === dateStr;
                 const isDisabled = min && dateStr < min;
                 const isToday = dateStr === new Date().toISOString().split('T')[0];

                 return (
                   <button 
                      key={day} 
                      type="button"
                      onClick={() => !isDisabled && handleDayClick(day)}
                      disabled={!!isDisabled}
                      className={`
                        w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors
                        ${isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300'}
                        ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}
                        ${isToday && !isSelected ? 'border border-blue-400 font-bold text-blue-600 dark:text-blue-400' : ''}
                      `}
                   >
                     {day}
                   </button>
                 );
              })}
           </div>
        </div>
      )}
    </div>
  );
};