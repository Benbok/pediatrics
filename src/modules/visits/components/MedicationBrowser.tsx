import React, { useState, useEffect, useMemo } from 'react';
import { Medication } from '../../../types';
import { useDataCache } from '../../../context/DataCacheContext';
import { logger } from '../../../services/logger';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { PrettySelect, type SelectOption } from '../../vaccination/components/PrettySelect';
import { sanitizeDisplayText } from '../../../utils/textSanitizers';
import { extractMedicationAllergyTerms, getMedicationAllergyRiskForMedication } from '../services/medicationAllergyRisk.service';
import {
    excludeMedicationsWithAllergyRisk,
    filterMedicationsForAge,
    sortMedicationsByFavoriteThenName,
} from '../utils/medicationSort';
import { Pill, Search, X, Plus, Loader2, AlertTriangle } from 'lucide-react';

const DISPLAY_LIMIT = 50;

interface MedicationBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (medication: Medication) => void;
    currentIcd10Codes?: string[]; // Для фильтрации по ICD-10
    medicationAllergyText?: string | null;
    patientAgeMonths?: number;
}

export const MedicationBrowser: React.FC<MedicationBrowserProps> = ({
    isOpen,
    onClose,
    onSelect,
    currentIcd10Codes = [],
    medicationAllergyText = null,
    patientAgeMonths,
}) => {
    const { medications: cachedMedications, loadMedications, isLoadingMedications } = useDataCache();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterByIcd10, setFilterByIcd10] = useState(false);
    const [excludeAllergyRisk, setExcludeAllergyRisk] = useState(false);
    const [filterByAge, setFilterByAge] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [expandedIcdCodes, setExpandedIcdCodes] = useState<string[]>([]);
    const [displayCount, setDisplayCount] = useState(DISPLAY_LIMIT);

    // Загрузка данных только при открытии модалки
    useEffect(() => {
        if (!isOpen) return;
        if (cachedMedications === null) {
            loadMedications();
        }
        loadExpandedIcdCodes();
        // Сбрасываем поиск и фильтры при открытии
        setSearchTerm('');
        setExcludeAllergyRisk(false);
        setFilterByAge(false);
        setSelectedGroup('');
        setDisplayCount(DISPLAY_LIMIT);
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    // При смене ICD-кодов (диагноза) перезагружаем расширенный список
    useEffect(() => {
        if (isOpen) {
            loadExpandedIcdCodes();
        }
    }, [currentIcd10Codes]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadExpandedIcdCodes = async () => {
        if (currentIcd10Codes.length === 0) {
            setExpandedIcdCodes([]);
            return;
        }
        try {
            const expanded = await window.electronAPI.getExpandedIcdCodes(currentIcd10Codes);
            setExpandedIcdCodes(expanded);
            logger.info('[MedicationBrowser] Expanded ICD codes', {
                original: currentIcd10Codes,
                expanded
            });
        } catch (error) {
            logger.error('[MedicationBrowser] Failed to expand ICD codes', { error });
            setExpandedIcdCodes(currentIcd10Codes);
        }
    };

    const hasDiagnosisMatch = (medicationCodes: string[], diagnosisCodes: string[]): boolean => {
        return medicationCodes.some(medCode =>
            diagnosisCodes.some(diseaseCode => {
                const normalizedMed = medCode.toUpperCase();
                const normalizedDisease = diseaseCode.toUpperCase();
                if (normalizedMed === normalizedDisease) return true;
                if (normalizedMed.startsWith(normalizedDisease + '.')) return true;
                if (normalizedDisease.startsWith(normalizedMed + '.')) return true;
                return false;
            })
        );
    };

    const diagnosisFilterCodes = useMemo(() => {
        if (expandedIcdCodes.length > 0) {
            return expandedIcdCodes;
        }
        return currentIcd10Codes;
    }, [expandedIcdCodes, currentIcd10Codes]);

    const allergyTerms = useMemo(
        () => extractMedicationAllergyTerms(medicationAllergyText),
        [medicationAllergyText]
    );

    const hasMedicationAllergyText = useMemo(
        () => Boolean(medicationAllergyText?.trim()),
        [medicationAllergyText]
    );

    const hasPatientAge = useMemo(
        () => typeof patientAgeMonths === 'number' && Number.isFinite(patientAgeMonths),
        [patientAgeMonths]
    );

    const allergyRiskByMedicationId = useMemo(() => {
        const risks = new Map<number, ReturnType<typeof getMedicationAllergyRiskForMedication>>();
        (cachedMedications ?? []).forEach((medication) => {
            if (!medication.id) return;
            risks.set(
                medication.id,
                getMedicationAllergyRiskForMedication(
                    {
                        nameRu: medication.nameRu,
                        activeSubstance: medication.activeSubstance,
                        clinicalPharmGroup: medication.clinicalPharmGroup,
                    },
                    allergyTerms
                )
            );
        });
        return risks;
    }, [cachedMedications, allergyTerms]);

    const medicationsForGroupOptions = useMemo(() => {
        const source = cachedMedications ?? [];
        if (!filterByIcd10 || diagnosisFilterCodes.length === 0) {
            return source;
        }
        return source.filter(med => hasDiagnosisMatch(med.icd10Codes, diagnosisFilterCodes));
    }, [cachedMedications, filterByIcd10, diagnosisFilterCodes]);

    const groupRiskSet = useMemo(() => {
        const riskyGroups = new Set<string>();

        medicationsForGroupOptions.forEach((medication) => {
            if (!medication.id || !medication.clinicalPharmGroup) return;
            const risk = allergyRiskByMedicationId.get(medication.id);
            if (risk?.hasMedicationRisk || risk?.hasGroupRisk) {
                riskyGroups.add(medication.clinicalPharmGroup);
            }
        });

        return riskyGroups;
    }, [medicationsForGroupOptions, allergyRiskByMedicationId]);

    // Уникальные группы для фильтра (при включенном ICD-фильтре только релевантные диагнозу)
    const groupSelectOptions = useMemo<Array<SelectOption<string>>>(() => {
        const seen = new Map<string, string>(); // key(lower) → rawValue
        medicationsForGroupOptions.forEach(med => {
            if (med.clinicalPharmGroup) {
                const label = sanitizeDisplayText(med.clinicalPharmGroup);
                if (label) {
                    const key = label.toLowerCase();
                    if (!seen.has(key)) seen.set(key, med.clinicalPharmGroup);
                }
            }
        });
        const sorted = Array.from(seen.entries())
            .map(([key, raw]) => {
                const sanitizedLabel = sanitizeDisplayText(raw);
                const isRiskyGroup = groupRiskSet.has(raw);
                return {
                    value: raw,
                    label: isRiskyGroup ? `[Риск аллергии] ${sanitizedLabel}` : sanitizedLabel,
                };
            })
            .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
        return [{ value: '', label: 'Все группы' }, ...sorted];
    }, [medicationsForGroupOptions, groupRiskSet]);

    useEffect(() => {
        if (!selectedGroup) {
            return;
        }

        const isSelectedGroupAvailable = groupSelectOptions.some(option => option.value === selectedGroup);
        if (!isSelectedGroupAvailable) {
            setSelectedGroup('');
        }
    }, [groupSelectOptions, selectedGroup]);

    // Фильтрация через useMemo — нет лишних re-renders и setState в useEffect
    const filteredMedications = useMemo(() => {
        let filtered = cachedMedications ?? [];

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(med =>
                med.nameRu.toLowerCase().includes(term) ||
                med.activeSubstance.toLowerCase().includes(term) ||
                med.icd10Codes.some(code => code.toLowerCase().includes(term))
            );
        }

        if (selectedGroup) {
            filtered = filtered.filter(med => med.clinicalPharmGroup === selectedGroup);
        }

        if (filterByIcd10 && diagnosisFilterCodes.length > 0) {
            filtered = filtered.filter(med => hasDiagnosisMatch(med.icd10Codes, diagnosisFilterCodes));
            filtered = sortMedicationsByFavoriteThenName(filtered);
        }

        if (filterByAge && hasPatientAge) {
            filtered = filterMedicationsForAge(filtered, patientAgeMonths as number);
        }

        if (excludeAllergyRisk && allergyTerms.length > 0) {
            filtered = excludeMedicationsWithAllergyRisk(filtered, allergyRiskByMedicationId);
        }

        return filtered;
    }, [
        cachedMedications,
        searchTerm,
        selectedGroup,
        filterByIcd10,
        diagnosisFilterCodes,
        filterByAge,
        hasPatientAge,
        patientAgeMonths,
        excludeAllergyRisk,
        allergyTerms,
        allergyRiskByMedicationId,
    ]);

    // Сброс пагинации при смене результатов фильтрации
    useEffect(() => {
        setDisplayCount(DISPLAY_LIMIT);
    }, [filteredMedications]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-4xl max-h-[90vh] m-4 flex flex-col rounded-3xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                            <Pill className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Справочник препаратов
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Лекарственные препараты из базы знаний
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Search and Filters */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-3 flex-shrink-0">
                    {hasMedicationAllergyText && (
                        <>
                            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    У пациента указана лекарственная аллергия. Препараты и группы риска помечены в списке.
                                </p>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    id="exclude-allergy-risk"
                                    checked={excludeAllergyRisk}
                                    onChange={(e) => setExcludeAllergyRisk(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-amber-600"
                                />
                                Исключить препараты риска аллергии
                            </label>
                        </>
                    )}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Поиск по названию, действующему веществу или коду МКБ-10..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-10 rounded-xl"
                        />
                        {searchTerm.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute inset-y-0 right-3 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                aria-label="Очистить поиск"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {/* Фильтр по клинико-фармакологической группе */}
                    <div className="flex items-center gap-2 w-full">
                        <div className="flex-1 w-full">
                            <PrettySelect
                                value={selectedGroup}
                                onChange={(val) => setSelectedGroup(val)}
                                options={groupSelectOptions}
                                searchable
                                searchPlaceholder="Поиск группы..."
                                emptyText="Группы не найдены"
                                buttonClassName="w-full h-9 rounded-xl text-sm"
                                panelClassName="w-full max-h-64"
                                searchInputClassName="w-full"
                            />
                        </div>
                        {selectedGroup && (
                            <button
                                type="button"
                                onClick={() => setSelectedGroup('')}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                title="Сбросить фильтр группы"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {currentIcd10Codes.length > 0 && (
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                            <input
                                type="checkbox"
                                id="filter-icd10"
                                checked={filterByIcd10}
                                onChange={(e) => setFilterByIcd10(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                            />
                            Показать только препараты для выбранного диагноза
                        </label>
                    )}
                    {hasPatientAge && (
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                            <input
                                type="checkbox"
                                id="filter-age"
                                checked={filterByAge}
                                onChange={(e) => setFilterByAge(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                            />
                            Показывать препараты для данного возраста
                        </label>
                    )}
                </div>

                {/* Medications List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoadingMedications ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                    ) : filteredMedications.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Pill className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Препараты не найдены</p>
                        </div>
                    ) : (
                        <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredMedications.slice(0, displayCount).map((med) => {
                                const risk = med.id ? allergyRiskByMedicationId.get(med.id) : undefined;
                                const hasMedicationRisk = Boolean(risk?.hasMedicationRisk);
                                const hasGroupRisk = Boolean(risk?.hasGroupRisk);

                                return (
                                    <div
                                        key={med.id}
                                        className={`p-4 rounded-2xl cursor-pointer group border-2 bg-white dark:bg-slate-800/50 hover:shadow-md transition-all duration-200 ${
                                            hasMedicationRisk
                                                ? 'border-red-300 dark:border-red-800 hover:border-red-400 hover:shadow-red-500/10'
                                                : hasGroupRisk
                                                    ? 'border-amber-300 dark:border-amber-800 hover:border-amber-400 hover:shadow-amber-500/10'
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:shadow-indigo-500/10'
                                        }`}
                                        onClick={() => {
                                            onSelect(med);
                                            onClose();
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                                                    {med.nameRu}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                                    {med.activeSubstance}
                                                </p>
                                                {(hasMedicationRisk || hasGroupRisk) && (
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {hasMedicationRisk && (
                                                            <Badge variant="error" size="sm" className="text-[10px]">
                                                                Аллергия
                                                            </Badge>
                                                        )}
                                                        {hasGroupRisk && (
                                                            <Badge variant="warning" size="sm" className="text-[10px]">
                                                                Группа риска
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                                {med.clinicalPharmGroup && (
                                                    <p
                                                        className={`text-[11px] mb-2 leading-snug truncate ${
                                                            hasGroupRisk
                                                                ? 'text-amber-700 dark:text-amber-300'
                                                                : 'text-indigo-600 dark:text-indigo-400'
                                                        }`}
                                                        title={sanitizeDisplayText(med.clinicalPharmGroup)}
                                                    >
                                                        {sanitizeDisplayText(med.clinicalPharmGroup)}
                                                    </p>
                                                )}
                                                {med.icd10Codes && med.icd10Codes.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {med.icd10Codes.slice(0, 3).map((code, idx) => (
                                                            <Badge key={idx} variant="outline" size="sm" className="font-mono text-[10px]">
                                                                {code}
                                                            </Badge>
                                                        ))}
                                                        {med.icd10Codes.length > 3 && (
                                                            <Badge variant="outline" size="sm" className="text-[10px]">
                                                                +{med.icd10Codes.length - 3}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:group-hover:bg-indigo-900/40 dark:group-hover:text-indigo-400 transition-colors">
                                                <Plus className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {filteredMedications.length > displayCount && (
                            <div className="mt-4 text-center">
                                <Button
                                    variant="ghost"
                                    onClick={() => setDisplayCount(c => c + DISPLAY_LIMIT)}
                                    className="rounded-xl text-sm"
                                >
                                    Показать ещё ({filteredMedications.length - displayCount})
                                </Button>
                            </div>
                        )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        {filteredMedications.length} препаратов
                    </span>
                    <Button variant="secondary" onClick={onClose} className="rounded-xl">
                        Закрыть
                    </Button>
                </div>
            </Card>
        </div>
    );
};
