import React from 'react';
import { Minimize2, Maximize2, X } from 'lucide-react';
import clsx from 'clsx';

export const TitleBar: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => {
  const [isMaximized, setIsMaximized] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);

  const handleMinimize = async () => {
    await window.electronAPI?.window?.minimize?.();
  };

  const handleMaximize = async () => {
    if (isMaximized) {
      await window.electronAPI?.window?.unmaximize?.();
    } else {
      await window.electronAPI?.window?.maximize?.();
    }
    setIsMaximized(!isMaximized);
  };

  const handleClose = async () => {
    await window.electronAPI?.window?.close?.();
  };

  React.useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.electronAPI?.window?.isMaximized?.();
      setIsMaximized(maximized || false);
    };
    checkMaximized();
  }, []);

  return (
    <div
      className={clsx(
        'h-12 flex items-center justify-between px-4 select-none border-b transition-colors duration-200 fixed w-full top-0 left-0 z-50',
        isDarkMode
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-slate-800'
          : 'bg-gradient-to-r from-white via-slate-50 to-white border-slate-200'
      )}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Left: App title and info - invisible but occupies space for drag area */}
      <div className="flex items-center gap-3 opacity-0 pointer-events-none">
        <span className="text-sm font-semibold">PediAssist</span>
      </div>

      {/* Center: Empty draggable area */}
      <div className="flex-1" />

      {/* Right: Window controls */}
      <div
        className={clsx(
          "flex items-center gap-0.5 transition-opacity duration-200",
          isHovering ? "opacity-100" : "opacity-75"
        )}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className={clsx(
            'p-2 rounded-md transition-all duration-150 hover:scale-110 active:scale-95',
            isDarkMode
              ? 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-300'
              : 'hover:bg-slate-100/80 text-slate-600 hover:text-slate-900'
          )}
          title="Свернуть (Minimize)"
        >
          <Minimize2 size={16} strokeWidth={2} />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={handleMaximize}
          className={clsx(
            'p-2 rounded-md transition-all duration-150 hover:scale-110 active:scale-95',
            isDarkMode
              ? 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-300'
              : 'hover:bg-slate-100/80 text-slate-600 hover:text-slate-900'
          )}
          title={isMaximized ? 'Восстановить (Restore)' : 'Развернуть (Maximize)'}
        >
          <Maximize2 size={16} strokeWidth={2} />
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className={clsx(
            'p-2 rounded-md transition-all duration-150 hover:scale-110 active:scale-95 ml-1',
            isDarkMode
              ? 'hover:bg-red-600/30 text-slate-400 hover:text-red-400'
              : 'hover:bg-red-100/80 text-slate-600 hover:text-red-600'
          )}
          title="Закрыть (Close)"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
