import React from 'react';
import { IndianRupee, TrendingDown, PiggyBank } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

interface CostComparisonChartProps {
  repairCost: { min: number; max: number };
  replaceCost: { min: number; max: number };
}

export const CostComparisonChart: React.FC<CostComparisonChartProps> = ({
  repairCost,
  replaceCost,
}) => {
  const repairAvg = Math.round((repairCost.min + repairCost.max) / 2);
  const replaceAvg = Math.round((replaceCost.min + replaceCost.max) / 2);
  const potentialSavings = Math.max(0, replaceAvg - repairAvg);
  const savingsPercent = replaceAvg > 0 ? Math.round((potentialSavings / replaceAvg) * 100) : 0;

  const chartData = [
    {
      category: 'Repair Estimate',
      min: repairCost.min,
      avg: repairAvg,
      max: repairCost.max,
      color: '#2E9E6B',
      label: `₹${repairCost.min} - ₹${repairCost.max}`,
    },
    {
      category: 'Buy Brand New',
      min: replaceCost.min,
      avg: replaceAvg,
      max: replaceCost.max,
      color: '#E53E3E',
      label: `₹${replaceCost.min} - ₹${replaceCost.max}`,
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E8E6DF] shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <PiggyBank className="w-4 h-4 text-[#2E9E6B]" />
            <h4 className="text-sm font-bold text-slate-900">
              Repair vs. Replace Economics
            </h4>
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Approximate cost comparison (INR ₹)
          </p>
        </div>

        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          Save ~{savingsPercent}%
        </span>
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
              width={90}
            />
            <Tooltip
              formatter={(value: any) => [`₹${value} (Avg)`, 'Cost']}
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

      {/* Range summary cards */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
        <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
          <span className="text-[10px] font-semibold text-emerald-800 block">
            Repair & Service
          </span>
          <span className="text-sm font-bold text-emerald-700">
            ₹{repairCost.min} – ₹{repairCost.max}
          </span>
          <span className="text-[10px] text-emerald-600 block mt-0.5">
            Diverts waste & keeps parts
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
          <span className="text-[10px] font-semibold text-rose-800 block">
            Buy Replacement
          </span>
          <span className="text-sm font-bold text-rose-700">
            ₹{replaceCost.min} – ₹{replaceCost.max}
          </span>
          <span className="text-[10px] text-rose-600 block mt-0.5">
            Includes high manufacturing CO2
          </span>
        </div>
      </div>

      {/* Highlight Box */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FAF9F5] border border-slate-200 text-xs text-slate-700">
        <TrendingDown className="w-4 h-4 text-[#2E9E6B] shrink-0" />
        <span>
          Choosing repair saves you approximately{' '}
          <strong className="text-slate-900 font-bold">₹{potentialSavings.toLocaleString('en-IN')}</strong>{' '}
          while preventing new embodied emissions.
        </span>
      </div>
    </div>
  );
};
