import React, { useState, useEffect } from 'react';
import { DiseaseNote } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import {
    X,
    Save,
    Tag as TagIcon,
    Share2,
    Pin,
    AlertCircle
} from 'lucide-react';

interface DiseaseNoteEditorProps {
    note?: DiseaseNote | null; // null for new note
    diseaseId: number;
    onSave: (data: Partial<DiseaseNote>) => Promise<void>;
    onCancel: () => void;
}

export const DiseaseNoteEditor: React.FC<DiseaseNoteEditorProps> = ({
    note,
    diseaseId,
    onSave,
    onCancel
}) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    const [isShared, setIsShared] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (note) {
            setTitle(note.title);
            setContent(note.content);
            setTags(note.tags || []);
            setIsPinned(note.isPinned);
            setIsShared(note.isShared);
        } else {
            // Defaults for new note
            setTitle('');
            setContent('');
            setTags([]);
            setIsPinned(false);
            setIsShared(false);
        }
    }, [note]);

    const handleAddTag = () => {
        const tag = tagInput.trim().toLowerCase().replace(/#/g, '');
        if (tag && !tags.includes(tag)) {
            setTags([...tags, tag]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tag: string) => {
        setTags(tags.filter(t => t !== tag));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError('Введите заголовок заметки');
            return;
        }

        if (!content.trim()) {
            setError('Введите текст заметки');
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                id: note?.id,
                diseaseId,
                title,
                content,
                tags,
                isPinned,
                isShared
            });
        } catch (err: any) {
            setError(err.message || 'Ошибка при сохранении заметки');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="p-6 rounded-[32px] border-none shadow-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {note ? 'Редактировать заметку' : 'Новая клиническая заметка'}
                </h3>
                <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-full w-10 h-10 p-0">
                    <X className="w-5 h-5" />
                </Button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
                {/* Title */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                        Заголовок
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Например: Особенности терапии у детей до года"
                        className="w-full h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-slate-900 dark:text-white font-bold"
                    />
                </div>

                {/* Content */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                        Текст заметки
                    </label>
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Ваши наблюдения, советы по лечению, практические нюансы..."
                        className="w-full min-h-[200px] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-slate-800 dark:text-slate-200 text-sm leading-relaxed"
                    />
                </div>

                {/* Tags */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1 flex items-center gap-1">
                        <TagIcon className="w-4 h-4" />
                        Теги
                    </label>
                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                            placeholder="Добавить тег..."
                            className="flex-1 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                        />
                        <Button type="button" variant="secondary" onClick={handleAddTag} className="rounded-xl px-4">
                            OK
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-xs font-bold ring-1 ring-primary-100 dark:ring-primary-800">
                                #{tag}
                                <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>

                {/* Options */}
                <div className="flex gap-6 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-10 h-6 rounded-full relative transition-colors ${isPinned ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-800'}`}>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={isPinned}
                                onChange={e => setIsPinned(e.target.checked)}
                            />
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPinned ? 'left-5' : 'left-1'}`} />
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Pin className={`w-4 h-4 ${isPinned ? 'text-amber-500 fill-current' : 'text-slate-400'}`} />
                            Закрепить вверху
                        </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-10 h-6 rounded-full relative transition-colors ${isShared ? 'bg-teal-400' : 'bg-slate-200 dark:bg-slate-800'}`}>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={isShared}
                                onChange={e => setIsShared(e.target.checked)}
                            />
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isShared ? 'left-5' : 'left-1'}`} />
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Share2 className={`w-4 h-4 ${isShared ? 'text-teal-500' : 'text-slate-400'}`} />
                            Поделиться с коллегами
                        </span>
                    </label>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving} className="h-12 px-6 rounded-2xl">
                        Отмена
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSaving}
                        className="h-12 px-8 rounded-2xl bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/20"
                    >
                        <Save className="w-4 h-4 mr-2 text-white" />
                        <span className="text-white font-bold">{note ? 'Обновить заметку' : 'Сохранить заметку'}</span>
                    </Button>
                </div>
            </form>
        </Card>
    );
};
