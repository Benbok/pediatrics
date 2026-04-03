import React from 'react';
import { DiseaseNote, getFullName } from '../../../types';
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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    const [isExpanded, setIsExpanded] = React.useState(false);
    const PREVIEW_CHAR_LIMIT = 320;
    const isAuthor = note.authorId === currentUserId;
    const formattedDate = new Date(note.createdAt).toLocaleDateString();

    const trimmedContent = note.content.trim();
    const canExpand = trimmedContent.length > PREVIEW_CHAR_LIMIT;

    const collapsedPreviewMarkdown = React.useMemo(() => {
        if (!canExpand) return note.content;

        const blocks = note.content.split(/\n{2,}/);
        const selectedBlocks: string[] = [];
        let totalLength = 0;

        for (const block of blocks) {
            const blockLength = block.length;
            if (selectedBlocks.length > 0 && totalLength + blockLength > PREVIEW_CHAR_LIMIT) {
                break;
            }

            if (selectedBlocks.length === 0 && blockLength > PREVIEW_CHAR_LIMIT) {
                const shortened = block.slice(0, PREVIEW_CHAR_LIMIT);
                const lastSpace = shortened.lastIndexOf(' ');
                selectedBlocks.push((lastSpace > 120 ? shortened.slice(0, lastSpace) : shortened).trim());
                totalLength = PREVIEW_CHAR_LIMIT;
                break;
            }

            selectedBlocks.push(block);
            totalLength += blockLength;
        }

        return `${selectedBlocks.join('\n\n').trim()}\n\n...`;
    }, [canExpand, note.content]);

    React.useEffect(() => {
        setIsExpanded(false);
    }, [note.id]);

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
                            <span>{getFullName(note.author) || 'Врач'}</span>
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

            <div className="mb-4">
                <div className="relative">
                    {isExpanded ? (
                        <div className="prose prose-sm max-w-none text-slate-600 dark:text-slate-300 prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-blockquote:my-2 prose-blockquote:border-primary-300 dark:prose-blockquote:border-primary-700 prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-300 prose-code:text-primary-700 dark:prose-code:text-primary-300 prose-code:before:content-none prose-code:after:content-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {note.content}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="prose prose-sm max-w-none text-slate-600 dark:text-slate-300 prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-blockquote:my-2 prose-blockquote:border-primary-300 dark:prose-blockquote:border-primary-700 prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-300 prose-code:text-primary-700 dark:prose-code:text-primary-300 prose-code:before:content-none prose-code:after:content-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {collapsedPreviewMarkdown}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
                {canExpand && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded(prev => !prev)}
                        className="mt-3 text-xs font-bold uppercase tracking-wide text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                    >
                        {isExpanded ? 'Свернуть' : 'Показать полностью'}
                    </button>
                )}
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
