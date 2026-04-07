import React, { useEffect, useState } from 'react';
import { Copy, CheckCheck, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
  onAccessGranted: () => void;
}

export default function FirstRunUserWaitPage({ onBack, onAccessGranted }: Props) {
  const [fingerprint, setFingerprint] = useState('');
  const [display, setDisplay] = useState('');
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

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

  async function handleCheckAccess() {
    setChecking(true);
    setError('');
    try {
      const res = await window.electronAPI?.isFirstRun?.();
      if (res && !res.isFirstRun) {
        onAccessGranted();
        return;
      }
      setError('Доступ еще не предоставлен. Обратитесь к администратору.');
    } catch {
      setError('Ошибка проверки доступа');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-7 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ожидание доступа от администратора</h1>
          <p className="text-slate-400 text-sm mt-1">
            Вы выбрали сценарий пользователя. Чтобы начать работу, администратор должен выдать вам доступ.
          </p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Ваш Machine ID</p>
          <div className="flex items-start gap-2">
            <div className="flex-1 font-mono text-xs sm:text-sm text-emerald-300 break-all bg-slate-950 rounded-lg p-3">
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

        <div className="text-sm text-slate-300 space-y-1.5">
          <p>1. Отправьте Machine ID администратору.</p>
          <p>2. Получите от администратора файл license.json и учетные данные.</p>
          <p>3. После выдачи доступа нажмите «Проверить доступ».</p>
        </div>

        {error && <p className="text-xs text-amber-400">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />Назад
          </button>
          <button
            onClick={handleCheckAccess}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />Проверить доступ
          </button>
        </div>
      </div>
    </div>
  );
}
