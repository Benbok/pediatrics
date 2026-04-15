import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
};

interface PrettySelectProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: Array<SelectOption<T>>;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  buttonClassName?: string;
  panelClassName?: string;
  searchInputClassName?: string;
  /** Render the dropdown panel with position:fixed to escape overflow:hidden/auto containers */
  useFixedPanel?: boolean;
}

export const PrettySelect = <T extends string | number,>({
  value,
  onChange,
  options,
  searchable = false,
  searchPlaceholder = 'Поиск...',
  emptyText = 'Ничего не найдено',
  buttonClassName = '',
  panelClassName = '',
  searchInputClassName = '',
  useFixedPanel = false,
}: PrettySelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const computePanelStyle = () => {
    if (!useFixedPanel || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    // Estimated panel height: up to 10 options * ~36px + search bar ~48px
    const estimatedPanelHeight = 408;
    const spaceBelow = viewportHeight - rect.bottom - 4;
    const spaceAbove = rect.top - 4;
    const openUpward = spaceBelow < estimatedPanelHeight && spaceAbove > spaceBelow;
    setPanelStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      maxHeight: `${Math.min(estimatedPanelHeight, openUpward ? spaceAbove : spaceBelow)}px`,
      ...(openUpward
        ? { bottom: viewportHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }
    if (useFixedPanel) {
      computePanelStyle();
      const onScroll = (event: Event) => {
        // Don't close when scrolling inside the panel itself
        if (panelRef.current && panelRef.current.contains(event.target as Node)) return;
        setIsOpen(false);
      };
      window.addEventListener('scroll', onScroll, true);
      return () => window.removeEventListener('scroll', onScroll, true);
    }
  }, [isOpen]);

  const selected = options.find((opt) => opt.value === value) ?? options[0];

  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, searchable, searchQuery]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) computePanelStyle();
          setIsOpen((prev) => !prev);
        }}
        className={[
          'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between transition-colors hover:border-blue-400',
          buttonClassName,
        ].join(' ').trim()}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate text-left">{selected?.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className={[
            useFixedPanel
              ? 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-y-auto'
              : 'absolute z-20 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden',
            panelClassName,
          ].join(' ').trim()}
          style={useFixedPanel ? panelStyle : undefined}
        >
          {searchable && (
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className={[
                  'w-full px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                  searchInputClassName,
                ].join(' ').trim()}
                autoFocus
              />
            </div>
          )}

          <ul role="listbox" className="max-h-64 overflow-auto py-1">
            {filteredOptions.map((opt) => (
              <li key={String(opt.value)}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    opt.value === value
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                  role="option"
                  aria-selected={opt.value === value}
                >
                  {opt.label}
                </button>
              </li>
            ))}

            {filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                {emptyText}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
