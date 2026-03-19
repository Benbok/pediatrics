import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { NutritionAgeNorm, NutritionProduct, ChildFeedingPlan, FeedingType } from '../../../types';
import { calcBasicNeeds, calcVolumetricRange } from '../../../logic/nutrition/calculateNeeds';
import {
  calcBreastFeeding,
  calcMixedFeeding,
  calcFormulaFeeding,
  type FeedingCalcResult,
} from '../../../logic/nutrition/calculateFeeding';
import { nutritionService } from '../services/nutritionService';

interface Props {
  childId: number;
  ageDays: number;
  birthWeightG?: number | null;
  onPlanSaved?: () => void;
}

const FEEDING_TYPE_LABELS: Record<FeedingType, string> = {
  BF: 'Грудное вскармливание (ГВ)',
  MF: 'Смешанное вскармливание (СВ)',
  FF: 'Искусственное вскармливание (ИВ)',
};

type FormulaCalcMethod = 'auto' | 'caloric' | 'volumetric';

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

const FEEDING_TYPE_OPTIONS: Array<SelectOption<FeedingType>> = [
  { value: 'BF', label: FEEDING_TYPE_LABELS.BF },
  { value: 'MF', label: FEEDING_TYPE_LABELS.MF },
  { value: 'FF', label: FEEDING_TYPE_LABELS.FF },
];

const FORMULA_METHOD_OPTIONS: Array<SelectOption<FormulaCalcMethod>> = [
  { value: 'auto', label: 'Авто (предпочесть калорийный при наличии данных)' },
  { value: 'caloric', label: 'Калорийный' },
  { value: 'volumetric', label: 'Объёмный' },
];

export const QuickCalculatorPanel: React.FC<Props> = ({
  childId,
  ageDays,
  birthWeightG,
  onPlanSaved,
}) => {
  const [weightKg, setWeightKg] = useState('');
  const [birthWeightInput, setBirthWeightInput] = useState(
    birthWeightG ? String(birthWeightG) : '',
  );
  const [feedingType, setFeedingType] = useState<FeedingType>('BF');
  const [estBreastMilk, setEstBreastMilk] = useState('');
  const [formulaId, setFormulaId] = useState<number | null>(null);
  const [mealsPerDayInput, setMealsPerDayInput] = useState('');
  const [formulaCalcMethod, setFormulaCalcMethod] = useState<FormulaCalcMethod>('auto');

  const [ageNorms, setAgeNorms] = useState<NutritionAgeNorm[]>([]);
  const [formulas, setFormulas] = useState<NutritionProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [comments, setComments] = useState('');

  // Load reference data once on mount
  React.useEffect(() => {
    (async () => {
      try {
        const [norms, formulaList] = await Promise.all([
          nutritionService.getAgeNorms(),
          nutritionService.getFormulaProducts(ageDays),
        ]);
        setAgeNorms(norms);
        setFormulas(formulaList);
        setDataLoaded(true);
      } catch {
        // non-fatal — calc still works from static norms
      }
    })();
  }, [ageDays]);

  const norm = useMemo(
    () => ageNorms.find((n) => n.ageMinDays <= ageDays && n.ageMaxDays >= ageDays) ?? null,
    [ageNorms, ageDays],
  );

  const selectedFormula = useMemo(
    () => formulas.find((f) => f.id === formulaId) ?? null,
    [formulas, formulaId],
  );

  const formulaOptions = useMemo<Array<SelectOption<string>>>(
    () => [
      { value: '', label: '— объёмный метод (без смеси) —' },
      ...formulas.map((f) => ({
        value: String(f.id),
        label: `${f.brand ? `${f.brand} ` : ''}${f.name}${f.energyKcalPer100ml ? ` (${f.energyKcalPer100ml} ккал/100 мл)` : ''}`,
      })),
    ],
    [formulas],
  );

  const mealsPerDayOverride = useMemo(() => {
    const v = parseInt(mealsPerDayInput, 10);
    if (Number.isNaN(v) || v < 1 || v > 12) return undefined;
    return v;
  }, [mealsPerDayInput]);

  const result: FeedingCalcResult | null = useMemo(() => {
    const wt = parseFloat(weightKg);
    if (!norm || isNaN(wt) || wt <= 0) return null;

    const bwG = parseInt(birthWeightInput) || birthWeightG || undefined;
    const needs = calcBasicNeeds(ageDays, wt, norm, bwG, mealsPerDayOverride);

    if (feedingType === 'BF') return calcBreastFeeding(needs);
    if (feedingType === 'MF') {
      const estMl = parseFloat(estBreastMilk) || 0;
      return calcMixedFeeding(needs, estMl);
    }
    const fProduct = selectedFormula
      ? { id: selectedFormula.id, name: selectedFormula.name, brand: selectedFormula.brand, energyKcalPer100ml: selectedFormula.energyKcalPer100ml }
      : null;
    const preferredMethod = formulaCalcMethod === 'auto' ? undefined : formulaCalcMethod;
    return calcFormulaFeeding(needs, fProduct, preferredMethod);
  }, [weightKg, birthWeightInput, feedingType, estBreastMilk, selectedFormula, formulaCalcMethod, mealsPerDayOverride, norm, ageDays, birthWeightG]);

  const volumeRange = useMemo(() => {
    const wt = parseFloat(weightKg);
    if (!norm || isNaN(wt) || !norm.volumeFactorMin) return null;
    return calcVolumetricRange(wt, norm);
  }, [weightKg, norm]);

  const handleSave = async () => {
    if (!result) return;
    const wt = parseFloat(weightKg);
    if (isNaN(wt)) return;
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const bwG = parseInt(birthWeightInput) || birthWeightG || null;
      await nutritionService.saveFeedingPlan({
        childId,
        date: new Date().toISOString().slice(0, 10),
        ageDays,
        weightKg: wt,
        birthWeightG: bwG,
        feedingType: result.type,
        dailyEnergyNeedKcal: result.dailyEnergyNeedKcal,
        dailyVolumeNeedMl: result.dailyVolumeNeedMl,
        mealsPerDay: result.mealsPerDay,
        estimatedBreastMilkMl: result.type === 'MF' ? result.estimatedBreastMilkMl : null,
        formulaVolumeMl: result.type === 'FF' ? result.dailyFormulaMl : result.type === 'MF' ? result.formulaDeficitMl : null,
        formulaId: result.type !== 'BF' ? formulaId : null,
        comments: comments || null,
      });
      setSaveSuccess(true);
      onPlanSaved?.();
    } catch (e: any) {
      setSaveError(e.message || 'Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const ageLabel = ageDays <= 10
    ? `${ageDays} дн.`
    : ageDays < 30
    ? `${ageDays} дн.`
    : ageDays < 365
    ? `${Math.floor(ageDays / 30)} мес. ${ageDays % 30 || ''} дн.`
    : `${Math.floor(ageDays / 365)} лет ${Math.floor((ageDays % 365) / 30)} мес.`;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-200">Входные данные</h3>
          {norm && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-2.5 py-1 text-xs font-medium">
              Этап: {norm.feedingStage}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Возраст</label>
            <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700">
              {ageLabel}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Масса (кг)<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="number"
              min="0.3"
              max="50"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="напр. 5.4"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {ageDays <= 10 && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Масса при рожд. (г)
              </label>
              <input
                type="number"
                min="500"
                max="7000"
                step="10"
                value={birthWeightInput}
                onChange={(e) => setBirthWeightInput(e.target.value)}
                placeholder="напр. 3500"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4 md:p-5 space-y-4">
        <h3 className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-200">Параметры расчёта</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Тип вскармливания</label>
            <PrettySelect
              value={feedingType}
              onChange={setFeedingType}
              options={FEEDING_TYPE_OPTIONS}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Кормлений в сутки
            </label>
            <input
              type="number"
              min="1"
              max="12"
              step="1"
              value={mealsPerDayInput}
              onChange={(e) => setMealsPerDayInput(e.target.value)}
              placeholder={norm ? `по норме: ${norm.mealsPerDay}` : '1-12'}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-slate-400">
              Оставьте пустым, чтобы использовать возрастную норму.
            </p>
          </div>

          {feedingType === 'FF' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Метод расчёта смеси
              </label>
              <PrettySelect
                value={formulaCalcMethod}
                onChange={setFormulaCalcMethod}
                options={FORMULA_METHOD_OPTIONS}
              />
            </div>
          )}
        </div>

        {(feedingType === 'MF' || feedingType === 'FF') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {feedingType === 'MF' && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Оценочный объём ГМ/сут (мл)
                </label>
                <input
                  type="number"
                  min="0"
                  max="2000"
                  step="10"
                  value={estBreastMilk}
                  onChange={(e) => setEstBreastMilk(e.target.value)}
                  placeholder="напр. 400"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-400">Задаётся врачом по клиническим данным (динамика веса, число кормлений)</p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Смесь (опционально)</label>
              <PrettySelect
                value={formulaId != null ? String(formulaId) : ''}
                onChange={(v) => setFormulaId(v ? Number(v) : null)}
                options={formulaOptions}
                searchable
                searchPlaceholder="Поиск смеси по названию или бренду"
              />
              {formulas.length === 0 && dataLoaded && (
                <p className="text-xs text-slate-400">Справочник смесей пуст. Добавьте смеси во вкладке «Смеси».</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ——— RESULTS ——— */}
      {result && (
        <FeedingResultCard
          result={result}
          volumeRange={volumeRange}
          comments={comments}
          onCommentsChange={setComments}
          onSave={handleSave}
          isSaving={isSaving}
          saveSuccess={saveSuccess}
          saveError={saveError}
        />
      )}

      {!norm && (
        <p className="text-sm text-amber-600">
          Нормы для данного возраста ({ageDays} дн.) не найдены в справочнике.
        </p>
      )}
    </div>
  );
};

// ─── Sub-component ────────────────────────────────────────────────────────────

interface FeedingResultCardProps {
  result: FeedingCalcResult;
  volumeRange: [number, number] | null;
  comments: string;
  onCommentsChange: (v: string) => void;
  onSave: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
}

interface PrettySelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<SelectOption<T>>;
  searchable?: boolean;
  searchPlaceholder?: string;
}

const PrettySelect = <T extends string,>({
  value,
  onChange,
  options,
  searchable = false,
  searchPlaceholder = 'Поиск...',
}: PrettySelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selected = options.find((opt) => opt.value === value) ?? options[0];

  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, searchable, searchQuery]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 flex items-center justify-between transition-colors hover:border-emerald-400"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate text-left">{selected?.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            </div>
          )}
          <ul role="listbox" className="max-h-64 overflow-auto py-1">
            {filteredOptions.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    opt.value === value
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                  role="option"
                  aria-selected={opt.value === value}
                >
                  {opt.label}
                </button>
              </li>
            ))}
            {filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                Ничего не найдено
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const FeedingResultCard: React.FC<FeedingResultCardProps> = ({
  result, volumeRange, comments, onCommentsChange, onSave, isSaving, saveSuccess, saveError,
}) => {
  const dailyVolumeForCard = result.type === 'FF' ? result.dailyFormulaMl : result.dailyVolumeNeedMl;
  const perMealForCard = result.type === 'FF'
    ? result.perMealFormulaMl
    : result.dailyVolumeNeedMl != null && result.mealsPerDay > 0
    ? Math.round(result.dailyVolumeNeedMl / result.mealsPerDay)
    : null;
  const volumeLabel = result.type === 'FF' ? 'Объём смеси/сут' : 'Объём пищи/сут';
  const ffCaloricRaw = result.type === 'FF' && result.formula?.energyKcalPer100ml
    ? Math.round((result.dailyEnergyNeedKcal / result.formula.energyKcalPer100ml) * 100)
    : null;

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-4 space-y-3">
    <h4 className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">
      Результат расчёта — {FEEDING_TYPE_LABELS[result.type]}
    </h4>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
        <div className="text-slate-500 text-xs mb-1">Суточная энергия</div>
        <div className="font-bold text-slate-800 dark:text-white">
          {result.dailyEnergyNeedKcal} ккал
        </div>
      </div>

      {dailyVolumeForCard != null ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
          <div className="text-slate-500 text-xs mb-1">{volumeLabel}</div>
          <div className="font-bold text-slate-800 dark:text-white">
            {dailyVolumeForCard} мл
            {result.type !== 'FF' && volumeRange && (
              <span className="text-xs font-normal text-slate-400 ml-1">
                ({volumeRange[0]}–{volumeRange[1]})
              </span>
            )}
          </div>
        </div>
      ) : null}

      <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
        <div className="text-slate-500 text-xs mb-1">Кормлений/сут</div>
        <div className="font-bold text-slate-800 dark:text-white">{result.mealsPerDay}</div>
      </div>

      {perMealForCard != null ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
          <div className="text-slate-500 text-xs mb-1">На 1 кормление</div>
          <div className="font-bold text-slate-800 dark:text-white">
            {perMealForCard} мл
          </div>
        </div>
      ) : null}
    </div>

    {result.type === 'MF' && (
      <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
        <p>
          Дефицит (объём смеси/сут):{' '}
          <span className="font-semibold">{result.formulaDeficitMl} мл</span>
          {' '}≈{' '}
          <span className="font-semibold">{result.formulaPerMealMl} мл/кормление</span>
        </p>
        {result.switchToFFRecommended && (
          <p className="text-amber-600 dark:text-amber-400">
            ⚠️ Объём грудного молока ({result.estimatedBreastMilkMl} мл) ниже 150 мл/сут —
            рассмотрите перевод на искусственное вскармливание.
          </p>
        )}
      </div>
    )}

    {result.type === 'MF' && result.dailyVolumeNeedMl != null && (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white/70 dark:bg-slate-900/30 p-3 text-sm text-slate-700 dark:text-slate-300 space-y-1">
        <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">
          Как рассчитано
        </p>
        <p>
          1) Суточная энергия по возрастной норме:{' '}
          <span className="font-semibold">{result.dailyEnergyNeedKcal} ккал/сут</span>
        </p>
        <p>
          2) Суточный объём питания (объёмный метод):{' '}
          <span className="font-semibold">{result.dailyVolumeNeedMl} мл/сут</span>
          {volumeRange && (
            <span className="text-slate-500"> ({volumeRange[0]}-{volumeRange[1]} мл)</span>
          )}
        </p>
        <p>
          3) Дефицит смеси: <span className="font-semibold">{result.dailyVolumeNeedMl}</span>
          {' '}−{' '}
          <span className="font-semibold">{result.estimatedBreastMilkMl}</span>
          {' '}={' '}
          <span className="font-semibold">{result.formulaDeficitMl} мл/сут</span>
        </p>
        <p>
          4) На 1 кормление: <span className="font-semibold">{result.formulaDeficitMl}</span>
          {' '}÷{' '}
          <span className="font-semibold">{result.mealsPerDay}</span>
          {' '}={' '}
          <span className="font-semibold">{result.formulaPerMealMl} мл</span>
        </p>
      </div>
    )}

    {result.type === 'FF' && (
      <div className="text-sm text-slate-700 dark:text-slate-300">
        <p>
          Смесь:{' '}
          <span className="font-semibold">
            {result.formula ? `${result.formula.brand ?? ''} ${result.formula.name}`.trim() : 'не выбрана (объёмный метод)'}
          </span>
          {' — '}метод расчёта: {result.calculationMethod === 'caloric' ? 'калорийный' : 'объёмный'}
        </p>
        <p>
          Суточный объём смеси:{' '}
          <span className="font-semibold">{result.dailyFormulaMl} мл</span>
          {' '}({result.perMealFormulaMl} мл/кормление)
        </p>
      </div>
    )}

    {result.type === 'FF' && (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white/70 dark:bg-slate-900/30 p-3 text-sm text-slate-700 dark:text-slate-300 space-y-1">
        <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">
          Как рассчитано
        </p>
        <p>
          1) Суточная энергия по возрастной норме:{' '}
          <span className="font-semibold">{result.dailyEnergyNeedKcal} ккал/сут</span>
        </p>

        {result.calculationMethod === 'caloric' ? (
          <>
            {result.formula?.energyKcalPer100ml != null && ffCaloricRaw != null ? (
              <p>
                2) Калорийный метод: {' '}
                <span className="font-semibold">{result.dailyEnergyNeedKcal}</span>
                {' '}÷{' '}
                <span className="font-semibold">{result.formula.energyKcalPer100ml}</span>
                {' '}× 100 ={' '}
                <span className="font-semibold">{ffCaloricRaw} мл/сут</span>
              </p>
            ) : (
              <p>
                2) Калорийный метод выбран, но у смеси нет валидной калорийности на 100 мл.
              </p>
            )}
          </>
        ) : (
          <p>
            2) Объёмный метод: берется суточная объёмная потребность{' '}
            <span className="font-semibold">{result.dailyVolumeNeedMl ?? result.dailyFormulaMl} мл/сут</span>
            {volumeRange && (
              <span className="text-slate-500"> ({volumeRange[0]}-{volumeRange[1]} мл)</span>
            )}
          </p>
        )}

        <p>
          3) На 1 кормление: <span className="font-semibold">{result.dailyFormulaMl}</span>
          {' '}÷{' '}
          <span className="font-semibold">{result.mealsPerDay}</span>
          {' '}={' '}
          <span className="font-semibold">{result.perMealFormulaMl} мл</span>
        </p>
      </div>
    )}

    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
        Комментарий врача (необязательно)
      </label>
      <textarea
        rows={2}
        value={comments}
        onChange={(e) => onCommentsChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm resize-none"
        placeholder="Особые указания, отклонения..."
      />
    </div>

    <div className="flex items-center gap-3">
      <button
        onClick={onSave}
        disabled={isSaving}
        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
      >
        {isSaving ? 'Сохранение...' : 'Сохранить расчёт'}
      </button>
      {saveSuccess && (
        <span className="text-emerald-600 dark:text-emerald-400 text-sm">✓ Сохранено</span>
      )}
      {saveError && (
        <span className="text-red-600 dark:text-red-400 text-sm">{saveError}</span>
      )}
    </div>
    </div>
  );
};
