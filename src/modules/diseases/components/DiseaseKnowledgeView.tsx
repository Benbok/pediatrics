import React, { useState, useEffect } from 'react';
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
import { DiseaseMedicationsTab } from './DiseaseMedicationsTab';
import { GuidelinesList } from './GuidelinesList';
import { clsx } from 'clsx';

interface DiseaseKnowledgeViewProps {
    disease: Disease;
}

export const DiseaseKnowledgeView: React.FC<DiseaseKnowledgeViewProps> = ({ disease }) => {
    const initialGuidelines = disease.guidelines || [];
    const [guidelines, setGuidelines] = useState<ClinicalGuideline[]>(initialGuidelines);
    const [selectedGuideline, setSelectedGuideline] = useState<ClinicalGuideline | null>(initialGuidelines[0] || null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Обновляем guidelines при изменении disease из пропсов
    useEffect(() => {
        const newGuidelines = disease.guidelines || [];
        setGuidelines(newGuidelines);
        // Если выбранный файл больше не существует, выбираем первый
        if (selectedGuideline && !newGuidelines.find(g => g.id === selectedGuideline.id)) {
            setSelectedGuideline(newGuidelines[0] || null);
        }
    }, [disease.guidelines]);

    const handleGuidelineAdded = (newGuidelines: ClinicalGuideline[]) => {
        setGuidelines(newGuidelines);
        // Если еще не выбран файл, выбираем первый (или новый)
        if (!selectedGuideline && newGuidelines.length > 0) {
            setSelectedGuideline(newGuidelines[0]);
        } else if (newGuidelines.length > 0) {
            // Обновляем selectedGuideline, если он был выбран
            const updated = newGuidelines.find(g => g.id === selectedGuideline?.id);
            if (updated) {
                setSelectedGuideline(updated);
            }
        }
    };

    const handleSearch = (term: string) => {
        setSearchTerm(term);
        if (!term.trim() || !selectedGuideline?.chunks) {
            setSearchResults([]);
            return;
        }

        try {
            // Поиск по всем файлам, если выбрано несколько
            let allMatches: any[] = [];
            
            if (selectedGuideline) {
                // Поиск только в выбранном файле
                const chunks = JSON.parse(selectedGuideline.chunks || '[]');
                const termLower = term.toLowerCase();
                const matches = chunks
                    .filter((chunk: any) =>
                        chunk.text.toLowerCase().includes(termLower) ||
                        chunk.sectionTitle?.toLowerCase().includes(termLower)
                    )
                    .map((chunk: any) => ({
                        ...chunk,
                        guidelineTitle: selectedGuideline.title,
                        guidelineId: selectedGuideline.id
                    }));
                allMatches.push(...matches);
            } else {
                // Поиск по всем файлам
                guidelines.forEach(guideline => {
                    try {
                        const chunks = JSON.parse(guideline.chunks || '[]');
                        const termLower = term.toLowerCase();
                        const matches = chunks
                            .filter((chunk: any) =>
                                chunk.text.toLowerCase().includes(termLower) ||
                                chunk.sectionTitle?.toLowerCase().includes(termLower)
                            )
                            .map((chunk: any) => ({
                                ...chunk,
                                guidelineTitle: guideline.title,
                                guidelineId: guideline.id
                            }));
                        allMatches.push(...matches);
                    } catch (e) {
                        console.error('Error parsing chunks for guideline:', guideline.id, e);
                    }
                });
            }

            setSearchResults(allMatches.slice(0, 10)); // Limit results
        } catch (e) {
            console.error('Search error:', e);
        }
    };

    const sections = [
        {
            id: 'files', label: 'Файлы', icon: FileText, isFiles: true
        },
        {
            id: 'search', label: 'Поиск в PDF', icon: Search, isSearch: true
        },
        {
            id: 'diagnosis', label: 'Диагностика', icon: Stethoscope, content: selectedGuideline ? [
                { title: 'Клиническая картина', text: selectedGuideline.clinicalPicture },
                { title: 'Жалобы и анамнез', text: selectedGuideline.complaints },
                { title: 'Физикальное обследование', text: selectedGuideline.physicalExam },
                { title: 'Лабораторная диагностика', text: selectedGuideline.labDiagnostics },
                { title: 'Инструментальная диагностика', text: selectedGuideline.instrumental },
            ] : []
        },
        {
            id: 'treatment', label: 'Лечение', icon: Pill, content: selectedGuideline ? [
                { title: 'Лечение', text: selectedGuideline.treatment },
                { title: 'Реабилитация', text: selectedGuideline.rehabilitation },
                { title: 'Профилактика', text: selectedGuideline.prevention },
            ] : []
        },
        {
            id: 'medications', label: 'Препараты', icon: Pill
        },
        {
            id: 'notes', label: 'Заметки', icon: FileText
        }
    ];

    const parsedMedications = selectedGuideline?.medications ? JSON.parse(selectedGuideline.medications) : [];

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
                    {selectedGuideline?.pdfPath && (
                        <Button
                            variant="secondary"
                            className="rounded-2xl"
                            onClick={() => window.electronAPI.openPdfAtPage(selectedGuideline.pdfPath!, 1)}
                        >
                            <Download className="w-5 h-5 mr-2" />
                            Открыть PDF
                        </Button>
                    )}
                    {guidelines.length > 1 && (
                        <Badge variant="outline" className="px-3 py-1">
                            {guidelines.length} файлов
                        </Badge>
                    )}
                </div>
            </div>

            <Card className="rounded-[32px] border-slate-200 overflow-hidden shadow-2xl bg-white dark:bg-slate-900 border-none">
                <Tabs defaultValue="files" className="w-full">
                    <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800">
                        <TabsList className="bg-slate-100/80 dark:bg-slate-800/40 p-1.5 rounded-[22px] inline-flex h-auto border border-slate-200/50 dark:border-slate-700/50">
                            {sections.map(s => (
                                <TabsTrigger
                                    key={s.id}
                                    value={s.id}
                                    className={clsx(
                                        "px-6 py-2.5 rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all duration-300 flex items-center gap-2.5 border-none",
                                        "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                                        "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-primary-600 data-[state=active]:shadow-xl data-[state=active]:shadow-primary-500/10"
                                    )}
                                >
                                    <s.icon className="w-4 h-4 stroke-[2.5]" />
                                    {s.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="p-8">
                        <TabsContent value="files" className="mt-0 focus-visible:outline-none">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                                    Загруженные файлы ({guidelines.length})
                                </h3>
                                <GuidelinesList
                                    diseaseId={disease.id!}
                                    onGuidelineSelect={(guideline) => {
                                        setSelectedGuideline(guideline);
                                        setSearchTerm(''); // Сброс поиска при смене файла
                                        setSearchResults([]);
                                    }}
                                    selectedGuidelineId={selectedGuideline?.id}
                                    onGuidelineAdded={handleGuidelineAdded}
                                />
                            </div>
                        </TabsContent>

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
                                                {result.guidelineTitle && (
                                                    <Badge variant="outline" size="sm" className="text-[10px]">
                                                        {result.guidelineTitle}
                                                    </Badge>
                                                )}
                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                    {result.sectionTitle}
                                                </span>
                                            </div>
                                            {result.guidelineId && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        const guideline = guidelines.find(g => g.id === result.guidelineId);
                                                        if (guideline?.pdfPath) {
                                                            window.electronAPI.openPdfAtPage(guideline.pdfPath, result.page);
                                                        }
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <ExternalLink className="w-4 h-4 mr-2" />
                                                    Перейти к странице
                                                </Button>
                                            )}
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

                        {sections.filter(s => !s.isSearch && !s.isFiles && s.content).map(s => (
                            <TabsContent key={s.id} value={s.id} className="mt-0 focus-visible:outline-none">
                                {!selectedGuideline ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>Выберите файл для просмотра информации</p>
                                    </div>
                                ) : (
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
                                            <div className="col-span-2 py-20 text-center bg-slate-50/50 dark:bg-slate-800/20 rounded-[32px] border-2 border-dashed border-slate-100 dark:border-slate-800/50">
                                                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-slate-600">
                                                    <BookOpen className="w-8 h-8" />
                                                </div>
                                                <p className="text-slate-400 font-medium max-w-xs mx-auto italic">
                                                    Для получения подробной информации по этому разделу используйте вкладку <span className="text-primary-500 font-bold not-italic">"Поиск в PDF"</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </TabsContent>
                        ))}

                        <TabsContent value="medications" className="mt-0 focus-visible:outline-none">
                            <DiseaseMedicationsTab diseaseId={disease.id} diseaseName={disease.nameRu} />
                        </TabsContent>

                        <TabsContent value="notes" className="mt-0 focus-visible:outline-none">
                            <DiseaseNotesList diseaseId={disease.id} />
                        </TabsContent>
                    </div>
                </Tabs>
            </Card>
        </div>
    );
};
