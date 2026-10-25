import React from 'react';
import { Cloud, Heart, RefreshCw, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Footer: React.FC = () => {
  const { setIsCloudinaryDrawerOpen, setIsCloudinarySettingsOpen, openLegalModal } = useApp();

  return (
    <footer className="mt-8 mb-20 px-4 text-center text-xs text-slate-500 space-y-2">
      <div className="flex items-center justify-center gap-1.5 font-medium text-slate-700">
        <span>SecondLife AI</span>
        <span>·</span>
        <span>Smart Choices. Longer Lives.</span>
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px]">
        <button
          onClick={() => setIsCloudinarySettingsOpen(true)}
          className="inline-flex items-center gap-1.5 text-sky-700 hover:text-sky-900 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200/60 font-medium transition-colors"
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Cloudinary Media Engine</span>
        </button>

        <span className="text-slate-300">•</span>

        <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
          <Sparkles className="w-3 h-3 text-[#2E9E6B]" />
          Gemini 3.8 Multimodal
        </span>
      </div>

      <p className="text-[10px] text-slate-600 max-w-xs mx-auto">
        Empowering circular communities. Diverting landfill waste and extending product lifecycles one smart choice at a time.
      </p>

      {/* Phase 6B: Legal & Privacy Links */}
      <div className="pt-1 flex items-center justify-center gap-3 text-[11px] text-slate-500 font-medium">
        <button
          onClick={() => openLegalModal('privacy')}
          className="hover:text-slate-800 hover:underline transition-colors cursor-pointer"
        >
          Privacy Policy
        </button>
        <span className="text-slate-300">·</span>
        <button
          onClick={() => openLegalModal('terms')}
          className="hover:text-slate-800 hover:underline transition-colors cursor-pointer"
        >
          Terms of Service
        </button>
      </div>
    </footer>

  );
};
