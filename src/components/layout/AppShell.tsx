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
  Moon,
  Users,
  UserCircle
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';

export const AppShell: React.FC = () => {
  const { logout, currentUser } = useAuth();
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
    ...(currentUser?.isAdmin ? [{ to: '/users', icon: Users, label: 'Пользователи' }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-500 font-sans focus:outline-none">
      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 transition-all duration-500 ease-in-out flex flex-col shadow-2xl shadow-slate-200/50 dark:shadow-none",
          isSidebarOpen ? "w-68" : "w-22"
        )}
      >
        <div className="h-20 flex items-center justify-between px-6">
          {isSidebarOpen ? (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
                <Baby className="w-5 h-5 text-white" strokeWidth={3} />
              </div>
              <span className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
                PediAssist
              </span>
            </div>
          ) : (
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-primary-500/30">
              <Baby className="w-6 h-6 text-white" strokeWidth={3} />
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx(
                "flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 group relative",
                isActive
                  ? "bg-primary-600 text-white shadow-xl shadow-primary-500/40"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} className={clsx("transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-110")} />
                  {isSidebarOpen && (
                    <span className={clsx("font-bold text-sm tracking-wide transition-opacity duration-300", isActive ? "opacity-100" : "opacity-80")}>
                      {item.label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 space-y-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={logout}
            className="w-full flex items-center gap-4 p-3.5 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all duration-300 group"
          >
            <LogOut size={22} className="group-hover:-translate-x-1 transition-transform font-bold" />
            {isSidebarOpen && <span className="font-bold text-sm">Выйти</span>}
          </button>
          <button
            onClick={() => window.electronAPI.closeApp()}
            className="w-full flex items-center gap-4 p-3.5 rounded-2xl text-red-500 hover:bg-red-600 hover:text-white transition-all duration-300 group shadow-sm hover:shadow-red-500/30"
          >
            <X size={22} strokeWidth={3} />
            {isSidebarOpen && <span className="font-bold text-sm">Закрыть</span>}
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div
        className={clsx(
          "flex-1 flex flex-col transition-all duration-500 ease-in-out",
          isSidebarOpen ? "pl-68" : "pl-22"
        )}
      >
        {/* Top Header */}
        <header className="h-20 flex items-center justify-between px-8 sticky top-0 z-40 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-900 transition-colors duration-500">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all hover:shadow-md active:scale-95 shadow-sm"
            >
              <Menu size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={isDarkMode ? 'Светлая тема' : 'Темная тема'}
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <NavLink
                to="/settings"
                className={({ isActive }) => clsx(
                  "p-2 rounded-lg transition-colors",
                  isActive ? "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <Settings size={18} />
              </NavLink>
            </div>

            <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 mx-2" />

            {currentUser && (
              <div className="flex items-center gap-3 pl-2 group cursor-pointer">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[10px] uppercase font-black text-primary-600 dark:text-primary-400 tracking-wider">
                    {currentUser.isAdmin ? 'Администратор' : 'Врач'}
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 p-0.5 shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform duration-300">
                  <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                    <UserCircle size={24} className="text-primary-600 dark:text-primary-400" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
