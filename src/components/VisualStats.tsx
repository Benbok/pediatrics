import React, { useState, useMemo } from 'react';
import { AugmentedVaccine, VaccineStatus } from '../types';

interface Props {
  schedule: AugmentedVaccine[];
  onVaccineClick: (id: string) => void;
}

export const VisualStats: React.FC<Props> = ({ schedule, onVaccineClick }) => {
  const [mode, setMode] = useState<'timeline' | 'coverage'>('timeline');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // --- Extract unique diseases for filter ---
  const uniqueDiseases = useMemo(() => {
    const diseases = new Set(schedule.map(v => v.disease));
    return Array.from(diseases).sort();
  }, [schedule]);

  // --- Logic for Timeline ---
  const timelineData = useMemo(() => {
    // Filter schedule based on active selection
    const filteredSchedule = activeFilter === 'all' 
      ? schedule 
      : schedule.filter(v => v.disease === activeFilter);

    // Group by age
    const grouped: Record<number, AugmentedVaccine[]> = {};
    filteredSchedule.forEach(vac => {
      if (!grouped[vac.ageMonthStart]) {
        grouped[vac.ageMonthStart] = [];
      }
      grouped[vac.ageMonthStart].push(vac);
    });

    // Sort ages
    const ages = Object.keys(grouped).map(Number).sort((a, b) => a - b);
    return { ages, grouped };
  }, [schedule, activeFilter]);

  // --- Logic for Coverage ---
  const coverageData = useMemo(() => {
    const diseaseMap: Record<string, { total: number; completed: number; nextDue?: Date }> = {};
    
    schedule.forEach(vac => {
      if (!diseaseMap[vac.disease]) {
        diseaseMap[vac.disease] = { total: 0, completed: 0 };
      }
      diseaseMap[vac.disease].total += 1;
      if (vac.status === VaccineStatus.COMPLETED) {
        diseaseMap[vac.disease].completed += 1;
      } else if (!diseaseMap[vac.disease].nextDue || vac.dueDate < diseaseMap[vac.disease].nextDue!) {
         diseaseMap[vac.disease].nextDue = vac.dueDate;
      }
    });

    return Object.entries(diseaseMap).sort((a, b) => {
        // Sort by completion % (descending), then name
        const rateA = a[1].completed / a[1].total;
        const rateB = b[1].completed / b[1].total;
        return rateB - rateA || a[0].localeCompare(b[0]);
    });
  }, [schedule]);

  const formatAge = (months: number) => {
    if (months === 0) return 'Роддом';
    if (months < 12) return `${months} мес`;
    const years = Math.floor(months / 12);
    const m = months % 12;
    return m > 0 ? `${years}г ${m}м` : `${years} лет`;
  };

  const getStatusClasses = (status: VaccineStatus) => {
     switch(status) {
         case VaccineStatus.COMPLETED: return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800';
         case VaccineStatus.OVERDUE: return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800';
         case VaccineStatus.DUE_NOW: return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800';
         default: return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
     }
  };
  
  const getDotColor = (hasProblem: boolean, isPast: boolean) => {
      if (hasProblem) return 'bg-rose-500 border-rose-200 dark:border-rose-900';
      if (isPast) return 'bg-emerald-500 border-emerald-200 dark:border-emerald-900';
      return 'bg-slate-300 border-slate-100 dark:bg-slate-600 dark:border-slate-800';
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-6">
      {/* Header / Tabs */}
      <div className="flex border-b border-slate-100 dark:border-slate-800">
        <button 
          onClick={() => setMode('timeline')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === 'timeline' ? 'text-blue-600 bg-blue-50/50 dark:bg-blue-900/10 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          Временная шкала
        </button>
        <button 
          onClick={() => setMode('coverage')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === 'coverage' ? 'text-blue-600 bg-blue-50/50 dark:bg-blue-900/10 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
          Защита по болезням
        </button>
      </div>

      <div className="p-4">
        {mode === 'timeline' && (
          <div className="relative">
            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-2 hide-scrollbar">
                <button
                    onClick={() => setActiveFilter('all')}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                        activeFilter === 'all' 
                        ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                    }`}
                >
                    Все
                </button>
                {uniqueDiseases.map(disease => (
                    <button
                        key={disease}
                        onClick={() => setActiveFilter(disease)}
                        className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                            activeFilter === disease 
                            ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                        }`}
                    >
                        {disease}
                    </button>
                ))}
            </div>

            {/* Horizontal Line */}
            <div className="absolute top-[68px] left-0 right-0 h-0.5 bg-slate-100 dark:bg-slate-800 z-0" />
            
            <div className="overflow-x-auto pb-4 hide-scrollbar flex gap-4 snap-x relative z-10 px-2 min-h-[140px]">
              {timelineData.ages.length > 0 ? (
                  timelineData.ages.map((age, idx) => {
                     const vaccines = timelineData.grouped[age];
                     const isPast = vaccines.every(v => v.status === VaccineStatus.COMPLETED);
                     const hasProblem = vaccines.some(v => v.status === VaccineStatus.OVERDUE);
                     
                     return (
                        <div key={age} className="snap-start flex flex-col items-center min-w-[110px] sm:min-w-[130px] pt-1 animate-in zoom-in-95 duration-200">
                            {/* Dot on line */}
                            <div className={`w-4 h-4 rounded-full mb-3 border-4 box-content ${getDotColor(hasProblem, isPast)} transition-colors`} />
                            
                            {/* Age Label */}
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                                {formatAge(age)}
                            </div>
    
                            {/* Vaccine Stack (Names) */}
                            <div className="flex flex-col gap-1.5 w-full">
                                {vaccines.map(vac => (
                                    <button 
                                        key={vac.id} 
                                        onClick={() => onVaccineClick(vac.id)}
                                        className={`px-2 py-1.5 rounded-md border text-[10px] font-medium leading-tight text-center transition-all hover:scale-105 active:scale-95 ${getStatusClasses(vac.status)}`}
                                        title={`${vac.name} (${vac.status}) - Нажмите, чтобы перейти`}
                                    >
                                        {vac.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                     );
                  })
              ) : (
                  <div className="w-full text-center py-8 text-sm text-slate-400 dark:text-slate-500 italic">
                      Нет прививок для выбранного фильтра
                  </div>
              )}
            </div>
            {timelineData.ages.length > 0 && (
                <div className="text-xs text-center text-slate-400 mt-2 flex items-center justify-center gap-1 opacity-60">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M2 10a.75.75 0 01.75-.75h12.59l-2.1-1.95a.75.75 0 111.02-1.1l3.5 3.25a.75.75 0 010 1.1l-3.5 3.25a.75.75 0 11-1.02-1.1l2.1-1.95H2.75A.75.75 0 012 10z" clipRule="evenodd" />
                    </svg>
                    Листайте и нажимайте
                </div>
            )}
          </div>
        )}

        {mode === 'coverage' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             {coverageData.map(([disease, stats]) => {
                const percentage = Math.round((stats.completed / stats.total) * 100);
                return (
                    <div key={disease} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{disease}</span>
                            <span className={`font-bold ${percentage === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                {stats.completed}/{stats.total}
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div 
                                className={`h-2 rounded-full transition-all duration-500 ${percentage === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                style={{ width: `${percentage}%` }}
                            ></div>
                        </div>
                        {percentage < 100 && stats.nextDue && (
                             <div className="text-[10px] text-slate-400 mt-1 text-right">
                                След: {stats.nextDue.toLocaleDateString('ru-RU')}
                             </div>
                        )}
                    </div>
                );
             })}
          </div>
        )}
      </div>
    </div>
  );
};