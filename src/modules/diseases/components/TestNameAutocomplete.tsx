import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '../../../components/ui/Input';
import { ChevronDown, AlertCircle } from 'lucide-react';

interface TestNameAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onBlurValue?: (value: string) => void;
    availableTests: string[];
    isLoading?: boolean;
    placeholder?: string;
    className?: string;
}

/**
 * Simple substring-based autocomplete for diagnostic test names.
 * Shows dropdown when user types or clicks input.
 */
export const TestNameAutocomplete: React.FC<TestNameAutocompleteProps> = ({
    value,
    onChange,
    onBlurValue,
    availableTests,
    isLoading = false,
    placeholder = 'Например: ОАК',
    className = 'h-10'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isSelectingOptionRef = useRef(false);

    // Derived list should be computed, not stored as state.
    const filtered = useMemo(() => {
        if (!value.trim()) {
            return [];
        }

        const term = value.toLowerCase().trim();
        return availableTests
            .filter(test => test.toLowerCase().includes(term))
            .slice(0, 12);
    }, [value, availableTests]);

    useEffect(() => {
        setIsOpen(filtered.length > 0 && value.trim().length > 0);
    }, [filtered, value]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                inputRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (test: string) => {
        onChange(test);
        setIsOpen(false);
    };

    const handleFocus = () => {
        if (value.trim() && filtered.length > 0) {
            setIsOpen(true);
        }
    };

    const handleBlur = () => {
        // Clicking a suggestion triggers input blur before click handler.
        // Ignore this blur to avoid overwriting the selected option.
        if (isSelectingOptionRef.current) {
            isSelectingOptionRef.current = false;
            return;
        }

        onBlurValue?.(value);
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <Input
                ref={inputRef}
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={handleBlur}
                onFocus={handleFocus}
                placeholder={placeholder}
                className={className}
                disabled={isLoading}
            />

            {/* Dropdown Indicator */}
            {filtered.length > 0 && value.trim() && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
            )}

            {/* Dropdown List */}
            {isOpen && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
                    {filtered.map((test, idx) => (
                        <button
                            key={`${test}-${idx}`}
                            type="button"
                            onMouseDown={e => {
                                // Keep focus handling predictable while selecting from dropdown.
                                e.preventDefault();
                                isSelectingOptionRef.current = true;
                            }}
                            onClick={() => handleSelect(test)}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                        >
                            {test}
                        </button>
                    ))}
                </div>
            )}

            {/* Empty state when typing but no matches */}
            {value.trim() && filtered.length === 0 && availableTests.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Совпадений не найдено. Разрешается добавить новое название.</span>
                    </div>
                </div>
            )}
        </div>
    );
};
