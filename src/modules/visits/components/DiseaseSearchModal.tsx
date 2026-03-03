import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDataCache } from '../../../context/DataCacheContext';
import { Disease } from '../../../types';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Search, X, Loader2, AlertCircle, FileText } from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';
import { DiagnosisEntry } from '../../../types';

const DISPLAY_LIMIT = 50;

interface DiseaseSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (diagnosis: DiagnosisEntry) => void;
}

export const DiseaseSearchModal: React.FC<DiseaseSearchModalProps> = ({
    isOpen,
    onClose,
    onSelect,
}) => {
    const { diseases: cachedDiseases, loadDiseases, isLoadingDiseases } = useDataCache();
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [displayCount, setDisplayCount] = useState(DISPLAY_LIMIT);
    const modalRef = useRef<HTMLDivElement>(null);

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    const filteredDiseases = useMemo(() => {
        const base = cachedDiseases ?? [];
        if (!debouncedSearchQuery.trim()) return base;
        const q = debouncedSearchQuery.toLowerCase();
        return base.filter(d =>
            d.nameRu.toLowerCase().includes(q) ||
            d.icd10Code.toLowerCase().includes(q) ||
            (Array.isArray(d.icd10Codes) && d.icd10Codes.some(c => c.toLowerCase().includes(q)))
        );
    }, [cachedDiseases, debouncedSearchQuery]);

    useEffect(() => {
        setDisplayCount(DISPLAY_LIMIT);
    }, [filteredDiseases]);

    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (cachedDiseases === null) {
                loadDiseases().catch(() => setError('Не удалось загрузить заболевания'));
            }
            setSearchQuery('');
        }
    }, [isOpen, cachedDiseases, loadDiseases]);

    // Закрытие по клику вне модального окна
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    const handleDiseaseSelect = (disease: Disease) => {
        onSelect({
            code: disease.icd10Code,
            nameRu: disease.nameRu,
            diseaseId: disease.id,
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                            <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Выбор из базы знаний
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Выберите заболевание из базы знаний
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        leftIcon={<X className="w-4 h-4" />}
                    >
                        Закрыть
                    </Button>
                </div>

                {/* Search */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск по названию заболевания или коду МКБ..."
                            className="pl-12"
                            leftIcon={<Search className="w-5 h-5" />}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400 mb-4">
                            <AlertCircle className="w-5 h-5" />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}

                    {isLoadingDiseases && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                        </div>
                    )}

                    {!isLoadingDiseases && (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Найдено: <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredDiseases.length}</span> заболеваний
                                </p>
                            </div>

                            {filteredDiseases.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-slate-500 dark:text-slate-400">Заболевания не найдены</p>
                                </div>
                            ) : (
                                <>
                                <div className="grid grid-cols-1 gap-4">
                                    {filteredDiseases.slice(0, displayCount).map((disease) => (
                                        <Card
                                            key={disease.id}
                                            hoverable
                                            onClick={() => handleDiseaseSelect(disease)}
                                            className="cursor-pointer"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="p-2.5 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                                                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <Badge variant="primary" size="sm">
                                                            {disease.icd10Code}
                                                        </Badge>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                                            Из базы знаний
                                                        </span>
                                                    </div>
                                                    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                                                        {disease.nameRu}
                                                    </h3>
                                                    {disease.description && (
                                                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                                            {disease.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                                {filteredDiseases.length > displayCount && (
                                    <div className="flex justify-center pt-4">
                                        <Button
                                            variant="secondary"
                                            onClick={() => setDisplayCount(c => c + DISPLAY_LIMIT)}
                                            className="rounded-xl"
                                        >
                                            Показать ещё {Math.min(DISPLAY_LIMIT, filteredDiseases.length - displayCount)}
                                        </Button>
                                    </div>
                                )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
