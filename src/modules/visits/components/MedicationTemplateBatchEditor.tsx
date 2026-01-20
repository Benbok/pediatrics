import React, { useState, useEffect } from 'react';
import { X, Pill, Check, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { MedicationTemplateItem, Medication } from '../../../types';
import { medicationService } from '../../medications/services/medicationService';
import { MedicationDoseModal, DoseData } from './MedicationDoseModal';
import { logger } from '../../../services/logger';

interface MedicationTemplateBatchEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (prescriptions: any[]) => void;
    templateItems: MedicationTemplateItem[];
    childWeight: number;
    childAgeMonths: number;
    childHeight?: number | null;
}

export const MedicationTemplateBatchEditor: React.FC<MedicationTemplateBatchEditorProps> = ({
    isOpen,
    onClose,
    onConfirm,
    templateItems,
    childWeight,
    childAgeMonths,
    childHeight,
}) => {
    const [medications, setMedications] = useState<Record<number, Medication>>({});
    const [prescriptions, setPrescriptions] = useState<Record<number, Partial<DoseData>>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [editingMedicationId, setEditingMedicationId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen && templateItems.length > 0) {
            loadMedicationsAndCalculateDoses();
        }
    }, [isOpen, templateItems]);

    const loadMedicationsAndCalculateDoses = async () => {
        setIsLoading(true);
        const meds: Record<number, Medication> = {};
        const doses: Record<number, Partial<DoseData>> = {};

        try {
            // Загружаем препараты и рассчитываем дозы параллельно
            await Promise.all(
                templateItems.map(async (item) => {
                    try {
                        const med = await medicationService.getMedication(item.medicationId);
                        meds[item.medicationId] = med;

                        // Рассчитываем дозу
                        const doseInfo = await medicationService.calculateDose(
                            item.medicationId,
                            childWeight,
                            childAgeMonths,
                            childHeight
                        );

                        // Используем override из шаблона, если есть, иначе расчетную дозу
                        doses[item.medicationId] = {
                            dosing: item.overrideInstruction || doseInfo.instruction || '',
                            duration: item.defaultDuration || '5-7 дней',
                            singleDoseMg: item.overrideSingleDoseMg ?? doseInfo.singleDoseMg,
                            timesPerDay: item.overrideTimesPerDay ?? doseInfo.timesPerDay,
                        };
                    } catch (err) {
                        logger.error('[MedicationTemplateBatchEditor] Failed to load medication', {
                            error: err,
                            medicationId: item.medicationId
                        });
                        // Используем данные из шаблона как fallback
                        doses[item.medicationId] = {
                            dosing: item.overrideInstruction || '',
                            duration: item.defaultDuration || '5-7 дней',
                            singleDoseMg: item.overrideSingleDoseMg,
                            timesPerDay: item.overrideTimesPerDay,
                        };
                    }
                })
            );

            setMedications(meds);
            setPrescriptions(doses);
        } catch (err) {
            logger.error('[MedicationTemplateBatchEditor] Failed to load medications', { error: err });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditDose = (medicationId: number) => {
        setEditingMedicationId(medicationId);
    };

    const handleDoseConfirm = (medicationId: number, doseData: DoseData) => {
        setPrescriptions(prev => ({
            ...prev,
            [medicationId]: doseData
        }));
        setEditingMedicationId(null);
    };

    const handleConfirmAll = () => {
        const prescriptionsArray = templateItems.map(item => {
            const med = medications[item.medicationId];
            const dose = prescriptions[item.medicationId] || {};
            
            return {
                medicationId: item.medicationId,
                name: med?.nameRu || 'Препарат',
                dosing: dose.dosing || '',
                duration: dose.duration || item.defaultDuration || '5-7 дней',
                singleDoseMg: dose.singleDoseMg,
                timesPerDay: dose.timesPerDay,
            };
        });

        onConfirm(prescriptionsArray);
        handleClose();
    };

    const handleClose = () => {
        setPrescriptions({});
        setMedications({});
        setEditingMedicationId(null);
        onClose();
    };

    if (!isOpen) return null;

    const currentEditingMedication = editingMedicationId ? medications[editingMedicationId] : null;
    const currentEditingDose = editingMedicationId ? prescriptions[editingMedicationId] : null;

    return (
        <>
            <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={handleClose}
            >
                <div 
                    className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-4xl w-full border dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b dark:border-slate-800 bg-primary-50 dark:bg-primary-950/20 flex justify-between items-start">
                        <div className="flex items-start gap-4 flex-1">
                            <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-2xl">
                                <Pill className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                    Применить шаблон назначений
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Проверьте и при необходимости скорректируйте дозировки препаратов
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={handleClose}
                            className="p-2 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                            </div>
                        ) : (
                            templateItems.map((item, index) => {
                                const med = medications[item.medicationId];
                                const dose = prescriptions[item.medicationId] || {};
                                
                                return (
                                    <div
                                        key={item.medicationId}
                                        className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="w-6 h-6 flex items-center justify-center bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 rounded-full text-xs font-bold">
                                                        {index + 1}
                                                    </span>
                                                    <span className="font-bold text-slate-900 dark:text-white">
                                                        {med?.nameRu || 'Загрузка...'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400 mb-2 ml-8">
                                                    {dose.dosing || 'Доза не рассчитана'}
                                                </div>
                                                <div className="text-xs text-slate-500 ml-8">
                                                    Длительность: {dose.duration || '5-7 дней'}
                                                    {(dose.singleDoseMg || dose.timesPerDay) && (
                                                        <>
                                                            {' • '}
                                                            {dose.singleDoseMg && `${dose.singleDoseMg} мг`}
                                                            {dose.timesPerDay && ` × ${dose.timesPerDay} раз/день`}
                                                        </>
                                                    )}
                                                </div>
                                                {item.notes && (
                                                    <div className="text-xs text-slate-500 italic mt-1 ml-8">
                                                        Примечание: {item.notes}
                                                    </div>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEditDose(item.medicationId)}
                                                className="text-slate-400 hover:text-primary-500"
                                            >
                                                Редактировать
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                        <Button
                            variant="ghost"
                            onClick={handleClose}
                            className="min-w-[120px]"
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleConfirmAll}
                            className="min-w-[120px]"
                            disabled={isLoading || templateItems.length === 0}
                        >
                            Применить все
                        </Button>
                    </div>
                </div>
            </div>

            {/* Dose Edit Modal */}
            {currentEditingMedication && (
                <MedicationDoseModal
                    isOpen={editingMedicationId !== null}
                    onClose={() => setEditingMedicationId(null)}
                    onConfirm={(doseData) => handleDoseConfirm(editingMedicationId!, doseData)}
                    medication={currentEditingMedication}
                    initialDoseData={currentEditingDose}
                    patientWeight={childWeight}
                    patientAgeMonths={childAgeMonths}
                    patientHeight={childHeight || null}
                />
            )}
        </>
    );
};
