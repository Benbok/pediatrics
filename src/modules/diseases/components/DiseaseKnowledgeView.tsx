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
    AlertCircle,
    CheckCircle,
    MessageSquare,
    ChevronDown,
    Check
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
    const [searchTerm, setSearchTerm] = useState('');
    const [searchFileId, setSearchFileId] = useState<number | 'all'>('all');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Обновляем guidelines при изменении disease из пропсов
    useEffect(() => {
        const newGuidelines = disease.guidelines || [];
    }, [disease.guidelines]);

    const handleGuidelineAdded = (newGuidelines: ClinicalGuideline[]) => {
        setGuidelines(newGuidelines);
    };

    useEffect(() => {
        if (!searchTerm.trim() || guidelines.length === 0) {
            setSearchResults([]);
            return;
        }

        const timeoutId = setTimeout(() => {
            try {
                let allMatches: any[] = [];

                const targetGuidelines = searchFileId === 'all'
                    ? guidelines
                    : guidelines.filter(g => g.id === searchFileId);

                // Поиск по выбранным файлам
                targetGuidelines.forEach(guideline => {
                    try {
                        const chunks = JSON.parse(guideline.chunks || '[]');
                        const termLower = searchTerm.toLowerCase();
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

                setSearchResults(allMatches.slice(0, 20)); // Limit results
            } catch (e) {
                console.error('Search error:', e);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchTerm, searchFileId, guidelines]);

    const hasRedFlags = disease.redFlags && disease.redFlags.length > 0;

    const sections = [
        {
            id: 'files', label: 'Файлы', icon: FileText, isFiles: true
        },
        {
            id: 'search', label: 'Поиск в PDF', icon: Search, isSearch: true
        },
        {
            id: 'diagnosis', label: 'Диагностика', icon: Stethoscope, content: []
        },
        {
            id: 'treatment', label: 'Лечение', icon: Pill, content: []
        },
        ...(hasRedFlags ? [{ id: 'red-flags', label: 'Красные флаги', icon: AlertTriangle }] : []),
        {
            id: 'medications', label: 'Препараты', icon: Pill
        },
        {
            id: 'notes', label: 'Заметки', icon: MessageSquare
        }
    ];


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
                                    onGuidelineAdded={handleGuidelineAdded}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="search" className="mt-0 focus-visible:outline-none">
                            <div className="flex flex-col md:flex-row gap-4 mb-8">
                                <div className="relative flex-1">
                                    <div className="absolute left-4 top-0 bottom-0 flex items-center justify-center pointer-events-none">
                                        <Search className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Поиск по тексту..."
                                        className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-primary-500 outline-none transition-all text-lg"
                                    />
                                </div>
                                <div className="relative min-w-[260px] md:max-w-xs">
                                    <button
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className={clsx(
                                            "w-full h-14 px-4 flex items-center justify-between rounded-2xl border-2 transition-all outline-none",
                                            "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200",
                                            isDropdownOpen
                                                ? "border-slate-300 dark:border-slate-600"
                                                : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                                        )}
                                    >
                                        <span className="truncate pr-2 font-bold text-sm">
                                            {searchFileId === 'all'
                                                ? 'Во всех файлах'
                                                : guidelines.find(g => g.id === searchFileId)?.title.replace(/^Клинические рекомендации:\s*/, '') || 'Выберите файл'}
                                        </span>
                                        <ChevronDown className={clsx("w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0", isDropdownOpen && "rotate-180")} />
                                    </button>

                                    {isDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                                            <div className="absolute top-full text-slate-700 dark:text-slate-200 mt-2 right-0 w-full min-w-[280px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200 max-h-[400px] overflow-y-auto custom-scrollbar p-1.5 ring-1 ring-slate-900/5">
                                                <div
                                                    onClick={() => { setSearchFileId('all'); setIsDropdownOpen(false); }}
                                                    className={clsx(
                                                        "px-4 py-3 rounded-xl cursor-pointer flex items-center justify-between transition-colors text-sm font-bold",
                                                        searchFileId === 'all' ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                    )}
                                                >
                                                    Во всех файлах
                                                    {searchFileId === 'all' && <Check className="w-4 h-4 text-primary-600" />}
                                                </div>

                                                {guidelines.length > 0 && <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5 mx-2" />}

                                                {guidelines.map(g => {
                                                    const title = g.title.replace(/^Клинические рекомендации:\s*/, '');
                                                    const isSelected = searchFileId === g.id;
                                                    return (
                                                        <div
                                                            key={g.id}
                                                            onClick={() => { setSearchFileId(g.id); setIsDropdownOpen(false); }}
                                                            className={clsx(
                                                                "px-4 py-3 rounded-xl cursor-pointer flex items-center justify-between transition-colors text-sm font-medium",
                                                                isSelected ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                            )}
                                                        >
                                                            <span className="truncate mr-3">{title}</span>
                                                            {isSelected && <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-8">
                                {(Object.entries(searchResults.reduce((acc, result) => {
                                    const key = result.guidelineTitle || 'Unknown';
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(result);
                                    return acc;
                                }, {} as Record<string, any[]>)) as [string, any[]][]).map(([title, results], groupIdx) => (
                                    <div key={groupIdx} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${groupIdx * 100}ms` }}>
                                        <div className="flex items-center gap-3 mb-4 px-2">
                                            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-lg">
                                                {title}
                                            </h4>
                                            <Badge variant="outline" className="ml-auto">
                                                {results.length} совпадений
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            {results.map((result: any, idx: number) => (
                                                <Card key={idx} className="p-5 rounded-2xl border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-primary-800 transition-all group bg-white dark:bg-slate-900">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Badge variant="default" className="bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-400 border-primary-100 dark:border-primary-900">
                                                                Стр. {result.page}
                                                            </Badge>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">
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
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity h-8"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                                                Перейти
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-200 dark:bg-primary-800 rounded-full" />
                                                        <p className="pl-4 text-slate-600 dark:text-slate-400 leading-relaxed italic text-sm">
                                                            "{result.text.length > 300 ? result.text.substring(0, 300) + '...' : result.text}"
                                                        </p>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
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
                                <div className="space-y-8">
                                    {/* Guideline content */}
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
                                    </div>

                                    {/* Additional structured data for Diagnostics tab */}
                                    {s.id === 'diagnosis' && (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                                            {/* Diagnostic Plan */}
                                            {(disease.diagnosticPlan || []).length > 0 ? (
                                                <Card className="p-6 rounded-3xl border-slate-100 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-950/10">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">План диагностики</h3>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {(disease.diagnosticPlan || []).map((item: any, idx: number) => (
                                                            <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/50">
                                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                                    <span className="font-semibold text-slate-900 dark:text-white">{item.test}</span>
                                                                    <Badge
                                                                        variant={item.priority === 'high' ? 'default' : 'outline'}
                                                                        className={clsx(
                                                                            "text-xs",
                                                                            item.priority === 'high' && "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                                                        )}
                                                                    >
                                                                        {item.priority || 'medium'}
                                                                    </Badge>
                                                                </div>
                                                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                                                    {item.type === 'lab' ? '🧪 Лабораторное' : '🏥 Инструментальное'}
                                                                </div>
                                                                {item.rationale && (
                                                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.rationale}</p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </Card>
                                            ) : (
                                                <div className="p-6 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 text-center">
                                                    <p className="text-slate-400 italic">План диагностики не заполнен</p>
                                                </div>
                                            )}

                                            {/* Differential Diagnosis */}
                                            {(disease.differentialDiagnosis || []).length > 0 ? (
                                                <Card className="p-6 rounded-3xl border-slate-100 dark:border-slate-800 bg-amber-50/30 dark:bg-amber-950/10">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Дифференциальная диагностика</h3>
                                                    </div>
                                                    <ul className="space-y-2">
                                                        {(disease.differentialDiagnosis || []).map((item: string, idx: number) => (
                                                            <li key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/50">
                                                                <CheckCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                                                <span className="text-slate-700 dark:text-slate-300">{item}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </Card>
                                            ) : (
                                                <div className="p-6 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 text-center">
                                                    <p className="text-slate-400 italic">Дифференциальная диагностика не заполнена</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Additional structured data for Treatment tab */}
                                    {s.id === 'treatment' && (
                                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                            {(disease.treatmentPlan || []).length > 0 ? (
                                                <Card className="p-6 rounded-3xl border-slate-100 dark:border-slate-800 bg-green-50/30 dark:bg-green-950/10">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <Pill className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">План лечения</h3>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {(disease.treatmentPlan || []).map((item: any, idx: number) => (
                                                            <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-green-100 dark:border-green-900/50">
                                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                                    <span className="font-semibold text-slate-900 dark:text-white">{item.description}</span>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {item.priority || 'medium'}
                                                                    </Badge>
                                                                </div>
                                                                <div className="inline-block px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-xs text-green-700 dark:text-green-400 font-medium">
                                                                    {item.category}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </Card>
                                            ) : (
                                                <div className="p-6 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 text-center">
                                                    <p className="text-slate-400 italic">План лечения не заполнен</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        ))}

                        {/* Red Flags Tab */}
                        {hasRedFlags && (
                            <TabsContent value="red-flags" className="mt-0 focus-visible:outline-none">
                                <Card className="p-8 rounded-3xl border-rose-200 dark:border-rose-900/50 bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/20 dark:to-orange-950/20">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center">
                                            <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-rose-900 dark:text-rose-100">Красные флаги</h3>
                                            <p className="text-sm text-rose-600 dark:text-rose-400">Признаки, требующие немедленного внимания</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {(disease.redFlags || []).map((item: string, idx: number) => (
                                            <div key={idx} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-rose-200 dark:border-rose-900/50 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex items-start gap-3">
                                                    <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
                                                    <span className="text-slate-800 dark:text-slate-200 leading-relaxed">{item}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </TabsContent>
                        )}

                        <TabsContent value="medications" className="mt-0 focus-visible:outline-none">
                            <DiseaseMedicationsTab diseaseId={disease.id} diseaseName={disease.nameRu} />
                        </TabsContent>

                        <TabsContent value="notes" className="mt-0 focus-visible:outline-none">
                            <DiseaseNotesList diseaseId={disease.id} />
                        </TabsContent>
                    </div>
                </Tabs >
            </Card >
        </div >
    );
};
