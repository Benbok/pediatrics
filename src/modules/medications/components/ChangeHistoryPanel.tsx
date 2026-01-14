import React, { useState, useEffect } from 'react';
import { History, User } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { medicationService } from '../services/medicationService';

export const ChangeHistoryPanel: React.FC<{ medicationId: number }> = ({
    medicationId
}) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, [medicationId]);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const result = await medicationService.getChangeHistory(medicationId);
            setHistory(result);
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className="p-6 rounded-[24px]">
                <div className="text-center py-4 text-slate-500">Загрузка...</div>
            </Card>
        );
    }

    return (
        <Card className="p-6 rounded-[24px]">
            <div className="flex items-center gap-3 mb-4">
                <History className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-bold">История изменений</h3>
            </div>

            {history.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                    История изменений пуста
                </div>
            ) : (
                <div className="space-y-3">
                    {history.map((log) => (
                        <div key={log.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                                <User className="w-4 h-4 text-slate-400" />
                                <span className="text-sm font-bold">{log.user?.fullName || 'Система'}</span>
                                <span className="text-xs text-slate-400">
                                    {new Date(log.changedAt).toLocaleString('ru-RU')}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                    log.source === 'vidal_import' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                }`}>
                                    {log.source === 'vidal_import' ? '🤖 Импорт' : '✏️ Ручное'}
                                </span>
                            </div>

                            {log.changes && log.changes.length > 0 && (
                                <div className="space-y-1">
                                    {log.changes.map((change: any, cidx: number) => (
                                        <div key={cidx} className="text-xs">
                                            <strong>{change.field}:</strong>
                                            <span className="text-red-600 dark:text-red-400"> {JSON.stringify(change.oldValue)}</span>
                                            <span> → </span>
                                            <span className="text-green-600 dark:text-green-400">{JSON.stringify(change.newValue)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};
