import React, { useEffect, useState } from 'react';
import type {
  NutritionFeedingTemplate,
  NutritionProductCategory,
  NutritionTemplateUpsertInput,
  NutritionTemplateItemInput,
} from '../../../types';
import { nutritionService } from '../services/nutritionService';

const DEFAULT_ITEM: NutritionTemplateItemInput = {
  mealOrder: 1,
  productCategoryId: 2,
  portionSizeG: 100,
  isExample: true,
  note: null,
};

function createEmptyForm(): NutritionTemplateUpsertInput {
  return {
    ageMinDays: 120,
    ageMaxDays: 180,
    title: '',
    description: '',
    items: [{ ...DEFAULT_ITEM }],
  };
}

interface Props {
  onChanged?: () => void;
}

export const TemplateManager: React.FC<Props> = ({ onChanged }) => {
  const [templates, setTemplates] = useState<NutritionFeedingTemplate[]>([]);
  const [categories, setCategories] = useState<NutritionProductCategory[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<NutritionTemplateUpsertInput>(createEmptyForm());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tmpl, cats] = await Promise.all([
        nutritionService.getTemplates(null),
        nutritionService.getProductCategories(),
      ]);
      setTemplates(tmpl);
      setCategories(cats);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки шаблонов');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const loadTemplate = async (template: NutritionFeedingTemplate) => {
    setSelectedId(template.id);
    setError(null);
    try {
      const items = await nutritionService.getTemplateItems(template.id);
      setForm({
        id: template.id,
        ageMinDays: template.ageMinDays,
        ageMaxDays: template.ageMaxDays,
        title: template.title,
        description: template.description ?? '',
        items: items.map((i) => ({
          mealOrder: i.mealOrder,
          productCategoryId: i.productCategoryId,
          portionSizeG: i.portionSizeG,
          isExample: i.isExample,
          note: i.note,
        })),
      });
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить пункты шаблона');
    }
  };

  const setItem = (idx: number, patch: Partial<NutritionTemplateItemInput>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    }));
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...DEFAULT_ITEM }] }));
  };

  const removeItem = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleNew = () => {
    setSelectedId(null);
    setError(null);
    setForm(createEmptyForm());
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const payload: NutritionTemplateUpsertInput = {
        ...form,
        description: form.description?.trim() ? form.description.trim() : null,
        title: form.title.trim(),
        items: form.items.map((i) => ({
          mealOrder: Number(i.mealOrder),
          productCategoryId: Number(i.productCategoryId),
          portionSizeG: Number(i.portionSizeG),
          isExample: i.isExample !== false,
          note: i.note?.trim() ? i.note.trim() : null,
        })),
      };

      const saved = await nutritionService.upsertTemplate(payload);
      await reload();
      setSelectedId(saved.id);
      await loadTemplate(saved);
      onChanged?.();
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения шаблона');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;
    if (!window.confirm(`Удалить шаблон «${form.title}»?`)) return;
    setError(null);
    try {
      await nutritionService.deleteTemplate(form.id);
      handleNew();
      await reload();
      onChanged?.();
    } catch (e: any) {
      setError(e.message || 'Ошибка удаления шаблона');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Шаблоны</h3>
          <button
            onClick={handleNew}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium"
          >
            + Новый
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Здесь создаются схемы прикорма и рациона 1–3 лет, которые отображаются во вкладках «Прикорм» и «Рацион 1–3 года».
        </p>

        <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
          {isLoading && <p className="text-xs text-slate-500">Загрузка...</p>}
          {!isLoading && templates.length === 0 && (
            <p className="text-xs text-amber-600">Шаблоны пока не добавлены.</p>
          )}
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => loadTemplate(t)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                selectedId === t.id
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="font-medium text-slate-700 dark:text-slate-300">{t.title}</div>
              <div className="text-xs text-slate-500">{t.ageMinDays}–{t.ageMaxDays} дн.</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">
          {form.id ? `Редактирование шаблона #${form.id}` : 'Новый шаблон питания'}
        </h3>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Минимум (дни)</span>
            <input
              type="number"
              min={0}
              max={1095}
              value={form.ageMinDays}
              onChange={(e) => setForm((p) => ({ ...p, ageMinDays: Number(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">Максимум (дни)</span>
            <input
              type="number"
              min={0}
              max={1095}
              value={form.ageMaxDays}
              onChange={(e) => setForm((p) => ({ ...p, ageMaxDays: Number(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-1">
            <span className="text-xs text-slate-500">Название</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
              placeholder="Напр. Рацион 1–1,5 года"
            />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-xs text-slate-500">Описание</span>
          <textarea
            rows={2}
            value={form.description ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
          />
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Пункты рациона</h4>
            <button onClick={addItem} className="text-xs px-2 py-1 rounded bg-sky-600 text-white">+ Пункт</button>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {form.items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-[80px_1fr_110px_1fr_70px] gap-2 items-center border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={it.mealOrder}
                  onChange={(e) => setItem(idx, { mealOrder: Number(e.target.value) || 1 })}
                  className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
                  title="Порядок приема пищи"
                />

                <select
                  value={it.productCategoryId}
                  onChange={(e) => setItem(idx, { productCategoryId: Number(e.target.value) })}
                  className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  max={3000}
                  step={1}
                  value={it.portionSizeG}
                  onChange={(e) => setItem(idx, { portionSizeG: Number(e.target.value) || 0 })}
                  className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
                  title="Порция (г)"
                />

                <input
                  type="text"
                  value={it.note ?? ''}
                  onChange={(e) => setItem(idx, { note: e.target.value })}
                  className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
                  placeholder="Примечание"
                />

                <button
                  onClick={() => removeItem(idx)}
                  disabled={form.items.length <= 1}
                  className="px-2 py-1.5 rounded text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium"
          >
            {isSaving ? 'Сохранение...' : 'Сохранить шаблон'}
          </button>
          {form.id && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
            >
              Удалить
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
