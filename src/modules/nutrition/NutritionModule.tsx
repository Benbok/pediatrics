import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Utensils } from 'lucide-react';
import { patientService } from '../../services/patient.service';
import type { ChildProfile } from '../../types';
import { PatientModuleHeader } from '../../components/PatientModuleHeader';
import { QuickCalculatorPanel } from './components/QuickCalculatorPanel';
import { ComplementaryFeedingPanel } from './components/ComplementaryFeedingPanel';
import { DietPlan1to3Panel } from './components/DietPlan1to3Panel';
import { FeedingPlanHistory } from './components/FeedingPlanHistory';
import { ProductsManager } from './components/ProductsManager';
import { TemplateManager } from './components/TemplateManager';

type TabKey = 'calculator' | 'complementary' | 'diet1to3' | 'history' | 'products' | 'templates';

interface TabDef {
  key: TabKey;
  label: string;
  showWhen?: (ageDays: number) => boolean;
}

const TABS: TabDef[] = [
  { key: 'calculator', label: 'Расчёт 0–12 мес.', showWhen: (d) => d < 365 },
  { key: 'complementary', label: 'Прикорм', showWhen: (d) => d >= 100 && d < 400 },
  { key: 'diet1to3', label: 'Рацион 1–3 года', showWhen: (d) => d >= 300 },
  { key: 'history', label: 'История расчётов' },
  { key: 'products', label: 'Смеси / продукты' },
  { key: 'templates', label: 'Шаблоны рациона' },
];

function calcAgeDays(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  const diff = now.getTime() - birth.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

export const NutritionModule: React.FC = () => {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();

  const [child, setChild] = useState<ChildProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('calculator');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    if (!childId) return;
    setIsLoading(true);
    patientService
      .getChildById(Number(childId))
      .then((c) => {
        setChild(c);
        if (c) {
          const days = calcAgeDays(c.birthDate);
          // Pick sensible default tab based on age
          if (days >= 365) setActiveTab('diet1to3');
          else if (days >= 100) setActiveTab('calculator');
          else setActiveTab('calculator');
        }
      })
      .finally(() => setIsLoading(false));
  }, [childId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Загрузка...</p>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Пациент не найден.</p>
      </div>
    );
  }

  const ageDays = calcAgeDays(child.birthDate);
  const childNumericId = Number(child.id);

  if (!Number.isFinite(childNumericId) || childNumericId <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Некорректный идентификатор пациента.</p>
      </div>
    );
  }

  const visibleTabs = TABS.filter((t) => !t.showWhen || t.showWhen(ageDays));

  // Make sure active tab is still visible after age filtering
  const safeTab = visibleTabs.some((t) => t.key === activeTab)
    ? activeTab
    : visibleTabs[0]?.key ?? 'history';

  const handlePlanSaved = () => {
    setHistoryRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Premium Header */}
      <PatientModuleHeader
        child={child}
        title="Питание"
        icon={<Utensils className="w-6 h-6 !text-white" strokeWidth={2.5} />}
        iconBgClass="bg-emerald-600"
        iconShadowClass="shadow-emerald-500/25"
        onBack={() => navigate(`/patients/${childId}`)}
      />

      {/* Tab strip */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm px-2">
        <div className="flex gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                safeTab === tab.key
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel content */}
      <div className="max-w-5xl mx-auto">
        {safeTab === 'calculator' && (
          <QuickCalculatorPanel
            childId={childNumericId}
            ageDays={ageDays}
            birthWeightG={null}
            onPlanSaved={handlePlanSaved}
          />
        )}
        {safeTab === 'complementary' && (
          <ComplementaryFeedingPanel ageDays={ageDays} />
        )}
        {safeTab === 'diet1to3' && (
          <DietPlan1to3Panel ageDays={ageDays} />
        )}
        {safeTab === 'history' && (
          <FeedingPlanHistory childId={childNumericId} refreshKey={historyRefreshKey} />
        )}
        {safeTab === 'products' && (
          <ProductsManager />
        )}
        {safeTab === 'templates' && (
          <TemplateManager />
        )}
      </div>
    </div>
  );
};
