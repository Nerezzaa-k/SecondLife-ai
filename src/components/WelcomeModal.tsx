import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, ArrowRight, ShieldCheck, Leaf, HeartHandshake, LogIn } from 'lucide-react';

export const WelcomeModal: React.FC = () => {
  const { isFirstVisit, completeOnboarding, openAuthModal, user } = useApp();
  const [inputName, setInputName] = useState('');

  if (!isFirstVisit || user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    completeOnboarding(inputName.trim() || 'Eco Pioneer');
  };

  const handleSignInClick = () => {
    completeOnboarding('Eco Member');
    openAuthModal('signin');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-emerald-100 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-100/70 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-100/50 rounded-full blur-2xl" />

        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-[#EAF7F0] flex items-center justify-center mb-4 text-[#2E9E6B]">
            <Leaf className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-[#1C241F] tracking-tight">
            Welcome to SecondLife AI
          </h2>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2E9E6B] mt-0.5 mb-3">
            Smart Choices. Longer Lives.
          </p>

          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            Before you throw an item away or buy new, snap a photo. We diagnose if it’s best to{' '}
            <strong className="text-slate-900 font-semibold">Repair, Borrow, Donate, Repurpose</strong>, or Replace.
          </p>

          {/* Value props */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <ShieldCheck className="w-4 h-4 text-[#2E9E6B] shrink-0" />
              <span>Cloudinary background removal & damage zoom</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <Sparkles className="w-4 h-4 text-[#2E9E6B] shrink-0" />
              <span>Gemini Vision diagnostic & savings analysis</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <HeartHandshake className="w-4 h-4 text-[#2E9E6B] shrink-0" />
              <span>Neighborhood circular sharing community</span>
            </div>
          </div>

          {/* Sign In CTA */}
          <button
            type="button"
            onClick={handleSignInClick}
            className="w-full mb-3 py-2.5 px-4 rounded-xl border border-[#2E9E6B] bg-[#EAF7F0] hover:bg-[#2E9E6B] hover:text-white text-[#2E9E6B] font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In / Create Account with Supabase</span>
          </button>

          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-2 text-[10px] uppercase font-semibold text-slate-400 absolute">
              or continue as guest
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="user-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Display Name
              </label>
              <input
                id="user-name"
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="e.g. Maya or Raghav"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B] text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#2E9E6B]/20 transition-colors"
            >
              <span>Explore as Guest</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
