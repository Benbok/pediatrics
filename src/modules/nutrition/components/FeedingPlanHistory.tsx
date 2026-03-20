import React, { useCallback, useEffect, useState } from 'react';
import type { ChildFeedingPlan, FeedingType } from '../../../types';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { nutritionService } from '../services/nutritionService';

interface Props {
  childId: number;
  refreshKey?: number;
}

const FEEDING_TYPE_LABELS: Record<FeedingType, string> = {
  BF: 'ГВ',
  MF: 'СВ',
  FF: 'ИВ',
};

const FEEDING_TYPE_COLOR: Record<FeedingType, string> = {
  BF: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  MF: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  FF: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
};

function formatAgeDays(ageDays: number): string {
  if (ageDays <= 30) return `${ageDays} дн.`;
  if (ageDays < 365) return `${Math.floor(ageDays / 30)} мес.`;
  return `${Math.floor(ageDays / 365)} л. ${Math.floor((ageDays % 365) / 30)} мес.`;
}

function formatPlanDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export const FeedingPlanHistory: React.FC<Props> = ({ childId, refreshKey }) => {
  const [plans, setPlans] = useState<ChildFeedingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [planToDelete, setPlanToDelete] = useState<ChildFeedingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await nutritionService.getFeedingPlans(childId);
      setPlans(result);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки');
    } finally {
      setIsLoading(false);
    }
  }, [childId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleDelete = async () => {
    if (!planToDelete) return;

    setDeletingId(planToDelete.id);
    try {
      await nutritionService.deleteFeedingPlan(planToDelete.id);
      setPlans((prev) => prev.filter((p) => p.id !== planToDelete.id));
      setPlanToDelete(null);
    } catch (e: any) {
      setError(e.message || 'Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-slate-500">Загрузка истории...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (plans.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Сохранённых расчётов питания нет. Выполните расчёт на вкладке «Расчёт 0–12 мес.» и сохраните его.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs">
            <th className="px-3 py-2 text-left font-medium">Дата</th>
            <th className="px-3 py-2 text-left font-medium">Возраст</th>
            <th className="px-3 py-2 text-right font-medium">Масса (кг)</th>
            <th className="px-3 py-2 text-center font-medium">Тип</th>
            <th className="px-3 py-2 text-right font-medium">Ккал/сут</th>
            <th className="px-3 py-2 text-right font-medium">Объём/сут</th>
            <th className="px-3 py-2 text-right font-medium">Смесь (мл)</th>
            <th className="px-3 py-2 text-left font-medium">Примечание</th>
            <th className="px-3 py-2 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {plans.map((plan) => (
            <tr key={plan.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                {formatPlanDate(plan.date)}
              </td>
              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                {formatAgeDays(plan.ageDays)}
              </td>
              <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                {plan.weightKg.toFixed(1)}
              </td>
              <td className="px-3 py-2 text-center">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${FEEDING_TYPE_COLOR[plan.feedingType as FeedingType]}`}>
                  {FEEDING_TYPE_LABELS[plan.feedingType as FeedingType]}
                </span>
              </td>
              <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                {plan.dailyEnergyNeedKcal}
              </td>
              <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                {plan.dailyVolumeNeedMl != null ? `${plan.dailyVolumeNeedMl} мл` : '—'}
              </td>
              <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                {plan.formulaVolumeMl != null ? `${plan.formulaVolumeMl} мл` : '—'}
              </td>
              <td className="px-3 py-2 text-slate-400 dark:text-slate-500 text-xs max-w-[160px] truncate">
                {(plan as any).comments ?? ''}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => setPlanToDelete(plan)}
                  disabled={deletingId === plan.id}
                  className="text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors p-1 rounded"
                  title="Удалить"
                >
                  {deletingId === plan.id ? '...' : '✕'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        isOpen={planToDelete !== null}
        title="Удаление расчёта"
        message="Вы уверены, что хотите удалить этот сохранённый расчёт питания?

Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => {
          if (deletingId === null) {
            setPlanToDelete(null);
          }
        }}
      />
    </div>
  );
};
