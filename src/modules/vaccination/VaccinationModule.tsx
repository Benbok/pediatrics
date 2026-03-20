import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Syringe, Printer, Download, Upload, Settings2 } from 'lucide-react';
import { ChildProfile, VaccinationProfile, UserVaccineRecord, AugmentedVaccine, VaccineStatus, VaccineDefinition, HepBRiskFactor, VaccineCatalogEntry } from '../../types';
import { PatientModuleHeader } from '../../components/PatientModuleHeader';
import { Badge } from '../../components/ui/Badge';
import { VaccineCard } from '../../components/VaccineCard';
import { VisualStats } from '../../components/VisualStats';
import { LECTURES } from '../../lectures';
import { getHepBRiskFactorLabel, getHepBCatchUpPlan, getHBIGInstructions } from '../../utils/hepatitisBLogic';
import { getPneumoRiskFactorLabel, getPneumoSpecificInstructions } from '../../utils/pneumoLogic';
import { getPertussisContraindicationLabel, getPertussisSpecificInstructions } from '../../utils/dtpLogic';
import { getPolioRiskFactorLabel } from '../../utils/polioLogic';
import { getMMRContraindicationLabel } from '../../utils/mmrLogic';
import { getMeningoRiskFactorLabel } from '../../utils/meningoLogic';
import { getVaricellaRiskFactorLabel } from '../../utils/varicellaLogic';
import { getHepARiskFactorLabel } from '../../utils/hepaLogic';
import { getFluRiskFactorLabel } from '../../utils/fluLogic';
import { getHpvRiskFactorLabel } from '../../utils/hpvLogic';
import { getTbeRiskFactorLabel } from '../../utils/tbeLogic';
import { getRotavirusRiskFactorLabel } from '../../utils/rotaLogic';
import { PneumoRiskFactor, PertussisContraindication, PolioRiskFactor, MMRContraindication, MeningoRiskFactor, VaricellaRiskFactor, HepARiskFactor, FluRiskFactor, HpvRiskFactor, TbeRiskFactor, RotavirusRiskFactor } from '../../types';
import { printService } from '../printing';
import { createVaccinationCertificateData } from './adapters/printingAdapter';
import { patientService } from '../../services/patient.service';
import { vaccinationService } from '../../services/vaccination.service';

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
    const [vaccineCatalog, setVaccineCatalog] = useState<VaccineCatalogEntry[]>([]);

    // UI state
    const [activeTab, setActiveTab] = useState<'all' | 'due' | 'completed'>('all');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isRiskFactorsModalOpen, setIsRiskFactorsModalOpen] = useState(false);
    const [editingVaccine, setEditingVaccine] = useState<VaccineDefinition | null>(null);
    const [viewingLecture, setViewingLecture] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [tempMantouxDate, setTempMantouxDate] = useState('');

    // Load all data when childId changes
    useEffect(() => {
        if (childId) {
            loadAllData(Number(childId));
        }
    }, [childId]);

    // Sync custom vaccines from proper DB source when profile loads
    useEffect(() => {
        if (vaccinationProfile?.customVaccines) {
            setCustomVaccines(vaccinationProfile.customVaccines);
        }
    }, [vaccinationProfile]);

    const loadAllData = async (id: number) => {
        setIsLoading(true);
        try {
            // Load data via services
            const [childData, profileData, recordsData, catalogData] = await Promise.all([
                patientService.getChildById(id),
                vaccinationService.getProfile(id),
                vaccinationService.getRecords(id),
                vaccinationService.getVaccineCatalog(),
            ]);

            if (childData) setChild(childData);
            setVaccinationProfile(profileData);
            setRecords(recordsData);
            setVaccineCatalog(catalogData || []);
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
        const varicellaRiskFactors: VaricellaRiskFactor[] = [];
        const hepaRiskFactors: HepARiskFactor[] = [];
        const fluRiskFactors: FluRiskFactor[] = [];
        const hpvRiskFactors: HpvRiskFactor[] = [];
        const tbeRiskFactors: TbeRiskFactor[] = [];
        const rotaRiskFactors: RotavirusRiskFactor[] = [];

        const possibleHepB = Object.values(HepBRiskFactor);
        const possiblePneumo = Object.values(PneumoRiskFactor);
        const possiblePertussis = Object.values(PertussisContraindication);
        const possiblePolio = Object.values(PolioRiskFactor);
        const possibleMMR = Object.values(MMRContraindication);

        const possibleMening = Object.values(MeningoRiskFactor);
        const possibleVaricella = Object.values(VaricellaRiskFactor);
        const possibleHepA = Object.values(HepARiskFactor);
        const possibleFlu = Object.values(FluRiskFactor);
        const possibleHpv = Object.values(HpvRiskFactor);
        const possibleTbe = Object.values(TbeRiskFactor);
        const possibleRota = Object.values(RotavirusRiskFactor);

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

        possibleVaricella.forEach(factor => {
            if (formData.get(factor) === 'on') {
                varicellaRiskFactors.push(factor as VaricellaRiskFactor);
            }
        });

        possibleHepA.forEach(factor => {
            if (formData.get(factor) === 'on') {
                hepaRiskFactors.push(factor as HepARiskFactor);
            }
        });

        possibleFlu.forEach(factor => {
            if (formData.get(factor) === 'on') {
                fluRiskFactors.push(factor as FluRiskFactor);
            }
        });

        possibleHpv.forEach(factor => {
            if (formData.get(factor) === 'on') {
                hpvRiskFactors.push(factor as HpvRiskFactor);
            }
        });

        possibleTbe.forEach(factor => {
            if (formData.get(factor) === 'on') {
                tbeRiskFactors.push(factor as TbeRiskFactor);
            }
        });

        possibleRota.forEach(factor => {
            if (formData.get(factor) === 'on') {
                rotaRiskFactors.push(factor as RotavirusRiskFactor);
            }
        });

        try {
            const updatedProfile = {
                ...vaccinationProfile,
                hepBRiskFactors,
                pneumoRiskFactors,
                pertussisContraindications,
                polioRiskFactors,
                mmrContraindications,
                meningRiskFactors,
                varicellaRiskFactors,
                hepaRiskFactors,
                fluRiskFactors,
                hpvRiskFactors,
                tbeRiskFactors,
                rotaRiskFactors,
                birthWeight: formData.get('birthWeight') ? parseInt(formData.get('birthWeight') as string) : null,
                mantouxDate: tempMantouxDate || vaccinationProfile.mantouxDate,
                mantouxResult: formData.get('mantouxResult') === 'true'
            };

            await vaccinationService.updateProfile(updatedProfile);
            setVaccinationProfile(updatedProfile);
            setIsRiskFactorsModalOpen(false);
        } catch (error: any) {
            console.error('Failed to update risk factors:', error);
            alert(error.message || 'Ошибка обновления профиля');
        }
    };

    const handleUpdateMantoux = async (date: string | null, result: boolean | null) => {
        if (!childId || !vaccinationProfile) return;

        try {
            const updatedProfile = {
                ...vaccinationProfile,
                childId: Number(childId),
                mantouxDate: date,
                mantouxResult: result,
                customVaccines: vaccinationProfile.customVaccines
            };
            await vaccinationService.updateProfile(updatedProfile);
            setVaccinationProfile(updatedProfile);
            setTempMantouxDate('');
        } catch (error: any) {
            console.error('Failed to update Mantoux data:', error);
            alert(error.message || 'Ошибка обновления данных Манту');
        }
    };

    const augmentedSchedule = useMemo(() => {
        if (!child || !vaccinationProfile) return [];
        return vaccinationService.calculateSchedule(child, vaccinationProfile, records, customVaccines, vaccineCatalog);
    }, [child, vaccinationProfile, records, customVaccines, vaccineCatalog]);

    const stats = useMemo(() => {
        const total = augmentedSchedule.length;
        const done = augmentedSchedule.filter(x => x.status === VaccineStatus.COMPLETED).length;
        const overdue = augmentedSchedule.filter(x => x.status === VaccineStatus.OVERDUE).length;
        const due = augmentedSchedule.filter(x => x.status === VaccineStatus.DUE_NOW).length;
        return { total, done, overdue, due };
    }, [augmentedSchedule]);

    const filteredVaccines = useMemo(() => {
        return augmentedSchedule.filter(v => {
            if (activeTab === 'completed' && v.status !== VaccineStatus.COMPLETED) return false;
            if (activeTab === 'due' && v.status !== VaccineStatus.OVERDUE && v.status !== VaccineStatus.DUE_NOW) return false;

            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                return v.name.toLowerCase().includes(query) ||
                    v.disease.toLowerCase().includes(query) ||
                    (v.userRecord?.vaccineBrand?.toLowerCase().includes(query) ?? false);
            }

            return true;
        });
    }, [augmentedSchedule, activeTab, searchQuery]);

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

    const handleToggleComplete = async (
        vaccineId: string,
        date: string | null,
        brand?: string,
        notes?: string,
        extra?: { dose?: string; series?: string; expiryDate?: string; manufacturer?: string }
    ) => {
        if (!childId) return;

        try {
            if (date === null) {
                // Delete record if date is null (Undo complete)
                await vaccinationService.deleteRecord(Number(childId), vaccineId);
            } else {
                // Save/Update record
                const record: UserVaccineRecord = {
                    childId: Number(childId),
                    vaccineId,
                    isCompleted: true,
                    completedDate: date,
                    vaccineBrand: brand || null,
                    notes: notes || null,
                    dose: extra?.dose || null,
                    series: extra?.series || null,
                    expiryDate: extra?.expiryDate || null,
                    manufacturer: extra?.manufacturer || null,
                };
                await vaccinationService.saveRecord(record);
            }
            // Reload records
            const recordsData = await vaccinationService.getRecords(Number(childId));
            setRecords(recordsData);
        } catch (error: any) {
            console.error('Failed to toggle vaccination status:', error);
            alert(error.message || 'Ошибка обновления статуса прививки');
        }
    };

    const handleAddCustomVaccine = async (e: React.FormEvent<HTMLFormElement>) => {
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

        if (vaccinationProfile && childId) {
            try {
                const updatedProfile = {
                    ...vaccinationProfile,
                    childId: Number(childId),
                    customVaccines: newCustoms
                };
                await vaccinationService.updateProfile(updatedProfile);
                setVaccinationProfile(updatedProfile);
                setIsAddModalOpen(false);
            } catch (error: any) {
                console.error('Failed to add custom vaccine:', error);
                alert(error.message || 'Ошибка обновления профиля');
            }
        }
    };

    const handleDeleteCustomVaccine = async (id: string) => {
        const newCustoms = customVaccines.filter(v => v.id !== id);
        setCustomVaccines(newCustoms);

        if (vaccinationProfile && childId) {
            try {
                const updatedProfile = {
                    ...vaccinationProfile,
                    childId: Number(childId),
                    customVaccines: newCustoms
                };
                await vaccinationService.updateProfile(updatedProfile);
                setVaccinationProfile(updatedProfile);
            } catch (error: any) {
                console.error('Failed to delete custom vaccine:', error);
                alert(error.message || 'Ошибка обновления профиля');
            }
        }
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

    const handlePrintCertificate = async () => {
        if (!child) return;

        try {
            // Преобразуем данные через адаптер
            const certificateData = createVaccinationCertificateData(child, augmentedSchedule);

            // Вызываем сервис печати с предпросмотром
            await printService.preview('vaccination-certificate', certificateData, {
                title: `Сертификат прививок - ${[child.surname, child.name].filter(Boolean).join(' ')}`,
                createdAt: new Date(),
                organization: 'Педиатрическая клиника',
            });
        } catch (error) {
            console.error('Failed to print certificate:', error);
            alert('Ошибка при подготовке сертификата к печати');
        }
    };

    const handleExportCSV = () => {
        if (!child) return;
        const headers = [
            'ID',
            'Болезнь',
            'Вакцина',
            'Статус',
            'План. дата',
            'Дата выполнения',
            'Препарат',
            'Дозировка',
            'Серия',
            'Срок годности',
            'Производитель',
            'Заметки'
        ];
        const rows = augmentedSchedule.map(v => {
            const statusText =
                v.status === VaccineStatus.COMPLETED ? 'Выполнено' :
                    v.status === VaccineStatus.OVERDUE ? 'Просрочено' :
                        v.status === VaccineStatus.DUE_NOW ? 'Пора делать' :
                            v.status === VaccineStatus.MISSED ? 'Упущено' :
                                v.status === VaccineStatus.SKIPPED ? 'Не требуется' : 'В плане';

            return [
                v.id,
                `"${v.disease}"`,
                `"${v.name}"`,
                `"${statusText}"`,
                v.dueDate.toLocaleDateString('ru-RU'),
                v.userRecord?.completedDate || '',
                `"${v.userRecord?.vaccineBrand || ''}"`,
                `"${v.userRecord?.dose || ''}"`,
                `"${v.userRecord?.series || ''}"`,
                v.userRecord?.expiryDate || '',
                `"${v.userRecord?.manufacturer || ''}"`,
                `"${v.userRecord?.notes || ''}"`
            ].join(',');
        });
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fullName = [child.surname, child.name].filter(Boolean).join('_');
        link.setAttribute('download', `PediAssist_${fullName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportCSV = async () => {
        if (!child || !childId) return;

        try {
            const result = await window.electronAPI.openFile({
                title: 'Выберите файл для импорта',
                buttonLabel: 'Импортировать',
                filters: [{ name: 'CSV Files', extensions: ['csv'] }]
            });

            if (result.canceled || result.filePaths.length === 0) return;

            const filePath = result.filePaths[0];
            const content = await window.electronAPI.readTextFile(filePath);

            // Basic CSV parsing (comma separated, handling quotes)
            const lines = content.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                alert('Файл пуст или имеет неверный формат');
                return;
            }

            // Headers are expected to match our export, but we need to be robust
            const headers = lines[0].split(',').map(h => h.trim().replace(/^\ufeff/, ''));
            const idIdx = headers.indexOf('ID');
            const dateIdx = headers.indexOf('Дата выполнения');
            const brandIdx = headers.indexOf('Препарат');
            const doseIdx = headers.indexOf('Дозировка');
            const seriesIdx = headers.indexOf('Серия');
            const expiryIdx = headers.indexOf('Срок годности');
            const manufacturerIdx = headers.indexOf('Производитель');
            const notesIdx = headers.indexOf('Заметки');

            if (idIdx === -1 || dateIdx === -1) {
                alert('Некорректный формат CSV. Отсутствуют обязательные колонки (ID или Дата выполнения)');
                return;
            }

            let importCount = 0;
            let skippedCount = 0;
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const birthDate = new Date(child.birthDate);
            birthDate.setHours(0, 0, 0, 0);

            for (let i = 1; i < lines.length; i++) {
                // Robust CSV splitting to handle quotes and empty cells
                const cells: string[] = [];
                let current = '';
                let inQuotes = false;
                const line = lines[i].trim();

                for (let char of line) {
                    if (char === '"') inQuotes = !inQuotes;
                    else if (char === ',' && !inQuotes) {
                        cells.push(current);
                        current = '';
                    } else current += char;
                }
                cells.push(current);

                const clean = (str: string) => str ? str.replace(/^"|"$/g, '').trim() : '';

                const vId = clean(cells[idIdx] || '');
                const compDateStr = clean(cells[dateIdx] || '');

                if (vId && compDateStr) {
                    const compDate = new Date(compDateStr);

                    // Safety Check: Date must be between birth and today
                    if (isNaN(compDate.getTime()) || compDate < birthDate || compDate > today) {
                        skippedCount++;
                        continue;
                    }

                    const record: UserVaccineRecord = {
                        childId: Number(childId),
                        vaccineId: vId,
                        isCompleted: true,
                        completedDate: compDateStr,
                        vaccineBrand: clean(cells[brandIdx] || '') || null,
                        dose: clean(cells[doseIdx] || '') || null,
                        series: clean(cells[seriesIdx] || '') || null,
                        expiryDate: clean(cells[expiryIdx] || '') || null,
                        manufacturer: clean(cells[manufacturerIdx] || '') || null,
                        notes: clean(cells[notesIdx] || '') || null,
                        ignoreValidation: true, // Bypass strict BCG/Mantoux check for historic import
                    };

                    await window.electronAPI.saveRecord(record);
                    importCount++;
                }
            }

            if (importCount > 0) {
                let msg = `Успешно импортировано записей: ${importCount}.`;
                if (skippedCount > 0) {
                    msg += `\nПропущено записей (некорректная дата или возраст): ${skippedCount}.`;
                }
                alert(msg);
                // Refresh records
                const recordsData = await window.electronAPI.getRecords(Number(childId));
                setRecords(recordsData);
            } else {
                alert(skippedCount > 0
                    ? `Все записи (${skippedCount}) были пропущены из-за некорректных дат.`
                    : 'Не удалось найти подходящие записи для импорта');
            }

        } catch (error) {
            console.error('Import failed:', error);
            alert('Ошибка при импорте данных');
        }
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
        <div className="space-y-4">
            {/* Premium Header */}
            <PatientModuleHeader
                child={child}
                title="Вакцинация"
                icon={<Syringe className="w-6 h-6 !text-white" strokeWidth={2.5} />}
                iconBgClass="bg-blue-600"
                iconShadowClass="shadow-blue-500/25"
                onBack={() => navigate(`/patients/${child.id}`)}
                badge={
                    <Badge
                        variant="primary"
                        className="px-3 py-1 text-xs font-bold"
                    >
                        {stats.done}/{stats.total} выполнено
                    </Badge>
                }
                actions={
                    <>
                        <button
                            onClick={() => setIsRiskFactorsModalOpen(true)}
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500 hover:text-blue-600"
                            title="Группы риска"
                        >
                            <Settings2 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handlePrintCertificate}
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500 hover:text-blue-600"
                            title="Печать сертификата"
                        >
                            <Printer className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500 hover:text-blue-600"
                            title="Экспорт CSV"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleImportCSV}
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500 hover:text-emerald-600"
                            title="Импорт CSV"
                        >
                            <Upload className="w-5 h-5" />
                        </button>
                    </>
                }
            />

            <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl overflow-hidden p-2 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                <div className="flex-1 sm:max-w-xs relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск по вакцине, болезни..."
                        className="block w-full pl-10 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg leading-5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 sm:text-xs transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-2 flex items-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>
                <div className="flex gap-1 flex-wrap sm:flex-nowrap">
                    <button onClick={() => setActiveTab('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${activeTab === 'all' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Все ({stats.total})</button>
                    <button onClick={() => setActiveTab('due')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${activeTab === 'due' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>План ({stats.due + stats.overdue})</button>
                    <button onClick={() => setActiveTab('completed')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${activeTab === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Готово ({stats.done})</button>
                </div>
            </div>

            {activeTab === 'all' && <VisualStats schedule={filteredVaccines} onVaccineClick={scrollToVaccine} birthDate={child.birthDate} />}

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
                                    value={tempMantouxDate}
                                    className="text-xs p-2 rounded-lg border dark:bg-slate-800 dark:text-white dark:border-slate-700 flex-1"
                                    onChange={(e) => setTempMantouxDate(e.target.value)}
                                />
                                <button
                                    onClick={() => handleUpdateMantoux(tempMantouxDate, false)}
                                    disabled={!tempMantouxDate}
                                    className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold disabled:opacity-50"
                                >
                                    ОК
                                </button>
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
                                    <VaccineCard key={vaccine.id} data={vaccine} child={child} onToggleComplete={handleToggleComplete} onDeleteCustom={handleDeleteCustomVaccine} onEditCustom={(id) => { const v = customVaccines.find(cv => cv.id === id); if (v) setEditingVaccine(v); }} onOpenLecture={(lectureId) => setViewingLecture(lectureId)} />
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
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl p-0 border dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
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
                            {/* Birth Weight */}
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                <label className="block text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                                    Вес при рождении (граммы)
                                </label>
                                <input
                                    type="number"
                                    name="birthWeight"
                                    min="500"
                                    max="8000"
                                    step="50"
                                    defaultValue={vaccinationProfile.birthWeight || ''}
                                    placeholder="3500"
                                    className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:text-white dark:border-slate-700 text-emerald-700 placeholder-emerald-300"
                                />
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                                    Опционально. Используется для расчетов БЦЖ (&lt;2000г) и Полио (&lt;2500г)
                                </p>
                            </div>

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

                                    <div className="space-y-3 bg-cyan-50 dark:bg-cyan-900/10 p-4 rounded-2xl border border-cyan-100 dark:border-cyan-900/30 md:col-span-2">
                                        <h5 className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Гепатит А (Желтуха)</h5>
                                        <div className="grid md:grid-cols-2 gap-3">
                                            {(Object.values(HepARiskFactor) as HepARiskFactor[]).map((factor) => (
                                                <label key={factor} className="flex items-start gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        name={factor}
                                                        defaultChecked={vaccinationProfile.hepaRiskFactors?.includes(factor)}
                                                        className="mt-1 w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 bg-white"
                                                    />
                                                    <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-cyan-600 transition-colors leading-snug">
                                                        {getHepARiskFactorLabel(factor)}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3 bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 md:col-span-2">
                                        <h5 className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Грипп (Ежегодно)</h5>
                                        <div className="grid md:grid-cols-2 gap-3">
                                            {(Object.values(FluRiskFactor) as FluRiskFactor[]).map((factor) => (
                                                <label key={factor} className="flex items-start gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        name={factor}
                                                        defaultChecked={vaccinationProfile.fluRiskFactors?.includes(factor)}
                                                        className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 bg-white"
                                                    />
                                                    <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors leading-snug">
                                                        {getFluRiskFactorLabel(factor)}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3 bg-fuchsia-50 dark:bg-fuchsia-900/10 p-4 rounded-2xl border border-fuchsia-100 dark:border-fuchsia-900/30 md:col-span-2">
                                        <h5 className="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 uppercase tracking-wider">ВПЧ (Вирус папилломы)</h5>
                                        <div className="grid md:grid-cols-2 gap-3">
                                            {(Object.values(HpvRiskFactor) as HpvRiskFactor[]).map((factor) => (
                                                <label key={factor} className="flex items-start gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        name={factor}
                                                        defaultChecked={vaccinationProfile.hpvRiskFactors?.includes(factor)}
                                                        className="mt-1 w-4 h-4 text-fuchsia-600 rounded border-slate-300 focus:ring-fuchsia-500 bg-white"
                                                    />
                                                    <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-fuchsia-600 transition-colors leading-snug">
                                                        {getHpvRiskFactorLabel(factor)}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3 bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 md:col-span-2">
                                        <h5 className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Клещевой Энцефалит</h5>
                                        <div className="grid md:grid-cols-2 gap-3">
                                            {(Object.values(TbeRiskFactor) as TbeRiskFactor[]).map((factor) => (
                                                <label key={factor} className="flex items-start gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        name={factor}
                                                        defaultChecked={vaccinationProfile.tbeRiskFactors?.includes(factor)}
                                                        className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 bg-white"
                                                    />
                                                    <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 transition-colors leading-snug">
                                                        {getTbeRiskFactorLabel(factor)}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3 bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-2xl border border-yellow-100 dark:border-yellow-900/30 md:col-span-2">
                                        <h5 className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.34c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                            </svg>
                                            Ветряная Оспа (SOS)
                                        </h5>
                                        {(Object.values(VaricellaRiskFactor) as VaricellaRiskFactor[]).map((factor) => (
                                            <label key={factor} className="flex items-start gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    name={factor}
                                                    defaultChecked={vaccinationProfile.varicellaRiskFactors?.includes(factor)}
                                                    className="mt-1 w-4 h-4 text-yellow-600 rounded border-slate-300 focus:ring-yellow-500 bg-white"
                                                />
                                                <span className="text-xs text-slate-900 dark:text-slate-100 font-bold group-hover:text-yellow-600 transition-colors leading-snug">
                                                    {getVaricellaRiskFactorLabel(factor)}
                                                </span>
                                            </label>
                                        ))}
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
