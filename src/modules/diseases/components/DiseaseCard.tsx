import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Disease } from '../../../types';
import { FileText, Activity } from 'lucide-react';

interface DiseaseCardProps {
    disease: Disease;
    onSelect: (id: number) => void;
    onDelete?: (id: number) => void;
}

export const DiseaseCard: React.FC<DiseaseCardProps> = ({ disease, onSelect, onDelete }) => {
    return (
        <Card
            className="relative p-4 border-slate-200 dark:border-slate-800 transition-all duration-200 cursor-pointer group before:content-[''] before:absolute before:inset-0 before:rounded-xl before:border-2 before:border-sky-500/90 dark:before:border-sky-400/80 before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100 before:pointer-events-none"
            onClick={() => disease.id && onSelect(disease.id)}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex flex-col gap-2 mb-2">
                        <div className="flex flex-wrap gap-1">
                            {(() => {
                                const codes: string[] = [];
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
                                {typeof symptom === 'object' && symptom !== null && 'text' in symptom ? symptom.text : String(symptom)}
                            </span>
                        ))}
                        {disease.symptoms.length > 4 && (
                            <span className="text-[11px] text-slate-400 self-center ml-1">
                                +{disease.symptoms.length - 4}
                            </span>
                        )}
                    </div>
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
