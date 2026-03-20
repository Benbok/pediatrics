import React, { useEffect, useMemo, useState } from 'react';
import type { NutritionProduct, NutritionProductCategory } from '../../../types';
import { nutritionService } from '../services/nutritionService';
import { JsonImportPanel } from './JsonImportPanel';
import { PrettySelect, type SelectOption } from './PrettySelect';

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
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const PAGE_SIZE = 15;

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
    setPage(1);
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

  const categoryOptions: Array<SelectOption<number | ''>> = [
    { value: '', label: '— выбрать —' },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ];

  const formulaTypeOptions: Array<SelectOption<string>> = [
    { value: '', label: 'стандартная' },
    { value: 'hydrolysate', label: 'гидролизат' },
    { value: 'amino-acid', label: 'аминокислотная' },
    { value: 'soy', label: 'соевая' },
    { value: 'AR', label: 'антирефлюксная (AR)' },
    { value: 'LF', label: 'низколактозная (LF)' },
    { value: 'premature', label: 'для недоношенных' },
  ];

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    if (!normalizedSearch) return products;
    return products.filter((product) => {
      const categoryName = categoryNameById.get(product.categoryId) ?? '';
      const haystack = [
        product.name,
        product.brand ?? '',
        categoryName,
        product.formulaType ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [products, categoryNameById, normalizedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

      <div className="max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Поиск по названию, бренду, категории..."
          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-slate-500">Загрузка...</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Нет продуктов в справочнике. Добавьте адаптированные смеси, чтобы использовать калорийный метод расчёта.
        </p>
      ) : filteredProducts.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          По запросу ничего не найдено.
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
              {paginatedProducts.map((p) => {
                const catName = categoryNameById.get(p.categoryId);
                return (
                  <tr key={p.id} className={`bg-white dark:bg-slate-900 ${p.isArchived ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{p.brand ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{catName ?? '—'}</td>
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

      {/* Pagination */}
      {filteredProducts.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Показано {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredProducts.length)}–{Math.min(currentPage * PAGE_SIZE, filteredProducts.length)} из {filteredProducts.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded-lg text-sm border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              ←
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-2.5 py-1 rounded-lg text-sm border transition-colors ${currentPage === p ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded-lg text-sm border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              →
            </button>
          </div>
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
                <PrettySelect
                  value={editProduct.categoryId ?? ''}
                  onChange={(value) => upd('categoryId', (value === '' ? null : value) as any)}
                  options={categoryOptions}
                  searchable
                  searchPlaceholder="Поиск категории..."
                  useFixedPanel
                />
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
                <PrettySelect
                  value={editProduct.formulaType ?? ''}
                  onChange={(value) => upd('formulaType', value as any)}
                  options={formulaTypeOptions}
                  useFixedPanel
                />
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
