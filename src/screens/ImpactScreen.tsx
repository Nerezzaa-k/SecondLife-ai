import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Award,
  TrendingUp,
  Leaf,
  Share2,
  RotateCw,
  Sparkles,
  Layers,
  ChevronRight,
  Info,
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle2,
  Lock,
  HelpCircle,
  RefreshCw,
  Wrench,
  Trophy,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { ShareImpactModal } from '../components/ShareImpactModal';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { BADGE_DEFINITIONS } from '../config/badges';
import { CATEGORY_IMPACT_DEFAULTS } from '../config/impactEstimates';

export const ImpactScreen: React.FC = () => {
  const {
    userStats,
    userName,
    userProfile,
    userActions,
    isActionsLoading,
    communityLeaderboard,
    communityTotals,
    refreshStats,
    openProfileModal,
    setCurrentScreen,
  } = useApp();

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const hasImpact = (userStats.itemsReused || 0) > 0;

  // Real 8-week timeline grouping from actions timestamps
  const weeklyData = useMemo(() => {
    const now = new Date();
    const weeks: { week: string; startDate: Date; endDate: Date; wasteKg: number; co2Kg: number }[] = [];

    for (let i = 7; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const label = i === 0 ? 'This Wk' : `Wk -${i}`;
      weeks.push({ week: label, startDate: start, endDate: end, wasteKg: 0, co2Kg: 0 });
    }

    if (userActions && userActions.length > 0) {
      for (const action of userActions) {
        const actionDate = new Date(action.createdAt);
        for (const w of weeks) {
          if (actionDate >= w.startDate && actionDate <= w.endDate) {
            w.wasteKg = parseFloat((w.wasteKg + (Number(action.wasteKg) || 0)).toFixed(1));
            w.co2Kg = parseFloat((w.co2Kg + (Number(action.co2Kg) || 0)).toFixed(1));
            break;
          }
        }
      }
    }

    return weeks.map((w) => ({ week: w.week, wasteKg: w.wasteKg, co2Kg: w.co2Kg }));
  }, [userActions]);

  const hasChartData = weeklyData.some((d) => d.wasteKg > 0 || d.co2Kg > 0);

  // User's own real completed repairs with photos
  const realRepairs = useMemo(() => {
    return userActions.filter(
      (a) => a.type === 'repaired' && (a.beforeImageUrl || a.afterImageUrl)
    );
  }, [userActions]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-2xl mx-auto">
      {/* Header & Share CTA */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1C241F] tracking-tight flex items-center gap-2">
            <span>Your Circular Impact</span>
            {isActionsLoading && (
              <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />
            )}
          </h2>
          <p className="text-xs text-slate-500">
            Real environmental and financial savings computed from your verified actions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshStats()}
            title="Refresh impact stats"
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isActionsLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="py-2 px-3.5 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-[#2E9E6B]/20 transition-colors shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Badge</span>
          </button>
        </div>
      </div>

      {/* Community Totals Banner */}
      <div className="bg-gradient-to-r from-[#163b2a] via-[#1c4d37] to-[#0f291d] rounded-3xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Community Collective Impact
              </span>
              <h4 className="text-xs font-semibold text-slate-200">
                Across {communityTotals?.activeMembers ?? 0} opted-in neighbors
              </h4>
            </div>
          </div>
          <span className="text-[10px] text-emerald-300/80 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/60">
            Real Aggregated
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-800/50 text-center">
          <div>
            <div className="text-base sm:text-lg font-extrabold text-white">
              {communityTotals?.totalItemsReused ?? 0}
            </div>
            <div className="text-[10px] text-slate-300">Items Reused</div>
          </div>
          <div>
            <div className="text-base sm:text-lg font-extrabold text-emerald-400">
              {communityTotals?.totalWasteKg ?? 0} <span className="text-[10px]">kg</span>
            </div>
            <div className="text-[10px] text-slate-300">Waste Diverted</div>
          </div>
          <div>
            <div className="text-base sm:text-lg font-extrabold text-sky-400">
              {communityTotals?.totalCo2Kg ?? 0} <span className="text-[10px]">kg</span>
            </div>
            <div className="text-[10px] text-slate-300">CO2 Prevented</div>
          </div>
        </div>
      </div>

      {/* Empty State Banner if user has 0 impact yet */}
      {!hasImpact && !isActionsLoading && (
        <div className="bg-white rounded-3xl p-6 border border-[#E8E6DF] shadow-xs text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF7F0] text-[#2E9E6B] flex items-center justify-center mx-auto shadow-xs">
            <Leaf className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900">
              Your impact starts with your first item
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
              Diagnose an appliance, complete a repair, or share an item in your neighborhood. All numbers will calculate directly from real recorded actions.
            </p>
          </div>
          <button
            onClick={() => setCurrentScreen('home')}
            className="py-2.5 px-4 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm shadow-[#2E9E6B]/20 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Diagnose Your First Item</span>
          </button>
        </div>
      )}

      {/* 4 Counter Metric Cards with Info Tooltips & Estimated Labels */}
      <div className="grid grid-cols-2 gap-3">
        {/* Metric 1: Waste Saved */}
        <div className="bg-white rounded-2xl p-4 border border-[#E8E6DF] shadow-xs space-y-1 relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Waste Saved
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                estimated
              </span>
              <button
                type="button"
                onClick={() => setActiveTooltip(activeTooltip === 'waste' ? null : 'waste')}
                className="text-slate-400 hover:text-slate-600 p-0.5"
                title="View definition"
              >
                <Info className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#2E9E6B] tracking-tight">
            {userStats.kgWasteSaved || 0}{' '}
            <span className="text-xs font-normal text-slate-500">kg</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            Landfill diversion from actions
          </p>

          {activeTooltip === 'waste' && (
            <div className="absolute top-12 left-2 right-2 bg-slate-900 text-white p-2.5 rounded-xl text-[11px] z-20 shadow-xl border border-slate-700 animate-fade-in">
              <p className="font-semibold text-emerald-400 mb-0.5">Waste Saved Definition:</p>
              Sum of material weight (kg) diverted from municipal landfills across your repaired, donated, or shared items.
            </div>
          )}
        </div>

        {/* Metric 2: CO2 Saved */}
        <div className="bg-white rounded-2xl p-4 border border-[#E8E6DF] shadow-xs space-y-1 relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              CO2 Prevented
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-semibold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded">
                estimated
              </span>
              <button
                type="button"
                onClick={() => setActiveTooltip(activeTooltip === 'co2' ? null : 'co2')}
                className="text-slate-400 hover:text-slate-600 p-0.5"
                title="View definition"
              >
                <Info className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-sky-600 tracking-tight">
            {userStats.co2Saved || 0}{' '}
            <span className="text-xs font-normal text-slate-500">kg</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            Embodied carbon avoided
          </p>

          {activeTooltip === 'co2' && (
            <div className="absolute top-12 left-2 right-2 bg-slate-900 text-white p-2.5 rounded-xl text-[11px] z-20 shadow-xl border border-slate-700 animate-fade-in">
              <p className="font-semibold text-sky-400 mb-0.5">CO2 Prevented Definition:</p>
              Sum of greenhouse gas emissions (kg CO2e) avoided by preventing brand new manufacturing and logistics cycles.
            </div>
          )}
        </div>

        {/* Metric 3: Money Saved in INR */}
        <div className="bg-white rounded-2xl p-4 border border-[#E8E6DF] shadow-xs space-y-1 relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Money Saved
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                estimated
              </span>
              <button
                type="button"
                onClick={() => setActiveTooltip(activeTooltip === 'money' ? null : 'money')}
                className="text-slate-400 hover:text-slate-600 p-0.5"
                title="View definition"
              >
                <Info className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-600 tracking-tight">
            ₹{(userStats.moneySavedInr || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            Avoided new purchase costs
          </p>

          {activeTooltip === 'money' && (
            <div className="absolute top-12 left-2 right-2 bg-slate-900 text-white p-2.5 rounded-xl text-[11px] z-20 shadow-xl border border-slate-700 animate-fade-in">
              <p className="font-semibold text-amber-400 mb-0.5">Money Saved Definition:</p>
              Avoided retail replacement cost minus repair cost for repairs, plus avoided purchases when borrowing from neighbors.
            </div>
          )}
        </div>

        {/* Metric 4: Items & Specific Breakdown */}
        <div className="bg-white rounded-2xl p-4 border border-[#E8E6DF] shadow-xs space-y-1 relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Items Reused
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTooltip(activeTooltip === 'items' ? null : 'items')}
                className="text-slate-400 hover:text-slate-600 p-0.5"
                title="View definition"
              >
                <Info className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {userStats.itemsReused || 0}{' '}
            <span className="text-xs font-normal text-slate-500">items</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            {userStats.repairsDone || 0} repairs · {userStats.donationsDone || 0} donated · {userStats.borrowedCount || 0} shared
          </p>

          {activeTooltip === 'items' && (
            <div className="absolute top-12 left-2 right-2 bg-slate-900 text-white p-2.5 rounded-xl text-[11px] z-20 shadow-xl border border-slate-700 animate-fade-in">
              <p className="font-semibold text-purple-400 mb-0.5">Items Reused Definition:</p>
              Strict sum of your verified action rows: {userStats.repairsDone || 0} repairs + {userStats.donationsDone || 0} donations + {userStats.borrowedCount || 0} loans/borrows = {userStats.itemsReused || 0} total items.
            </div>
          )}
        </div>
      </div>

      {/* Methodology Accordion: "How we calculate this" */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#2E9E6B]" />
            <span className="text-xs font-bold text-slate-900">
              How we calculate your impact
            </span>
            <span className="text-[9px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full">
              Methodology & Assumptions
            </span>
          </div>
          {showMethodology ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showMethodology && (
          <div className="p-4 pt-1 border-t border-slate-100 text-xs text-slate-600 space-y-3 bg-slate-50/50">
            <p className="leading-relaxed">
              <strong>All metrics are estimates.</strong> SecondLife computes impact at action creation time by prioritizing Google Gemini Vision multimodal analysis, and falling back to a documented per-category Life Cycle Assessment (LCA) table.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="py-1.5 pr-2 font-semibold">Category</th>
                    <th className="py-1.5 px-2 font-semibold">Avg Weight</th>
                    <th className="py-1.5 px-2 font-semibold">CO2 Factor</th>
                    <th className="py-1.5 pl-2 font-semibold">Avoided Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[10px]">
                  {Object.values(CATEGORY_IMPACT_DEFAULTS).slice(0, 5).map((row) => (
                    <tr key={row.category}>
                      <td className="py-1.5 pr-2 font-sans font-medium text-slate-800">{row.category}</td>
                      <td className="py-1.5 px-2 text-slate-600">{row.averageWeightKg} kg</td>
                      <td className="py-1.5 px-2 text-slate-600">{row.embodiedCo2FactorKg} kg/kg</td>
                      <td className="py-1.5 pl-2 text-slate-600">₹{row.typicalReplacementPriceInr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal border-t border-slate-200/60 pt-2">
              Values are strictly persisted with each action in the database with their provenance tag (<code className="font-mono text-emerald-700">estimate_source: 'gemini' | 'category_default'</code>) and are never invented at display time.
            </p>
          </div>
        )}
      </div>

      {/* Real 8-Week Timeline Chart */}
      <div className="bg-white rounded-3xl p-5 border border-[#E8E6DF] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              8-Week Activity Timeline
            </h3>
            <p className="text-[11px] text-slate-500">
              {hasChartData
                ? 'Grouped weekly waste and CO2 savings from your actions'
                : 'Zero recorded actions in the last 8 weeks (no fake curve)'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-semibold">
            <span className="flex items-center gap-1 text-[#2E9E6B]">
              <span className="w-2 h-2 rounded-full bg-[#2E9E6B]" /> Waste (kg)
            </span>
            <span className="flex items-center gap-1 text-sky-600">
              <span className="w-2 h-2 rounded-full bg-sky-500" /> CO2 (kg)
            </span>
          </div>
        </div>

        <div className="h-44 w-full -ml-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="wasteGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E9E6B" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2E9E6B" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  borderRadius: '12px',
                  fontSize: '11px',
                  padding: '8px 12px',
                  border: 'none',
                }}
              />
              <Area type="monotone" dataKey="co2Kg" stroke="#0284c7" fillOpacity={1} fill="url(#co2Grad)" name="CO2 Saved (kg)" />
              <Area type="monotone" dataKey="wasteKg" stroke="#2E9E6B" strokeWidth={2} fillOpacity={1} fill="url(#wasteGrad)" name="Waste Saved (kg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {!hasChartData && (
          <p className="text-center text-[11px] text-slate-400 pt-1">
            Activity curve will populate as you complete your first repair, loan, or donation.
          </p>
        )}
      </div>

      {/* Badges Section with Real Progress Bars */}
      <div className="bg-white rounded-3xl p-5 border border-[#E8E6DF] shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              Circular Achievements
            </div>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">
              Badges & Milestones
            </h3>
          </div>
          <span className="text-[10px] text-slate-500">
            Real action thresholds
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BADGE_DEFINITIONS.map((b) => {
            const progress = b.calculateProgress(userStats, { averageRating: 5.0, totalReviews: 0 });
            const isUnlocked = progress.unlocked;

            return (
              <div
                key={b.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isUnlocked
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-slate-50/70 border-slate-200/80 opacity-90'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                      isUnlocked
                        ? 'bg-emerald-100 text-emerald-700 shadow-xs'
                        : 'bg-slate-200/70 text-slate-400 grayscale'
                    }`}
                  >
                    {b.id === 'badge-1' ? '🛠️' : b.id === 'badge-2' ? '⭐' : b.id === 'badge-3' ? '🌱' : b.id === 'badge-4' ? '🔄' : b.id === 'badge-5' ? '✨' : '🏆'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 truncate">
                        {b.name}
                      </h4>
                      {isUnlocked ? (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Unlocked
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-400 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" />
                          Locked
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      {b.description}
                    </p>

                    {/* Progress Bar */}
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                        <span>Progress</span>
                        <span>
                          {progress.current} / {progress.target} {b.unit}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isUnlocked ? 'bg-[#2E9E6B]' : 'bg-slate-400'
                          }`}
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Before/After Repairs Gallery */}
      <div className="bg-white rounded-3xl p-5 border border-[#E8E6DF] shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Layers className="w-3.5 h-3.5 text-[#2E9E6B]" />
              Before & After Repairs
            </div>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">
              Your Completed Repairs
            </h3>
          </div>
        </div>

        {/* Real User Repairs */}
        {realRepairs.length > 0 ? (
          <div className="space-y-3">
            {realRepairs.map((action) => (
              <div
                key={action.id}
                className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900">
                    {action.itemName || 'Repaired Item'}
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    {new Date(action.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {action.beforeImageUrl && action.afterImageUrl ? (
                  <BeforeAfterSlider
                    originalUrl={action.beforeImageUrl}
                    cleanedUrl={action.afterImageUrl}
                    itemName={action.itemName}
                  />
                ) : (
                  <div className="relative rounded-xl overflow-hidden aspect-4/3 bg-slate-200">
                    <img
                      src={action.afterImageUrl || action.beforeImageUrl || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500'}
                      alt="Repaired item"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute bottom-1.5 left-1.5 bg-[#2E9E6B] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      Repaired Item
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                  <span className="text-emerald-700 font-semibold">
                    Saved {action.wasteKg} kg waste · ₹{action.moneySavedInr}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    {action.co2Kg} kg CO2 · source: {action.estimateSource || 'estimate'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center space-y-2 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 p-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Layers className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700">
              No completed repairs yet
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              Diagnose an item with a photo and mark it repaired to see your real before-and-after restorations showcased here.
            </p>
          </div>
        )}
      </div>

      {/* Community Leaderboard (Real Opt-in Aggregation) */}
      <div className="bg-white rounded-3xl p-5 border border-[#E8E6DF] shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              Community Leaderboard
            </div>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">
              Top CO2 Savers
            </h3>
          </div>
          <span className="text-[10px] text-slate-500">
            Opt-in neighbors only
          </span>
        </div>

        {/* Opt-in status callout */}
        {!userProfile?.show_on_leaderboard ? (
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
            <div className="text-amber-800">
              <p className="font-semibold text-[11px]">You're hidden from the leaderboard</p>
              <p className="text-[10px] text-amber-700">Only opted-in neighbors appear here with their first name and neighborhood.</p>
            </div>
            <button
              onClick={openProfileModal}
              className="py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] shrink-0 transition-colors"
            >
              Join Leaderboard
            </button>
          </div>
        ) : (
          <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-[11px] text-emerald-800">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              You are participating in the Community Leaderboard
            </span>
            <button
              onClick={openProfileModal}
              className="text-[#2E9E6B] font-semibold hover:underline"
            >
              Edit in Profile
            </button>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {communityLeaderboard && communityLeaderboard.length > 0 ? (
            communityLeaderboard.map((entry, idx) => {
              const isCurrentUser =
                userProfile?.id === entry.userId ||
                userName?.toLowerCase().startsWith(entry.firstName.toLowerCase());

              return (
                <div
                  key={entry.userId}
                  className={`py-2.5 px-2.5 flex items-center justify-between gap-3 rounded-xl transition-colors ${
                    isCurrentUser ? 'bg-[#EAF7F0]/80 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-5 text-center text-xs font-bold ${
                        idx === 0
                          ? 'text-amber-500'
                          : idx === 1
                          ? 'text-slate-400'
                          : idx === 2
                          ? 'text-amber-700'
                          : 'text-slate-500'
                      }`}
                    >
                      #{idx + 1}
                    </span>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h5 className="text-xs font-bold text-slate-900">
                          {entry.firstName} {isCurrentUser ? '(You)' : ''}
                        </h5>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {entry.neighborhood}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-[#2E9E6B] block">
                      {entry.co2SavedKg} kg CO2
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {entry.itemsReused} items
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs space-y-1">
              <p>No one has joined the leaderboard yet</p>
              <button
                onClick={openProfileModal}
                className="mt-1 text-[#2E9E6B] font-semibold hover:underline"
              >
                Be the first to join in your Profile!
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Share Impact Modal */}
      <ShareImpactModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
};
