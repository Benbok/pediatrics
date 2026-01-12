import React, { useState, useEffect } from 'react';
import { DiseaseNote } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { DiseaseNoteCard } from './DiseaseNoteCard';
import { DiseaseNoteEditor } from './DiseaseNoteEditor';
import { Button } from '../../../components/ui/Button';
import {
    Plus,
    MessageSquare,
    Search,
    Filter,
    ClipboardList
} from 'lucide-react';

interface DiseaseNotesListProps {
    diseaseId: number;
}

export const DiseaseNotesList: React.FC<DiseaseNotesListProps> = ({ diseaseId }) => {
    const { currentUser } = useAuth();
    const [notes, setNotes] = useState<DiseaseNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editingNote, setEditingNote] = useState<DiseaseNote | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'my' | 'shared'>('all');

    useEffect(() => {
        loadNotes();
    }, [diseaseId]);

    const loadNotes = async () => {
        setIsLoading(true);
        try {
            const data = await window.electronAPI.getDiseaseNotes(diseaseId);
            setNotes(data);
        } catch (error) {
            console.error('Failed to load notes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveNote = async (data: Partial<DiseaseNote>) => {
        try {
            if (data.id) {
                await window.electronAPI.updateDiseaseNote(data.id, data);
            } else {
                await window.electronAPI.createDiseaseNote({
                    ...data,
                    diseaseId
                });
            }
            setIsEditing(false);
            setEditingNote(null);
            loadNotes();
        } catch (error) {
            console.error('Failed to save note:', error);
            throw error;
        }
    };

    const handleDeleteNote = async (id: number) => {
        if (!window.confirm('Вы уверены, что хотите удалить эту заметку?')) return;

        try {
            await window.electronAPI.deleteDiseaseNote(id);
            loadNotes();
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    };

    const handleTogglePin = async (note: DiseaseNote) => {
        try {
            await window.electronAPI.updateDiseaseNote(note.id, {
                isPinned: !note.isPinned
            });
            loadNotes();
        } catch (error) {
            console.error('Failed to toggle pin:', error);
        }
    };

    const filteredNotes = notes.filter(note => {
        const matchesSearch =
            note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesFilter =
            filter === 'all' ||
            (filter === 'my' && note.authorId === currentUser?.id) ||
            (filter === 'shared' && note.isShared && note.authorId !== currentUser?.id);

        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                        <MessageSquare className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                            Клинический опыт
                        </h2>
                        <p className="text-sm text-slate-500">
                            Личные наблюдения, советы по лечению и интересные кейсы
                        </p>
                    </div>
                </div>

                {!isEditing && (
                    <Button
                        onClick={() => {
                            setEditingNote(null);
                            setIsEditing(true);
                        }}
                        className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 px-6 h-12 font-bold"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Добавить заметку
                    </Button>
                )}
            </div>

            {isEditing ? (
                <DiseaseNoteEditor
                    note={editingNote}
                    diseaseId={diseaseId}
                    onSave={handleSaveNote}
                    onCancel={() => {
                        setIsEditing(false);
                        setEditingNote(null);
                    }}
                />
            ) : (
                <>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Поиск по заметкам и тегам..."
                                className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant={filter === 'all' ? 'primary' : 'ghost'}
                                onClick={() => setFilter('all')}
                                size="sm"
                                className="rounded-xl px-4"
                            >
                                Все
                            </Button>
                            <Button
                                variant={filter === 'my' ? 'primary' : 'ghost'}
                                onClick={() => setFilter('my')}
                                size="sm"
                                className="rounded-xl px-4"
                            >
                                Мои
                            </Button>
                            <Button
                                variant={filter === 'shared' ? 'primary' : 'ghost'}
                                onClick={() => setFilter('shared')}
                                size="sm"
                                className="rounded-xl px-4"
                            >
                                Общие
                            </Button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800 rounded-[32px]" />
                            ))}
                        </div>
                    ) : filteredNotes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredNotes.map(note => (
                                <DiseaseNoteCard
                                    key={note.id}
                                    note={note}
                                    currentUserId={currentUser?.id}
                                    onEdit={() => {
                                        setEditingNote(note);
                                        setIsEditing(true);
                                    }}
                                    onDelete={handleDeleteNote}
                                    onTogglePin={handleTogglePin}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/20 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <ClipboardList className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                                Заметок пока нет
                            </h3>
                            <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed">
                                Поделитесь своим клиническим опытом или сохраните важные наблюдения для себя
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
