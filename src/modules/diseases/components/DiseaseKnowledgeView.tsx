import React, { useState } from 'react';
import { Disease, ClinicalGuideline } from '../../../types';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/Tabs';
import {
    BookOpen,
    Stethoscope,
    Pill,
    FileText,
    Search,
    ExternalLink,
    Download,
    Info,
    AlertTriangle,
    CheckCircle,
    MessageSquare
} from 'lucide-react';
import { DiseaseNotesList } from './DiseaseNotesList';
import { clsx } from 'clsx';

interface DiseaseKnowledgeViewProps {
    disease: Disease;
}

export const DiseaseKnowledgeView: React.FC<DiseaseKnowledgeViewProps> = ({ disease }) => {
    const guideline = disease.guidelines?.[0];
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    const handleSearch = (term: string) => {
        setSearchTerm(term);
        if (!term.trim() || !guideline.chunks) {
            setSearchResults([]);
            return;
        }

        try {
            const chunks = JSON.parse(guideline.chunks);
            const termLower = term.toLowerCase();

            const matches = chunks.filter((chunk: any) =>
                chunk.text.toLowerCase().includes(termLower) ||
                chunk.sectionTitle?.toLowerCase().includes(termLower)
            ).slice(0, 10); // Limit results

            setSearchResults(matches);
        } catch (e) {
            console.error('Search error:', e);
        }
    };

    const sections = [
        {
            id: 'search', label: 'Поиск в PDF', icon: Search, isSearch: true
        },
        {
            id: 'diagnosis', label: 'Диагностика', icon: Stethoscope, content: [
                { title: 'Клиническая картина', text: guideline.clinicalPicture },
                { title: 'Жалобы и анамнез', text: guideline.complaints },
                { title: 'Физикальное обследование', text: guideline.physicalExam },
                { title: 'Лабораторная диагностика', text: guideline.labDiagnostics },
                { title: 'Инструментальная диагностика', text: guideline.instrumental },
            ]
        },
        {
            id: 'treatment', label: 'Лечение', icon: Pill, content: [
                { title: 'Лечение', text: guideline.treatment },
                { title: 'Реабилитация', text: guideline.rehabilitation },
                { title: 'Профилактика', text: guideline.prevention },
            ]
        },
        {
            id: 'notes', label: 'Заметки', icon: FileText
        }
    ];

    const parsedMedications = guideline.medications ? JSON.parse(guideline.medications) : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="primary" className="font-mono text-sm px-3 py-1">
                            {disease.icd10Code}
                        </Badge>
                        <div className="flex gap-1 flex-wrap">
                            {Array.isArray(disease.icd10Codes) && disease.icd10Codes
                                .filter((c: string) => c && c !== disease.icd10Code)
                                .map((code: string) => (
                                    <Badge key={code} variant="outline" size="sm" className="font-mono opacity-60">
                                        {code}
                                    </Badge>
                                ))}
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
                        {disease.nameRu}
                    </h1>
                </div>

                <div className="flex gap-2">
                    {guideline?.pdfPath && (
                        <Button
                            variant="secondary"
                            className="rounded-2xl"
                            onClick={() => window.electronAPI.openPdfAtPage(guideline.pdfPath!, 1)}
                        >
                            <Download className="w-5 h-5 mr-2" />
                            Открыть PDF
                        </Button>
                    )}
                </div>
            </div>

            <Card className="rounded-[32px] border-slate-200 overflow-hidden shadow-2xl bg-white dark:bg-slate-900 border-none">
                <Tabs defaultValue="search" className="w-full">
                    <div className="px-8 pt-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                        <TabsList className="bg-transparent space-x-8 h-14">
                            {sections.map(s => (
                                <TabsTrigger
                                    key={s.id}
                                    value={s.id}
                                    className="px-0 py-4 font-bold text-slate-500 data-[state=active]:text-primary-600 data-[state=active]:border-b-2 data-[state=active]:border-primary-600 rounded-none transition-all flex items-center gap-2"
                                >
                                    <s.icon className="w-5 h-5" />
                                    {s.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="p-8">
                        <TabsContent value="search" className="mt-0 focus-visible:outline-none">
                            <div className="max-w-2xl mb-8">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        placeholder="Поиск по тексту клинических рекомендаций..."
                                        className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-primary-500 outline-none transition-all text-lg"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                {searchResults.map((result, idx) => (
                                    <Card key={idx} className="p-6 rounded-3xl border-slate-100 dark:border-slate-800 hover:border-primary-200 transition-all group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="default" className="bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                                                    Стр. {result.page}
                                                </Badge>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                    {result.sectionTitle}
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => window.electronAPI.openPdfAtPage(guideline.pdfPath!, result.page)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <ExternalLink className="w-4 h-4 mr-2" />
                                                Перейти к странице
                                            </Button>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                            {result.text.length > 300 ? result.text.substring(0, 300) + '...' : result.text}
                                        </p>
                                    </Card>
                                ))}

                                {searchTerm && searchResults.length === 0 && (
                                    <div className="text-center py-12 text-slate-400 italic">
                                        Ничего не найдено по вашему запросу
                                    </div>
                                )}

                                {!searchTerm && (
                                    <div className="text-center py-12">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Search className="w-10 h-10 text-slate-300" />
                                        </div>
                                        <p className="text-slate-400">
                                            Введите ключевое слово (например: "антибиотики", "диагностика", "доза"), <br />
                                            чтобы найти нужную информацию в документе
                                        </p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {sections.filter(s => !s.isSearch && s.content).map(s => (
                            <TabsContent key={s.id} value={s.id} className="mt-0 focus-visible:outline-none">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {s.content?.filter(c => c.text).map((item, idx) => (
                                        <div key={idx} className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-6 bg-primary-500 rounded-full" />
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 italic">
                                                    {item.title}
                                                </h3>
                                            </div>
                                            <div className="text-slate-600 dark:text-slate-400 leading-relaxed text-[15px] p-5 rounded-[24px] bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                                                {item.text}
                                            </div>
                                        </div>
                                    ))}
                                    {s.content?.filter(c => c.text).length === 0 && (
                                        <div className="col-span-2 py-12 text-center text-slate-400 italic">
                                            Для новых записей используйте вкладку "Поиск в PDF" для быстрого доступа к информации.
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        ))}

                        <TabsContent value="notes" className="mt-0 focus-visible:outline-none">
                            <DiseaseNotesList diseaseId={disease.id} />
                        </TabsContent>
                    </div>
                </Tabs>
            </Card>
        </div>
    );
};
