import React, { useState, useMemo } from 'react';
import { AugmentedVaccine, VaccineStatus, ChildProfile, VaccinationProfile } from '../types';
import { getVaccineAdvice } from '../services/geminiService';
import { DatePicker } from './DatePicker';
import { UserVaccineRecordSchema } from '../validators/record.validator';

interface Props {
  data: AugmentedVaccine;
  child: ChildProfile;
  vaccinationProfile?: VaccinationProfile;
  onToggleComplete: (
    id: string,
    date: string | null,
    brand?: string,
    notes?: string,
    extra?: { dose?: string; series?: string; expiryDate?: string; manufacturer?: string }
  ) => void;
  onDeleteCustom?: (id: string) => void;
  onEditCustom?: (id: string) => void;
  onOpenLecture?: (lectureId: string) => void;
}

const formatAge = (totalMonths: number) => {
  if (totalMonths === 0) return 'роддом';
  if (totalMonths < 12) return `${totalMonths} мес`;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  let yearStr = 'лет';
  const lastDigit = years % 10;
  const lastTwo = years % 100;

  if (lastDigit === 1 && lastTwo !== 11) yearStr = 'год';
  else if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwo)) yearStr = 'года';

  return months > 0 ? `${years} ${yearStr} ${months} мес` : `${years} ${yearStr}`;
};

export const VaccineCard: React.FC<Props> = ({ data, child, vaccinationProfile, onToggleComplete, onDeleteCustom, onEditCustom, onOpenLecture }) => {
  const [showInfo, setShowInfo] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [dose, setDose] = useState<string>(data.userRecord?.dose || '');
  const [series, setSeries] = useState<string>(data.userRecord?.series || '');
  const [manufacturer, setManufacturer] = useState<string>(data.userRecord?.manufacturer || '');
  const [expiryDate, setExpiryDate] = useState<string>(data.userRecord?.expiryDate || '');
  const [userNotes, setUserNotes] = useState<string>(data.userRecord?.notes || '');
  const [selectedBrandName, setSelectedBrandName] = useState<string>(data.userRecord?.vaccineBrand || '');
  const [isEditing, setIsEditing] = useState(false);

  // Sync states with userRecord updates
  React.useEffect(() => {
    if (!isEditing) {
      setDose(data.userRecord?.dose || '');
      setSeries(data.userRecord?.series || '');
      setManufacturer(data.userRecord?.manufacturer || '');
      setExpiryDate(data.userRecord?.expiryDate || '');
      setUserNotes(data.userRecord?.notes || '');
      setSelectedBrandName(data.userRecord?.vaccineBrand || '');
    }
  }, [data.userRecord, isEditing]);

  // Initialize date with the planned due date, handle potential invalid dates gracefully
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (data.userRecord?.completedDate) return data.userRecord.completedDate;
    try {
      return data.dueDate.toISOString().split('T')[0];
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  });

  const getStatusColor = (status: VaccineStatus) => {
    // Special handling for emergency vaccines to make them look more "available" even if skipped
    const isEmergency = data.id.endsWith('-sos');
    const isNonCalendar = data.isRecommended || data.isCustom;

    if (status !== VaccineStatus.COMPLETED && isNonCalendar) {
      return 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-500 opacity-80';
    }

    switch (status) {
      case VaccineStatus.COMPLETED:
        return 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400';
      case VaccineStatus.OVERDUE:
        return 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400';
      case VaccineStatus.DUE_NOW:
        return 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400';
      case VaccineStatus.MISSED:
        return `bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500 ${isEmergency ? '' : 'opacity-75'}`;
      case VaccineStatus.SKIPPED:
        return isEmergency
          ? 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
          : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-600 opacity-60';
      case VaccineStatus.PLANNED:
      default:
        return 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400';
    }
  };

  const getStatusLabel = (status: VaccineStatus) => {
    switch (status) {
      case VaccineStatus.COMPLETED: return 'Выполнено';
      case VaccineStatus.OVERDUE: return 'Просрочено';
      case VaccineStatus.DUE_NOW: return 'Пора делать';
      case VaccineStatus.MISSED: return 'Поздно делать';
      case VaccineStatus.SKIPPED: return 'Не требуется';
      case VaccineStatus.PLANNED: return 'В плане';
    }
  };

  const handleAskAI = async () => {
    if (aiAdvice) return;
    setLoadingAi(true);
    const advice = await getVaccineAdvice(data, child, vaccinationProfile);
    setAiAdvice(advice);
    setLoadingAi(false);
  };

  const toggleDetails = () => {
    setShowInfo(!showInfo);
    // Automatic AI call removed
  };

  const handleConfirm = () => {
    if (selectedDate) {
      const recordData = {
        childId: child.id,
        vaccineId: data.id,
        isCompleted: true,
        completedDate: selectedDate,
        vaccineBrand: selectedBrandName || null,
        notes: userNotes || null,
        dose: dose || null,
        series: series || null,
        expiryDate: expiryDate || null,
        manufacturer: manufacturer || null,
      };

      const result = UserVaccineRecordSchema.safeParse(recordData);
      if (!result.success) {
        alert(result.error.issues.map(i => i.message).join('\n'));
        return;
      }

      // Additional medical checks
      if (selectedDate < child.birthDate) {
        alert("Дата прививки не может быть раньше даты рождения ребенка.");
        return;
      }

      onToggleComplete(data.id, selectedDate, selectedBrandName, userNotes, {
        dose,
        series,
        manufacturer,
        expiryDate
      });
      setIsEditing(false);
    }
  };

  const selectedBrandDetails = useMemo(() => {
    return data.availableBrands?.find(b => b.name === selectedBrandName);
  }, [data.availableBrands, selectedBrandName]);

  // If skipped or missed, allow forcing completion via a "Force" button hidden in details?
  // For now, allow regular completion but show visually distinct.
  // Disable actions for missed/skipped vaccines UNLESS it's an emergency (SOS) vaccine like ATS
  const isEmergency = data.id.endsWith('-sos');
  const isActionDisabled = (data.status === VaccineStatus.MISSED || data.status === VaccineStatus.SKIPPED) && !isEmergency;

  return (
    <div
      id={data.id}
      className={`relative border rounded-xl p-4 mb-3 transition-all duration-200 ${getStatusColor(data.status)} hover:shadow-md dark:hover:shadow-none scroll-mt-24`}
    >
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${data.status === VaccineStatus.COMPLETED
              ? 'bg-white/50 border-emerald-300 dark:bg-black/20 dark:border-emerald-700'
              : 'bg-white/50 border-slate-300 dark:bg-black/20 dark:border-slate-700'
              }`}>
              {getStatusLabel(data.status)}
            </span>
            <span className="text-xs opacity-75">
              {data.status === VaccineStatus.COMPLETED && data.userRecord?.completedDate
                ? `Сделано: ${new Date(data.userRecord.completedDate).toLocaleDateString('ru-RU')}`
                : `План: ${data.dueDate.toLocaleDateString('ru-RU')} (${formatAge(data.ageMonthStart)})`}
            </span>
            {data.isCustom && (
              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800">
                Своя
              </span>
            )}
          </div>
          <h3 className={`font-bold text-lg leading-tight dark:text-slate-200 ${data.status === VaccineStatus.SKIPPED ? 'line-through opacity-70' : ''}`}>{data.name}</h3>
          <p className="text-sm opacity-90 mt-1">От: {data.disease}</p>

          {/* ALERT MESSAGE */}
          {data.alertMessage && data.status !== VaccineStatus.COMPLETED && (
            <div className="mt-2 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 p-2 rounded border border-amber-200 dark:border-amber-800 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>{data.alertMessage}</span>
            </div>
          )}

          {data.status === VaccineStatus.COMPLETED && data.userRecord?.vaccineBrand && (
            <p className="text-xs mt-1 font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 inline-block px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Препарат: <span className="font-bold">{data.userRecord.vaccineBrand}</span>
            </p>
          )}

          {data.status === VaccineStatus.COMPLETED && (data.userRecord?.dose || data.userRecord?.series || data.userRecord?.manufacturer || data.userRecord?.expiryDate) && (
            <div className="mt-2 text-[10px] space-y-1.5 bg-white/40 dark:bg-black/20 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <div className="grid grid-cols-2 gap-2">
                {data.userRecord.dose && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Доза:</span>
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">{data.userRecord.dose} {data.id === 'ats-sos' ? 'МЕ' : 'мл'}</span>
                  </div>
                )}
                {data.userRecord.series && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Серия:</span>
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">{data.userRecord.series}</span>
                  </div>
                )}
                {data.userRecord.expiryDate && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Годен до:</span>
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">{new Date(data.userRecord.expiryDate).toLocaleDateString('ru-RU')}</span>
                  </div>
                )}
              </div>
              {data.userRecord.manufacturer && (
                <div className="flex items-baseline gap-1.5 pt-1 border-t border-emerald-50 dark:border-emerald-900/20">
                  <span className="text-slate-500 font-bold uppercase text-[9px]">Производитель:</span>
                  <span className="font-medium text-emerald-900 dark:text-emerald-200 italic">{data.userRecord.manufacturer}</span>
                </div>
              )}
            </div>
          )}

          {data.status === VaccineStatus.COMPLETED && data.userRecord?.notes && (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-black/20 p-2 rounded-xl italic border border-slate-100 dark:border-slate-800/50">
              <span className="font-semibold not-italic text-[10px] uppercase opacity-70 block mb-0.5">Заметки:</span>
              "{data.userRecord.notes}"
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {data.status !== VaccineStatus.COMPLETED || isEditing ? (
            <div className={`flex flex-col items-end gap-2 w-full sm:w-auto ${isActionDisabled && !isEditing ? 'opacity-50 pointer-events-none' : ''}`}>
              {data.availableBrands && data.availableBrands.length > 0 && (
                <div className="w-full sm:w-56">
                  <select
                    value={selectedBrandName}
                    onChange={(e) => setSelectedBrandName(e.target.value)}
                    className="text-xs p-2 w-full rounded border border-slate-300 bg-white/80 focus:ring-1 focus:ring-blue-400 outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 mb-1"
                  >
                    <option value="">Выберите препарат...</option>
                    {data.availableBrands.map(brand => (
                      <option key={brand.name} value={brand.name}>{brand.name} ({brand.country})</option>
                    ))}
                  </select>
                  {selectedBrandDetails && (
                    <div className="text-[10px] bg-white/50 dark:bg-black/20 p-1.5 rounded text-slate-600 dark:text-slate-400 leading-snug">
                      {selectedBrandDetails.description}
                    </div>
                  )}
                </div>
              )}

              {/* Enhanced Inputs for Completion */}
              <div className="w-full sm:w-56 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder={data.id === 'ats-sos' ? "Доза (МЕ)" : "Доза (мл)"}
                  className="text-[10px] p-2 rounded border border-slate-300 bg-white/80 outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                />
                <input
                  type="text"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  placeholder="Серия"
                  className="text-[10px] p-2 rounded border border-slate-300 bg-white/80 outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                />
                <input
                  type="text"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="Производитель"
                  className="col-span-2 text-[10px] p-2 rounded border border-slate-300 bg-white/80 outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                />
                <div className="col-span-2">
                  <label className="text-[9px] uppercase font-bold opacity-60 ml-1">Срок годности:</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full text-[10px] p-2 rounded border border-slate-300 bg-white/80 outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Notes Input */}
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Заметки (реакция, клиника...)"
                rows={1}
                className="w-full sm:w-56 text-xs p-2 rounded border border-slate-300 bg-white/80 focus:ring-1 focus:ring-blue-400 outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 resize-none overflow-hidden hover:overflow-auto focus:h-16 transition-all"
              />

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <label className="text-xs font-medium opacity-80 sm:hidden">Дата:</label>
                <div className="flex gap-2 w-full sm:w-auto">
                  <DatePicker
                    value={selectedDate}
                    min={child.birthDate}
                    onChange={setSelectedDate}
                    className="flex-1 sm:w-40"
                  />
                  <button
                    onClick={handleConfirm}
                    className="bg-white/50 hover:bg-emerald-500 hover:text-white text-emerald-700 p-2 rounded border border-emerald-300 transition-colors dark:bg-slate-800 dark:text-emerald-500 dark:border-emerald-800 dark:hover:bg-emerald-600 dark:hover:text-white"
                    title="Подтвердить"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {isEditing && (
                    <button
                      onClick={() => setIsEditing(false)}
                      className="bg-white/50 hover:bg-slate-500 hover:text-white text-slate-700 p-2 rounded border border-slate-300 transition-colors dark:bg-slate-800 dark:text-slate-500 dark:border-slate-800 dark:hover:bg-slate-600 dark:hover:text-white"
                      title="Отмена"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs bg-white/50 hover:bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md border border-blue-200 font-medium dark:bg-black/20 dark:hover:bg-black/40 dark:text-blue-400 dark:border-blue-800 transition-colors"
              >
                Редактировать
              </button>
              <button
                onClick={() => onToggleComplete(data.id, null)}
                className="text-xs bg-white/50 hover:bg-rose-50 text-rose-700 px-3 py-1.5 rounded-md border border-rose-200 font-medium dark:bg-black/20 dark:hover:bg-black/40 dark:text-rose-400 dark:border-rose-800 transition-colors"
              >
                Отменить
              </button>
            </div>
          )}

          {/* Custom Vaccine Actions */}
          {data.isCustom && (
            <div className="flex items-center gap-1 self-start sm:self-center">
              {onEditCustom && (
                <button
                  onClick={() => onEditCustom(data.id)}
                  className="text-slate-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  title="Редактировать"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                  </svg>
                </button>
              )}
              {onDeleteCustom && (
                <button
                  onClick={() => {
                    if (confirm(`Удалить прививку "${data.name}"?`)) {
                      onDeleteCustom(data.id);
                    }
                  }}
                  className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  title="Удалить"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={toggleDetails}
        className="mt-3 text-sm font-medium underline opacity-80 hover:opacity-100 flex items-center gap-1 dark:text-slate-300"
      >
        {showInfo ? 'Скрыть информацию' : 'Подробнее о вакцине'}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 transition-transform ${showInfo ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {showInfo && (
        <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 text-sm animate-in slide-in-from-top-2 duration-200">
          <p className="mb-3 dark:text-slate-300">{data.description}</p>

          <div className="flex flex-col gap-3">
            {/* Lecture Button if available */}
            {data.lectureId && onOpenLecture && (
              <button
                onClick={() => onOpenLecture(data.lectureId!)}
                className="flex items-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-800 transition-colors dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-900/50 group"
              >
                <div className="bg-blue-200 dark:bg-blue-800 p-1.5 rounded-full text-blue-700 dark:text-blue-100 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-bold">Медицинская справка</div>
                  <div className="text-xs opacity-80">Читать подробную лекцию врача</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 ml-auto opacity-50">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            )}

            <div className="bg-white/60 p-3 rounded-lg border border-black/5 dark:bg-black/20 dark:border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v4.383l3.035 3.035c.42.42.42 1.102 0 1.522l-4.5 4.5a1.875 1.875 0 01-2.652 0l-4.5-4.5a1.875 1.875 0 010-2.652L9 8.883V4.5zM13.5 18a.75.75 0 010-1.5V16.5h-3v-1.5a.75.75 0 010-1.5h3v-1.5h-3a.75.75 0 010-1.5h3V9h-3V7.5h3A.75.75 0 0113.5 9v9z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-semibold text-indigo-900 dark:text-indigo-300">AI Справка (Gemini)</span>
              </div>

              {loadingAi ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-2 bg-indigo-200 rounded w-3/4 dark:bg-indigo-900"></div>
                  <div className="h-2 bg-indigo-200 rounded w-full dark:bg-indigo-900"></div>
                  <div className="h-2 bg-indigo-200 rounded w-5/6 dark:bg-indigo-900"></div>
                </div>
              ) : aiAdvice ? (
                <div className="prose prose-sm prose-indigo max-w-none dark:prose-invert">
                  <div dangerouslySetInnerHTML={{
                    __html: aiAdvice.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') || ''
                  }} />
                </div>
              ) : (
                <button
                  onClick={handleAskAI}
                  className="w-full text-left text-xs p-2 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40 transition-colors flex items-center gap-2 group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 group-hover:scale-110 transition-transform">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <span>Нажмите, чтобы загрузить краткую справку</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};