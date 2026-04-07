import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Key, Plus, Download, Ban, RefreshCw, Shield, ShieldCheck, ShieldX,
    Clock, Infinity, AlertCircle, CheckCircle2, Copy, CheckCheck,
    ChevronDown, ChevronUp, Search, X, CalendarDays, User, FileText,
    Loader2, Lock, UserPlus, Upload
} from 'lucide-react';
import type { LicenseRecord, LicenseStats } from '../../types';

type GenerateFormState = { fingerprint: string; userName: string; expiresAt: string; notes: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStats(records: LicenseRecord[]): LicenseStats {
    const now = new Date();
    let active = 0, expired = 0, revoked = 0, permanent = 0;
    for (const r of records) {
        if (r.revokedAt) { revoked++; continue; }
        if (!r.expiresAt) { permanent++; active++; continue; }
        if (new Date(r.expiresAt) < now) { expired++; } else { active++; }
    }
    return { total: records.length, active, expired, revoked, permanent };
}

type LicenseStatus = 'active' | 'expired' | 'revoked';

function getStatus(r: LicenseRecord): LicenseStatus {
    if (r.revokedAt) return 'revoked';
    if (r.expiresAt && new Date(r.expiresAt) < new Date()) return 'expired';
    return 'active';
}

function fmtDate(iso: string | null): string {
    if (!iso) return '∞ Бессрочно';
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysLeft(expiresAt: string | null): number | null {
    if (!expiresAt) return null;
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

function truncFp(fp: string): string {
    return `${fp.slice(0, 8)}…${fp.slice(-8)}`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const statusConfig: Record<LicenseStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    active:  { label: 'Активна',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    expired: { label: 'Истекла',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',         icon: <Clock className="w-3.5 h-3.5" /> },
    revoked: { label: 'Отозвана', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',             icon: <ShieldX className="w-3.5 h-3.5" /> },
};

function StatusBadge({ record }: { record: LicenseRecord }) {
    const st = getStatus(record);
    const { label, cls, icon } = statusConfig[st];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
            {icon}{label}
        </span>
    );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyBtn({ text, title = 'Копировать' }: { text: string; title?: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    };
    return (
        <button onClick={handleCopy} title={title} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────

function StatsCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
    return (
        <div className={`rounded-xl border p-4 flex flex-col gap-1 ${color}`}>
            <span className="text-2xl font-bold">{value}</span>
            <span className="text-sm font-medium">{label}</span>
            {sub && <span className="text-xs opacity-70">{sub}</span>}
        </div>
    );
}

// ─── Create Client Bundle Form ───────────────────────────────────────────────────

type BundleResult = { licenseContent: string; suggestedName: string; username: string };

function CreateClientForm({ onCreated }: { onCreated: (r: LicenseRecord | null) => void }) {
    const [form, setForm] = useState({ fingerprint: '', clientName: '', username: '', password: '', expiresAt: '', notes: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<BundleResult | null>(null);

    const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(f => ({ ...f, [k]: e.target.value }));
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await window.electronAPI!.licenseAdminCreateClientBundle!({
                fingerprint: form.fingerprint.trim(),
                clientName: form.clientName.trim(),
                username: form.username.trim(),
                password: form.password,
                expiresAt: form.expiresAt.trim() || null,
                notes: form.notes.trim(),
            });
            if (res.success) {
                setResult({ licenseContent: res.licenseContent!, suggestedName: res.suggestedName!, username: res.username! });
                onCreated(null); // signal parent to reload registry
            } else {
                setError(res.error ?? 'Ошибка');
            }
        } catch (err: any) {
            setError(err?.message ?? 'Ошибка');
        } finally {
            setLoading(false);
        }
    };

    function downloadLicense() {
        if (!result) return;
        const blob = new Blob([result.licenseContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    if (result) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Клиент зарегистрирован!
                </h3>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500">Логин:</span>
                        <span className="font-mono font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            {result.username}
                            <CopyBtn text={result.username} title="Копировать логин" />
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500">Файл лицензии:</span>
                        <span className="text-slate-600 dark:text-slate-400 text-xs">{result.suggestedName}</span>
                    </div>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">Скачайте license.json и передайте клиенту вместе с логином и паролем.</p>
                <div className="flex gap-2">
                    <button onClick={downloadLicense} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                        <Download className="w-4 h-4" />Скачать license.json
                    </button>
                    <button onClick={() => setResult(null)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        Создать ещё
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-500" />
                Создать клиента (учётная запись + лицензия)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Fingerprint */}
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Machine ID (Fingerprint) <span className="text-rose-500">*</span>
                    </label>
                    <input type="text" value={form.fingerprint} onChange={setF('fingerprint')}
                        placeholder="64 hex-символа (клиент берёт с экрана активации)"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        required minLength={64} maxLength={64} pattern="[a-fA-F0-9]{64}" autoComplete="off" spellCheck={false} />
                </div>
                {/* Client name */}
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Полное имя <span className="text-rose-500">*</span>
                    </label>
                    <input type="text" value={form.clientName} onChange={setF('clientName')}
                        placeholder="Иванов Иван Иванович"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required />
                </div>
                {/* Login */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Логин <span className="text-rose-500">*</span>
                    </label>
                    <input type="text" value={form.username} onChange={setF('username')}
                        placeholder="ivanov_aa"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        required minLength={3} autoComplete="off" />
                </div>
                {/* Password */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Пароль <span className="text-rose-500">*</span>
                    </label>
                    <input type="password" value={form.password} onChange={setF('password')}
                        placeholder="Минимум 6 символов"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required minLength={6} autoComplete="new-password" />
                </div>
                {/* Expires */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Срок действия <span className="text-slate-400">(пусто — бессрочно)</span>
                    </label>
                    <input type="date" value={form.expiresAt} onChange={setF('expiresAt')}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {/* Notes */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Примечания</label>
                    <input type="text" value={form.notes} onChange={setF('notes')} placeholder="..."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>

            {error && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

            <button type="submit" disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {loading ? 'Создание...' : 'Создать клиента'}
            </button>
        </form>
    );
}

// ─── Generate Form ────────────────────────────────────────────────────────────

interface GenerateFormProps {
    onGenerated: (record: LicenseRecord) => void;
}

function GenerateForm({ onGenerated }: GenerateFormProps) {
    const [form, setForm] = useState<GenerateFormState>({
        fingerprint: '',
        userName: '',
        expiresAt: '',
        notes: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleChange = (k: keyof GenerateFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(f => ({ ...f, [k]: e.target.value }));
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            const result = await window.electronAPI!.licenseAdminGenerate({
                fingerprint: form.fingerprint.trim(),
                userName: form.userName.trim(),
                expiresAt: form.expiresAt.trim() || null,
                notes: form.notes.trim(),
            });
            if (result.success) {
                setSuccess(`Лицензия создана для «${result.record.userName}»`);
                setForm({ fingerprint: '', userName: '', expiresAt: '', notes: '' });
                onGenerated(result.record);
            } else {
                setError(result.error || 'Ошибка генерации');
            }
        } catch (err: any) {
            setError(err?.message || 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-500" />
                Создать новую лицензию
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Fingerprint */}
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Machine ID (Fingerprint) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={form.fingerprint}
                            onChange={handleChange('fingerprint')}
                            placeholder="64 hex-символа SHA-256 от пользователя (экран активации)"
                            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            required
                            minLength={64}
                            maxLength={64}
                            pattern="[a-fA-F0-9]{64}"
                            title="64 hex-символа (SHA-256)"
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>
                </div>

                {/* User name */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Имя пользователя <span className="text-rose-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={form.userName}
                        onChange={handleChange('userName')}
                        placeholder="Иванов А.А."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                    />
                </div>

                {/* Expires at */}
                <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Срок действия <span className="text-slate-400">(оставьте пустым — бессрочно)</span>
                    </label>
                    <input
                        type="date"
                        value={form.expiresAt}
                        onChange={handleChange('expiresAt')}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Заметки</label>
                    <textarea
                        value={form.notes}
                        onChange={handleChange('notes')}
                        placeholder="Учреждение, контакты, основание…"
                        rows={2}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />{success}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {loading ? 'Генерация…' : 'Сгенерировать лицензию'}
            </button>
        </form>
    );
}

// ─── Extend popup ─────────────────────────────────────────────────────────────

interface ExtendPopupProps {
    record: LicenseRecord;
    onClose: () => void;
    onExtended: (updated: LicenseRecord) => void;
}

function ExtendPopup({ record, onClose, onExtended }: ExtendPopupProps) {
    const today = new Date().toISOString().slice(0, 10);
    const [expiresAt, setExpiresAt] = useState(
        record.expiresAt ? record.expiresAt.slice(0, 10) : ''
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result = await window.electronAPI!.licenseAdminExtend({
                id: record.id,
                expiresAt: expiresAt.trim() || null,
            });
            if (result.success) {
                onExtended(result.record);
                onClose();
            } else {
                setError(result.error || 'Ошибка продления');
            }
        } catch (err: any) {
            setError(err?.message || 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Продление / изменение срока
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Лицензия: <span className="font-medium text-slate-700 dark:text-slate-300">{record.userName}</span>
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Новый срок <span className="text-slate-400">(пусто = бессрочно)</span>
                        </label>
                        <input
                            type="date"
                            value={expiresAt}
                            min={today}
                            onChange={e => { setExpiresAt(e.target.value); setError(''); }}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                        </div>
                    )}
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            Отмена
                        </button>
                        <button type="submit" disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors">
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            {loading ? 'Применяем…' : 'Применить'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── License Row ─────────────────────────────────────────────────────────────

interface LicenseRowProps {
    record: LicenseRecord;
    onRevoke: (id: string) => Promise<void>;
    onExtend: (record: LicenseRecord) => void;
    onExport: (id: string) => Promise<void>;
}

function LicenseRow({ record, onRevoke, onExtend, onExport }: LicenseRowProps) {
    const [expanded, setExpanded] = useState(false);
    const [revoking, setRevoking] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [confirmRevoke, setConfirmRevoke] = useState(false);

    const status = getStatus(record);
    const days = daysLeft(record.expiresAt);
    const isRevoked = status === 'revoked';
    const isExpired = status === 'expired';

    const handleRevoke = async () => {
        if (!confirmRevoke) { setConfirmRevoke(true); return; }
        setRevoking(true);
        setConfirmRevoke(false);
        try { await onRevoke(record.id); }
        finally { setRevoking(false); }
    };

    const handleExport = async () => {
        setExporting(true);
        try { await onExport(record.id); }
        finally { setExporting(false); }
    };

    return (
        <div className={`border rounded-xl transition-colors ${isRevoked ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/10' : isExpired ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
            {/* Row header */}
            <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setExpanded(v => !v)} className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{record.userName}</span>
                        <StatusBadge record={record} />
                        {days !== null && !isRevoked && (
                            <span className={`text-xs ${days <= 30 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                                {days > 0 ? `${days} д.` : 'истекла'}
                            </span>
                        )}
                        {!record.expiresAt && !isRevoked && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                                <Infinity className="w-3.5 h-3.5" />
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-400 font-mono">{truncFp(record.fingerprint)}</span>
                        <span className="text-xs text-slate-400">Выдана: {fmtDate(record.issuedAt)}</span>
                        {record.expiresAt && <span className="text-xs text-slate-400">До: {fmtDate(record.expiresAt)}</span>}
                        {record.revokedAt && <span className="text-xs text-rose-400">Отозвана: {fmtDate(record.revokedAt)}</span>}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Download */}
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        title="Скачать license.json"
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">Скачать</span>
                    </button>

                    {/* Extend */}
                    {!isRevoked && (
                        <button
                            onClick={() => onExtend(record)}
                            title="Продлить / изменить срок"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Продлить</span>
                        </button>
                    )}

                    {/* Revoke */}
                    {!isRevoked && (
                        <button
                            onClick={handleRevoke}
                            disabled={revoking}
                            title={confirmRevoke ? 'Нажмите ещё раз для подтверждения' : 'Отозвать лицензию'}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${confirmRevoke ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' : 'text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'}`}
                        >
                            {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{confirmRevoke ? 'Подтвердить' : 'Отозвать'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-28">Fingerprint:</span>
                        <span className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all flex-1">{record.fingerprint}</span>
                        <CopyBtn text={record.fingerprint} title="Копировать fingerprint" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-28">ID записи:</span>
                        <span className="text-xs font-mono text-slate-500 break-all flex-1">{record.id}</span>
                    </div>
                    {record.notes && (
                        <div className="flex items-start gap-2">
                            <span className="text-xs text-slate-500 w-28 mt-0.5">Заметки:</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400 flex-1">{record.notes}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export const LicenseAdminPanel: React.FC = () => {
    const [records, setRecords] = useState<LicenseRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | LicenseStatus>('all');
    const [sortField, setSortField] = useState<'issuedAt' | 'expiresAt' | 'userName'>('issuedAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [showForm, setShowForm] = useState(false);
    const [showClientForm, setShowClientForm] = useState(false);
    const [extendTarget, setExtendTarget] = useState<LicenseRecord | null>(null);
    const [keyExists, setKeyExists] = useState<boolean | null>(null);

    // ── Load registry ──────────────────────────────────────────────────────────
    const loadRecords = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const result = await window.electronAPI!.licenseAdminList();
            if (result.success) {
                setRecords(result.records);
            } else {
                setLoadError(result.error || 'Ошибка загрузки реестра');
            }
        } catch (err: any) {
            setLoadError(err?.message || 'Ошибка IPC');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadRecords(); }, [loadRecords]);

    useEffect(() => {
        window.electronAPI?.licenseAdminCheckKey?.().then(res => setKeyExists(res.exists));
    }, []);

    async function handleImportKey() {
        const res = await window.electronAPI?.licenseAdminImportKey?.();
        if (res?.success) {
            setKeyExists(true);
            loadRecords();
        } else if (res?.error) {
            alert(res.error);
        }
    }

    // ── Stats ──────────────────────────────────────────────────────────────────
    const stats = useMemo(() => computeStats(records), [records]);

    // ── Filtered & sorted records ──────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = records;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(r =>
                r.userName.toLowerCase().includes(q) ||
                r.fingerprint.toLowerCase().includes(q) ||
                r.notes.toLowerCase().includes(q)
            );
        }
        if (statusFilter !== 'all') {
            list = list.filter(r => getStatus(r) === statusFilter);
        }
        return [...list].sort((a, b) => {
            let va: string, vb: string;
            if (sortField === 'issuedAt') { va = a.issuedAt; vb = b.issuedAt; }
            else if (sortField === 'expiresAt') { va = a.expiresAt ?? '9999'; vb = b.expiresAt ?? '9999'; }
            else { va = a.userName.toLowerCase(); vb = b.userName.toLowerCase(); }
            return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    }, [records, search, statusFilter, sortField, sortDir]);

    // ── Actions ────────────────────────────────────────────────────────────────
    const handleGenerated = (record: LicenseRecord) => {
        setRecords(prev => [record, ...prev]);
        setShowForm(false);
    };

    const handleRevoke = async (id: string) => {
        const result = await window.electronAPI!.licenseAdminRevoke({ id });
        if (result.success) {
            setRecords(prev => prev.map(r => r.id === id ? result.record : r));
        }
    };

    const handleExtended = (updated: LicenseRecord) => {
        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
    };

    const handleExport = async (id: string) => {
        const result = await window.electronAPI!.licenseAdminExport({ id });
        if (!result.success) { alert(`Ошибка экспорта: ${result.error}`); return; }
        // Trigger download via invisible <a> element with blob URL
        const blob = new Blob([result.content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    // ── Loading State ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">Загрузка реестра лицензий…</span>
            </div>
        );
    }

    // ── Private key unavailable ───────────────────────────────────────────────
    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center max-w-sm mx-auto">
                <Lock className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Доступ недоступен</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{loadError}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        Admin-панель работает только на машине разработчика (требуется файл <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">private.pem</code>).
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleImportKey} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <Upload className="w-3.5 h-3.5" />Импортировать private.pem
                    </button>
                    <button onClick={loadRecords} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" />Повторить
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Developer Key Status */}
            {keyExists === false && (
                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
                        <Key className="w-4 h-4" />
                        <span className="font-medium">Приватный ключ не импортирован.</span>
                        <span className="text-xs opacity-75">Генерация лицензий недоступна.</span>
                    </div>
                    <button onClick={handleImportKey}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors">
                        <Upload className="w-3.5 h-3.5" />Импортировать private.pem
                    </button>
                </div>
            )}
            {keyExists === true && (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs px-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Ключ разработчика активен — генерация лицензий доступна</span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-500" />
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Управление лицензиями</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadRecords}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Обновить"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setShowClientForm(v => !v); setShowForm(false); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${showClientForm ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                        <UserPlus className="w-4 h-4" />
                        {showClientForm ? 'Скрыть' : 'Создать клиента'}
                    </button>
                    <button
                        onClick={() => { setShowForm(v => !v); setShowClientForm(false); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${showForm ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showForm ? 'Скрыть' : 'Новая лицензия'}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatsCard label="Всего выдано" value={stats.total} color="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300" />
                <StatsCard label="Активных" value={stats.active} sub={`из них бессрочных: ${stats.permanent}`} color="border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400" />
                <StatsCard label="Истекших" value={stats.expired} color="border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400" />
                <StatsCard label="Отозванных" value={stats.revoked} color="border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400" />
            </div>

            {/* Client bundle form */}
            {showClientForm && <CreateClientForm onCreated={() => { loadRecords(); }} />}

            {/* Generate form */}
            {showForm && <GenerateForm onGenerated={handleGenerated} />}

            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск по имени / fingerprint…"
                        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Status filter */}
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">Все статусы</option>
                    <option value="active">Активные</option>
                    <option value="expired">Истекшие</option>
                    <option value="revoked">Отозванные</option>
                </select>

                {/* Sort */}
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>Сортировка:</span>
                    {(['issuedAt', 'expiresAt', 'userName'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => toggleSort(f)}
                            className={`flex items-center gap-0.5 px-2 py-1 rounded-md transition-colors ${sortField === f ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            {{ issuedAt: 'Выдана', expiresAt: 'Истекает', userName: 'Имя' }[f]}
                            {sortField === f && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Records count */}
            <p className="text-xs text-slate-400 dark:text-slate-500">
                {filtered.length === records.length
                    ? `${records.length} лицензий`
                    : `${filtered.length} из ${records.length} лицензий`}
            </p>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 dark:text-slate-600">
                    <FileText className="w-10 h-10 opacity-40" />
                    <p className="text-sm">{records.length === 0 ? 'Реестр пуст — создайте первую лицензию' : 'Нет результатов по фильтру'}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(record => (
                        <LicenseRow
                            key={record.id}
                            record={record}
                            onRevoke={handleRevoke}
                            onExtend={setExtendTarget}
                            onExport={handleExport}
                        />
                    ))}
                </div>
            )}

            {/* Extend popup */}
            {extendTarget && (
                <ExtendPopup
                    record={extendTarget}
                    onClose={() => setExtendTarget(null)}
                    onExtended={handleExtended}
                />
            )}
        </div>
    );
};
