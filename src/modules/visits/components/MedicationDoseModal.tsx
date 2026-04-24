import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { X, AlertCircle, Pill, Beaker, Calculator, ChevronDown, ChevronUp, Plus, Trash2, BookOpen } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { PrettySelect, type SelectOption } from '../../vaccination/components/PrettySelect';
import { Medication, MedicationForm } from '../../../types';
import type { MatchingRuleSummary, CalculationBreakdown } from '../../../types/medication.types';
import { ROUTE_LABELS, RouteOfAdmin } from '../../../utils/routeOfAdmin';
import { DILUENT_LABELS, DiluentType } from '../../../utils/diluentTypes';
import { calculateDilution } from '../services/medicationDoseCalcService';
import { formatAgeLabel } from '../../../utils/ageUtils';
import { parseInstructionText } from '../../../utils/parseInstructionText';

// ---- Public types ----

export interface DayDose {
    dayLabel: string;
    singleDoseMg: number | null;
    timesPerDay: number | null;
    routeOfAdmin: string | null;
    note?: string | null;
}

export interface DoseData {
    dosing: string;
    duration: string;
    /** Primary single dose (from first day row) — kept for backward compat */
    singleDoseMg?: number | null;
    formId?: string | null;
    /** Physical form type: tablet | powder | solution | ... */
    formType?: string | null;
    timesPerDay?: number | null;
    routeOfAdmin?: string | null;
    packagingDescription?: string | null;
    /** Multi-day schedule; if set, takes precedence over legacy singleDoseMg/timesPerDay */
    daySchedule?: DayDose[] | null;
    dilution?: {
        enabled: boolean;
        suspensionEnabled?: boolean | null;
        suspensionBaseVolumeMl?: number | null;
        suspensionBaseMg?: number | null;
        /** Powder: mg in one vial */
        powderVialMg?: number | null;
        /** Powder: ml of solvent added during reconstitution */
        reconstitutionVolumeMl?: number | null;
        /** Standard: mg in ampoule/concentrate */
        drugAmountMg?: number | null;
        diluentType?: DiluentType | null;
        diluentVolumeMl?: number | null;
        concentrationMgPerMl?: number | null;
        volumeToDrawMl?: number | null;
    } | null;
}

// ---- Internal row type (string-based for controlled inputs) ----

interface DayDoseRow {
    id: string;
    dayLabel: string;
    singleDoseMg: string;
    timesPerDay: string;
    routeOfAdmin: string;
}

// ---- Props ----

interface MedicationDoseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (doseData: DoseData) => void;
    medication: Medication | null;
    initialDoseData?: Partial<DoseData>;
    patientWeight?: number;
    patientAgeMonths?: number;
    patientHeight?: number | null;
    matchingRulesSummary?: MatchingRuleSummary[];
    appliedRuleIndex?: number;
    calculationBreakdown?: CalculationBreakdown | null;
    onRuleChange?: (ruleIndex: number) => void;
    notSuitableForPatient?: string | null;
}

// ---- Helpers ----

const FORM_TYPE_LABELS: Record<string, string> = {
    tablet: 'Таблетки',
    capsule: 'Капсулы',
    syrup: 'Сироп',
    suspension: 'Суспензия',
    solution: 'Раствор',
    powder: 'Порошок',
    granules: 'Гранулы',
    drops: 'Капли',
    spray: 'Спрей',
    suppository: 'Суппозитории',
    cream: 'Крем',
    ointment: 'Мазь',
    gel: 'Гель',
    other: 'Прочее',
};

const buildFormLabel = (form: MedicationForm): string => {
    const parts = [form.type, form.concentration].filter(Boolean);
    return parts.length > 0 ? parts.join(' • ') : form.id;
};

const buildFormDescription = (form: MedicationForm | null): string => {
    if (!form) return '';
    if (form.description) return form.description;
    const parts = [form.type, form.concentration]
        .filter((v): v is string => Boolean(v && String(v).trim()));
    return parts.join(' • ');
};

let _rowCounter = 0;
const newRowId = () => `row_${++_rowCounter}_${Date.now()}`;

const buildDosingString = (rows: DayDoseRow[]): string => {
    const filled = rows.filter(r => r.singleDoseMg || r.timesPerDay);
    if (filled.length === 0) return '';
    if (rows.length === 1) {
        const r = rows[0];
        const parts: string[] = [];
        if (r.singleDoseMg) parts.push(`${r.singleDoseMg} мг`);
        if (r.timesPerDay) parts.push(`${r.timesPerDay} р/сут`);
        if (r.routeOfAdmin) parts.push(ROUTE_LABELS[r.routeOfAdmin as RouteOfAdmin] || r.routeOfAdmin);
        return parts.join(', ');
    }
    return rows.map(r => {
        const dose = [
            r.singleDoseMg ? `${r.singleDoseMg} мг` : '',
            r.timesPerDay ? `${r.timesPerDay} р/сут` : '',
        ].filter(Boolean).join(', ');
        return `${r.dayLabel}: ${dose || '—'}`;
    }).join('; ');
};

// ---- Component ----

export const MedicationDoseModal: React.FC<MedicationDoseModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    medication,
    initialDoseData,
    patientWeight,
    patientAgeMonths,
    patientHeight,
    matchingRulesSummary,
    appliedRuleIndex,
    calculationBreakdown,
    onRuleChange,
    notSuitableForPatient,
}) => {
    // ---- UI state ----
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);
    const [expandedInstructionIndexes, setExpandedInstructionIndexes] = useState<Set<number>>(new Set());
    const [instructionSearch, setInstructionSearch] = useState('');

    // ---- Primary / global route ----
    const [routeOfAdmin, setRouteOfAdmin] = useState<string>(
        initialDoseData?.routeOfAdmin || medication?.routeOfAdmin || ''
    );

    // ---- Form of drug ----
    const [formId, setFormId] = useState<string>(initialDoseData?.formId || '');
    const [packagingDescription, setPackagingDescription] = useState(
        initialDoseData?.packagingDescription || ''
    );

    // ---- Dosing text + duration ----
    const [duration, setDuration] = useState(initialDoseData?.duration || '5-7 дней');
    const [dosing, setDosing] = useState(initialDoseData?.dosing || '');

    // ---- Day schedule ----
    const buildInitialRows = (): DayDoseRow[] => {
        if (initialDoseData?.daySchedule?.length) {
            return initialDoseData.daySchedule.map(d => ({
                id: newRowId(),
                dayLabel: d.dayLabel,
                singleDoseMg: d.singleDoseMg?.toString() || '',
                timesPerDay: d.timesPerDay?.toString() || '',
                routeOfAdmin: d.routeOfAdmin || initialDoseData.routeOfAdmin || medication?.routeOfAdmin || '',
            }));
        }
        return [{
            id: newRowId(),
            dayLabel: 'Весь курс',
            singleDoseMg: initialDoseData?.singleDoseMg?.toString() || '',
            timesPerDay: initialDoseData?.timesPerDay?.toString() || '',
            routeOfAdmin: initialDoseData?.routeOfAdmin || medication?.routeOfAdmin || '',
        }];
    };
    const [daySchedule, setDaySchedule] = useState<DayDoseRow[]>(buildInitialRows);

    // ---- Dilution state ----
    const [dilutionEnabled, setDilutionEnabled] = useState(initialDoseData?.dilution?.enabled || false);
    // Powder fields
    const [powderVialMg, setPowderVialMg] = useState<string>(
        initialDoseData?.dilution?.powderVialMg?.toString() || ''
    );
    const [reconstitutionVolumeMl, setReconstitutionVolumeMl] = useState<string>(
        initialDoseData?.dilution?.reconstitutionVolumeMl?.toString() || ''
    );
    // Manual overrides for auto-calc fields
    const [concentrationOverride, setConcentrationOverride] = useState(false);
    const [manualConcentration, setManualConcentration] = useState<string>(
        initialDoseData?.dilution?.concentrationMgPerMl?.toString() || ''
    );
    const [volumeToDrawOverride, setVolumeToDrawOverride] = useState(false);
    const [manualVolumeToDraw, setManualVolumeToDraw] = useState<string>(
        initialDoseData?.dilution?.volumeToDrawMl?.toString() || ''
    );
    // Standard (ampoule/solution) fields
    const [drugAmountMg, setDrugAmountMg] = useState<string>(
        initialDoseData?.dilution?.drugAmountMg?.toString() || ''
    );
    const [diluentType, setDiluentType] = useState<DiluentType | ''>(
        initialDoseData?.dilution?.diluentType || ''
    );
    const [diluentVolumeMl, setDiluentVolumeMl] = useState<string>(
        initialDoseData?.dilution?.diluentVolumeMl?.toString() || ''
    );

    // ---- Suspension calculator state ----
    const [suspensionCalcEnabled, setSuspensionCalcEnabled] = useState(
        initialDoseData?.dilution?.suspensionEnabled ?? false
    );
    const [suspensionMgInBottle, setSuspensionMgInBottle] = useState(
        initialDoseData?.dilution?.suspensionBaseMg?.toString() || ''
    );
    const [suspensionVolumeMl, setSuspensionVolumeMl] = useState(
        initialDoseData?.dilution?.suspensionBaseVolumeMl?.toString() || ''
    );
    const instructionSearchQuery = instructionSearch.trim();

    const escapeRegExp = useCallback((value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), []);

    const getMatchCount = useCallback((text: string, query: string): number => {
        if (!query) return 0;
        const re = new RegExp(escapeRegExp(query), 'gi');
        return Array.from(text.matchAll(re)).length;
    }, [escapeRegExp]);

    const renderHighlightedText = useCallback((text: string): React.ReactNode => {
        if (!instructionSearchQuery) return text;
        const re = new RegExp(escapeRegExp(instructionSearchQuery), 'gi');
        const matches = Array.from(text.matchAll(re));
        if (matches.length === 0) return text;

        const nodes: React.ReactNode[] = [];
        let lastIndex = 0;

        matches.forEach((match, index) => {
            const start = match.index ?? 0;
            const end = start + match[0].length;
            if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
            nodes.push(
                <mark
                    key={`instruction_match_${start}_${index}`}
                    className="rounded px-0.5 bg-yellow-200 text-yellow-900 dark:bg-yellow-500/40 dark:text-yellow-100"
                >
                    {text.slice(start, end)}
                </mark>
            );
            lastIndex = end;
        });

        if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
        return nodes;
    }, [escapeRegExp, instructionSearchQuery]);

    // ---- Mini dose calculator ----
    const [calcOpenRowId, setCalcOpenRowId] = useState<string | null>(null);
    const [calcMgPerKg, setCalcMgPerKg] = useState<string>('');

    const calcResultMg = useMemo(() => {
        if (!patientWeight || !calcMgPerKg) return null;
        const v = parseFloat(calcMgPerKg);
        if (isNaN(v) || v <= 0) return null;
        return Math.round(v * patientWeight * 10) / 10;
    }, [calcMgPerKg, patientWeight]);


    // ---- Derived from medication ----
    const forms = useMemo((): MedicationForm[] => {
        if (!Array.isArray(medication?.forms)) return [];
        return medication.forms.filter((f): f is MedicationForm => Boolean(f?.id));
    }, [medication]);

    const selectedForm = useMemo(
        () => forms.find(f => f.id === formId) || null,
        [forms, formId]
    );

    const headerRouteOptions = useMemo<Array<SelectOption<string>>>(
        () => [
            { value: '', label: 'Не указано' },
            ...Object.entries(ROUTE_LABELS).map(([value, label]) => ({ value, label })),
        ],
        []
    );

    const rowRouteOptions = useMemo<Array<SelectOption<string>>>(
        () => [
            { value: '', label: '—' },
            ...Object.entries(ROUTE_LABELS).map(([value, label]) => ({ value, label })),
        ],
        []
    );

    const formOptions = useMemo<Array<SelectOption<string>>>(
        () => [
            { value: '', label: 'Без привязки к форме' },
            ...forms.map(form => ({ value: form.id, label: buildFormLabel(form) })),
        ],
        [forms]
    );

    const diluentOptions = useMemo<Array<SelectOption<string>>>(
        () => [
            { value: '', label: 'Выберите растворитель' },
            ...Object.entries(DILUENT_LABELS).map(([value, label]) => ({ value, label })),
        ],
        []
    );

    const parsedInstruction = useMemo(
        () => medication?.fullInstruction && typeof medication.fullInstruction === 'string'
            ? parseInstructionText(medication.fullInstruction)
            : [],
        [medication]
    );

    const isPowderForm = useMemo(() => selectedForm?.type === 'powder', [selectedForm]);
    const isSuspensionForm = useMemo(
        () => ['suspension', 'syrup', 'drops'].includes(selectedForm?.type || ''),
        [selectedForm]
    );

    // Primary dose = first row (for dilution calc)
    const primaryDoseMg = useMemo(() => {
        const val = parseFloat(daySchedule[0]?.singleDoseMg || '');
        return isNaN(val) || val <= 0 ? null : val;
    }, [daySchedule]);

    // Primary route for dilution gating
    const primaryRoute = useMemo(
        () => daySchedule[0]?.routeOfAdmin || routeOfAdmin || '',
        [daySchedule, routeOfAdmin]
    );



    // ml preview for solution forms
    const singleDoseMlPreview = useMemo(() => {
        if (!selectedForm?.mgPerMl || !primaryDoseMg) return null;
        return Math.round((primaryDoseMg / selectedForm.mgPerMl) * 100) / 100;
    }, [primaryDoseMg, selectedForm]);

    // Suspension calculator memos
    const suspensionCalcMgPerMl = useMemo(() => {
        const mg = parseFloat(suspensionMgInBottle);
        const vol = parseFloat(suspensionVolumeMl);
        if (mg > 0 && vol > 0) return Math.round((mg / vol) * 1000) / 1000;
        return null;
    }, [suspensionMgInBottle, suspensionVolumeMl]);
    const perDaySuspensionResults = useMemo(() => {
        if (!suspensionCalcMgPerMl || suspensionCalcMgPerMl <= 0) return [];
        return daySchedule.map(row => {
            const doseMg = parseFloat(row.singleDoseMg);
            if (isNaN(doseMg) || doseMg <= 0) return { label: row.dayLabel, doseMg: null, volumeMl: null };
            return { label: row.dayLabel, doseMg, volumeMl: Math.round((doseMg / suspensionCalcMgPerMl) * 10) / 10 };
        });
    }, [suspensionCalcMgPerMl, daySchedule]);

    const formatSuspensionVolumeMl = useCallback((value: number | null | undefined) => {
        if (value == null || !Number.isFinite(value)) return '—';
        return `${value.toFixed(1)} мл`;
    }, []);

    // Powder auto-concentration
    const autoConcentrationMgPerMl = useMemo(() => {
        const vial = parseFloat(powderVialMg);
        const vol = parseFloat(reconstitutionVolumeMl);
        if (!vial || !vol || vial <= 0 || vol <= 0) return null;
        return Math.round((vial / vol) * 100) / 100;
    }, [powderVialMg, reconstitutionVolumeMl]);

    const effectiveConcentration = useMemo(() => {
        if (concentrationOverride && manualConcentration) {
            const v = parseFloat(manualConcentration);
            return isNaN(v) ? null : v;
        }
        return autoConcentrationMgPerMl;
    }, [concentrationOverride, manualConcentration, autoConcentrationMgPerMl]);

    // Powder auto-volumeToDraw
    const autoVolumeToDrawMl = useMemo(() => {
        if (!isPowderForm || !primaryDoseMg || !effectiveConcentration || effectiveConcentration <= 0) return null;
        return Math.round((primaryDoseMg / effectiveConcentration) * 100) / 100;
    }, [isPowderForm, primaryDoseMg, effectiveConcentration]);

    const effectiveVolumeToDraw = useMemo(() => {
        if (volumeToDrawOverride && manualVolumeToDraw) {
            const v = parseFloat(manualVolumeToDraw);
            return isNaN(v) ? null : v;
        }
        return autoVolumeToDrawMl;
    }, [volumeToDrawOverride, manualVolumeToDraw, autoVolumeToDrawMl]);

    // Standard dilution result (single-day / first row)
    const standardDilutionResult = useMemo(() => {
        if (!dilutionEnabled || isPowderForm) return null;
        if (!primaryDoseMg || !drugAmountMg || !diluentVolumeMl || !diluentType) return null;
        const drugAmt = parseFloat(drugAmountMg);
        const vol = parseFloat(diluentVolumeMl);
        if (isNaN(drugAmt) || isNaN(vol) || drugAmt <= 0 || vol <= 0) return null;
        const res = calculateDilution({
            singleDoseMg: primaryDoseMg,
            drugAmountMg: drugAmt,
            diluentType: diluentType as DiluentType,
            diluentVolumeMl: vol,
        });
        return 'message' in res ? null : res;
    }, [dilutionEnabled, isPowderForm, primaryDoseMg, drugAmountMg, diluentVolumeMl, diluentType]);

    // Concentration for standard dilution (independent of dose, for per-day calc)
    const standardConcentration = useMemo(() => {
        if (!dilutionEnabled || isPowderForm) return null;
        const drugAmt = parseFloat(drugAmountMg);
        const vol = parseFloat(diluentVolumeMl);
        if (isNaN(drugAmt) || drugAmt <= 0 || isNaN(vol) || vol <= 0) return null;
        return Math.round((drugAmt / vol) * 100) / 100;
    }, [dilutionEnabled, isPowderForm, drugAmountMg, diluentVolumeMl]);

    // Per-day dilution breakdown
    type PerDayDilution = { label: string; doseMg: number | null; volumeMl: number | null };
    const perDayDilutionResults = useMemo((): PerDayDilution[] => {
        if (!dilutionEnabled) return [];
        const conc = isPowderForm ? effectiveConcentration : standardConcentration;
        if (!conc || conc <= 0) return [];
        return daySchedule.map(row => {
            const doseMg = parseFloat(row.singleDoseMg);
            if (isNaN(doseMg) || doseMg <= 0) return { label: row.dayLabel, doseMg: null, volumeMl: null };
            return { label: row.dayLabel, doseMg, volumeMl: Math.round((doseMg / conc) * 100) / 100 };
        });
    }, [dilutionEnabled, isPowderForm, effectiveConcentration, standardConcentration, daySchedule]);

    // ---- Sync on initialDoseData / medication change ----
    useEffect(() => {
        if (initialDoseData) {
            setRouteOfAdmin(initialDoseData.routeOfAdmin || medication?.routeOfAdmin || '');
            setDuration(initialDoseData.duration || '5-7 дней');
            setDosing(initialDoseData.dosing || '');

            const defaultRuleFormId =
                appliedRuleIndex != null && medication?.pediatricDosing?.[appliedRuleIndex]?.formId
                    ? medication.pediatricDosing[appliedRuleIndex].formId!
                    : '';
            const resolvedFormId = initialDoseData.formId || defaultRuleFormId || '';
            setFormId(resolvedFormId);

            const resolvedForm = resolvedFormId
                ? (medication?.forms || []).find(f => f.id === resolvedFormId) || null
                : null;
            setPackagingDescription(
                initialDoseData.packagingDescription ||
                buildFormDescription(resolvedForm) ||
                medication?.packageDescription || ''
            );

            if (initialDoseData.daySchedule?.length) {
                setDaySchedule(initialDoseData.daySchedule.map(d => ({
                    id: newRowId(),
                    dayLabel: d.dayLabel,
                    singleDoseMg: d.singleDoseMg?.toString() || '',
                    timesPerDay: d.timesPerDay?.toString() || '',
                    routeOfAdmin: d.routeOfAdmin || initialDoseData.routeOfAdmin || medication?.routeOfAdmin || '',
                })));
            } else {
                setDaySchedule([{
                    id: newRowId(),
                    dayLabel: 'Весь курс',
                    singleDoseMg: initialDoseData.singleDoseMg?.toString() || '',
                    timesPerDay: initialDoseData.timesPerDay?.toString() || '',
                    routeOfAdmin: initialDoseData.routeOfAdmin || medication?.routeOfAdmin || '',
                }]);
            }

            setDilutionEnabled(initialDoseData.dilution?.enabled || false);
            setPowderVialMg(initialDoseData.dilution?.powderVialMg?.toString() || '');
            setReconstitutionVolumeMl(initialDoseData.dilution?.reconstitutionVolumeMl?.toString() || '');
            setDrugAmountMg(initialDoseData.dilution?.drugAmountMg?.toString() || '');
            setDiluentType(initialDoseData.dilution?.diluentType || '');
            setDiluentVolumeMl(initialDoseData.dilution?.diluentVolumeMl?.toString() || '');
            setManualConcentration(initialDoseData.dilution?.concentrationMgPerMl?.toString() || '');
            setManualVolumeToDraw(initialDoseData.dilution?.volumeToDrawMl?.toString() || '');
            setConcentrationOverride(false);
            setVolumeToDrawOverride(false);
        } else if (medication) {
            setRouteOfAdmin(medication.routeOfAdmin || '');
            setPackagingDescription(medication.packageDescription || '');
            const defaultRuleFormId =
                appliedRuleIndex != null && medication.pediatricDosing?.[appliedRuleIndex]?.formId
                    ? medication.pediatricDosing[appliedRuleIndex].formId!
                    : '';
            setFormId(defaultRuleFormId || medication.forms?.[0]?.id || '');
        }
    }, [initialDoseData, medication, appliedRuleIndex]);

    // ---- Reset on close ----
    useEffect(() => {
        if (!isOpen) {
            setIsInfoExpanded(false);
            setDosing('');
            setDuration('5-7 дней');
            setFormId('');
            setPackagingDescription('');
            setDaySchedule([{
                id: newRowId(), dayLabel: 'Весь курс',
                singleDoseMg: '', timesPerDay: '', routeOfAdmin: '',
            }]);
            setDilutionEnabled(false);
            setPowderVialMg('');
            setReconstitutionVolumeMl('');
            setDrugAmountMg('');
            setDiluentType('');
            setDiluentVolumeMl('');
            setManualConcentration('');
            setManualVolumeToDraw('');
            setConcentrationOverride(false);
            setVolumeToDrawOverride(false);
            setCalcOpenRowId(null);
            setCalcMgPerKg('');
            setSuspensionCalcEnabled(false);
            setSuspensionMgInBottle('');
            setSuspensionVolumeMl('');
        }
    }, [isOpen]);

    // ---- Day schedule handlers ----
    const updateRow = useCallback((id: string, field: keyof DayDoseRow, value: string) => {
        setDaySchedule(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    }, []);

    const addRow = useCallback(() => {
        setDaySchedule(prev => [
            ...prev,
            {
                id: newRowId(),
                dayLabel: `Дни ${prev.length + 1}+`,
                singleDoseMg: '',
                timesPerDay: prev[prev.length - 1]?.timesPerDay || '',
                routeOfAdmin: prev[prev.length - 1]?.routeOfAdmin || routeOfAdmin,
            },
        ]);
    }, [routeOfAdmin]);

    const removeRow = useCallback((id: string) => {
        setDaySchedule(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
    }, []);

    const applyCalcToRow = useCallback((rowId: string) => {
        if (calcResultMg == null) return;
        updateRow(rowId, 'singleDoseMg', calcResultMg.toString());
        setCalcOpenRowId(null);
        setCalcMgPerKg('');
    }, [calcResultMg, updateRow]);

    // ---- Confirm ----
    const handleConfirm = () => {
        const firstRow = daySchedule[0];
        const finalDosing = dosing.trim() || buildDosingString(daySchedule);

        const outSchedule: DayDose[] = daySchedule.map(r => ({
            dayLabel: r.dayLabel,
            singleDoseMg: r.singleDoseMg ? parseFloat(r.singleDoseMg) : null,
            timesPerDay: r.timesPerDay ? parseInt(r.timesPerDay) : null,
            routeOfAdmin: r.routeOfAdmin || null,
        }));

        let dilutionData: DoseData['dilution'] = null;
        if (dilutionEnabled || suspensionCalcEnabled) {
            dilutionData = {
                enabled: dilutionEnabled,
                suspensionEnabled: suspensionCalcEnabled,
                suspensionBaseVolumeMl: suspensionCalcEnabled && suspensionVolumeMl ? parseFloat(suspensionVolumeMl) : null,
                suspensionBaseMg: suspensionCalcEnabled && suspensionMgInBottle ? parseFloat(suspensionMgInBottle) : null,
                concentrationMgPerMl: suspensionCalcEnabled ? suspensionCalcMgPerMl : null,
                volumeToDrawMl: suspensionCalcEnabled ? (perDaySuspensionResults[0]?.volumeMl ?? null) : null,
            };

            if (dilutionEnabled) {
                if (isPowderForm) {
                    dilutionData = {
                        ...dilutionData,
                        enabled: true,
                        powderVialMg: powderVialMg ? parseFloat(powderVialMg) : null,
                        reconstitutionVolumeMl: reconstitutionVolumeMl ? parseFloat(reconstitutionVolumeMl) : null,
                        diluentType: (diluentType || null) as DiluentType | null,
                        concentrationMgPerMl: effectiveConcentration,
                        volumeToDrawMl: effectiveVolumeToDraw,
                    };
                } else {
                    dilutionData = {
                        ...dilutionData,
                        enabled: true,
                        drugAmountMg: drugAmountMg ? parseFloat(drugAmountMg) : null,
                        diluentType: (diluentType || null) as DiluentType | null,
                        diluentVolumeMl: diluentVolumeMl ? parseFloat(diluentVolumeMl) : null,
                        concentrationMgPerMl: standardDilutionResult?.concentrationMgPerMl || null,
                        volumeToDrawMl: standardDilutionResult?.volumeToDrawMl || null,
                    };
                }
            }
        }

        const doseData: DoseData = {
            dosing: finalDosing,
            duration: duration.trim() || '5-7 дней',
            singleDoseMg: firstRow?.singleDoseMg ? parseFloat(firstRow.singleDoseMg) : null,
            timesPerDay: firstRow?.timesPerDay ? parseInt(firstRow.timesPerDay) : null,
            routeOfAdmin: firstRow?.routeOfAdmin || routeOfAdmin || null,
            formId: formId || null,
            formType: selectedForm?.type || null,
            packagingDescription: packagingDescription.trim() || buildFormDescription(selectedForm) || null,
            daySchedule: outSchedule,
            dilution: dilutionData,
        };

        onConfirm(doseData);
    };

    if (!isOpen || !medication) return null;

    const isMultiDay = daySchedule.length > 1;
    const autoDosingPreview = buildDosingString(daySchedule);
    const tableInputClass = 'w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 dark:text-white';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[94vh] border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ==== HEADER ==== */}
                <div className="px-5 py-3 border-b dark:border-slate-800 bg-primary-50 dark:bg-primary-950/20 flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl mt-0.5">
                            <Pill className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-0.5">
                                Настройка дозировки
                            </h3>
                            {medication.id ? (
                                <Link
                                    to={`/medications/${medication.id}`}
                                    className="text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline"
                                >
                                    {medication.nameRu}
                                </Link>
                            ) : (
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    {medication.nameRu}
                                </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium text-slate-500">Путь (осн.):</span>
                                    <PrettySelect<string>
                                        value={routeOfAdmin}
                                        onChange={setRouteOfAdmin}
                                        options={headerRouteOptions}
                                        useFixedPanel
                                        buttonClassName="h-7 min-w-[130px] px-2 py-1 text-xs font-semibold rounded-md border-slate-200 dark:border-slate-700"
                                        panelClassName="max-h-64"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {patientWeight
                                        ? `Вес: ${patientWeight} кг`
                                        : <span className="text-amber-600 dark:text-amber-400 font-medium">Вес не указан!</span>}
                                    {patientAgeMonths != null && ` • ${formatAgeLabel(patientAgeMonths)}`}
                                    {patientHeight && ` • Рост: ${patientHeight} см`}
                                </p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ==== CONTENT ==== */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">

                    {/* Предупреждение: не подходит пациенту */}
                    {notSuitableForPatient && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-medium">Препарат не подходит: {notSuitableForPatient}</p>
                        </div>
                    )}

                    {/* ==== 2-COLUMN LAYOUT ==== */}
                    <div className="grid grid-cols-2 gap-4 items-start">

                    {/* ——— LEFT: dosing logic ——— */}
                    <div className="space-y-3">

                    {/* ==== АККОРДЕОН: инструкция + формы ==== */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => {
                                setIsInfoExpanded(v => {
                                    const next = !v;
                                    if (next) setExpandedInstructionIndexes(new Set());
                                    return next;
                                });
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                <BookOpen className="w-4 h-4 text-slate-400" />
                                Инструкция и формы выпуска препарата
                            </div>
                            {isInfoExpanded
                                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                                : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>
                        {isInfoExpanded && (
                            <div className="px-4 py-4 space-y-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
                                {parsedInstruction.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="relative">
                                            <Input
                                                value={instructionSearch}
                                                onChange={(e) => setInstructionSearch(e.target.value)}
                                                placeholder="Поиск по инструкции..."
                                                className="h-8 text-xs pr-8"
                                            />
                                            {instructionSearch.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setInstructionSearch('')}
                                                    className="absolute inset-y-0 right-2 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                                    aria-label="Очистить поиск"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        {instructionSearchQuery && (
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                Подсвечиваются все совпадения по запросу.
                                            </p>
                                        )}
                                    </div>
                                )}
                                {parsedInstruction.length > 0 && (
                                    <div className="space-y-2">
                                        {parsedInstruction.map((section, index) => {
                                            const sectionMatchCount = getMatchCount(section.text, instructionSearchQuery);
                                            const isForcedExpanded = Boolean(instructionSearchQuery) && sectionMatchCount > 0;
                                            const isSectionExpanded = isForcedExpanded || expandedInstructionIndexes.has(index);
                                            return (
                                                <div key={`${section.id}_${index}`} className={`rounded-lg border ${section.colorClass.split(' ').filter(c => c.startsWith('border')).join(' ')} overflow-hidden`}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setExpandedInstructionIndexes(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(index)) next.delete(index);
                                                                else next.add(index);
                                                                return next;
                                                            });
                                                        }}
                                                        className={`w-full px-3 py-1.5 flex items-center justify-between gap-2 ${section.colorClass.split(' ').filter(c => !c.startsWith('border')).join(' ')}`}
                                                    >
                                                        <span className="text-xs font-semibold uppercase tracking-wide text-left">{section.label}</span>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {sectionMatchCount > 0 && (
                                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/70 dark:bg-slate-900/50">
                                                                    {sectionMatchCount}
                                                                </span>
                                                            )}
                                                            {isSectionExpanded
                                                                ? <ChevronUp className="w-3.5 h-3.5" />
                                                                : <ChevronDown className="w-3.5 h-3.5" />}
                                                        </div>
                                                    </button>
                                                    {isSectionExpanded && (
                                                        <div className="px-3 py-2 bg-white dark:bg-slate-900">
                                                            <p className={`whitespace-pre-wrap leading-relaxed ${section.priority === 3 ? 'text-xs text-slate-500 dark:text-slate-400' : 'text-sm text-slate-700 dark:text-slate-300'}`}>
                                                                {renderHighlightedText(section.text)}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {forms.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                            Доступные формы выпуска
                                        </p>
                                        <div className="space-y-1.5">
                                            {forms.map(form => (
                                                <div
                                                    key={form.id}
                                                    onClick={() => { setFormId(form.id); setIsInfoExpanded(false); }}
                                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-sm ${formId === form.id
                                                        ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/30'
                                                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                                >
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                        {FORM_TYPE_LABELS[form.type || ''] || form.type}
                                                    </span>
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-slate-200">
                                                            {form.concentration || form.id}
                                                        </p>
                                                        {form.description && (
                                                            <p className="text-xs text-slate-500 mt-0.5">{form.description}</p>
                                                        )}
                                                        {form.mgPerMl && (
                                                            <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                                                                {form.mgPerMl} мг/мл
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ==== Выбор правила дозирования ==== */}
                    {matchingRulesSummary && matchingRulesSummary.length > 1 && onRuleChange && (
                        <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Правило дозирования
                            </label>
                            <div className="space-y-2">
                                {matchingRulesSummary.map(({ ruleIndex, label }) => (
                                    <label
                                        key={ruleIndex}
                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${appliedRuleIndex === ruleIndex
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                                    >
                                        <input
                                            type="radio"
                                            name="dosingRule"
                                            checked={appliedRuleIndex === ruleIndex}
                                            onChange={() => onRuleChange(ruleIndex)}
                                            className="mt-1 text-primary-600"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ==== Как рассчитана доза ==== */}
                    {calculationBreakdown?.steps?.length ? (
                        <div className="p-4 bg-primary-50 dark:bg-primary-950/20 rounded-xl border border-primary-200 dark:border-primary-900/40 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                <Calculator className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                Как рассчитана доза
                            </div>
                            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                {calculationBreakdown.steps.map((step, i) => <li key={i}>{step}</li>)}
                            </ul>
                        </div>
                    ) : matchingRulesSummary?.length ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                            Итоговые значения можно скорректировать вручную.
                        </p>
                    ) : null}

                    {/* ==== ТАБЛИЦА РАСПИСАНИЯ ПО ДНЯМ ==== */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {isMultiDay ? 'Расписание дозирования' : 'Разовая доза'}
                            </label>
                            <button
                                type="button"
                                onClick={addRow}
                                className="flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Добавить период
                            </button>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-700">
                            {isMultiDay && (
                                <div className="grid grid-cols-[120px_90px_60px_1fr_28px] gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 rounded-t-xl text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    <span>Период</span>
                                    <span>Доза (мг)</span>
                                    <span>Р/сут</span>
                                    <span>Путь</span>
                                    <span />
                                </div>
                            )}

                            {daySchedule.map((row, idx) => (
                                <div
                                    key={row.id}
                                    className={`${isMultiDay
                                        ? 'grid grid-cols-[120px_90px_60px_1fr_28px] gap-2 px-3 py-2.5 items-start'
                                        : 'p-4'
                                        } ${idx > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}
                                >
                                    {isMultiDay ? (
                                        <>
                                            <input
                                                type="text"
                                                value={row.dayLabel}
                                                onChange={e => updateRow(row.id, 'dayLabel', e.target.value)}
                                                placeholder="День 1"
                                                className={tableInputClass}
                                            />
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={row.singleDoseMg}
                                                    onChange={e => updateRow(row.id, 'singleDoseMg', e.target.value)}
                                                    placeholder="мг"
                                                    className={tableInputClass}
                                                />
                                                {patientWeight && row.singleDoseMg && parseFloat(row.singleDoseMg) > 0 && (
                                                    <p className="text-xs text-primary-500 mt-0.5 truncate">
                                                        ~{Math.round(parseFloat(row.singleDoseMg) / patientWeight * 10) / 10} мг/кг
                                                    </p>
                                                )}
                                                {/* mini calculator */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (calcOpenRowId === row.id) { setCalcOpenRowId(null); setCalcMgPerKg(''); }
                                                        else { setCalcOpenRowId(row.id); setCalcMgPerKg(''); }
                                                    }}
                                                    className="mt-1 flex items-center gap-0.5 text-xs text-slate-400 hover:text-primary-500 transition-colors"
                                                    title="Рассчитать дозу по мг/кг"
                                                >
                                                    <Calculator className="w-3 h-3" />
                                                    <span>мг/кг</span>
                                                </button>
                                                {calcOpenRowId === row.id && (
                                                    <div className="absolute left-0 top-full mt-1 z-30 w-48 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700 rounded-xl shadow-lg space-y-2">
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                value={calcMgPerKg}
                                                                onChange={e => setCalcMgPerKg(e.target.value)}
                                                                placeholder="мг/кг"
                                                                autoFocus
                                                                className="w-16 px-2 py-1 text-xs border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                                                            />
                                                            <span className="text-slate-500 whitespace-nowrap">× {patientWeight} кг</span>
                                                        </div>
                                                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                                                            {calcResultMg != null ? `= ${calcResultMg} мг` : '—'}
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => applyCalcToRow(row.id)}
                                                            disabled={calcResultMg == null}
                                                            className="w-full text-xs py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            Применить {calcResultMg != null ? `${calcResultMg} мг` : ''}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <input
                                                type="number"
                                                value={row.timesPerDay}
                                                onChange={e => updateRow(row.id, 'timesPerDay', e.target.value)}
                                                placeholder="р/сут"
                                                className={tableInputClass}
                                            />
                                            <PrettySelect<string>
                                                value={row.routeOfAdmin}
                                                onChange={(value) => updateRow(row.id, 'routeOfAdmin', value)}
                                                options={rowRouteOptions}
                                                useFixedPanel
                                                buttonClassName="h-[34px] px-2 py-1.5 text-xs rounded-lg border-slate-200 dark:border-slate-700"
                                                panelClassName="max-h-64"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeRow(row.id)}
                                                disabled={daySchedule.length === 1}
                                                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-0.5"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    ) : (
                                        /* Single-row expanded form */
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    Разовая доза (мг)
                                                </label>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    value={row.singleDoseMg}
                                                    onChange={e => updateRow(row.id, 'singleDoseMg', e.target.value)}
                                                    placeholder="Не указано"
                                                    className="w-full"
                                                />
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    {patientWeight && row.singleDoseMg && parseFloat(row.singleDoseMg) > 0 && (
                                                        <p className="text-xs text-primary-600 dark:text-primary-400">
                                                            ~{Math.round(parseFloat(row.singleDoseMg) / patientWeight * 10) / 10} мг/кг по весу
                                                        </p>
                                                    )}
                                                    {singleDoseMlPreview && (
                                                        <p className="text-xs text-primary-600 dark:text-primary-400">
                                                            ≈ {singleDoseMlPreview} мл
                                                        </p>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (calcOpenRowId === row.id) { setCalcOpenRowId(null); setCalcMgPerKg(''); }
                                                            else { setCalcOpenRowId(row.id); setCalcMgPerKg(''); }
                                                        }}
                                                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-600 transition-colors"
                                                        title="Рассчитать дозу по мг/кг"
                                                    >
                                                        <Calculator className="w-3.5 h-3.5" />
                                                        Посчитать мг/кг
                                                    </button>
                                                </div>
                                                {calcOpenRowId === row.id && (
                                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl space-y-2">
                                                        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                                                            Калькулятор дозы по весу
                                                        </p>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={calcMgPerKg}
                                                                    onChange={e => setCalcMgPerKg(e.target.value)}
                                                                    placeholder="мг/кг"
                                                                    autoFocus
                                                                    className="w-20 px-2.5 py-1.5 text-sm border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                                                                />
                                                                <span className="text-sm text-slate-500">× {patientWeight} кг</span>
                                                            </div>
                                                            <span className="text-sm font-bold text-amber-700 dark:text-amber-400 min-w-[60px]">
                                                                {calcResultMg != null ? `= ${calcResultMg} мг` : '= ?'}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => applyCalcToRow(row.id)}
                                                            disabled={calcResultMg == null}
                                                            className="px-4 py-1.5 text-xs rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            Применить {calcResultMg != null ? `${calcResultMg} мг` : ''}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    Кратность (р/сутки)
                                                </label>
                                                <Input
                                                    type="number"
                                                    value={row.timesPerDay}
                                                    onChange={e => updateRow(row.id, 'timesPerDay', e.target.value)}
                                                    placeholder="Не указано"
                                                    className="w-full"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {isMultiDay && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Пример: «День 1» — нагрузочная доза, «Дни 2–5» — поддерживающая.
                            </p>
                        )}
                    </div>

                    </div>{/* end LEFT column */}

                    {/* ——— RIGHT: prescription details ——— */}
                    <div className="space-y-3">

                    {/* ==== Форма выпуска ==== */}
                    {forms.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Форма выпуска
                            </label>
                            <PrettySelect<string>
                                value={formId}
                                onChange={setFormId}
                                options={formOptions}
                                useFixedPanel
                                searchable
                                searchPlaceholder="Поиск формы выпуска..."
                                buttonClassName="w-full px-4 py-3 rounded-xl border-slate-200 dark:border-slate-800 text-sm"
                                panelClassName="max-h-72"
                            />
                            {selectedForm && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {FORM_TYPE_LABELS[selectedForm.type || ''] || selectedForm.type}
                                    {selectedForm.description ? ` • ${selectedForm.description}` : ''}
                                    {selectedForm.mgPerMl ? ` • ${selectedForm.mgPerMl} мг/мл` : ''}
                                </p>
                            )}
                        </div>
                    )}

                    {/* ==== Описание упаковки + Длительность ==== */}
                    <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Упаковка
                        </label>
                        <Input
                            type="text"
                            value={packagingDescription}
                            onChange={(e) => setPackagingDescription(e.target.value)}
                            placeholder="Флакон 500 мг"
                            className="w-full"
                        />
                    </div>

                    {/* ==== Длительность ==== */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Длительность
                        </label>
                        <Input
                            type="text"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="5-7 дней"
                            className="w-full"
                        />
                    </div>
                    </div>{/* end packaging+duration grid */}

                    {/* ==== Инструкция по применению (свободный текст) ==== */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <AlertCircle className="w-4 h-4 text-slate-400" />
                            Инструкция по применению
                        </label>
                        <textarea
                            value={dosing}
                            onChange={(e) => setDosing(e.target.value)}
                            placeholder={autoDosingPreview || 'Например: По 10 мг/кг каждые 12 часов...'}
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 text-slate-900 dark:text-white"
                        />
                        {!dosing && autoDosingPreview && (
                            <p className="text-xs text-slate-400 italic">
                                Будет авто-заполнено из расписания: «{autoDosingPreview}»
                            </p>
                        )}
                    </div>

                    {/* ==== РАСЧЁТ СУСПЕНЗИИ ==== */}
                    {isSuspensionForm && (
                        <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Beaker className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Расчёт суспензии
                                    </label>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0 mr-1">
                                    <input
                                        type="checkbox"
                                        checked={suspensionCalcEnabled}
                                        onChange={(e) => setSuspensionCalcEnabled(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className={`relative overflow-hidden w-11 h-6 rounded-full transition-colors duration-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 ${suspensionCalcEnabled ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <span
                                            className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full border border-slate-300 bg-white transition-transform duration-200"
                                            style={{ transform: suspensionCalcEnabled ? 'translateX(20px)' : 'translateX(0px)' }}
                                        />
                                    </div>
                                </label>
                            </div>

                            {suspensionCalcEnabled && (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Укажите объём суспензии, количество мг препарата в этом объёме и разовую дозу в расписании выше.
                                    </p>
                                    <div className="grid grid-cols-2 gap-3 items-start">
                                        <div className="space-y-1.5">
                                            <label className="block min-h-[2.5rem] text-xs font-medium text-slate-700 dark:text-slate-300">
                                                Объём суспензии (мл)
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                value={suspensionVolumeMl}
                                                onChange={e => setSuspensionVolumeMl(e.target.value)}
                                                placeholder="5"
                                                className="w-full"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block min-h-[2.5rem] text-xs font-medium text-slate-700 dark:text-slate-300">
                                                Количество препарата в этом объёме (мг)
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                value={suspensionMgInBottle}
                                                onChange={e => setSuspensionMgInBottle(e.target.value)}
                                                placeholder="200"
                                                className="w-full"
                                            />
                                        </div>
                                    </div>

                                    {perDaySuspensionResults.length > 0 && suspensionCalcMgPerMl ? (
                                        isMultiDay ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-slate-500">Концентрация:</p>
                                                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                                                        {suspensionCalcMgPerMl} мг/мл
                                                    </span>
                                                </div>
                                                <div className="rounded-lg border border-teal-200 dark:border-teal-800/50 overflow-hidden">
                                                    <div className="grid grid-cols-3 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/20 border-b border-teal-200 dark:border-teal-800/50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                        <span>Период</span><span>Доза</span><span>Отмерить</span>
                                                    </div>
                                                    {perDaySuspensionResults.map((r, i) => (
                                                        <div key={i} className={`grid grid-cols-3 px-3 py-2 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}>
                                                            <span className="text-xs text-slate-600 dark:text-slate-300">{r.label}</span>
                                                            <span className="text-xs text-slate-700 dark:text-slate-200">{r.doseMg != null ? `${r.doseMg} мг` : '—'}</span>
                                                            <span className={`text-xs font-bold ${r.volumeMl != null ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`}>
                                                                {formatSuspensionVolumeMl(r.volumeMl)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-teal-200 dark:border-teal-800/50">
                                                <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Дозировка</p>
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                        {perDaySuspensionResults[0]?.doseMg != null ? `${perDaySuspensionResults[0].doseMg} мг` : '—'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Концентрация</p>
                                                    <p className="text-sm font-bold text-teal-600 dark:text-teal-400">
                                                        {suspensionCalcMgPerMl} мг/мл
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Отмерить суспензии</p>
                                                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                        {formatSuspensionVolumeMl(perDaySuspensionResults[0]?.volumeMl)}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    ) : null}

                                    {!suspensionCalcMgPerMl && (
                                        <p className="text-xs text-amber-500">
                                            Укажите объём суспензии и количество мг препарата в этом объёме
                                        </p>
                                    )}
                                    {suspensionCalcMgPerMl && perDaySuspensionResults.every(r => r.doseMg == null) && (
                                        <p className="text-xs text-amber-500">
                                            Укажите разовую дозу (мг) в расписании выше
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ==== РАЗВЕДЕНИЕ ==== */}
                    <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Beaker className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Разведение препарата
                                        {isPowderForm && (
                                            <span className="ml-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                                порошок
                                            </span>
                                        )}
                                    </label>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0 mr-1">
                                    <input
                                        type="checkbox"
                                        checked={dilutionEnabled}
                                        onChange={(e) => {
                                            setDilutionEnabled(e.target.checked);
                                            if (!e.target.checked) {
                                                setDiluentType('');
                                                setDiluentVolumeMl('');
                                            }
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div
                                        className={`relative overflow-hidden w-11 h-6 rounded-full transition-colors duration-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 ${
                                            dilutionEnabled ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
                                        }`}
                                    >
                                        <span
                                            className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full border border-slate-300 bg-white transition-transform duration-200"
                                            style={{ transform: dilutionEnabled ? 'translateX(20px)' : 'translateX(0px)' }}
                                        />
                                    </div>
                                </label>
                            </div>

                            {dilutionEnabled && (
                                <div className="space-y-4">
                                    {isPowderForm ? (
                                        /* --------- ПОРОШОК --------- */
                                        <div className="space-y-3">
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Укажите содержимое флакона и объём растворителя — концентрация и объём для шприца рассчитаются автоматически.
                                            </p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                        Мг во флаконе (порошок)
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        step="1"
                                                        value={powderVialMg}
                                                        onChange={e => setPowderVialMg(e.target.value)}
                                                        placeholder="500"
                                                        className="w-full"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                        Объём растворителя (мл)
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        step="0.5"
                                                        value={reconstitutionVolumeMl}
                                                        onChange={e => setReconstitutionVolumeMl(e.target.value)}
                                                        placeholder="10"
                                                        className="w-full"
                                                    />
                                                </div>
                                            </div>

                                            {/* Растворитель */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                    Растворитель
                                                </label>
                                                <PrettySelect<string>
                                                    value={diluentType}
                                                    onChange={(value) => setDiluentType(value as DiluentType | '')}
                                                    options={diluentOptions}
                                                    useFixedPanel
                                                    buttonClassName="w-full px-4 py-3 rounded-xl border-slate-200 dark:border-slate-800 text-sm"
                                                    panelClassName="max-h-72"
                                                />
                                            </div>

                                            {/* Результаты расчёта */}
                                            {isMultiDay && perDayDilutionResults.length > 0 ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs text-slate-500">Концентрация:</p>
                                                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                                                            {effectiveConcentration ? `${effectiveConcentration} мг/мл` : '—'}
                                                            {concentrationOverride && (
                                                                <button type="button" onClick={() => { setConcentrationOverride(false); setManualConcentration(''); }} className="ml-1 text-slate-400 hover:text-red-500" title="Вернуть авторасчёт">↺</button>
                                                            )}
                                                            {!concentrationOverride && autoConcentrationMgPerMl && (
                                                                <button type="button" onClick={() => { setConcentrationOverride(true); setManualConcentration(autoConcentrationMgPerMl.toString()); }} className="ml-1 text-slate-400 hover:text-primary-500" title="Скорректировать вручную">✎</button>
                                                            )}
                                                        </span>
                                                        {concentrationOverride && (
                                                            <input type="number" step="0.01" value={manualConcentration} onChange={e => setManualConcentration(e.target.value)} className="w-20 px-1.5 py-0.5 text-xs border border-primary-300 rounded bg-white dark:bg-slate-900 focus:outline-none" />
                                                        )}
                                                    </div>
                                                    <div className="rounded-lg border border-primary-200 dark:border-primary-900/40 overflow-hidden">
                                                        <div className="grid grid-cols-3 px-3 py-1.5 bg-primary-50 dark:bg-primary-950/20 border-b border-primary-200 dark:border-primary-900/40 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                            <span>Период</span><span>Доза</span><span>Набрать</span>
                                                        </div>
                                                        {perDayDilutionResults.map((r, i) => (
                                                            <div key={i} className={`grid grid-cols-3 px-3 py-2 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}>
                                                                <span className="text-xs text-slate-600 dark:text-slate-300">{r.label}</span>
                                                                <span className="text-xs text-slate-700 dark:text-slate-200">{r.doseMg != null ? `${r.doseMg} мг` : '—'}</span>
                                                                <span className={`text-xs font-bold ${r.volumeMl != null ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                                    {r.volumeMl != null ? `${r.volumeMl} мл` : '—'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                            <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-primary-200 dark:border-primary-900/40">
                                                {/* Концентрация */}
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                        Концентрация (мг/мл)
                                                    </p>
                                                    {concentrationOverride ? (
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={manualConcentration}
                                                                onChange={e => setManualConcentration(e.target.value)}
                                                                className="w-full"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => { setConcentrationOverride(false); setManualConcentration(''); }}
                                                                className="text-xs text-slate-400 hover:text-red-500 whitespace-nowrap px-1"
                                                                title="Вернуть авторасчёт"
                                                            >↺</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm font-bold ${autoConcentrationMgPerMl ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`}>
                                                                {autoConcentrationMgPerMl ? `${autoConcentrationMgPerMl} мг/мл` : '—'}
                                                            </span>
                                                            {autoConcentrationMgPerMl && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setConcentrationOverride(true); setManualConcentration(autoConcentrationMgPerMl.toString()); }}
                                                                    className="text-xs text-slate-400 hover:text-primary-500"
                                                                    title="Скорректировать вручную"
                                                                >✎</button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Мл для набора */}
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                        Набрать в шприц (мл)
                                                    </p>
                                                    {volumeToDrawOverride ? (
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={manualVolumeToDraw}
                                                                onChange={e => setManualVolumeToDraw(e.target.value)}
                                                                className="w-full"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => { setVolumeToDrawOverride(false); setManualVolumeToDraw(''); }}
                                                                className="text-xs text-slate-400 hover:text-red-500 whitespace-nowrap px-1"
                                                                title="Вернуть авторасчёт"
                                                            >↺</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-sm font-bold ${autoVolumeToDrawMl ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                                {autoVolumeToDrawMl ? `${autoVolumeToDrawMl} мл` : '—'}
                                                            </span>
                                                            {autoVolumeToDrawMl && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setVolumeToDrawOverride(true); setManualVolumeToDraw(autoVolumeToDrawMl.toString()); }}
                                                                    className="text-xs text-slate-400 hover:text-primary-500"
                                                                    title="Скорректировать вручную"
                                                                >✎</button>
                                                            )}
                                                        </div>
                                                    )}
                                                    {primaryDoseMg && !effectiveConcentration && (
                                                        <p className="text-xs text-amber-500">
                                                            Укажите мг и объём выше
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* --------- СТАНДАРТНОЕ РАЗВЕДЕНИЕ (ампула/раствор) --------- */
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    Кол-во вещества в ампуле (мг)
                                                </label>
                                                <Input
                                                    type="number"
                                                    step="10"
                                                    value={drugAmountMg}
                                                    onChange={e => setDrugAmountMg(e.target.value)}
                                                    placeholder="500"
                                                    className="w-full"
                                                />
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Общее кол-во действующего вещества в ампуле/флаконе
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        Растворитель
                                                    </label>
                                                    <PrettySelect<string>
                                                        value={diluentType}
                                                        onChange={(value) => setDiluentType(value as DiluentType | '')}
                                                        options={diluentOptions}
                                                        useFixedPanel
                                                        buttonClassName="w-full px-4 py-3 rounded-xl border-slate-200 dark:border-slate-800 text-sm"
                                                        panelClassName="max-h-72"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        Объём растворителя (мл)
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        step="1"
                                                        value={diluentVolumeMl}
                                                        onChange={e => setDiluentVolumeMl(e.target.value)}
                                                        placeholder="10"
                                                        className="w-full"
                                                    />
                                                </div>
                                            </div>
                                            {isMultiDay && perDayDilutionResults.length > 0 ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs text-slate-500">Концентрация:</p>
                                                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                                                            {standardConcentration ? `${standardConcentration} мг/мл` : '—'}
                                                        </span>
                                                    </div>
                                                    <div className="rounded-lg border border-primary-200 dark:border-primary-900/40 overflow-hidden">
                                                        <div className="grid grid-cols-3 px-3 py-1.5 bg-primary-50 dark:bg-primary-950/20 border-b border-primary-200 dark:border-primary-900/40 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                            <span>Период</span><span>Доза</span><span>Набрать</span>
                                                        </div>
                                                        {perDayDilutionResults.map((r, i) => (
                                                            <div key={i} className={`grid grid-cols-3 px-3 py-2 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}>
                                                                <span className="text-xs text-slate-600 dark:text-slate-300">{r.label}</span>
                                                                <span className="text-xs text-slate-700 dark:text-slate-200">{r.doseMg != null ? `${r.doseMg} мг` : '—'}</span>
                                                                <span className={`text-xs font-bold ${r.volumeMl != null ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                                    {r.volumeMl != null ? `${r.volumeMl} мл` : '—'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : standardDilutionResult ? (
                                                <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-primary-200 dark:border-primary-900/40">
                                                    <div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">Концентрация</p>
                                                        <p className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                                            {standardDilutionResult.concentrationMgPerMl} мг/мл
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">Набрать в шприц</p>
                                                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                            {standardDilutionResult.volumeToDrawMl} мл
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    </div>{/* end RIGHT column */}
                    </div>{/* end GRID */}

                {/* ==== FOOTER ==== */}
                <div className="px-5 py-3 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="min-w-[120px]">
                        Отмена
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        className="min-w-[120px]"
                        disabled={!dosing.trim() && !autoDosingPreview}
                    >
                        Подтвердить
                    </Button>
                </div>
            </div>
        </div>
    );
};

