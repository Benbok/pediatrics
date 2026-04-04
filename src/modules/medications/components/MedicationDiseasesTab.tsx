import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Stethoscope, Loader2, AlertCircle, ExternalLink, Info,
    Search, Plus, X, CheckCircle2, Link2,
} from 'lucide-react';
import { medicationService } from '../services/medicationService';
import { diseaseService } from '../../diseases/services/diseaseService';
import { Disease } from '../../../types';
import { Badge } from '../../../components/ui/Badge';
import { logger } from '../../../services/logger';

interface LinkedDisease {
    id: number;
    icd10Code: string;
    nameRu: string;
    nameEn?: string | null;
    description: string;
    priority?: number;
    dosing?: string | null;
    duration?: string | null;
}

interface MedicationDiseasesTabProps {
    medicationId: number;
    icd10Codes: string[];
    /** Вызывается после привязки болезни с обновлённым списком кодов МКБ-10 препарата */
    onIcd10CodesUpdated?: (codes: string[]) => void;
}

export const MedicationDiseasesTab: React.FC<MedicationDiseasesTabProps> = ({
    medicationId,
    icd10Codes,
    onIcd10CodesUpdated,
}) => {
    const [diseases, setDiseases] = useState<LinkedDisease[]>([]);
    const [allDiseases, setAllDiseases] = useState<Disease[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Поиск и привязка
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [linkingId, setLinkingId] = useState<number | null>(null);
    const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
    const [linkedSuccess, setLinkedSuccess] = useState<number | null>(null);
    const [selectedPriority, setSelectedPriority] = useState<1 | 2>(1);
    const searchRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadLinkedDiseases();
        diseaseService.getDiseases()
            .then(setAllDiseases)
            .catch(err => logger.error('[MedicationDiseasesTab] Failed to load all diseases', { error: err }));
    }, [medicationId]);

    // Закрытие дропдауна при клике вне
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const loadLinkedDiseases = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await medicationService.getMedication(medicationId);
            const linked: LinkedDisease[] = (data.diseases ?? []).map((dm: any) => ({
                id: dm.disease.id,
                icd10Code: dm.disease.icd10Code,
                nameRu: dm.disease.nameRu,
                nameEn: dm.disease.nameEn,
                description: dm.disease.description,
                priority: dm.priority,
                dosing: dm.dosing,
                duration: dm.duration,
            }));
            setDiseases(linked);
        } catch (err) {
            setError('Не удалось загрузить связанные болезни');
            logger.error('[MedicationDiseasesTab] Failed to load linked diseases', { error: err, medicationId });
        } finally {
            setIsLoading(false);
        }
    };

    // Болезни для дропдауна — исключаем уже привязанные
    const linkedIds = useMemo(() => new Set(diseases.map(d => d.id)), [diseases]);

    const dropdownOptions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return [];
        return allDiseases
            .filter(d => !linkedIds.has(d.id))
            .filter(d =>
                d.nameRu.toLowerCase().includes(q) ||
                d.icd10Code.toLowerCase().includes(q) ||
                (d.icd10Codes ?? []).some((c: string) => c.toLowerCase().includes(q))
            )
            .slice(0, 8);
    }, [searchQuery, allDiseases, linkedIds]);

    const handleLink = async (disease: Disease) => {
        setLinkingId(disease.id);
        setShowDropdown(false);
        setSearchQuery('');
        try {
            // 1. Создать явную связь DiseaseMedication
            await medicationService.linkToDisease({
                diseaseId: disease.id,
                medicationId,
                priority: selectedPriority,
            });

            // 2. Собрать все коды болезни (primary + все доп.)
            const diseaseCodes = [
                disease.icd10Code,
                ...(disease.icd10Codes ?? []),
            ].map(c => c.trim().toUpperCase()).filter(Boolean);

            // 3. Смержить с текущими кодами препарата без дублей
            const merged = Array.from(new Set([...icd10Codes, ...diseaseCodes]));

            // 4. Сохранить обновлённые коды в препарате
            const current = await medicationService.getMedication(medicationId);
            await medicationService.upsertMedication(
                { ...current, icd10Codes: merged } as any,
                'manual'
            );

            // 5. Уведомить родителя об обновлённых кодах
            onIcd10CodesUpdated?.(merged);

            setLinkedSuccess(disease.id);
            setTimeout(() => setLinkedSuccess(null), 2000);
            await loadLinkedDiseases();
        } catch (err: any) {
            setError(err.message || 'Не удалось создать связь');
        } finally {
            setLinkingId(null);
        }
    };

    const handleUnlink = async (disease: LinkedDisease) => {
        setUnlinkingId(disease.id);
        try {
            await medicationService.unlinkFromDisease(disease.id, medicationId);
            await loadLinkedDiseases();
        } catch (err: any) {
            setError(err.message || 'Не удалось удалить связь');
        } finally {
            setUnlinkingId(null);
        }
    };

    const priorityLabel = (priority?: number) => {
        if (priority === 1) return { label: 'Первая линия', color: 'success' as const };
        if (priority === 2) return { label: 'Альтернатива', color: 'primary' as const };
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Поиск и привязка */}
            <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-primary-500" />
                    Привязать заболевание
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Поиск */}
                    <div ref={searchRef} className="relative flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => {
                                    const value = e.target.value;
                                    const capitalized = value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
                                    setSearchQuery(capitalized);
                                    setShowDropdown(true);
                                }}
                                onFocus={() => searchQuery.trim() && setShowDropdown(true)}
                                placeholder="Поиск по названию или коду МКБ..."
                                className="w-full pl-9 pr-4 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                            />
                        </div>

                        {/* Дропдаун результатов */}
                        {showDropdown && dropdownOptions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
                                {dropdownOptions.map(disease => (
                                    <button
                                        key={disease.id}
                                        type="button"
                                        onClick={() => handleLink(disease)}
                                        disabled={linkingId === disease.id}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 disabled:opacity-60"
                                    >
                                        {linkingId === disease.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-primary-500 shrink-0" />
                                        ) : (
                                            <Plus className="w-4 h-4 text-primary-500 shrink-0" />
                                        )}
                                        <span className="font-mono text-xs font-bold text-slate-500 shrink-0">
                                            {disease.icd10Code}
                                        </span>
                                        <span className="text-sm font-medium text-slate-800 dark:text-white truncate">
                                            {disease.nameRu}
                                        </span>
                                        {linkedSuccess === disease.id && (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                        {showDropdown && searchQuery.trim() && dropdownOptions.length === 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 px-4 py-3 text-sm text-slate-500">
                                Болезней не найдено
                            </div>
                        )}
                    </div>

                    {/* Приоритет */}
                    <select
                        value={selectedPriority}
                        onChange={e => setSelectedPriority(Number(e.target.value) as 1 | 2)}
                        className="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-primary-500 transition-all shrink-0"
                    >
                        <option value={1}>Первая линия</option>
                        <option value={2}>Альтернатива</option>
                    </select>
                </div>
            </div>

            {/* Ошибка */}
            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                    <button type="button" onClick={() => setError(null)} className="ml-auto">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Список привязанных болезней */}
            {isLoading ? (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                </div>
            ) : diseases.length === 0 ? (
                <div className="text-center py-12">
                    <div className="bg-slate-50 dark:bg-slate-900/50 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Stethoscope className="w-7 h-7 text-slate-300" />
                    </div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Нет привязанных болезней
                    </p>
                    <p className="text-xs text-slate-400">
                        Используйте строку поиска выше, чтобы добавить связь
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Info className="w-3.5 h-3.5" />
                        <span>
                            Привязано болезней: <strong className="text-primary-600">{diseases.length}</strong>
                        </span>
                    </div>
                    {diseases.map(disease => {
                        const prio = priorityLabel(disease.priority);
                        const isUnlinking = unlinkingId === disease.id;
                        return (
                            <div
                                key={disease.id}
                                className="group flex items-start gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary-300 dark:hover:border-primary-700 transition-all"
                            >
                                {/* Инфо */}
                                <div
                                    className="flex-1 min-w-0 cursor-pointer"
                                    onClick={() => navigate(`/diseases/${disease.id}`)}
                                >
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                                            {disease.icd10Code}
                                        </span>
                                        {prio && (
                                            <Badge variant={prio.color} className="text-xs">
                                                {prio.label}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="font-semibold text-slate-900 dark:text-white text-sm leading-snug">
                                        {disease.nameRu}
                                    </p>
                                    {disease.nameEn && (
                                        <p className="text-xs text-slate-400 mt-0.5">{disease.nameEn}</p>
                                    )}
                                    {(disease.dosing || disease.duration) && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {disease.dosing && (
                                                <span className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                                    Доза: {disease.dosing}
                                                </span>
                                            )}
                                            {disease.duration && (
                                                <span className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                                    Курс: {disease.duration}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Кнопки */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/diseases/${disease.id}`)}
                                        className="p-2 rounded-xl text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-all"
                                        title="Открыть заболевание"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleUnlink(disease)}
                                        disabled={isUnlinking}
                                        className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all disabled:opacity-50"
                                        title="Отвязать заболевание"
                                    >
                                        {isUnlinking
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <X className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

