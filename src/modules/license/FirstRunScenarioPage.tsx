import React from 'react';
import { ShieldCheck, UserRound, ChevronRight } from 'lucide-react';

interface Props {
  onChooseAdmin: () => void;
  onChooseUser: () => void;
}

export default function FirstRunScenarioPage({ onChooseAdmin, onChooseUser }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Первый запуск PediAssist</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-3 text-sm sm:text-base">Выберите сценарий входа, чтобы продолжить настройку</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button
            onClick={onChooseAdmin}
            className="group text-left rounded-2xl border border-blue-200 dark:border-blue-700/60 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 p-6 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600/90 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-300 group-hover:translate-x-1 transition-transform" />
            </div>
            <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100">Войти как администратор</h2>
            <p className="text-sm text-blue-800/80 dark:text-blue-200/80 mt-2 leading-relaxed">
              Импорт private.pem, создание первого admin-аккаунта и активация рабочей машины.
            </p>
          </button>

          <button
            onClick={onChooseUser}
            className="group text-left rounded-2xl border border-emerald-200 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/25 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 p-6 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/90 flex items-center justify-center">
                <UserRound className="w-6 h-6 text-white" />
              </div>
              <ChevronRight className="w-5 h-5 text-emerald-600 dark:text-emerald-300 group-hover:translate-x-1 transition-transform" />
            </div>
            <h2 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">Войти как пользователь</h2>
            <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80 mt-2 leading-relaxed">
              Получите доступ у администратора: license.json и учетные данные, затем войдите в систему.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
