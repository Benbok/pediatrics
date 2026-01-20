import React, { useState, useEffect, useRef } from 'react';
import { diseaseService } from '../../diseases/services/diseaseService';
import { Disease } from '../../../types';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Search, X, Loader2, AlertCircle, FileText } from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';
import { DiagnosisEntry } from '../../../types';
import { logger } from '../../../services/logger';

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
    const [diseases, setDiseases] = useState<Disease[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    useEffect(() => {
        if (isOpen) {
            loadDiseases();
            setSearchQuery('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && debouncedSearchQuery.trim()) {
            performSearch();
        } else if (isOpen && !debouncedSearchQuery.trim()) {
            loadDiseases();
        }
    }, [debouncedSearchQuery, isOpen]);

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

    const loadDiseases = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const allDiseases = await diseaseService.getDiseases();
            setDiseases(allDiseases);
        } catch (err: any) {
            setError('Не удалось загрузить заболевания');
            logger.error('[DiseaseSearchModal] Failed to load diseases:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const performSearch = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Получаем все заболевания и фильтруем локально
            const allDiseases = await diseaseService.getDiseases();
            const query = debouncedSearchQuery.toLowerCase().trim();
            
            const filtered = allDiseases.filter(disease => {
                const nameMatch = disease.nameRu.toLowerCase().includes(query);
                const codeMatch = disease.icd10Code.toLowerCase().includes(query);
                const additionalCodesMatch = Array.isArray(disease.icd10Codes) 
                    ? disease.icd10Codes.some(code => code.toLowerCase().includes(query))
                    : false;
                return nameMatch || codeMatch || additionalCodesMatch;
            });
            
            setDiseases(filtered);
        } catch (err: any) {
            setError('Ошибка при поиске заболеваний');
            logger.error('[DiseaseSearchModal] Search failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

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

                    {isLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                        </div>
                    )}

                    {!isLoading && (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Найдено: <span className="font-semibold text-slate-700 dark:text-slate-300">{diseases.length}</span> заболеваний
                                </p>
                            </div>

                            {diseases.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-slate-500 dark:text-slate-400">Заболевания не найдены</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {diseases.map((disease) => (
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
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
