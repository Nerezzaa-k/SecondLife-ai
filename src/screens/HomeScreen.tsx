import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Upload,
  Camera,
  Search,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export const HomeScreen: React.FC = () => {
  const {
    analyzePhoto,
    isUploading,
    uploadProgress,
    performMatch,
    setCurrentScreen,
    listings,
    communityTotals,
  } = useApp();

  const [mode, setMode] = useState<'have' | 'need'>('have');
  const [problemDescription, setProblemDescription] = useState('');
  const [needSearchTerm, setNeedSearchTerm] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const needFileInputRef = useRef<HTMLInputElement>(null);
  const needCameraInputRef = useRef<HTMLInputElement>(null);
  const [isMatchingWithPhoto, setIsMatchingWithPhoto] = useState(false);

  const handleNeedPhoto = async (file: File) => {
    setIsMatchingWithPhoto(true);
    try {
      await performMatch(needSearchTerm, file);
    } finally {
      setIsMatchingWithPhoto(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WEBP).');
      return;
    }
    analyzePhoto(file, problemDescription);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleNeedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!needSearchTerm.trim()) return;
    performMatch(needSearchTerm);
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Hero Header */}
      <section className="text-center space-y-2 pt-2 px-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF7F0] border border-[#2E9E6B]/30 text-[#2E9E6B] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Circular Economy Decision Engine</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C241F] tracking-tight leading-tight">
          Before you throw it or buy new, give it a{' '}
          <span className="text-[#2E9E6B] relative inline-block">
            SecondLife.
            <svg
              className="absolute -bottom-1 left-0 w-full h-2 text-[#2E9E6B]/20"
              viewBox="0 0 100 12"
              preserveAspectRatio="none"
            >
              <path d="M0,10 Q50,0 100,10" stroke="currentColor" strokeWidth="3" fill="none" />
            </svg>
          </span>
        </h1>

        <p className="text-xs text-slate-600 max-w-sm mx-auto">
          AI diagnosis to <strong className="text-slate-800">Repair, Borrow, Donate, Repurpose</strong>, or Replace in seconds.
        </p>
      </section>

      {/* Segmented Mode Selector: Have vs Need */}
      <div className="flex p-1 bg-slate-200/70 rounded-2xl max-w-xs mx-auto border border-slate-300/60 shadow-inner">
        <button
          onClick={() => setMode('have')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            mode === 'have'
              ? 'bg-white text-[#1C241F] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>📦 I have an item</span>
        </button>
        <button
          onClick={() => setMode('need')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            mode === 'need'
              ? 'bg-white text-[#1C241F] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🔍 I need an item</span>
        </button>
      </div>

      {/* MODE 1: I HAVE AN ITEM */}
      {mode === 'have' && (
        <section className="space-y-4">
          {/* Main Upload Box */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-3xl border-2 border-dashed transition-all p-6 text-center ${
              dragActive
                ? 'border-[#2E9E6B] bg-[#EAF7F0]/60 scale-[1.01]'
                : 'border-slate-300 hover:border-[#2E9E6B]/60 bg-white/80'
            } shadow-sm`}
          >
            {isUploading ? (
              <div className="py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#EAF7F0] text-[#2E9E6B] flex items-center justify-center mx-auto animate-spin">
                  <RefreshCw className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Processing Image...
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Optimizing framing and removing background with Cloudinary
                  </p>
                </div>
                {uploadProgress > 0 && (
                  <div className="w-48 bg-slate-200 rounded-full h-1.5 mx-auto overflow-hidden">
                    <div
                      className="bg-[#2E9E6B] h-1.5 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#EAF7F0] text-[#2E9E6B] flex items-center justify-center mx-auto shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    Photograph or upload your item
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Take a clear picture of the full item or focus on broken parts, wear, or model tags.
                  </p>
                </div>

                {/* Upload & Camera Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-xs mx-auto pt-1">
                  {/* Camera capture button (mobile-first) */}
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#2E9E6B]/20 transition-all active:scale-98"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Photo</span>
                  </button>

                  {/* File chooser button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-white border border-[#E8E6DF] hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>Choose File</span>
                  </button>
                </div>

                {/* Hidden native inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Optional Problem Description input */}
          <div className="bg-white rounded-2xl p-3.5 border border-[#E8E6DF] shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                What seems wrong? <span className="text-slate-400 font-normal">(Optional context)</span>
              </label>
              <span className="text-[10px] text-slate-400">Helps AI diagnosis</span>
            </div>
            <input
              type="text"
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="e.g. Lever won't latch down, motor hums, wobbly leg, battery dead"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
            />
          </div>
        </section>
      )}

      {/* MODE 2: I NEED AN ITEM */}
      {mode === 'need' && (
        <section className="bg-white rounded-3xl p-6 border border-[#E8E6DF] shadow-sm space-y-4">
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              Borrow from your neighbors instead of buying
            </h3>
            <p className="text-xs text-slate-500">
              Find gear, tools, appliances, or study items available near you
            </p>
          </div>

          <form onSubmit={handleNeedSubmit} className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={needSearchTerm}
                onChange={(e) => setNeedSearchTerm(e.target.value)}
                placeholder="e.g. tripod for 2 days, drill machine, table fan"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
                autoFocus
              />
            </div>

            {/* Quick search chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['Tripod', 'Drill machine', 'Ironing board', 'Camping tent', 'Acoustic guitar'].map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => {
                    setNeedSearchTerm(tag);
                    performMatch(tag);
                  }}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#EAF7F0] text-slate-700 hover:text-[#2E9E6B] transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isMatchingWithPhoto}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#2E9E6B]/20 transition-colors disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Nearby Community</span>
            </button>
          </form>

          {/* Visual Search / Photo Match Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400">
              <span className="bg-white px-2">Or match by photo</span>
            </div>
          </div>

          {/* Photo Search Buttons */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isMatchingWithPhoto}
                onClick={() => needCameraInputRef.current?.click()}
                className="flex-1 py-2.5 px-3 rounded-xl border border-dashed border-[#2E9E6B]/50 bg-[#EAF7F0]/60 hover:bg-[#EAF7F0] text-[#2E9E6B] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>Snap Photo</span>
              </button>
              <button
                type="button"
                disabled={isMatchingWithPhoto}
                onClick={() => needFileInputRef.current?.click()}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 hover:border-[#2E9E6B]/40 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4 text-slate-400" />
                <span>Upload Image</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Upload a picture of the item. Cloudinary auto-tags it to rank local matches by visual overlap.
            </p>

            {isMatchingWithPhoto && (
              <div className="p-2.5 rounded-xl bg-[#EAF7F0] border border-[#2E9E6B]/30 flex items-center justify-center gap-2 text-xs font-semibold text-[#2E9E6B]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing photo tags & ranking neighborhood matches...</span>
              </div>
            )}
          </div>

          <input
            ref={needFileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleNeedPhoto(e.target.files[0]);
              }
            }}
          />
          <input
            ref={needCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleNeedPhoto(e.target.files[0]);
              }
            }}
          />

          <div className="pt-2 border-t border-slate-100 text-center">
            <button
              onClick={() => setCurrentScreen('community')}
              className="text-xs text-[#2E9E6B] font-semibold hover:underline inline-flex items-center gap-1"
            >
              <span>Browse all community listings ({listings.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      )}

      {/* Row of 4 Circular Impact Metrics */}
      <section className="bg-white rounded-2xl p-4 border border-[#E8E6DF] shadow-xs">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-3 text-center">
          Community Circular Impact to Date
        </div>

        <div className="grid grid-cols-4 gap-2 text-center divide-x divide-slate-100">
          <div>
            <span className="block text-base font-extrabold text-[#2E9E6B]">
              {communityTotals?.totalItemsReused ?? 0}
            </span>
            <span className="text-[10px] text-slate-600 block mt-0.5 leading-tight">
              Items Reused
            </span>
          </div>

          <div>
            <span className="block text-base font-extrabold text-[#2E9E6B]">
              {communityTotals?.totalWasteKg ?? 0} kg
            </span>
            <span className="text-[10px] text-slate-600 block mt-0.5 leading-tight">
              Waste Diverted
            </span>
          </div>

          <div>
            <span className="block text-base font-extrabold text-sky-600">
              {communityTotals?.totalCo2Kg ?? 0} kg
            </span>
            <span className="text-[10px] text-slate-600 block mt-0.5 leading-tight">
              CO2 Prevented
            </span>
          </div>

          <div>
            <span className="block text-base font-extrabold text-amber-600">
              {communityTotals?.activeMembers ?? 0}
            </span>
            <span className="text-[10px] text-slate-600 block mt-0.5 leading-tight">
              Opted-In Members
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
