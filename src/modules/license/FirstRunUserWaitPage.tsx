import React, { useEffect, useState } from 'react';
import { Copy, CheckCheck, Upload, KeyRound, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
  onBack: () => void;
  onAccessGranted: () => void;
}

type Step = 'share-id' | 'import-license' | 'enter-credentials';

export default function FirstRunUserWaitPage({ onBack, onAccessGranted }: Props) {
  const [step, setStep] = useState<Step>('share-id');
  const [fingerprint, setFingerprint] = useState('');
  const [display, setDisplay] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Credentials form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    window.electronAPI?.getLicenseFingerprint?.().then((res) => {
      setFingerprint(res?.fingerprint || '');
      setDisplay(res?.display || '');
    }).catch(() => {
      setError('Не удалось получить Machine ID');
    });
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fingerprint || display);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Не удалось скопировать Machine ID');
    }
  }

  async function handleImportLicense() {
    setLoading(true);
    setError('');
    try {
      const res = await window.electronAPI?.importLicense?.();
      if (res?.success) {
        setStep('enter-credentials');
      } else {
        setError(res?.reason || 'Не удалось импортировать лицензию. Убедитесь, что файл предназначен для этой машины.');
      }
    } catch {
      setError('Ошибка импорта лицензии');
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (username.trim().length < 3) { setError('Логин должен быть минимум 3 символа'); return; }
    if (password.length < 6)        { setError('Пароль должен быть минимум 6 символов'); return; }

    setLoading(true);
    try {
      const res = await window.electronAPI?.firstRunUserSetup?.({ username: username.trim(), password });
      if (res?.success) {
        onAccessGranted();
      } else {
        setError(res?.error || 'Не удалось создать учётную запись');
      }
    } catch {
      setError('Ошибка создания учётной записи');
    } finally {
      setLoading(false);
    }
  }

  // ── Step indicator ──────────────────────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: 'share-id',         label: 'Получить лицензию' },
    { key: 'import-license',   label: 'Импорт license.json' },
    { key: 'enter-credentials',label: 'Ввести данные входа' },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-7 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Активация пользователя</h1>
          <p className="text-slate-400 text-sm mt-1">Выполните 3 шага для начала работы</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-1.5 text-xs font-medium ${
                i < stepIndex ? 'text-emerald-400' :
                i === stepIndex ? 'text-blue-300' :
                'text-slate-600'
              }`}>
                {i < stepIndex
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                      i === stepIndex ? 'border-blue-400 text-blue-300' : 'border-slate-700 text-slate-600'
                    }`}>{i + 1}</span>
                }
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-px ${i < stepIndex ? 'bg-emerald-700' : 'bg-slate-700'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1: Share Machine ID ─────────────────────────────────────── */}
        {step === 'share-id' && (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">
              Скопируйте ваш <strong className="text-white">Machine ID</strong> и отправьте его администратору.
              Администратор сгенерирует файл <code className="text-emerald-300 bg-slate-800 px-1 rounded">license.json</code> и
              сообщит вам логин и пароль.
            </p>

            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Ваш Machine ID</p>
              <div className="flex items-start gap-2">
                <div className="flex-1 font-mono text-xs sm:text-sm text-emerald-300 break-all bg-slate-950 rounded-lg p-3 select-all">
                  {display || 'Загрузка...'}
                </div>
                <button
                  onClick={handleCopy}
                  className="shrink-0 p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
                  title="Копировать Machine ID"
                >
                  {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-amber-400">{error}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={onBack}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm">
                <ArrowLeft className="w-4 h-4" />Назад
              </button>
              <button
                onClick={() => { setError(''); setStep('import-license'); }}
                disabled={!display}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium"
              >
                Получил license.json → Далее
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Import license.json ──────────────────────────────────── */}
        {step === 'import-license' && (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm">
              Нажмите кнопку и выберите файл <code className="text-emerald-300 bg-slate-800 px-1 rounded">license.json</code>, который прислал администратор.
            </p>

            {error && <p className="text-xs text-amber-400">{error}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => { setError(''); setStep('share-id'); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm">
                <ArrowLeft className="w-4 h-4" />Назад
              </button>
              <button
                onClick={handleImportLicense}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Upload className="w-4 h-4" />
                }
                {loading ? 'Проверка...' : 'Выбрать license.json'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Enter credentials ─────────────────────────────────────── */}
        {step === 'enter-credentials' && (
          <form onSubmit={handleActivate} className="space-y-4">
            <p className="text-slate-300 text-sm">
              Лицензия принята. Введите <strong className="text-white">логин и пароль</strong>, которые сообщил вам администратор.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Логин</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Введите логин"
                  required
                  autoComplete="username"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {error && <p className="text-xs text-amber-400">{error}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => { setError(''); setStep('import-license'); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm">
                <ArrowLeft className="w-4 h-4" />Назад
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <KeyRound className="w-4 h-4" />
                }
                {loading ? 'Активация...' : 'Войти в систему'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
