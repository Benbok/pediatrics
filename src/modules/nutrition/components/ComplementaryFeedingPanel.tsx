import React, { useEffect, useMemo, useState } from 'react';
import type { NutritionFeedingTemplate, NutritionFeedingTemplateItem } from '../../../types';
import { getComplementaryFeedingStatus } from '../../../logic/nutrition/calculateFeeding';
import { nutritionService } from '../services/nutritionService';

interface Props {
  ageDays: number;
  isBF?: boolean;
}

const STATUS_CONFIG = {
  too_early: {
    label: 'Слишком рано для прикорма',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  window_open: {
    label: 'Оптимальный возраст для введения прикорма',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  overdue: {
    label: 'Прикорм следует начать (возраст > 6 мес.)',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
  },
  active: {
    label: 'Прикорм активно вводится / уже введён',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

const MEAL_ORDER_LABELS: Record<number, string> = {
  1: '1-е кормление (утро)',
  2: '2-е кормление',
  3: '3-е кормление (обед)',
  4: '4-е кормление',
  5: '5-е кормление',
  6: '6-е кормление (ужин)',
};

export const ComplementaryFeedingPanel: React.FC<Props> = ({ ageDays, isBF = true }) => {
  const [templates, setTemplates] = useState<NutritionFeedingTemplate[]>([]);
  const [items, setItems] = useState<NutritionFeedingTemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const status = useMemo(() => getComplementaryFeedingStatus(ageDays, isBF), [ageDays, isBF]);
  const statusConfig = STATUS_CONFIG[status];

  useEffect(() => {
    setIsLoading(true);
    nutritionService
      .getTemplates(ageDays)
      .then((list) => {
        // Only show templates up to 12m (365 days) in this panel
        const filtered = list.filter((t) => t.ageMinDays < 365);
        setTemplates(filtered);
        if (filtered.length > 0) setSelectedTemplateId(filtered[0].id);
      })
      .finally(() => setIsLoading(false));
  }, [ageDays]);

  useEffect(() => {
    if (selectedTemplateId == null) {
      setItems([]);
      return;
    }
    nutritionService.getTemplateItems(selectedTemplateId).then(setItems);
  }, [selectedTemplateId]);

  const groupedItems = useMemo(() => {
    const grouped: Record<number, NutritionFeedingTemplateItem[]> = {};
    for (const item of items) {
      if (!grouped[item.mealOrder]) grouped[item.mealOrder] = [];
      grouped[item.mealOrder].push(item);
    }
    return grouped;
  }, [items]);

  return (
    <div className="space-y-5">
      {/* Status badge */}
      <div className={`rounded-xl border p-3 ${statusConfig.border}`}>
        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Возраст ребёнка: {ageDays} дн.{' '}
          {ageDays >= 120 && ageDays <= 180 ? '(4–6 мес.)' : ''}
          {ageDays > 180 && ageDays < 365 ? '(> 6 мес.)' : ''}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
          По Нацпрограмме 2019: оптимальный срок введения прикорма — 5–6 мес. (не ранее 4 мес.).
          При ГВ — не позднее 6 мес.
        </p>
      </div>

      {status === 'too_early' && (
        <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
          Прикорм не вводится до 4 месяцев жизни (120 дней) независимо от вида вскармливания.
        </div>
      )}

      {status !== 'too_early' && (
        <>
          {/* Template selector */}
          {templates.length > 1 && (
            <div className="space-y-1 max-w-sm">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Схема прикорма для возраста
              </label>
              <select
                value={selectedTemplateId ?? ''}
                onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          )}

          {isLoading && (
            <p className="text-sm text-slate-500">Загрузка схемы...</p>
          )}

          {!isLoading && templates.length === 0 && (
            <p className="text-sm text-amber-600">
              Схемы прикорма для данного возраста не найдены в справочнике.
            </p>
          )}

          {!isLoading && items.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                {templates.find((t) => t.id === selectedTemplateId)?.description ?? 'Примерная схема питания'}
              </h4>

              {Object.entries(groupedItems)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([order, mealItems]) => (
                  <div
                    key={order}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3"
                  >
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                      {MEAL_ORDER_LABELS[Number(order)] ?? `Кормление №${order}`}
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {mealItems.map((item) => (
                          <tr key={item.id}>
                            <td className="py-1.5 text-slate-700 dark:text-slate-300">
                              {item.productCategory?.name
                                ? item.productCategory.name
                                : item.productCategoryId
                                ? `Категория #${item.productCategoryId}`
                                : '—'}
                            </td>
                            <td className="py-1.5 text-right font-medium text-slate-600 dark:text-slate-400 w-24">
                              {item.portionSizeG} г
                            </td>
                            <td className="py-1.5 pl-3 text-xs text-slate-400 dark:text-slate-500">
                              {item.note ?? (item.isExample ? '(пример)' : '')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

              <p className="text-xs text-slate-400 mt-2">
                * Порции — ориентировочные. Введение каждого продукта — индивидуально,
                начиная с 1/4 чайной ложки.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
