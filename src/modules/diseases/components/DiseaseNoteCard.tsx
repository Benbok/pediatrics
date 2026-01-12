import React from 'react';
import { DiseaseNote } from '../../../types';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import {
    Pin,
    Share2,
    Edit2,
    Trash2,
    User as UserIcon,
    Clock,
    Tag
} from 'lucide-react';
import { clsx } from 'clsx';

interface DiseaseNoteCardProps {
    note: DiseaseNote;
    currentUserId?: number;
    onEdit: (note: DiseaseNote) => void;
    onDelete: (id: number) => void;
    onTogglePin: (note: DiseaseNote) => void;
}

export const DiseaseNoteCard: React.FC<DiseaseNoteCardProps> = ({
    note,
    currentUserId,
    onEdit,
    onDelete,
    onTogglePin
}) => {
    const isAuthor = note.authorId === currentUserId;
    const formattedDate = new Date(note.createdAt).toLocaleDateString();

    return (
        <Card className={clsx(
            "p-5 rounded-[32px] transition-all duration-300 border-none shadow-md hover:shadow-lg relative group",
            note.isPinned ? "bg-amber-50/50 dark:bg-amber-900/10 ring-1 ring-amber-200 dark:ring-amber-800" : "bg-white dark:bg-slate-900"
        )}>
            {note.isPinned && (
                <div className="absolute -top-2 -right-2 bg-amber-400 text-white p-1.5 rounded-full shadow-lg">
                    <Pin className="w-3.5 h-3.5 fill-current" />
                </div>
            )}

            <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">
                        {note.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                            <UserIcon className="w-3 h-3" />
                            <span>{note.author?.fullName || 'Врач'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formattedDate}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isAuthor && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onTogglePin(note)}
                                className={clsx("w-8 h-8 p-0 rounded-full", note.isPinned ? "text-amber-500" : "text-slate-400")}
                            >
                                <Pin className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(note)}
                                className="w-8 h-8 p-0 rounded-full text-blue-500"
                            >
                                <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(note.id)}
                                className="w-8 h-8 p-0 rounded-full text-red-500"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </>
                    )}
                    {note.isShared && !isAuthor && (
                        <div className="p-2 text-teal-500" title="Общая заметка">
                            <Share2 className="w-4 h-4" />
                        </div>
                    )}
                </div>
            </div>

            <div className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-wrap mb-4">
                {note.content}
            </div>

            {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <Tag className="w-3 h-3 text-slate-300 mt-1" />
                    {note.tags.map(tag => (
                        <Badge key={tag} variant="outline" size="sm" className="bg-slate-50 dark:bg-slate-800 border-none text-[10px] text-slate-500 font-bold px-2 py-0">
                            #{tag}
                        </Badge>
                    ))}
                </div>
            )}
        </Card>
    );
};
