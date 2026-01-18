import React, { useState, useEffect, useMemo } from 'react';
import { Medication } from '../../../types';
import { medicationService } from '../../medications/services/medicationService';
import { MedicationCard } from '../../medications/components/MedicationCard';
import { Pill, Loader2, AlertCircle, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logger } from '../../../services/logger';
import { Badge } from '../../../components/ui/Badge';

interface DiseaseMedicationsTabProps {
    diseaseId: number;
    diseaseName: string;
}

export const DiseaseMedicationsTab: React.FC<DiseaseMedicationsTabProps> = ({ diseaseId, diseaseName }) => {
    const [medications, setMedications] = useState<Medication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadMedications();
    }, [diseaseId]);

    const loadMedications = async () => {
        setIsLoading(true);
        try {
            const data = await medicationService.getMedicationsByDisease(diseaseId);
            setMedications(data);
            setError(null);
        } catch (err) {
            setError('Не удалось загрузить препараты');
            logger.error('Failed to load medications for disease', { error: err, diseaseId });
        } finally {
            setIsLoading(false);
        }
    };

    // Группировка препаратов по фармакологическим группам
    // ВАЖНО: useMemo должен вызываться до всех условных возвратов (правило хуков React)
    const groupedMedications = useMemo(() => {
        const groups: Record<string, Medication[]> = {};
        
        medications.forEach(med => {
            // Используем clinicalPharmGroup, если есть, иначе pharmTherapyGroup, иначе "Прочие"
            const groupName = med.clinicalPharmGroup || med.pharmTherapyGroup || 'Прочие';
            
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(med);
        });
        
        // Сортируем группы по алфавиту, "Прочие" в конец
        const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
            if (a === 'Прочие') return 1;
            if (b === 'Прочие') return -1;
            return a.localeCompare(b, 'ru');
        });
        
        return sortedGroups;
    }, [medications]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
                <p className="font-medium">{error}</p>
            </div>
        );
    }

    if (medications.length === 0) {
        return (
            <div className="text-center py-20">
                <div className="bg-slate-50 dark:bg-slate-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Pill className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                    Препараты не найдены
                </h3>
                <p className="text-slate-500 max-w-md mx-auto">
                    Для заболевания "{diseaseName}" пока нет препаратов с совпадающими кодами МКБ-10 в базе данных
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <p className="text-slate-600 dark:text-slate-400">
                    Найдено препаратов: <span className="font-bold text-primary-600">{medications.length}</span>
                </p>
            </div>

            {groupedMedications.map(([groupName, groupMedications]) => (
                <div key={groupName} className="space-y-4">
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                        <Layers className="w-5 h-5 text-primary-500" />
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                            {groupName}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                            {groupMedications.length} {groupMedications.length === 1 ? 'препарат' : groupMedications.length < 5 ? 'препарата' : 'препаратов'}
                        </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groupMedications.map(med => (
                            <MedicationCard
                                key={med.id}
                                medication={med}
                                onSelect={(id) => navigate(`/medications/${id}?from=disease&diseaseId=${diseaseId}`)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
