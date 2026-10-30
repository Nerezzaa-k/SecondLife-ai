import React from 'react';
import {
  TrendingDown,
  PiggyBank,
  CheckCircle2,
  AlertTriangle,
  Info,
  Wrench,
  ShoppingBag,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

import { DamageChecklist, ItemState } from '../types';

interface CostComparisonChartProps {
  repairCost?: { min: number; max: number };
  replaceCost?: { min: number; max: number };
  damageVisible?: boolean;
  itemState?: ItemState | string;
  damageChecklist?: DamageChecklist;
  recommendedAction?: string;
  costBasis?: string;
  costConfidence?: 'low' | 'medium' | 'high';
  troubleshootingTips?: string[];
  isFallback?: boolean;
}

export const CostComparisonChart: React.FC<CostComparisonChartProps> = ({
  repairCost = { min: 0, max: 0 },
  replaceCost = { min: 0, max: 0 },
  damageVisible = false,
  itemState = 'intact',
  damageChecklist,
  recommendedAction = 'maintain',
  costBasis,
  costConfidence = 'medium',
  troubleshootingTips = [],
  isFallback = false,
}) => {
  const normAction = (recommendedAction || '').toLowerCase();
  const isOffline =
    isFallback ||
    costBasis === 'Estimate unavailable without AI analysis' ||
    (repairCost.min === 0 && repairCost.max === 0 && replaceCost.min === 0 && replaceCost.max === 0);

  // CASE 1: Offline Fallback (No invented numbers)
  if (isOffline) {
    return (
      <div className="bg-white rounded-3xl p-5 border border-[#E8E6DF] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Repair vs. Replace Economics
              </h4>
              <p className="text-[11px] text-slate-500">
                Cost comparison unavailable offline
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            Offline Mode
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Estimate unavailable without AI analysis</span>
          </div>
          <p className="text-[11px] text-amber-900 leading-relaxed">
            Live multimodal AI vision is required to calculate accurate parts and labor cost comparisons for your specific item. Connect an active Gemini API key to view realistic repair economics.
          </p>
        </div>
      </div>
    );
  }

  // CASE 2: No Repair Needed Right Now (ONLY when item_state is intact and every checklist item is false)
  const anyChecklistTrue = Boolean(
    damageChecklist && Object.values(damageChecklist).some((val) => val === true)
  );
  const isTrulyIntact = itemState === 'intact' && !anyChecklistTrue && !damageVisible;

  const isNoRepairNeeded =
    isTrulyIntact &&
    (['maintain', 'keep', 'donate', 'borrow', 'repurpose'].includes(normAction) ||
      repairCost.min <= 0 ||
      repairCost.max <= 0);

  if (isNoRepairNeeded) {
    return (
      <div className="bg-white rounded-3xl p-5 border border-[#E8E6DF] shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                No repair needed right now
              </h4>
              <p className="text-[11px] text-slate-500">
                Item evaluated as functional and intact
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#2E9E6B]" />
            Intact
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 leading-relaxed space-y-1">
          <p className="font-medium text-slate-800">
            A repair estimate appears once a problem is visible or described.
          </p>
          <p className="text-[11px] text-slate-500">
            Because this item shows no visible defects, zero repair expense is currently warranted.
          </p>
        </div>

        {troubleshootingTips && troubleshootingTips.length > 0 && (
          <div className="pt-1 border-t border-slate-100 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Proactive Maintenance Tips:
            </span>
            <ul className="space-y-1">
              {troubleshootingTips.slice(0, 3).map((tip, idx) => (
                <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E9E6B] mt-1.5 shrink-0" />
                  <span className="leading-snug">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // CASE 3: Active Repair Recommended with Positive Costs
  const repairMid = Math.round((repairCost.min + repairCost.max) / 2);
  const replaceMid = Math.round((replaceCost.min + replaceCost.max) / 2);
  const netSavings = replaceMid - repairMid;
  const isRepairMoreExpensive = netSavings <= 0;

  // Never show savings above 90% unless numbers truly support it
  let savingsPercent = 0;
  if (!isRepairMoreExpensive && replaceMid > 0) {
    const rawPercent = Math.round((netSavings / replaceMid) * 100);
    if (rawPercent > 90) {
      const trueRatio = netSavings / replaceMid;
      savingsPercent = trueRatio >= 0.90 ? Math.min(rawPercent, 95) : 90;
    } else {
      savingsPercent = rawPercent;
    }
  }

  const chartData = [
    {
      category: 'Repair Estimate',
      min: repairCost.min,
      avg: repairMid,
      max: repairCost.max,
      color: isRepairMoreExpensive ? '#E53E3E' : '#2E9E6B',
      label: `₹${repairCost.min} - ₹${repairCost.max}`,
    },
    {
      category: 'Buy Brand New',
      min: replaceCost.min,
      avg: replaceMid,
      max: replaceCost.max,
      color: '#475569',
      label: `₹${replaceCost.min} - ₹${replaceCost.max}`,
    },
  ];

  return (
    <div className="bg-white rounded-3xl p-5 border border-[#E8E6DF] shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#2E9E6B] flex items-center justify-center">
            <PiggyBank className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Repair vs. Replace Economics
            </h4>
            <p className="text-[11px] text-slate-500">
              Item-specific cost comparison (INR ₹)
            </p>
          </div>
        </div>

        {isRepairMoreExpensive ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
            <ShoppingBag className="w-3 h-3 text-rose-600" />
            Replace Recommended
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Save ~{savingsPercent}%
          </span>
        )}
      </div>

      {/* Recharts Bar Chart */}
      <div className="h-36 w-full -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis
              type="number"
              tickFormatter={(val) => `₹${val}`}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={95}
            />
            <Tooltip
              formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')} (Midpoint)`, 'Cost']}
              contentStyle={{
                backgroundColor: '#1e293b',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '11px',
                padding: '6px 10px',
              }}
              labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
            />
            <Bar dataKey="avg" radius={[0, 6, 6, 0]} barSize={20}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Range summary cards labeled approximate */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
        <div className={`p-2.5 rounded-xl border ${isRepairMoreExpensive ? 'bg-rose-50/60 border-rose-200' : 'bg-emerald-50/60 border-emerald-100'}`}>
          <span className={`text-[10px] font-semibold block ${isRepairMoreExpensive ? 'text-rose-800' : 'text-emerald-800'}`}>
            Approximate Repair & Service
          </span>
          <span className={`text-sm font-bold ${isRepairMoreExpensive ? 'text-rose-700' : 'text-emerald-700'}`}>
            ₹{repairCost.min.toLocaleString('en-IN')} – ₹{repairCost.max.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Diverts waste & keeps parts
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-semibold text-slate-700 block">
            Approximate Buy Replacement
          </span>
          <span className="text-sm font-bold text-slate-800">
            ₹{replaceCost.min.toLocaleString('en-IN')} – ₹{replaceCost.max.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Includes high manufacturing CO2
          </span>
        </div>
      </div>

      {/* Cost Basis & Confidence Details */}
      <div className="space-y-1.5 pt-1">
        {costBasis && (
          <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 leading-relaxed">
            <span className="font-semibold text-slate-800">Estimate Basis: </span>
            <span>{costBasis}</span>
          </div>
        )}

        {costConfidence === 'low' && (
          <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Rough estimate — we recommend getting a quote from a local repair technician before proceeding.</span>
          </div>
        )}
        {costConfidence === 'medium' && (
          <div className="text-[11px] text-slate-500 italic px-1">
            Approximate estimate based on typical component & local labor averages in India.
          </div>
        )}
        {costConfidence === 'high' && (
          <div className="text-[11px] text-emerald-800 bg-emerald-50/70 p-2 rounded-xl border border-emerald-100 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2E9E6B] shrink-0" />
            <span>High-confidence estimate based on specific identified component replacement.</span>
          </div>
        )}
      </div>

      {/* Highlight Box */}
      {isRepairMoreExpensive ? (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>
            Repair cost (~₹{repairMid.toLocaleString('en-IN')}) equals or exceeds replacement (~₹{replaceMid.toLocaleString('en-IN')}). Consider safe replacement and recycling this unit via certified e-waste.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF9F5] border border-slate-200 text-xs text-slate-700">
          <TrendingDown className="w-4 h-4 text-[#2E9E6B] shrink-0" />
          <span>
            Choosing repair saves you approximately{' '}
            <strong className="text-slate-900 font-bold">
              ₹{netSavings.toLocaleString('en-IN')}
            </strong>{' '}
            while preventing new embodied emissions.
          </span>
        </div>
      )}
    </div>
  );
};
