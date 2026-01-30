import React, { useState, useEffect } from 'react';
import { Medication } from '../../../types';
import { medicationService } from '../../medications/services/medicationService';
import { logger } from '../../../services/logger';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Pill, Search, X, Plus, Loader2 } from 'lucide-react';

interface MedicationBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (medication: Medication) => void;
    currentIcd10Codes?: string[]; // Для фильтрации по ICD-10
}

export const MedicationBrowser: React.FC<MedicationBrowserProps> = ({
    isOpen,
    onClose,
    onSelect,
    currentIcd10Codes = []
}) => {
    const [medications, setMedications] = useState<Medication[]>([]);
    const [filteredMedications, setFilteredMedications] = useState<Medication[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [filterByIcd10, setFilterByIcd10] = useState(false);
    const [expandedIcdCodes, setExpandedIcdCodes] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadMedications();
            loadExpandedIcdCodes();
        }
    }, [isOpen, currentIcd10Codes]);

    useEffect(() => {
        filterMedications();
    }, [searchTerm, filterByIcd10, medications, expandedIcdCodes]);

    const loadMedications = async () => {
        setIsLoading(true);
        try {
            const data = await medicationService.getMedications();
            setMedications(data);
        } catch (error) {
            logger.error('[MedicationBrowser] Failed to load medications', { error });
        } finally {
            setIsLoading(false);
        }
    };

    const loadExpandedIcdCodes = async () => {
        if (currentIcd10Codes.length === 0) {
            setExpandedIcdCodes([]);
            return;
        }
        try {
            // Получаем расширенный список кодов (все коды из заболеваний, содержащих выбранные диагнозы)
            const expanded = await window.electronAPI.getExpandedIcdCodes(currentIcd10Codes);
            setExpandedIcdCodes(expanded);
            logger.info('[MedicationBrowser] Expanded ICD codes', { 
                original: currentIcd10Codes, 
                expanded 
            });
        } catch (error) {
            logger.error('[MedicationBrowser] Failed to expand ICD codes', { error });
            setExpandedIcdCodes(currentIcd10Codes); // Fallback to original codes
        }
    };

    const filterMedications = () => {
        let filtered = medications;

        // Фильтр по поисковому запросу
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(med =>
                med.nameRu.toLowerCase().includes(term) ||
                med.activeSubstance.toLowerCase().includes(term) ||
                med.icd10Codes.some(code => code.toLowerCase().includes(term))
            );
        }

        // Фильтр по ICD-10 кодам (используем расширенные коды из заболеваний)
        // expandedIcdCodes содержит ВСЕ коды из заболеваний базы знаний,
        // которые содержат выбранные диагнозы
        if (filterByIcd10 && expandedIcdCodes.length > 0) {
            filtered = filtered.filter(med =>
                med.icd10Codes.some(medCode => 
                    expandedIcdCodes.some(diseaseCode => {
                        const normalizedMed = medCode.toUpperCase();
                        const normalizedDisease = diseaseCode.toUpperCase();
                        
                        // Точное совпадение
                        if (normalizedMed === normalizedDisease) return true;
                        
                        // Частичное совпадение в обе стороны
                        if (normalizedMed.startsWith(normalizedDisease + '.')) return true;
                        if (normalizedDisease.startsWith(normalizedMed + '.')) return true;
                        
                        return false;
                    })
                )
            );
        }

        setFilteredMedications(filtered);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-4xl max-h-[90vh] m-4 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Справочник препаратов
                    </h2>
                    <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Search and Filters */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Поиск по названию, действующему веществу или коду МКБ-10..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 rounded-xl"
                        />
                    </div>
                    {currentIcd10Codes.length > 0 && (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="filter-icd10"
                                checked={filterByIcd10}
                                onChange={(e) => setFilterByIcd10(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-primary-600"
                            />
                            <label htmlFor="filter-icd10" className="text-sm text-slate-600 dark:text-slate-400">
                                Показать только препараты для выбранного диагноза
                            </label>
                        </div>
                    )}
                </div>

                {/* Medications List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                        </div>
                    ) : filteredMedications.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Pill className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Препараты не найдены</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredMedications.map((med) => (
                                <Card
                                    key={med.id}
                                    className="p-4 rounded-2xl border-slate-100 dark:border-slate-800 hover:border-primary-300 transition-all cursor-pointer group"
                                    onClick={() => {
                                        onSelect(med);
                                        onClose();
                                    }}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="font-bold text-slate-800 dark:text-white group-hover:text-primary-600 transition-colors">
                                            {med.nameRu}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="text-xs text-slate-500 mb-2">
                                        {med.activeSubstance}
                                    </div>
                                    {med.icd10Codes && med.icd10Codes.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
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
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div className="text-sm text-slate-500">
                        Найдено: <strong>{filteredMedications.length}</strong> из {medications.length}
                    </div>
                    <Button variant="primary" onClick={onClose} className="rounded-xl">
                        Закрыть
                    </Button>
                </div>
            </Card>
        </div>
    );
};
