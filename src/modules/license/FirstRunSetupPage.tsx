import React, { useState, useEffect } from 'react';

/**
 * FirstRunSetupPage — экран первоначальной настройки администратора.
 * Поток:
 *   1) Импорт private.pem
 *   2) Автосоздание admin/admin + генерация лицензии текущей машины
 *   3) Переход на страницу логина
 */

interface Props {
  onSetupComplete: () => void;
}

type Step = 'key' | 'done';

export default function FirstRunSetupPage({ onSetupComplete }: Props) {
  const [step, setStep] = useState<Step>('key');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyImported, setKeyImported] = useState(false);
  const [machineId, setMachineId] = useState('');

  useEffect(() => {
    window.electronAPI?.licenseAdminCheckKey?.().then((res) => {
      if (res.exists) setKeyImported(true);
    });
    window.electronAPI?.getLicenseFingerprint?.().then((res) => {
      if (res?.fingerprint) setMachineId(res.fingerprint);
    });
  }, []);

  async function runBootstrap() {
    setLoading(true);
    setError('');
    try {
      // 1. Create first admin user with fixed defaults
      const setupRes = await window.electronAPI!.firstRunSetup!({ username: 'admin', password: 'admin' });
      if (!setupRes.success) {
        setError(setupRes.error ?? 'Не удалось создать admin-пользователя');
        return;
      }

      // 2. Generate own license for current machine
      const ownLicenseRes = await window.electronAPI!.licenseAdminGenerateOwnLicense!();
      if (!ownLicenseRes.success) {
        setError(ownLicenseRes.error ?? 'Пользователь создан, но не удалось сгенерировать лицензию');
        return;
      }

      setStep('done');
    } catch (err: any) {
      setError(err?.message ?? 'Ошибка первоначальной настройки');
    } finally {
      setLoading(false);
    }
  }

  async function handleImportAndContinue() {
    setLoading(true);
    setError('');
    try {
      const res = await window.electronAPI!.licenseAdminImportKey!();
      if (!res.success) {
        setError(res.error ?? 'Импорт ключа отменен или не удался');
        return;
      }
      setKeyImported(true);
      await runBootstrap();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Настройка администратора</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">Шаг 1: импорт private.pem, затем автоматический входной bootstrap</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-xl">
          {step === 'key' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Импорт private.pem</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  После импорта будут автоматически созданы учетные данные по умолчанию:
                  <span className="text-blue-300"> логин: admin, пароль: admin</span>.
                  Пароль можно сменить позже в Настройки → Пользователи.
                </p>
              </div>

              {keyImported && (
                <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-xl p-3 text-emerald-700 dark:text-emerald-300 text-sm">
                  Ключ найден. Можно продолжать bootstrap.
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-3 text-red-700 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleImportAndContinue}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Инициализация...
                  </>
                ) : 'Импортировать private.pem и продолжить'}
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Bootstrap завершен</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Лицензия для этой машины создана. Можно войти в систему.</p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-left text-sm text-blue-800 dark:text-blue-200 space-y-1.5">
                <p className="font-semibold text-blue-900 dark:text-blue-100">Учетные данные по умолчанию:</p>
                <p>• Логин: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">admin</code></p>
                <p>• Пароль: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">admin</code></p>
                <p>• Пароль можно сменить в Настройки → Пользователи</p>
              </div>

              {machineId && (
                <div className="bg-slate-100 dark:bg-slate-700 rounded-xl p-4 text-left border border-slate-200 dark:border-slate-600">
                  <p className="text-slate-500 dark:text-slate-400 text-xs mb-1.5">Machine ID этой машины</p>
                  <p className="text-emerald-700 dark:text-emerald-300 text-xs font-mono break-all">{machineId}</p>
                </div>
              )}

              <button
                onClick={onSetupComplete}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Перейти к логину
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
