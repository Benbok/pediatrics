import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Disease } from '../../../types';
import { ChevronRight, FileText, Activity } from 'lucide-react';

interface DiseaseCardProps {
    disease: Disease;
    onSelect: (id: number) => void;
    onDelete?: (id: number) => void;
}

export const DiseaseCard: React.FC<DiseaseCardProps> = ({ disease, onSelect, onDelete }) => {
    return (
        <Card
            className="p-4 hover:border-primary-500 transition-colors cursor-pointer group"
            onClick={() => disease.id && onSelect(disease.id)}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex flex-col gap-2 mb-2">
                        <div className="flex flex-wrap gap-1">
                            {(() => {
                                const codes = [];
                                // Add primary code if exists
                                if (disease.icd10Code) codes.push(disease.icd10Code);

                                // Add additional codes from array
                                if (Array.isArray(disease.icd10Codes)) {
                                    disease.icd10Codes.forEach(c => {
                                        if (c && !codes.includes(c)) codes.push(c);
                                    });
                                } else if (typeof disease.icd10Codes === 'string') {
                                    // Handle potential JSON string from DB
                                    try {
                                        const parsed = JSON.parse(disease.icd10Codes);
                                        if (Array.isArray(parsed)) {
                                            parsed.forEach(c => {
                                                if (c && !codes.includes(c)) codes.push(c);
                                            });
                                        }
                                    } catch (e) {
                                        // Ignore parsing error
                                    }
                                }

                                return codes.length > 0 ? codes : ['?'];
                            })().map((code, i) => (
                                <Badge key={`${code}-${i}`} variant="primary" className="font-mono text-xs uppercase tracking-wider">
                                    {code}
                                </Badge>
                            ))}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                            {disease.nameRu}
                        </h3>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-auto">
                        {disease.symptoms.slice(0, 4).map((symptom, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                            >
                                <Activity className="w-3 h-3 text-primary-500" />
                                {symptom}
                            </span>
                        ))}
                        {disease.symptoms.length > 4 && (
                            <span className="text-[11px] text-slate-400 self-center ml-1">
                                +{disease.symptoms.length - 4}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2 ml-4 self-center">
                    <Button variant="ghost" size="sm" className="rounded-full p-2 h-9 w-9">
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-500 transition-colors" />
                    </Button>
                </div>
            </div>

            {disease.guidelines && disease.guidelines.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-medium text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-teal-500" />
                        <span>Клинические рекомендации ({disease.guidelines.length})</span>
                    </div>
                </div>
            )}
        </Card>
    );
};
