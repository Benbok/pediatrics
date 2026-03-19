import React, { useState } from 'react';
import { nutritionService, type ProductValidationResult } from '../services/nutritionService';
import type { NutritionProductCategory } from '../../../types';
import {
  FORMULA_IMPORT_TEMPLATES,
  PRODUCT_CAT_LABELS,
  PRODUCT_SCHEMA_HELP,
} from '../data/importTemplates';

// ─── Types ───────────────────────────────────────────────────────────────────────────────

type ImportResultItem = {
  index: number;
  status: 'success' | 'error';
  name: string;
  id?: number;
  errors?: string[];
};

interface Props {
  categories: NutritionProductCategory[];
  onImportDone: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────────────────

export const JsonImportPanel: React.FC<Props> = ({ categories, onImportDone }) => {
  const [rawJson, setRawJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<ProductValidationResult[] | null>(null);
  const [importResults, setImportResults] = useState<ImportResultItem[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const handleLoadTemplate = (key: string) => {
    setRawJson(JSON.stringify(FORMULA_IMPORT_TEMPLATES[key], null, 2));
    setParseError(null);
    setValidationResults(null);
    setImportResults(null);
  };

  // Validation logic delegated to service (Component = View only)
  const handleValidate = () => {
    setImportResults(null);
    const { parseError: err, results } = nutritionService.validateProductsJson(rawJson);
    setParseError(err ?? null);
    setValidationResults(results ?? null);
  };

  const handleImport = async () => {
    if (!validationResults) return;
    const validItems = validationResults.filter((r) => r.status === 'valid' && r.data);
    if (validItems.length === 0) return;

    setIsImporting(true);
    setImportResults(null);
    try {
      const results = await nutritionService.bulkUpsertProducts(validItems.map((r) => r.data!));
      setImportResults(results.map((r) => ({ ...r, status: r.status === 'success' ? 'success' : 'error' }) as ImportResultItem));
      if (results.some((r) => r.status === 'success')) onImportDone();
    } catch (e: any) {
      setParseError(e.message || 'Неизвестная ошибка при импорте');
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = validationResults?.filter((r) => r.status === 'valid').length ?? 0;
  const savedCount = importResults?.filter((r) => r.status === 'success').length ?? 0;

  return (
    <div className="space-y-4">
      {/* Template buttons */}
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium uppercase tracking-wide">
          Загрузить шаблон:
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(FORMULA_IMPORT_TEMPLATES).map((key) => (
            <button
              key={key}
              onClick={() => handleLoadTemplate(key)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Textarea */}
      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
          JSON массив продуктов
        </label>
        <textarea
          value={rawJson}
          onChange={(e) => {
            setRawJson(e.target.value);
            setParseError(null);
            setValidationResults(null);
            setImportResults(null);
          }}
          rows={14}
          spellCheck={false}
          className="w-full font-mono text-xs px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-slate-200 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder={'[\n  {\n    "categoryId": 2,\n    "brand": "Nestlé",\n    "name": "NAN Optipro 1",\n    "energyKcalPer100ml": 67,\n    "minAgeDays": 0,\n    "maxAgeDays": 180,\n    "formulaType": "standard"\n  }\n]'}
        />
        <p className="mt-1 text-xs text-slate-400">
          Поля: <code>categoryId</code>*, <code>name</code>*, <code>energyKcalPer100ml</code> или{' '}
          <code>energyKcalPer100g</code>*, <code>minAgeDays</code>*, <code>maxAgeDays</code>*.
          Остальные — необязательные.
        </p>
      </div>

      {/* Parse error */}
      {parseError && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-400">
          {parseError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleValidate}
          disabled={!rawJson.trim()}
          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
        >
          Проверить
        </button>
        {validationResults && validCount > 0 && !importResults && (
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            {isImporting ? 'Сохранение…' : `Сохранить валидные (${validCount})`}
          </button>
        )}
        {rawJson && (
          <button
            onClick={() => {
              setRawJson('');
              setParseError(null);
              setValidationResults(null);
              setImportResults(null);
            }}
            className="px-3 py-2 rounded-lg text-slate-400 hover:text-red-500 text-sm transition-colors"
          >
            Очистить
          </button>
        )}
      </div>

      {/* Validation results */}
      {validationResults && !importResults && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Результат проверки ({validCount} из {validationResults.length} валидны)
          </p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {validationResults.map((item) => (
              <ValidationRow key={item.index} item={item} catMap={catMap} />
            ))}
          </div>
        </div>
      )}

      {/* Import results */}
      {importResults && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Результат импорта — сохранено {savedCount} из {importResults.length}
          </p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {importResults.map((item) => (
              <ImportResultRow key={item.index} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Schema reference */}
      <details className="border border-slate-200 dark:border-slate-700 rounded-xl">
        <summary className="px-4 py-2 cursor-pointer text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 select-none">
          Справка: поля и допустимые значения
        </summary>
        <div className="px-4 pb-4 pt-2 text-xs text-slate-600 dark:text-slate-400 space-y-2">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                <th className="py-1 pr-3 font-semibold">Поле</th>
                <th className="py-1 pr-3 font-semibold">Обязательное</th>
                <th className="py-1 font-semibold">Описание</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {PRODUCT_SCHEMA_HELP.map((row) => (
                <tr key={row.field}>
                  <td className="py-1 pr-3 font-mono text-emerald-700 dark:text-emerald-400">{row.field}</td>
                  <td className="py-1 pr-3 text-center">{row.required ? '✓' : '—'}</td>
                  <td className="py-1 text-slate-500 dark:text-slate-400">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <p className="font-semibold mb-1">Категории (categoryId):</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PRODUCT_CAT_LABELS).map(([id, label]) => (
                <span key={id} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                  {id} – {label}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold mb-1">formulaType:</p>
            <div className="flex flex-wrap gap-1.5">
              {['standard', 'hydrolysate', 'amino-acid', 'soy', 'AR', 'LF', 'premature'].map((t) => (
                <span key={t} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────────────────────────────────────────

const ValidationRow: React.FC<{
  item: ProductValidationResult;
  catMap: Record<number, string>;
}> = ({ item }) => {
  if (item.status === 'valid') {
    const d = item.data;
    return (
      <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
        <span className="text-emerald-500 mt-0.5">✓</span>
        <div className="min-w-0">
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{item.name}</span>
          {d && (
            <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-500">
              {d.energyKcalPer100ml ?? d.energyKcalPer100g} ккал · {Math.floor(d.minAgeDays / 30)}–
              {Math.floor(d.maxAgeDays / 30)} мес
            </span>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2">
      <div className="flex items-start gap-2 mb-1">
        <span className="text-red-500 mt-0.5">✕</span>
        <span className="text-sm font-medium text-red-800 dark:text-red-300">{item.name}</span>
      </div>
      <ul className="ml-5 space-y-0.5">
        {item.errors?.map((e, i) => (
          <li key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
};

const ImportResultRow: React.FC<{ item: ImportResultItem }> = ({ item }) => {
  if (item.status === 'success') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
        <span className="text-emerald-500">✓</span>
        <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{item.name}</span>
        <span className="text-xs text-emerald-500 ml-auto">ID {item.id}</span>
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-red-500">✕</span>
        <span className="text-sm font-medium text-red-800 dark:text-red-300">{item.name}</span>
      </div>
      {item.errors?.map((e, i) => (
        <p key={i} className="text-xs text-red-600 dark:text-red-400 ml-5 font-mono">{e}</p>
      ))}
    </div>
  );
};

