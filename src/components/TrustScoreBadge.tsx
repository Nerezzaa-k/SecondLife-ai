import React, { useState, useRef, useEffect } from 'react';
import { TrustScoreBreakdown } from '../types';
import { ShieldCheck, Info, X, Check, Star, Sparkles } from 'lucide-react';

interface TrustScoreBadgeProps {
  breakdown: TrustScoreBreakdown;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const TrustScoreBadge: React.FC<TrustScoreBadgeProps> = ({
  breakdown,
  size = 'md',
  showLabel = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const score = breakdown.score;
  const isHighTrust = score >= 80;
  const isMedTrust = score >= 50 && score < 80;

  const badgeColor = isHighTrust
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
    : isMedTrust
    ? 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100'
    : 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100';

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center gap-1 font-bold rounded-lg border transition-all cursor-pointer ${badgeColor} ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
        }`}
        title="Computed Community Trust Score (Click to view breakdown)"
      >
        <ShieldCheck className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span>{score}</span>
        {showLabel && <span className="font-medium opacity-80">Trust</span>}
        <Info className="w-2.5 h-2.5 opacity-60 ml-0.5" />
      </button>

      {/* Trust Score Breakdown Modal / Popover */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 left-0 bottom-full mb-2 w-72 p-4 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 text-slate-800 text-xs animate-fade-in"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2E9E6B]" />
              <span className="font-bold text-slate-900">Trust Score: {score}/100</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
            Computed transparently to keep SecondLife AI neighbors safe and circular exchanges reliable.
          </p>

          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Profile Completeness (Name, Area, Avatar)</span>
              <span className="font-semibold text-slate-800">{breakdown.profileCompleteness}/25 pts</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2E9E6B] h-full rounded-full"
                style={{ width: `${(breakdown.profileCompleteness / 25) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-600">Account / Email Verification</span>
              <span className="font-semibold text-slate-800">{breakdown.emailVerified}/20 pts</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2E9E6B] h-full rounded-full"
                style={{ width: `${(breakdown.emailVerified / 20) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-600">Completed Exchanges History</span>
              <span className="font-semibold text-slate-800">{breakdown.completedExchanges}/30 pts</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2E9E6B] h-full rounded-full"
                style={{ width: `${(breakdown.completedExchanges / 30) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-600">Community Ratings ({breakdown.averageRating} ★)</span>
              <span className="font-semibold text-slate-800">{breakdown.averageRatingScore}/15 pts</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2E9E6B] h-full rounded-full"
                style={{ width: `${(breakdown.averageRatingScore / 15) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-600">Real Item Photo Quality</span>
              <span className="font-semibold text-slate-800">{breakdown.photoQualityScore}/10 pts</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2E9E6B] h-full rounded-full"
                style={{ width: `${(breakdown.photoQualityScore / 10) * 100}%` }}
              />
            </div>
          </div>

          {breakdown.isVerified ? (
            <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-1.5 text-emerald-800 text-[10px] font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Verified Neighbor (Confirmed email & completed profile)</span>
            </div>
          ) : (
            <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[10px]">
              Complete your profile photo & area to earn the Verified Neighbor badge.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
