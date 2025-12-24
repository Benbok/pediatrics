import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Baby,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import clsx from 'clsx';

export const AppShell: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // Theme State
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Apply Theme Effect
  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Главная' },
    { to: '/patients', icon: Baby, label: 'Пациенты' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-300">
      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r dark:border-slate-800 transition-all duration-300 flex flex-col",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b dark:border-slate-800">
          {isSidebarOpen && (
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              VaxTrack
            </span>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx(
                "flex items-center gap-3 p-3 rounded-lg transition-colors",
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <item.icon size={24} />
              {isSidebarOpen && <span className="font-medium whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t dark:border-slate-800 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 p-3 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            {isSidebarOpen && <span className="font-medium">{isDarkMode ? 'Светлая тема' : 'Темная тема'}</span>}
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) => clsx(
              "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
              isActive
                ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Settings size={24} />
            {isSidebarOpen && <span className="font-medium">Настройки</span>}
          </NavLink>
          <button
            onClick={() => window.electronAPI.closeApp()}
            className="w-full flex items-center gap-3 p-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={24} />
            {isSidebarOpen && <span className="font-medium">Выход</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={clsx(
          "flex-1 transition-all duration-300 min-h-screen",
          isSidebarOpen ? "ml-64" : "ml-20"
        )}
      >
        <div className="container mx-auto p-6 max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
