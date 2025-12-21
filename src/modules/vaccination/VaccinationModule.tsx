import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VACCINE_SCHEDULE } from '../../constants';
import { ChildProfile, VaccinationProfile, UserVaccineRecord, AugmentedVaccine, VaccineStatus, VaccineDefinition, HepBRiskFactor } from '../../types';
import { VaccineCard } from '../../components/VaccineCard';
import { VisualStats } from '../../components/VisualStats';
import { getGeneralAdvice } from '../../services/geminiService';
import { LECTURES } from '../../lectures';
import { getHepBRiskFactorLabel, getHepBCatchUpPlan, getHBIGInstructions } from '../../utils/hepatitisBLogic';
import { getPneumoRiskFactorLabel, getPneumoSpecificInstructions } from '../../utils/pneumoLogic';
import { getPertussisContraindicationLabel, getPertussisSpecificInstructions } from '../../utils/dtpLogic';
import { getPolioRiskFactorLabel } from '../../utils/polioLogic';
import { getMMRContraindicationLabel } from '../../utils/mmrLogic';
import { getMeningoRiskFactorLabel } from '../../utils/meningoLogic';
import { calculateVaccineSchedule } from '../../logic/vax';
import { PneumoRiskFactor, PertussisContraindication, PolioRiskFactor, MMRContraindication, MeningoRiskFactor } from '../../types';

/**
 * VACCINATION MODULE
 * 
 * Responsibility: Manage ONLY vaccination-related data
 * - Vaccination records (completed vaccines, dates, brands, notes)
 * - Risk factors (groups that affect vaccine schedule)
 * - Custom vaccines
 * - Vaccine schedule calculations
 * 
 * NO PATIENT MANAGEMENT HERE - completely isolated from patients module
 * Gets patient ID from URL, loads patient data independently
 */

export const VaccinationModule: React.FC = () => {
    const { childId } = useParams<{ childId: string }>();
    const navigate = useNavigate();

    // Module's own data - loaded independently
    const [child, setChild] = useState<ChildProfile | null>(null);
    const [vaccinationProfile, setVaccinationProfile] = useState<VaccinationProfile | null>(null);
    const [records, setRecords] = useState<UserVaccineRecord[]>([]);
    const [customVaccines, setCustomVaccines] = useState<VaccineDefinition[]>([]);

    // UI state
    const [activeTab, setActiveTab] = useState<'all' | 'due' | 'completed'>('all');
    const [chatQuery, setChatQuery] = useState('');
    const [chatResponse, setChatResponse] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isRiskFactorsModalOpen, setIsRiskFactorsModalOpen] = useState(false);
    const [editingVaccine, setEditingVaccine] = useState<VaccineDefinition | null>(null);
    const [viewingLecture, setViewingLecture] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load all data when childId changes
    useEffect(() => {
        if (childId) {
            loadAllData(Number(childId));
        }
    }, [childId]);

    // Load custom vaccines from localStorage (could be moved to DB later)
    useEffect(() => {
        const savedCustom = localStorage.getItem('vax_custom_defs');
        if (savedCustom) setCustomVaccines(JSON.parse(savedCustom));
    }, []);

    const loadAllData = async (id: number) => {
        setIsLoading(true);
        try {
            // Load patient data independently
            const childData = await window.electronAPI.getChild(id);
            setChild(childData);

            // Load vaccination-specific data
            const profileData = await window.electronAPI.getVaccinationProfile(id);
            setVaccinationProfile(profileData);

            const recordsData = await window.electronAPI.getRecords(id);
            setRecords(recordsData);
        } catch (error) {
            console.error('Failed to load vaccination data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateRiskFactors = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!childId || !vaccinationProfile) return;

        const formData = new FormData(e.currentTarget);
        const hepBRiskFactors: HepBRiskFactor[] = [];
        const pneumoRiskFactors: PneumoRiskFactor[] = [];
        const pertussisContraindications: PertussisContraindication[] = [];
        const polioRiskFactors: PolioRiskFactor[] = [];
        const mmrContraindications: MMRContraindication[] = [];
        const meningRiskFactors: MeningoRiskFactor[] = [];

        const possibleHepB = Object.values(HepBRiskFactor);
        const possiblePneumo = Object.values(PneumoRiskFactor);
        const possiblePertussis = Object.values(PertussisContraindication);
        const possiblePolio = Object.values(PolioRiskFactor);
        const possibleMMR = Object.values(MMRContraindication);

        const possibleMening = Object.values(MeningoRiskFactor);

        possibleHepB.forEach(factor => {
            if (formData.get(factor) === 'on') {
                hepBRiskFactors.push(factor as HepBRiskFactor);
            }
        });

        possiblePneumo.forEach(factor => {
            if (formData.get(factor) === 'on') {
                pneumoRiskFactors.push(factor as PneumoRiskFactor);
            }
        });

        possiblePertussis.forEach(factor => {
            if (formData.get(factor) === 'on') {
                pertussisContraindications.push(factor as PertussisContraindication);
            }
        });

        possiblePolio.forEach(factor => {
            if (formData.get(factor) === 'on') {
                polioRiskFactors.push(factor as PolioRiskFactor);
            }
        });

        possibleMMR.forEach(factor => {
            if (formData.get(factor) === 'on') {
                mmrContraindications.push(factor as MMRContraindication);
            }
        });

        possibleMening.forEach(factor => {
            if (formData.get(factor) === 'on') {
                meningRiskFactors.push(factor as MeningoRiskFactor);
            }
        });

        try {
            await window.electronAPI.updateVaccinationProfile({
                childId: Number(childId),
                hepBRiskFactors,
                pneumoRiskFactors,
                pertussisContraindications,
                polioRiskFactors,
                mmrContraindications,
                meningRiskFactors,
                mantouxDate: vaccinationProfile.mantouxDate,
                mantouxResult: vaccinationProfile.mantouxResult
            });
            setVaccinationProfile({
                ...vaccinationProfile,
                hepBRiskFactors,
                pneumoRiskFactors,
                pertussisContraindications,
                polioRiskFactors,
                mmrContraindications,
                meningRiskFactors
            });
            setIsRiskFactorsModalOpen(false);
        } catch (error) {
            console.error('Failed to update risk factors:', error);
        }
    };

    const handleUpdateMantoux = async (date: string | null, result: boolean | null) => {
        if (!childId || !vaccinationProfile) return;

        try {
            await window.electronAPI.updateVaccinationProfile({
                ...vaccinationProfile,
                childId: Number(childId),
                mantouxDate: date,
                mantouxResult: result
            });
            setVaccinationProfile({ ...vaccinationProfile, mantouxDate: date, mantouxResult: result });
        } catch (error) {
            console.error('Failed to update Mantoux data:', error);
        }
    };

    const augmentedSchedule: AugmentedVaccine[] = useMemo(() => {
        if (!child || !vaccinationProfile) return [];
        return calculateVaccineSchedule(child, vaccinationProfile, records, [...VACCINE_SCHEDULE, ...customVaccines]);
    }, [child, vaccinationProfile, records, customVaccines]);

    const stats = useMemo(() => {
        const total = augmentedSchedule.length;
        const done = augmentedSchedule.filter(x => x.status === VaccineStatus.COMPLETED).length;
        const overdue = augmentedSchedule.filter(x => x.status === VaccineStatus.OVERDUE).length;
        const due = augmentedSchedule.filter(x => x.status === VaccineStatus.DUE_NOW).length;
        return { total, done, overdue, due };
    }, [augmentedSchedule]);

    const filteredVaccines = useMemo(() => {
        return augmentedSchedule.filter(v => {
            if (activeTab === 'completed') return v.status === VaccineStatus.COMPLETED;
            if (activeTab === 'due') return v.status === VaccineStatus.OVERDUE || v.status === VaccineStatus.DUE_NOW;
            return true;
        });
    }, [augmentedSchedule, activeTab]);

    const groupedVaccines = useMemo(() => {
        const groups: Record<number, AugmentedVaccine[]> = {};
        filteredVaccines.forEach(vac => {
            if (!groups[vac.ageMonthStart]) groups[vac.ageMonthStart] = [];
            groups[vac.ageMonthStart].push(vac);
        });
        return groups;
    }, [filteredVaccines]);

    const sortedAges = useMemo(() => {
        return Object.keys(groupedVaccines).map(Number).sort((a, b) => a - b);
    }, [groupedVaccines]);

    const handleToggleComplete = async (id: string, date: string | null, brand?: string, notes?: string) => {
        if (!childId) return;

        const record: UserVaccineRecord = {
            childId: Number(childId),
            vaccineId: id,
            isCompleted: !!date,
            completedDate: date,
            vaccineBrand: brand,
            notes: notes
        };

        try {
            await window.electronAPI.saveRecord(record);
            // Reload records
            const recordsData = await window.electronAPI.getRecords(Number(childId));
            setRecords(recordsData);
        } catch (error) {
            console.error('Failed to save record:', error);
        }
    };

    const handleAddCustomVaccine = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        const disease = formData.get('disease') as string;
        const ageMonth = parseInt(formData.get('age') as string);
        const description = formData.get('description') as string;

        const newVaccine: VaccineDefinition = {
            id: `custom-${Date.now()}`,
            name,
            disease,
            ageMonthStart: ageMonth,
            description: description || 'Пользовательская прививка',
            isCustom: true
        };

        const newCustoms = [...customVaccines, newVaccine];
        setCustomVaccines(newCustoms);
        localStorage.setItem('vax_custom_defs', JSON.stringify(newCustoms));
        setIsAddModalOpen(false);
    };

    const handleDeleteCustomVaccine = (id: string) => {
        const newCustoms = customVaccines.filter(v => v.id !== id);
        setCustomVaccines(newCustoms);
        localStorage.setItem('vax_custom_defs', JSON.stringify(newCustoms));
    };

    const scrollToVaccine = (id: string) => {
        setActiveTab('all');
        setTimeout(() => {
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('ring-2', 'ring-blue-500');
                setTimeout(() => element.classList.remove('ring-2', 'ring-blue-500'), 2000);
            }
        }, 100);
    };

    const handleGeneralChat = async () => {
        if (!chatQuery.trim() || !child) return;
        setIsChatting(true);
        setChatResponse('');
        const resp = await getGeneralAdvice(chatQuery, child, vaccinationProfile || undefined);
        setChatResponse(resp);
        setIsChatting(false);
    };

    const handleExportCSV = () => {
        if (!child) return;
        const headers = ['Болезнь', 'Вакцина', 'Статус', 'План. дата', 'Дата выполнения', 'Препарат', 'Заметки'];
        const rows = augmentedSchedule.map(v => {
            const statusText =
                v.status === VaccineStatus.COMPLETED ? 'Выполнено' :
                    v.status === VaccineStatus.OVERDUE ? 'Просрочено' :
                        v.status === VaccineStatus.DUE_NOW ? 'Пора делать' :
                            v.status === VaccineStatus.MISSED ? 'Упущено' :
                                v.status === VaccineStatus.SKIPPED ? 'Не требуется' : 'В плане';
            return [`"${v.disease}"`, `"${v.name}"`, `"${statusText}"`, v.dueDate.toLocaleDateString('ru-RU'), v.userRecord?.completedDate ? new Date(v.userRecord.completedDate).toLocaleDateString('ru-RU') : '', `"${v.userRecord?.vaccineBrand || ''}"`, `"${v.userRecord?.notes || ''}"`].join(',');
        });
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fullName = [child.surname, child.name].filter(Boolean).join('_');
        link.setAttribute('download', `VaxTrack_${fullName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getAgeLabel = (months: number) => {
        if (months === 0) return 'Первые 24 часа';
        if (months < 12) return `${months} мес`;
        const years = Math.floor(months / 12);
        const m = months % 12;
        let yearStr = 'лет';
        const lastDigit = years % 10;
        const lastTwo = years % 100;
        if (lastDigit === 1 && lastTwo !== 11) yearStr = 'год';
        else if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwo)) yearStr = 'года';
        return m > 0 ? `${years} ${yearStr} ${m} мес` : `${years} ${yearStr}`;
    };

    const getFullName = (child: ChildProfile) => {
        return [child.surname, child.name, child.patronymic].filter(Boolean).join(' ');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-slate-500">Загрузка данных вакцинации...</div>
            </div>
        );
    }

    if (!child) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Пациент не найден</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8">
                    Не удалось загрузить данные пациента.
                </p>
                <button
                    onClick={() => navigate('/patients')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30"
                >
                    Вернуться к списку пациентов
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">{child.surname.charAt(0)}</div>
                    <div>
                        <h1 className="font-bold text-slate-900 dark:text-white leading-tight">{getFullName(child)}</h1>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{new Date(child.birthDate).toLocaleDateString('ru-RU')}</span>
                            <span>•</span>
                            <span>{stats.done}/{stats.total} готово</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsRiskFactorsModalOpen(true)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-400 hover:text-blue-600" title="Группы риска">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                    <button onClick={handleExportCSV} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-400 hover:text-blue-600" title="Экспорт CSV">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                    </button>
                    <button onClick={() => navigate('/patients')} className="text-xs text-slate-500 hover:text-red-500 p-2 font-medium transition-colors">Закрыть</button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-3">
                    <button onClick={() => setActiveTab('all')} className={`p-3 text-center transition ${activeTab === 'all' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700' : ''}`}><div className="text-xl font-bold">{stats.total}</div><div className="text-[10px] uppercase">Всего</div></button>
                    <button onClick={() => setActiveTab('due')} className={`p-3 text-center transition ${activeTab === 'due' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700' : ''}`}><div className="text-xl font-bold">{stats.due + stats.overdue}</div><div className="text-[10px] uppercase">План</div></button>
                    <button onClick={() => setActiveTab('completed')} className={`p-3 text-center transition ${activeTab === 'completed' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : ''}`}><div className="text-xl font-bold">{stats.done}</div><div className="text-[10px] uppercase">Готово</div></button>
                </div>
            </div>

            {activeTab === 'all' && <VisualStats schedule={augmentedSchedule} onVaccineClick={scrollToVaccine} />}

            <section className="bg-indigo-50 dark:bg-slate-900 rounded-xl p-4 border dark:border-slate-800">
                <h2 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 mb-3"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>AI Педиатр</h2>
                <div className="flex gap-2">
                    <input type="text" value={chatQuery} onChange={(e) => setChatQuery(e.target.value)} placeholder="Напр: Можно ли гулять после АКДС?" className="flex-1 p-2 rounded-lg border dark:bg-slate-800 dark:text-white dark:border-slate-700 text-sm" />
                    <button onClick={handleGeneralChat} disabled={isChatting} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">{isChatting ? '...' : 'Спросить'}</button>
                </div>
                {chatResponse && <div className="mt-3 bg-white dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700 text-sm prose dark:prose-invert max-w-none"><div dangerouslySetInnerHTML={{ __html: chatResponse.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>') }} /></div>}
            </section>

            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">График прививок</h2>
                    <button onClick={() => setIsAddModalOpen(true)} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium dark:bg-blue-900/40 dark:text-blue-300">+ Добавить</button>
                </div>
                <div className="space-y-6">
                    {getHBIGInstructions(vaccinationProfile) && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex gap-3">
                            <span className="text-2xl">⚠️</span>
                            <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                                {getHBIGInstructions(vaccinationProfile)}
                            </p>
                        </div>
                    )}

                    {getPneumoSpecificInstructions(vaccinationProfile?.pneumoRiskFactors) && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl flex gap-3">
                            <span className="text-2xl">🛡️</span>
                            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed font-medium">
                                {getPneumoSpecificInstructions(vaccinationProfile?.pneumoRiskFactors)}
                            </p>
                        </div>
                    )}

                    {getPertussisSpecificInstructions(vaccinationProfile) && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex gap-3">
                            <span className="text-2xl">🚫</span>
                            <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed font-medium font-bold">
                                {getPertussisSpecificInstructions(vaccinationProfile)}
                            </p>
                        </div>
                    )}

                    {/* Mantoux Screening Card */}
                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-500">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                                Проба Манту (скрининг)
                            </h3>
                            {vaccinationProfile?.mantouxDate && (
                                <button
                                    onClick={() => handleUpdateMantoux(null, null)}
                                    className="text-[10px] text-slate-400 hover:text-red-500 uppercase font-bold"
                                >
                                    Очистить
                                </button>
                            )}
                        </div>

                        {!vaccinationProfile?.mantouxDate ? (
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    className="text-xs p-2 rounded-lg border dark:bg-slate-800 dark:text-white dark:border-slate-700 flex-1"
                                    onChange={(e) => {
                                        if (e.target.value) handleUpdateMantoux(e.target.value, false);
                                    }}
                                />
                                <div className="text-[10px] text-slate-500 max-w-[150px] leading-tight flex items-center">
                                    Необходима для БЦЖ детям старше 2 месяцев
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${vaccinationProfile.mantouxResult ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                                    <div>
                                        <div className="text-sm font-bold dark:text-white">
                                            {vaccinationProfile.mantouxResult ? 'Положительная' : 'Отрицательная'}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            Проверка: {new Date(vaccinationProfile.mantouxDate).toLocaleDateString('ru-RU')}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                    <button
                                        onClick={() => handleUpdateMantoux(vaccinationProfile.mantouxDate!, false)}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${!vaccinationProfile.mantouxResult ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400'}`}
                                    >
                                        ОТР (-)
                                    </button>
                                    <button
                                        onClick={() => handleUpdateMantoux(vaccinationProfile.mantouxDate!, true)}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${vaccinationProfile.mantouxResult ? 'bg-white dark:bg-slate-700 shadow-sm text-red-600' : 'text-slate-400'}`}
                                    >
                                        ПОЛ (+)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    {sortedAges.map(age => (
                        <div key={age} className="space-y-3">
                            <div className="sticky top-0 z-20 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-md py-1 px-3 rounded-lg font-bold text-xs uppercase text-slate-500 border dark:border-slate-800">{getAgeLabel(age)}</div>
                            <div className="space-y-3">
                                {groupedVaccines[age].map(vaccine => (
                                    <VaccineCard key={vaccine.id} data={vaccine} child={child} vaccinationProfile={vaccinationProfile || undefined} onToggleComplete={handleToggleComplete} onDeleteCustom={handleDeleteCustomVaccine} onEditCustom={(id) => { const v = customVaccines.find(cv => cv.id === id); if (v) setEditingVaccine(v); }} onOpenLecture={(lectureId) => setViewingLecture(lectureId)} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Modals */}
            {viewingLecture && LECTURES[viewingLecture] && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full h-[85vh] flex flex-col border dark:border-slate-800">
                        <div className="p-4 border-b dark:border-slate-800 flex justify-between items-start">
                            <h2 className="text-xl font-bold">{LECTURES[viewingLecture].title}</h2>
                            <button onClick={() => setViewingLecture(null)} className="p-1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 prose dark:prose-invert max-w-none"><div dangerouslySetInnerHTML={{ __html: LECTURES[viewingLecture].content }} /></div>
                        <div className="p-4 border-t dark:border-slate-800"><button onClick={() => setViewingLecture(null)} className="w-full bg-slate-900 dark:bg-slate-700 text-white py-3 rounded-lg">Закрыть</button></div>
                    </div>
                </div>
            )}

            {isRiskFactorsModalOpen && vaccinationProfile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full p-0 border dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Настройка групп риска</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Отметьте факторы, влияющие на график вакцинации</p>
                            </div>
                            <button onClick={() => setIsRiskFactorsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form id="risk-factors-form" onSubmit={handleUpdateRiskFactors} className="flex-1 overflow-y-auto p-6 space-y-8">
                            <div>
                                <h4 className="flex items-center gap-2 font-bold text-sm uppercase text-blue-600 dark:text-blue-400 mb-4 px-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                    </svg>
                                    Группы риска (Инфекции)
                                </h4>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Гепатит В (Приказ 1122н)</h5>
                                        {(Object.values(HepBRiskFactor) as HepBRiskFactor[]).map((factor) => (
                                            <label key={factor} className="flex items-start gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    name={factor}
                                                    defaultChecked={vaccinationProfile.hepBRiskFactors?.includes(factor)}
                                                    className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 bg-white"
                                                />
                                                <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors leading-snug">
                                                    {getHepBRiskFactorLabel(factor)}
                                                </span>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Пневмококк</h5>
                                        {(Object.values(PneumoRiskFactor) as PneumoRiskFactor[]).map((factor) => (
                                            <label key={factor} className="flex items-start gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    name={factor}
                                                    defaultChecked={vaccinationProfile.pneumoRiskFactors?.includes(factor)}
                                                    className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 bg-white"
                                                />
                                                <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors leading-snug">
                                                    {getPneumoRiskFactorLabel(factor)}
                                                </span>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 md:col-span-2">
                                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Менингококк</h5>
                                        <div className="grid md:grid-cols-2 gap-3">
                                            {(Object.values(MeningoRiskFactor) as MeningoRiskFactor[]).map((factor) => (
                                                <label key={factor} className="flex items-start gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        name={factor}
                                                        defaultChecked={vaccinationProfile.meningRiskFactors?.includes(factor)}
                                                        className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 bg-white"
                                                    />
                                                    <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors leading-snug">
                                                        {getMeningoRiskFactorLabel(factor)}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8">
                                <h4 className="flex items-center gap-2 font-bold text-sm uppercase text-amber-600 dark:text-amber-400 mb-4 px-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.34c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                    </svg>
                                    Безопасность и Отводы
                                </h4>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-3 bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/30">
                                        <h5 className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Коклюш (Отводы AKDC)</h5>
                                        {(Object.values(PertussisContraindication) as PertussisContraindication[]).map((factor) => (
                                            <label key={factor} className="flex items-start gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    name={factor}
                                                    defaultChecked={vaccinationProfile.pertussisContraindications?.includes(factor)}
                                                    className="mt-1 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 bg-white"
                                                />
                                                <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-red-600 transition-colors leading-snug font-medium">
                                                    {getPertussisContraindicationLabel(factor)}
                                                </span>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="space-y-3 bg-purple-50 dark:bg-purple-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/30">
                                        <h5 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Полиомиелит (Риски ОПВ)</h5>
                                        {(Object.values(PolioRiskFactor) as PolioRiskFactor[]).map((factor) => (
                                            <label key={factor} className="flex items-start gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    name={factor}
                                                    defaultChecked={vaccinationProfile.polioRiskFactors?.includes(factor)}
                                                    className="mt-1 w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 bg-white"
                                                />
                                                <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-purple-600 transition-colors leading-snug font-medium">
                                                    {getPolioRiskFactorLabel(factor)}
                                                </span>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="space-y-3 bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30 md:col-span-2">
                                        <h5 className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">КПК (Живые вакцины)</h5>
                                        <div className="grid md:grid-cols-2 gap-3">
                                            {(Object.values(MMRContraindication) as MMRContraindication[]).map((factor) => (
                                                <label key={factor} className="flex items-start gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        name={factor}
                                                        defaultChecked={vaccinationProfile.mmrContraindications?.includes(factor)}
                                                        className="mt-1 w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 bg-white"
                                                    />
                                                    <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-orange-600 transition-colors leading-snug font-medium">
                                                        {getMMRContraindicationLabel(factor)}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>

                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex gap-4">
                            <button
                                type="submit"
                                form="risk-factors-form"
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                            >
                                Обновить график
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsRiskFactorsModalOpen(false)}
                                className="px-8 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-4 rounded-2xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full border dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-4">Своя прививка</h3>
                        <form onSubmit={handleAddCustomVaccine} className="space-y-4">
                            <input name="name" required className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700" placeholder="Название" />
                            <input name="disease" required className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700" placeholder="Болезнь" />
                            <input name="age" type="number" min="0" required className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700" placeholder="Возраст (мес)" />
                            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">Добавить</button>
                            <button type="button" onClick={() => setIsAddModalOpen(false)} className="w-full text-slate-500 py-2">Отмена</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
