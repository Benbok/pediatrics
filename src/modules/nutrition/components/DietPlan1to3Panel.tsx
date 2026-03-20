import React, { useEffect, useMemo, useState } from 'react';
import type { NutritionAgeNorm, NutritionFeedingTemplate, NutritionFeedingTemplateItem } from '../../../types';
import { calcBasicNeeds } from '../../../logic/nutrition/calculateNeeds';
import { nutritionService } from '../services/nutritionService';
import { PrettySelect, type SelectOption } from './PrettySelect';

interface Props {
  ageDays: number;
}

export const DietPlan1to3Panel: React.FC<Props> = ({ ageDays }) => {
  const [weightKg, setWeightKg] = useState('');
  const [norm, setNorm] = useState<NutritionAgeNorm | null>(null);
  const [templates, setTemplates] = useState<NutritionFeedingTemplate[]>([]);
  const [items, setItems] = useState<NutritionFeedingTemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      nutritionService.getAgeNormForAge(ageDays),
      nutritionService.getTemplates(ageDays),
    ]).then(([n, t]) => {
      setNorm(n);
      // Only 1–3y templates (ageMinDays >= 365)
      const filtered = t.filter((tmpl) => tmpl.ageMinDays >= 365);
      setTemplates(filtered);
      if (filtered.length > 0) setSelectedTemplateId(filtered[0].id);
    });
  }, [ageDays]);

  useEffect(() => {
    if (selectedTemplateId == null) { setItems([]); return; }
    nutritionService.getTemplateItems(selectedTemplateId).then(setItems);
  }, [selectedTemplateId]);

  const needs = useMemo(() => {
    const wt = parseFloat(weightKg);
    if (!norm || isNaN(wt) || wt <= 0) return null;
    return calcBasicNeeds(ageDays, wt, norm);
  }, [weightKg, norm, ageDays]);

  const templateOptions = useMemo<Array<SelectOption<number>>>(
    () => templates.map((template) => ({ value: template.id, label: template.title })),
    [templates],
  );

  const ageYears = Math.floor(ageDays / 365);
  const ageMonths = Math.floor((ageDays % 365) / 30);

  if (ageDays < 365) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Данный раздел предназначен для детей 1–3 лет (от 365 дней).
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Возраст: {ageYears} г. {ageMonths} мес.
        </div>
        {norm && (
          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs text-slate-500">
            {norm.feedingStage}
          </span>
        )}
      </div>

      {/* Weight input */}
      <div className="space-y-1 max-w-xs">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Масса ребёнка (кг)<span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          type="number"
          min="4"
          max="50"
          step="0.1"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          placeholder="напр. 12.5"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Calculated needs */}
      {needs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-3 text-sm">
            <div className="text-slate-500 text-xs mb-1">Энергопотребность</div>
            <div className="font-bold text-slate-800 dark:text-white">{needs.dailyEnergyNeedKcal} ккал/сут</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border border-slate-200 dark:border-slate-700">
            <div className="text-slate-500 text-xs mb-1">Объём пищи</div>
            <div className="font-bold text-slate-800 dark:text-white">
              {needs.totalFoodMinG ? `${needs.totalFoodMinG}–${needs.totalFoodMaxG} г/сут` : `${needs.dailyVolumeNeedMl ?? '—'} мл/сут`}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border border-slate-200 dark:border-slate-700">
            <div className="text-slate-500 text-xs mb-1">Режим</div>
            <div className="font-bold text-slate-800 dark:text-white">{needs.mealsPerDay} приёмов</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm border border-slate-200 dark:border-slate-700">
            <div className="text-slate-500 text-xs mb-1">Разовая порция</div>
            <div className="font-bold text-slate-800 dark:text-white">до 300–350 мл</div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold mb-2">
          Принципы рациона 1–3 лет
        </div>
        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <li>Режим: 3 основных приёма пищи + 2 перекуса.</li>
          <li>1–1.5 года: 1000–1200 г/сут; 1.5–3 года: 1200–1500 г/сут.</li>
          <li>Обед должен быть самым калорийным приёмом пищи.</li>
          <li>Ежедневно: не менее 3 порций молочных продуктов и 5 порций овощей/фруктов суммарно.</li>
          <li>Рыба и яйца: 2–3 раза в неделю.</li>
        </ul>
      </div>

      {/* Template */}
      {templates.length > 1 && selectedTemplateId != null && (
        <div className="space-y-1 max-w-sm">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Возрастная схема питания</label>
          <PrettySelect
            value={selectedTemplateId}
            onChange={(value) => setSelectedTemplateId(Number(value))}
            options={templateOptions}
          />
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-slate-700 dark:text-slate-300 text-sm">
            {templates.find((t) => t.id === selectedTemplateId)?.description ?? 'Примерный суточный рацион'}
          </h4>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                  <th className="px-4 py-2 text-left font-medium">Приём пищи</th>
                  <th className="px-4 py-2 text-left font-medium">Продукт / категория</th>
                  <th className="px-4 py-2 text-right font-medium">Порция (г)</th>
                  <th className="px-4 py-2 text-left font-medium">Примечание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((item) => (
                  <tr key={item.id} className="bg-white dark:bg-slate-900">
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {item.mealOrder}-й приём
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {item.productCategory?.name
                        ? item.productCategory.name
                        : item.productCategoryId
                        ? `Кат. #${item.productCategoryId}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                      {item.portionSizeG}
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs">
                      {item.note ?? (item.isExample ? 'пример' : '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">
            * Рацион ориентировочный. Согласно МР 2.3.1.0253-21 (Программа оптимизации питания детей 1–3 лет).
          </p>
        </div>
      )}

      {templates.length === 0 && (
        <p className="text-sm text-amber-600">
          Шаблоны рациона для данного возраста не найдены в справочнике.
        </p>
      )}
    </div>
  );
};
