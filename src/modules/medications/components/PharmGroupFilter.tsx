import React, { useState, useEffect, useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import { medicationService } from '../services/medicationService';
import { logger } from '../../../services/logger';
import { sanitizeDisplayText } from '../../../utils/textSanitizers';
import { PrettySelect, type SelectOption } from '../../vaccination/components/PrettySelect';

type GroupOption = {
    value: string;
    label: string;
};

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
            logger.error('[PharmGroupFilter] Failed to load groups', { error });
        }
    };

    const groupOptions = useMemo<GroupOption[]>(() => {
        const byLabel = new Map<string, GroupOption>();

        groups.forEach((rawValue) => {
            const label = sanitizeDisplayText(rawValue);
            if (!label) {
                return;
            }

            const key = label.toLowerCase();
            if (!byLabel.has(key)) {
                byLabel.set(key, {
                    value: rawValue,
                    label,
                });
            }
        });

        return Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    }, [groups]);

    const selectOptions = useMemo<Array<SelectOption<string>>>(() => {
        return [
            { value: '', label: 'Все группы' },
            ...groupOptions.map((option) => ({ value: option.value, label: option.label })),
        ];
    }, [groupOptions]);

    const selectedLabel = useMemo(() => {
        if (!selectedGroup) {
            return null;
        }

        const selected = groupOptions.find((option) => option.value === selectedGroup);
        return selected ? selected.label : sanitizeDisplayText(selectedGroup);
    }, [groupOptions, selectedGroup]);

    const handleSelect = (group: string) => {
        const newGroup = group || null;
        setSelectedGroup(newGroup);
        onGroupSelect(newGroup);
    };

    return (
        <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-500 shrink-0">
                <Filter className="w-3.5 h-3.5" />
                Группа
            </div>

            <div className="flex-1 min-w-0">
                <PrettySelect
                    value={selectedGroup ?? ''}
                    onChange={handleSelect}
                    options={selectOptions}
                    searchable
                    searchPlaceholder="Поиск группы..."
                    emptyText="Группы не найдены"
                    buttonClassName="h-10 rounded-xl"
                    panelClassName="max-h-72"
                />
            </div>

            {selectedGroup && (
                <button
                    type="button"
                    onClick={() => handleSelect(selectedGroup)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                    title="Сбросить фильтр"
                >
                    <X className="w-4 h-4" />
                </button>
            )}

            <div className="hidden xl:block text-[11px] text-slate-400 shrink-0">
                {selectedLabel ? `Выбрано: ${selectedLabel}` : `${groupOptions.length} групп`}
            </div>
        </div>
    );
};
