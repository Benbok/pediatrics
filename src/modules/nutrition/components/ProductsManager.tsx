import React, { useEffect, useState } from 'react';
import type { NutritionProduct, NutritionProductCategory } from '../../../types';
import { nutritionService } from '../services/nutritionService';
import { JsonImportPanel } from './JsonImportPanel';

type ViewMode = 'list' | 'import';

export const ProductsManager: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [categories, setCategories] = useState<NutritionProductCategory[]>([]);
  const [products, setProducts] = useState<NutritionProduct[]>([]);
  const [filterCatId, setFilterCatId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Partial<NutritionProduct> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadProducts = async (catId?: number | null) => {
    setIsLoading(true);
    try {
      const list = await nutritionService.getProducts(catId ?? undefined);
      setProducts(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    nutritionService.getProductCategories().then(setCategories);
    loadProducts();
  }, []);

  const handleFilterChange = (catId: number | null) => {
    setFilterCatId(catId);
    loadProducts(catId);
  };

  const openAdd = () => {
    setEditProduct({ minAgeDays: 0, maxAgeDays: 365 });
    setSaveError(null);
    setShowForm(true);
  };

  const openEdit = (p: NutritionProduct) => {
    setEditProduct({ ...p });
    setSaveError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editProduct) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      await nutritionService.upsertProduct(editProduct);
      setShowForm(false);
      setEditProduct(null);
      await loadProducts(filterCatId);
    } catch (e: any) {
      setSaveError(e.message || 'Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (p: NutritionProduct) => {
    if (!window.confirm(`Удалить «${p.name}»?`)) return;
    try {
      await nutritionService.deleteProduct(p.id);
      await loadProducts(filterCatId);
    } catch (e: any) {
      alert(e.message || 'Ошибка удаления');
    }
  };

  const upd = <K extends keyof NutritionProduct>(k: K, v: NutritionProduct[K]) =>
    setEditProduct((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      {/* View mode tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
        <button
          onClick={() => setViewMode('list')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
        >
          Справочник
        </button>
        <button
          onClick={() => setViewMode('import')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'import' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
        >
          Импорт JSON
        </button>
      </div>

      {/* JSON Import view */}
      {viewMode === 'import' && (
        <JsonImportPanel
          categories={categories}
          onImportDone={() => {
            loadProducts(filterCatId);
            setViewMode('list');
          }}
        />
      )}

      {/* List view */}
      {viewMode === 'list' && (<>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Category filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleFilterChange(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterCatId === null ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
          >
            Все
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleFilterChange(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterCatId === cat.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
        >
          + Добавить смесь/продукт
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-slate-500">Загрузка...</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Нет продуктов в справочнике. Добавьте адаптированные смеси, чтобы использовать калорийный метод расчёта.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                <th className="px-3 py-2 text-left font-medium">Название</th>
                <th className="px-3 py-2 text-left font-medium">Бренд</th>
                <th className="px-3 py-2 text-left font-medium">Категория</th>
                <th className="px-3 py-2 text-right font-medium">Ккал/100 мл</th>
                <th className="px-3 py-2 text-center font-medium">Возраст (мес.)</th>
                <th className="px-3 py-2 text-center font-medium">Тип</th>
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {products.map((p) => {
                const cat = categories.find((c) => c.id === p.categoryId);
                return (
                  <tr key={p.id} className={`bg-white dark:bg-slate-900 ${p.isArchived ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{p.brand ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{cat?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                      {p.energyKcalPer100ml ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400">
                      {p.minAgeDays != null ? `${Math.floor(p.minAgeDays / 30)}` : '0'}–
                      {p.maxAgeDays != null ? `${Math.floor(p.maxAgeDays / 30)}` : '?'}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-slate-400">{p.formulaType ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-sky-500 hover:text-sky-700 mr-2 text-xs"
                      >
                        ред.
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        уд.
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit form modal */}
      {showForm && editProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-white">
                {editProduct.id ? 'Редактировать продукт' : 'Добавить продукт / смесь'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 space-y-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">Название<span className="text-red-500">*</span></span>
                <input
                  value={editProduct.name ?? ''}
                  onChange={(e) => upd('name', e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                  placeholder="напр. NAN Optipro 1"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">Бренд</span>
                <input
                  value={editProduct.brand ?? ''}
                  onChange={(e) => upd('brand', e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                  placeholder="Nestlé"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">Категория</span>
                <select
                  value={editProduct.categoryId ?? ''}
                  onChange={(e) => upd('categoryId', Number(e.target.value) as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                >
                  <option value="">— выбрать —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">Ккал / 100 мл</span>
                <input
                  type="number"
                  value={editProduct.energyKcalPer100ml ?? ''}
                  onChange={(e) => upd('energyKcalPer100ml', Number(e.target.value) as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                  placeholder="напр. 67"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">Тип смеси</span>
                <select
                  value={editProduct.formulaType ?? ''}
                  onChange={(e) => upd('formulaType', e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                >
                  <option value="">стандартная</option>
                  <option value="hydrolysate">гидролизат</option>
                  <option value="amino-acid">аминокислотная</option>
                  <option value="soy">соевая</option>
                  <option value="AR">антирефлюксная (AR)</option>
                  <option value="LF">низколактозная (LF)</option>
                  <option value="premature">для недоношенных</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">Мин. возраст (дн.)</span>
                <input
                  type="number"
                  value={editProduct.minAgeDays ?? 0}
                  onChange={(e) => upd('minAgeDays', Number(e.target.value) as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-slate-600 dark:text-slate-400">Макс. возраст (дн.)</span>
                <input
                  type="number"
                  value={editProduct.maxAgeDays ?? 365}
                  onChange={(e) => upd('maxAgeDays', Number(e.target.value) as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                />
              </label>
            </div>

            {saveError && (
              <p className="text-red-500 text-sm">{saveError}</p>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium"
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
};
