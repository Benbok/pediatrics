import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { medicationService } from '../services/medicationService';

export const PharmGroupFilter: React.FC<{
    onGroupSelect: (group: string | null) => void;
}> = ({ onGroupSelect }) => {
    const [groups, setGroups] = useState<string[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            const result = await medicationService.getPharmacologicalGroups();
            setGroups(result);
        } catch (error) {
            console.error('Failed to load groups:', error);
        }
    };

    const handleSelect = (group: string) => {
        const newGroup = selectedGroup === group ? null : group;
        setSelectedGroup(newGroup);
        onGroupSelect(newGroup);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                <Filter className="w-4 h-4" />
                Клинико-фармакологические группы
            </div>
            
            <div className="flex flex-wrap gap-2">
                {groups.map(group => (
                    <button
                        key={group}
                        onClick={() => handleSelect(group)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border ${
                            selectedGroup === group
                                ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                        }`}
                    >
                        {group}
                    </button>
                ))}
            </div>
        </div>
    );
};
