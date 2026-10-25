import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Cloud, Key, Check, RefreshCw, ShieldCheck, Eye, EyeOff, Sliders } from 'lucide-react';
import {
  getActiveCloudName,
  isUsingPlaceholderConfig,
  syncCloudinaryConfigFromServer,
} from '../config/cloudinary';

export const CloudinarySettingsModal: React.FC = () => {
  const {
    isCloudinarySettingsOpen,
    setIsCloudinarySettingsOpen,
    setIsCloudinaryDrawerOpen,
    showToast,
  } = useApp();

  const [cloudName, setCloudName] = useState(getActiveCloudName());
  const [isChecking, setIsChecking] = useState(false);
  const [isConfigured, setIsConfigured] = useState(!isUsingPlaceholderConfig());

  useEffect(() => {
    if (isCloudinarySettingsOpen) {
      handleCheckStatus();
    }
  }, [isCloudinarySettingsOpen]);

  if (!isCloudinarySettingsOpen) return null;

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      const config = await syncCloudinaryConfigFromServer();
      setCloudName(config.cloudName);
      setIsConfigured(config.isConfigured);
      if (config.isConfigured) {
        showToast(`Connected to Cloudinary (${config.cloudName})! ☁️`, 'success');
      }
    } catch {
      showToast('Could not reach server endpoint.', 'warning');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={() => setIsCloudinarySettingsOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Media & Pipeline Settings
            </h3>
            <p className="text-[11px] text-slate-500">
              Cloudinary configuration & inspector
            </p>
          </div>
        </div>

        {/* 2. Media Pipeline Status card */}
        <div
          className={`p-3.5 border rounded-2xl text-xs mb-4 leading-relaxed ${
            isConfigured
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-slate-100/80 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between font-semibold mb-1">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span>
                {isConfigured ? 'Live Cloudinary Connected' : 'Simulated Pipeline Active'}
              </span>
            </div>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/70 border border-slate-200 text-slate-600">
              {cloudName}
            </span>
          </div>
          <p className="text-[11px] opacity-90">
            {isConfigured
              ? 'Authenticated image processing with AI background cutout, smart crop, and tags.'
              : 'Smart circular simulation pipeline active. Media processes smoothly without external cloud requirements.'}
          </p>
        </div>

        {/* 3. Developer Media Pipeline Inspector Launcher */}
        <div className="p-3.5 bg-sky-50/70 border border-sky-200/60 rounded-2xl mb-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-sky-950 block">
              Media Pipeline Inspector
            </span>
            <p className="text-[11px] text-sky-700 mt-0.5">
              Inspect active transforms & optical crops
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCloudinarySettingsOpen(false);
              setIsCloudinaryDrawerOpen(true);
            }}
            className="py-1.5 px-3 rounded-xl bg-white text-sky-800 border border-sky-200 font-semibold text-xs hover:bg-sky-100/60 shadow-xs transition-colors shrink-0"
          >
            Open Drawer
          </button>
        </div>

        {/* 4. Security Architecture Info */}
        <div className="space-y-3 mb-5">
          <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">
                Server-Side Secret Isolation:
              </span>
              <p className="mt-0.5">
                API credentials remain securely on the server in{' '}
                <code className="text-[#2E9E6B] font-mono">.env</code> and are never leaked to the client bundle.
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] space-y-1">
            <div className="text-slate-400 font-sans font-semibold text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Key className="w-3 h-3 text-[#2E9E6B]" /> Server .env keys:
            </div>
            <div>CLOUDINARY_CLOUD_NAME=your_cloud</div>
            <div>CLOUDINARY_API_KEY=your_key</div>
            <div>CLOUDINARY_API_SECRET=your_secret</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-slate-500 ${
                isChecking ? 'animate-spin' : ''
              }`}
            />
            <span>{isChecking ? 'Checking...' : 'Check Server'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCloudinarySettingsOpen(false)}
            className="py-2 px-4 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#2E9E6B]/20 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
