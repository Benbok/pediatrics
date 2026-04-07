import React, { useState, useEffect } from 'react';

/**
 * FirstRunSetupPage — Экран первоначальной настройки разработчика.
 *
 * Отображается при первом запуске приложения (нет пользователей в БД).
 * Шаги:
 *   1. Импорт приватного ключа (private.pem) через файловый диалог
 *   2. Установка логина и пароля администратора
 *   3. Готово — показ Machine ID + инструкций
 */

interface Props {
  /** Вызывается после успешного завершения настройки */
  onSetupComplete: () => void;
}

type Step = 'key' | 'credentials' | 'done';

export default function FirstRunSetupPage({ onSetupComplete }: Props) {
  const [step, setStep] = useState<Step>('key');

  // Step: key
  const [keyImporting, setKeyImporting] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [keyImported, setKeyImported] = useState(false);

  // Step: credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [credError, setCredError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Step: done
  const [machineId, setMachineId] = useState('');

  // Check if key was already imported (e.g., dev env with keys/ fallback)
  useEffect(() => {
    window.electronAPI?.licenseAdminCheckKey?.().then((res) => {
      if (res.exists) setKeyImported(true);
    });
    window.electronAPI?.getLicenseFingerprint?.().then((res) => {
      if (res?.fingerprint) setMachineId(res.fingerprint);
    });
  }, []);

  // ── Step 1: Import key ────────────────────────────────────────────────────

  async function handleImportKey() {
    setKeyImporting(true);
    setKeyError('');
    try {
      const res = await window.electronAPI!.licenseAdminImportKey!();
      if (res.success) {
        setKeyImported(true);
        setStep('credentials');
      } else {
        setKeyError(res.error ?? 'Не удалось импортировать ключ');
      }
    } catch (err: any) {
      setKeyError(err?.message ?? 'Ошибка');
    } finally {
      setKeyImporting(false);
    }
  }

  // ── Step 2: Set credentials ───────────────────────────────────────────────

  async function handleSetupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCredError('');

    if (username.trim().length < 3) {
      setCredError('Логин должен быть минимум 3 символа');
      return;
    }
    if (password.length < 6) {
      setCredError('Пароль должен быть минимум 6 символов');
      return;
    }
    if (password !== passwordConfirm) {
      setCredError('Пароли не совпадают');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create admin user
      const setupRes = await window.electronAPI!.firstRunSetup!({ username: username.trim(), password });
      if (!setupRes.success) {
        setCredError(setupRes.error ?? 'Ошибка создания пользователя');
        return;
      }

      // 2. Generate own license (for developer's machine)
      const licRes = await window.electronAPI!.licenseAdminGenerateOwnLicense!();
      if (!licRes.success) {
        setCredError(`Пользователь создан, но ошибка генерации лицензии: ${licRes.error}`);
        return;
      }

      setStep('done');
    } catch (err: any) {
      setCredError(err?.message ?? 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Первоначальная настройка</h1>
          <p className="text-slate-400 mt-1 text-sm">Только для разработчика / администратора системы</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {(['key', 'credentials', 'done'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${step === s ? 'bg-blue-600 text-white' :
                  ((['key', 'credentials', 'done'].indexOf(step) > i) ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400')}`}>
                {(['key', 'credentials', 'done'].indexOf(step) > i) ? '✓' : i + 1}
              </div>
              {i < 2 && <div className={`h-px w-12 ${['key', 'credentials', 'done'].indexOf(step) > i ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 shadow-xl">

          {/* ── Step 1: Import key ── */}
          {step === 'key' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Шаг 1: Приватный ключ</h2>
                <p className="text-slate-400 text-sm">
                  Импортируйте файл <code className="bg-slate-700 px-1 rounded text-blue-300">private.pem</code> с вашего защищённого носителя.
                  Ключ будет скопирован в защищённое хранилище приложения и не покинет эту машину.
                </p>
              </div>

              {keyImported && (
                <div className="flex items-center gap-3 bg-emerald-900/30 border border-emerald-700 rounded-xl p-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-emerald-300 font-medium text-sm">Ключ уже присутствует</p>
                    <p className="text-emerald-400/70 text-xs">Можно перейти к следующему шагу</p>
                  </div>
                </div>
              )}

              {keyError && (
                <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 text-red-300 text-sm">
                  {keyError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleImportKey}
                  disabled={keyImporting}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {keyImporting ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                  {keyImporting ? 'Импорт...' : 'Выбрать private.pem'}
                </button>
                {keyImported && (
                  <button
                    onClick={() => setStep('credentials')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-xl transition-colors"
                  >
                    Далее →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Credentials ── */}
          {step === 'credentials' && (
            <form onSubmit={handleSetupSubmit} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Шаг 2: Учётная запись администратора</h2>
                <p className="text-slate-400 text-sm">Создайте логин и пароль для входа в систему. Запомните их — восстановить без переустановки невозможно.</p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Логин администратора</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  autoComplete="new-password"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Подтверждение пароля</label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Повторите пароль"
                  autoComplete="new-password"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {credError && (
                <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 text-red-300 text-sm">
                  {credError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('key')}
                  className="px-5 py-3 text-slate-400 hover:text-white border border-slate-600 hover:border-slate-500 rounded-xl transition-colors text-sm"
                >
                  ← Назад
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Настройка...
                    </>
                  ) : 'Завершить настройку'}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">Настройка завершена!</h2>
                <p className="text-slate-400 text-sm mt-1">Лицензия для вашей машины сгенерирована автоматически.</p>
              </div>

              {machineId && (
                <div className="bg-slate-700 rounded-xl p-4 text-left">
                  <p className="text-slate-400 text-xs mb-1.5">Machine ID вашей машины</p>
                  <p className="text-emerald-300 text-xs font-mono break-all">{machineId}</p>
                </div>
              )}

              <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 text-left text-sm text-blue-200 space-y-1.5">
                <p className="font-semibold text-blue-100">Следующие шаги:</p>
                <p>• Войдите в систему с логином <code className="bg-blue-900 px-1 rounded">{username}</code></p>
                <p>• В Настройках → Лицензии создайте клиентские записи</p>
                <p>• Клиент получит <code className="bg-blue-900 px-1 rounded">license.json</code> + логин/пароль</p>
              </div>

              <button
                onClick={onSetupComplete}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Войти в систему
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
