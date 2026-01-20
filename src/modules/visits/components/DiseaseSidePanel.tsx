import React from 'react';
import { Disease } from '../../../types';
import { DiseaseKnowledgeView } from '../../diseases/components/DiseaseKnowledgeView';
import { Button } from '../../../components/ui/Button';
import { X } from 'lucide-react';

interface DiseaseSidePanelProps {
    disease: Disease | null;
    isOpen: boolean;
    onClose: () => void;
}

export const DiseaseSidePanel: React.FC<DiseaseSidePanelProps> = ({
    disease,
    isOpen,
    onClose,
}) => {
    if (!isOpen || !disease) return null;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                onClick={onClose}
            />
            
            {/* Side Panel */}
            <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl z-50 animate-in slide-in-from-right duration-300 overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 z-10">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            Карточка заболевания
                        </h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            leftIcon={<X className="w-4 h-4" />}
                        >
                            Закрыть
                        </Button>
                    </div>
                </div>
                
                <div className="p-6">
                    <DiseaseKnowledgeView disease={disease} />
                </div>
            </div>
        </>
    );
};
