import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  Wrench,
  Share2,
  Gift,
  RotateCcw,
  ShoppingBag,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Camera,
  ExternalLink,
  ChevronRight,
  Info,
  Edit2,
  Calendar,
  Cloud,
  Check,
  Star,
  ShieldCheck,
  Upload,
  Loader2,
  Zap,
  Cpu,
} from 'lucide-react';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { CostComparisonChart } from '../components/CostComparisonChart';
import { ListForSharingModal } from '../components/ListForSharingModal';
import { MarkRepairedModal } from '../components/MarkRepairedModal';

export const AnalyzeScreen: React.FC = () => {
  const {
    currentAsset,
    currentAnalysis,
    isAnalyzing,
    isUploading,
    uploadProgress,
    analysisStage,
    analysisStageMessage,
    analysisError,
    retryAnalysis,
    updateAnalysisField,
    markItemRepaired,
    markItemDonated,
    listItemForSharing,
    userProfile,
    setIsCloudinaryDrawerOpen,
    setCurrentScreen,
  } = useApp();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isListForSharingOpen, setIsListForSharingOpen] = useState(false);
  const [listSharingType, setListSharingType] = useState<'borrow' | 'donate'>('borrow');
  const [isMarkRepairedOpen, setIsMarkRepairedOpen] = useState(false);
  const [customFaultText, setCustomFaultText] = useState('');
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // CLEAR MULTI-STAGE PROGRESS UI STATE
  if (isUploading || isAnalyzing) {
    const stages = [
      {
        id: 'optimizing',
        label: 'Photo Optimization',
        detail: 'Compressing image to max 1600px in browser',
        icon: Zap,
        isCompleted: ['uploading', 'analyzing', 'finalizing'].includes(analysisStage) || uploadProgress > 25,
        isActive: analysisStage === 'optimizing',
      },
      {
        id: 'uploading',
        label: 'Cloud Delivery',
        detail: 'Direct signed Cloudinary media ingestion',
        icon: Cloud,
        isCompleted: ['analyzing', 'finalizing'].includes(analysisStage) || uploadProgress > 65,
        isActive: analysisStage === 'uploading',
      },
      {
        id: 'analyzing',
        label: 'Gemini Diagnostics',
        detail: 'Multimodal analysis on lightweight 1024px image',
        icon: Cpu,
        isCompleted: analysisStage === 'finalizing' || uploadProgress >= 95,
        isActive: analysisStage === 'analyzing',
      },
      {
        id: 'parallel_tasks',
        label: 'Parallel Cutout & Phash Verification',
        detail: 'Background removal and duplicate check running in parallel',
        icon: Sparkles,
        isCompleted: analysisStage === 'finalizing' || uploadProgress >= 95,
        isActive: analysisStage === 'analyzing' || analysisStage === 'uploading',
      },
    ];

    const currentTitle =
      analysisStage === 'optimizing'
        ? 'Optimizing Image...'
        : analysisStage === 'uploading'
        ? 'Delivering to Cloudinary...'
        : analysisStage === 'analyzing'
        ? 'Gemini Diagnostics...'
        : 'Finalizing Circular Plan...';

    return (
      <div className="py-8 px-4 max-w-sm mx-auto space-y-6">
        {/* Animated Visual Hero */}
        <div className="relative w-20 h-20 mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-[#EAF7F0] border-2 border-[#2E9E6B]/30 flex items-center justify-center text-[#2E9E6B] shadow-inner">
            {analysisStage === 'analyzing' ? (
              <Sparkles className="w-10 h-10 animate-spin" />
            ) : analysisStage === 'uploading' ? (
              <Cloud className="w-10 h-10 animate-bounce" />
            ) : (
              <Zap className="w-10 h-10 text-emerald-600 animate-pulse" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-emerald-600">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        </div>

        {/* Dynamic Title & Subtitle */}
        <div className="text-center space-y-1.5">
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
            {currentTitle}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
            {analysisStageMessage || 'Running streamlined parallel circular analysis pipeline.'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-slate-600">Overall Progress</span>
            <span className="text-emerald-700 font-bold">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-[#2E9E6B] rounded-full transition-all duration-300"
              style={{ width: `${Math.max(8, uploadProgress)}%` }}
            />
          </div>
        </div>

        {/* Clear Multi-Stage Stepper List */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3 text-left">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Analysis Stages
          </h4>
          <div className="space-y-2.5">
            {stages.map((st, i) => {
              return (
                <div key={st.id} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {st.isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : st.isActive ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                        {i + 1}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold ${st.isActive ? 'text-emerald-800' : st.isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                        {st.label}
                      </span>
                      {st.isActive && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block leading-tight truncate">
                      {st.detail}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Skeleton Preview */}
        <div className="space-y-2.5 pt-1 text-left opacity-60">
          <div className="h-28 rounded-2xl bg-slate-200/80 animate-pulse" />
          <div className="h-16 rounded-2xl bg-slate-200/80 animate-pulse" />
        </div>
      </div>
    );
  }

  // ERROR STATE
  if (analysisError) {
    return (
      <div className="py-12 px-4 text-center space-y-4 max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">
          Diagnosis Needs Attention
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          {analysisError}
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={() => retryAnalysis()}
            className="px-4 py-2.5 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-[#2E9E6B]/20 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Analysis</span>
          </button>
          <button
            onClick={() => setCurrentScreen('home')}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // EMPTY STATE (no photo uploaded yet)
  if (!currentAnalysis) {
    return (
      <div className="py-14 px-4 text-center space-y-4 max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-[#FAF9F5] border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
          <Camera className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800">
          No item analyzed yet
        </h3>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          Upload a photo of an item you want to repair, donate, borrow, or repurpose to view Gemini & Cloudinary insights.
        </p>
        <button
          onClick={() => setCurrentScreen('home')}
          className="py-2.5 px-5 rounded-xl bg-[#2E9E6B] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-md shadow-[#2E9E6B]/20 hover:bg-[#237E55] transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload an item photo</span>
        </button>
      </div>
    );
  }

  const actionConfig = {
    maintain: {
      label: 'RECOMMENDED: KEEP & MAINTAIN',
      bg: 'bg-emerald-600',
      text: 'text-emerald-700',
      border: 'border-emerald-300',
      lightBg: 'bg-emerald-50',
      icon: CheckCircle2,
      description: 'Item is in good working order with no fault detected. Routine care and proactive maintenance will preserve peak performance.',
    },
    repair: {
      label: 'RECOMMENDED: REPAIR',
      bg: 'bg-emerald-600',
      text: 'text-emerald-700',
      border: 'border-emerald-300',
      lightBg: 'bg-emerald-50',
      icon: Wrench,
      description: 'High repairability index. Restoring this item prevents embodied carbon and saves wallet cash.',
    },
    borrow: {
      label: 'RECOMMENDED: BORROW / SHARE',
      bg: 'bg-sky-600',
      text: 'text-sky-700',
      border: 'border-sky-300',
      lightBg: 'bg-sky-50',
      icon: Share2,
      description: 'Occasional use item. Borrowing from neighborhood inventory avoids buying a single-purpose item.',
    },
    donate: {
      label: 'RECOMMENDED: DONATE / PASS ON',
      bg: 'bg-amber-600',
      text: 'text-amber-700',
      border: 'border-amber-300',
      lightBg: 'bg-amber-50',
      icon: Gift,
      description: 'Good remaining functional value. A student or local neighbor can immediately put this to use.',
    },
    repurpose: {
      label: 'RECOMMENDED: REPURPOSE / UPCYCLE',
      bg: 'bg-purple-600',
      text: 'text-purple-700',
      border: 'border-purple-300',
      lightBg: 'bg-purple-50',
      icon: RotateCcw,
      description: 'Transform casing, materials, or components into innovative household solutions.',
    },
    replace: {
      label: 'CONSIDER: SAFE REPLACEMENT',
      bg: 'bg-slate-700',
      text: 'text-slate-700',
      border: 'border-slate-300',
      lightBg: 'bg-slate-50',
      icon: ShoppingBag,
      description: 'Repair cost exceeds 70% of new unit or severe hazard detected. Recycle safely via e-waste.',
    },
  }[currentAnalysis.recommended_action] || {
    label: 'RECOMMENDED: KEEP & MAINTAIN',
    bg: 'bg-emerald-600',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    lightBg: 'bg-emerald-50',
    icon: CheckCircle2,
    description: 'Item diagnosed as circular candidate.',
  };

  const ActionIcon = actionConfig.icon;

  return (
    <div className="space-y-5 pb-8">
      {/* 1. Header with Editable Title & Category */}
      <div className="bg-white rounded-3xl p-4 border border-[#E8E6DF] shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>{currentAnalysis.category}</span>
            <span>·</span>
            <span className="capitalize font-medium text-slate-700">
              Condition: {currentAnalysis.condition}
            </span>
          </div>

          {currentAnalysis.isFallback || currentAsset?.isDemoFallback ? (
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Offline estimate, AI unavailable</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
              <ShieldCheck className="w-3 h-3 text-[#2E9E6B]" />
              <span>AI-assisted estimate</span>
            </div>
          )}
        </div>


        {/* Item Title */}
        <div className="flex items-center justify-between gap-2">
          {isEditingTitle ? (
            <div className="flex-1 flex gap-1.5">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
              />
              <button
                onClick={() => {
                  if (editTitle.trim()) {
                    updateAnalysisField('item_name', editTitle.trim());
                  }
                  setIsEditingTitle(false);
                }}
                className="p-2 bg-[#2E9E6B] text-white rounded-xl text-xs font-semibold"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-[#1C241F] tracking-tight">
                {currentAnalysis.item_name}
              </h2>
              <button
                onClick={() => {
                  setEditTitle(currentAnalysis.item_name);
                  setIsEditingTitle(true);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
                title="Edit item name"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Cloudinary Tag Chips */}
        {currentAsset?.tags && currentAsset.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Tags:
            </span>
            {currentAsset.tags.map((tag, i) => (
              <span
                key={i}
                className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. Before/After Slider (Original vs Cleaned Cloudinary Cutout) */}
      {currentAsset && (
        <>
          <BeforeAfterSlider
            originalUrl={currentAsset.originalUrl}
            cleanedUrl={currentAsset.cleanedUrl}
            damageCloseupUrl={currentAsset.damageCloseupUrl}
            itemName={currentAnalysis.item_name}
          />

          {/* Cloudinary Bandwidth Optimization Badge */}
          {(() => {
            const orig = currentAsset.bytes || 1.8 * 1024 * 1024;
            const deliv = currentAsset.deliveredBytes || Math.round(orig * 0.22);
            const savedPct = currentAsset.savedPercent ?? Math.round(((orig - deliv) / orig) * 100);
            const formattedOrig = (orig / (1024 * 1024)).toFixed(2) + ' MB';
            const formattedDeliv = (deliv / 1024).toFixed(1) + ' KB';

            return (
              <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#2E9E6B] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    ⚡
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      Cloudinary Bandwidth Optimization
                    </div>
                    <div className="text-slate-600 text-[11px] truncate">
                      Original: <span className="font-semibold text-slate-800">{formattedOrig}</span>, delivered: <span className="font-semibold text-slate-800">{formattedDeliv}</span>, saved <span className="font-bold text-[#2E9E6B]">{savedPct}%</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                  f_auto,q_auto
                </span>
              </div>
            );
          })()}
        </>
      )}

      {/* 3. Big "Best Next Action" Badge Card */}
      <div className={`rounded-3xl p-5 border ${actionConfig.border} ${actionConfig.lightBg} shadow-sm space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl ${actionConfig.bg} text-white flex items-center justify-center shadow-xs`}>
              <ActionIcon className="w-4 h-4" />
            </div>
            <span className="text-xs font-extrabold tracking-wider text-slate-900">
              {actionConfig.label}
            </span>
          </div>

          {/* Confidence Score Bar */}
          <div className="text-right">
            <span className="text-xs font-bold text-slate-900">
              {currentAnalysis.confidence}% Match
            </span>
            <div className="w-20 bg-slate-200/80 rounded-full h-1.5 overflow-hidden mt-1">
              <div
                className={`h-full ${actionConfig.bg}`}
                style={{ width: `${currentAnalysis.confidence}%` }}
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-800 leading-relaxed font-medium">
          {currentAnalysis.reasoning}
        </p>

        {/* Environmental Impact Metrics Pill */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
          <div className="bg-white/80 rounded-xl p-2.5 border border-slate-200/60">
            <span className="text-[10px] text-slate-500 font-semibold block">
              Landfill Waste Diverted
            </span>
            <span className="text-sm font-extrabold text-[#2E9E6B]">
              ~{currentAnalysis.estimated_waste_saved_kg} kg
            </span>
          </div>

          <div className="bg-white/80 rounded-xl p-2.5 border border-slate-200/60">
            <span className="text-[10px] text-slate-500 font-semibold block">
              CO2 Footprint Reduced
            </span>
            <span className="text-sm font-extrabold text-sky-600">
              ~{currentAnalysis.estimated_co2_saved_kg} kg
            </span>
          </div>
        </div>
      </div>

      {/* 4. Fault Diagnosis & Maintenance Section */}
      <div className="bg-white rounded-3xl p-5 border border-[#E8E6DF] shadow-xs space-y-4">
        {(() => {
          const isNoFault = currentAnalysis.likely_issue.toLowerCase().includes('no fault') || currentAnalysis.recommended_action === 'maintain';

          if (isNoFault) {
            return (
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2E9E6B]" />
                      Inspection Result
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-2">
                      <span>No fault detected</span>
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Functional & Intact
                      </span>
                    </h4>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  The item appears in sound physical condition with no obvious defects or damage observed. Proactive maintenance preserves its longevity.
                </p>

                {/* Maintenance Tips */}
                {currentAnalysis.troubleshooting_tips && currentAnalysis.troubleshooting_tips.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <span className="text-xs font-bold text-slate-800 block">
                      Recommended Maintenance & Care Tips:
                    </span>
                    <div className="space-y-2">
                      {currentAnalysis.troubleshooting_tips.map((tip, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2 text-xs text-slate-700"
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#2E9E6B] shrink-0 mt-0.5" />
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div className="space-y-3.5">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  Likely Issue & Causes
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-1">
                  {currentAnalysis.likely_issue}
                </h4>
              </div>

              {currentAnalysis.possible_causes && currentAnalysis.possible_causes.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Possible root causes:
                  </span>
                  <ul className="space-y-1">
                    {currentAnalysis.possible_causes.map((cause, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                        <span>{cause}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Troubleshooting Tips */}
              {currentAnalysis.troubleshooting_tips && currentAnalysis.troubleshooting_tips.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">
                    Safe Troubleshooting Checklist:
                  </span>
                  <div className="space-y-2">
                    {currentAnalysis.troubleshooting_tips.map((tip, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2 text-xs text-slate-700"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#2E9E6B] shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tell us what's wrong for a better diagnosis */}
        <div className="pt-3 border-t border-slate-100 space-y-2 bg-[#FAF9F5] p-3.5 rounded-2xl border border-amber-200/60">
          <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
            <span>Tell us what's wrong for a better diagnosis</span>
          </label>
          <p className="text-[11px] text-slate-600">
            Is the item rattling, failing to heat, leaking, or behaving erratically? Describe the symptom below for an updated fault diagnosis.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="text"
              value={customFaultText}
              onChange={(e) => setCustomFaultText(e.target.value)}
              placeholder="e.g. Motor hums but blades don't spin, or power cuts out..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B] bg-white"
            />
            <button
              type="button"
              disabled={!customFaultText.trim() || isReanalyzing}
              onClick={async () => {
                if (!customFaultText.trim()) return;
                setIsReanalyzing(true);
                try {
                  await retryAnalysis(customFaultText.trim());
                  setCustomFaultText('');
                } finally {
                  setIsReanalyzing(false);
                }
              }}
              className="px-4 py-2 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] disabled:opacity-50 text-white text-xs font-semibold shrink-0 transition-colors shadow-xs"
            >
              {isReanalyzing ? 'Analyzing...' : 'Update Diagnosis'}
            </button>
          </div>
        </div>

        {/* Safety Note */}
        {currentAnalysis.safety_note && (
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-2 text-xs text-amber-950">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{currentAnalysis.safety_note}</span>
          </div>
        )}
      </div>

      {/* 5. Repair vs. Replace Cost Comparison Chart */}
      <CostComparisonChart
        repairCost={currentAnalysis.repair_cost_inr}
        replaceCost={currentAnalysis.replace_cost_inr}
      />

      {/* 6. Creative Reuse / Repurposing Ideas */}
      {currentAnalysis.reuse_ideas && currentAnalysis.reuse_ideas.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-[#E8E6DF] shadow-xs space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-700">
            <RotateCcw className="w-3.5 h-3.5" />
            Circular Repurposing Ideas
          </div>
          <p className="text-xs text-slate-600">
            If keeping it isn't preferred, consider upcycling these parts:
          </p>
          <div className="space-y-1.5">
            {currentAnalysis.reuse_ideas.map((idea, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-purple-950 flex items-start gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                <span>{idea}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Photo Quality & Listing Trust Score Meter */}
      <div className="bg-white rounded-3xl p-4 border border-[#E8E6DF] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900">
              Listing Trust Score & Photo Quality
            </h4>
            <p className="text-[11px] text-slate-500">
              Evaluated for neighborhood credibility
            </p>
          </div>
          <div className="flex items-center gap-1 font-bold text-sm text-[#2E9E6B] bg-[#EAF7F0] px-2.5 py-1 rounded-xl">
            <Star className="w-3.5 h-3.5 fill-[#2E9E6B]" />
            <span>{currentAnalysis.photo_quality?.score || 88}/100</span>
          </div>
        </div>

        {/* Meter progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
          <div
            className="bg-[#2E9E6B] h-full rounded-full transition-all duration-500"
            style={{ width: `${currentAnalysis.photo_quality?.score || 88}%` }}
          />
        </div>

        {currentAnalysis.photo_quality?.tip && (
          <div className="flex items-start gap-1.5 text-xs text-slate-600">
            <Info className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
            <span>Tip: {currentAnalysis.photo_quality.tip}</span>
          </div>
        )}
      </div>

      {/* 8. Local Repair Services (Google Maps Search) */}
      {(() => {
        const itemType = currentAnalysis.category || 'item';
        const itemName = currentAnalysis.item_name || itemType;
        const locationPart = [userProfile?.neighborhood, userProfile?.city].filter(Boolean).join(', ') || 'me';
        const mapsQuery = `${itemName} repair near ${locationPart}`;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;

        return (
          <div className="bg-white rounded-3xl p-5 border border-[#E8E6DF] shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
              <Wrench className="w-4 h-4 text-[#2E9E6B]" />
              <span>Local Repair Services</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Connect with real local repair shops and specialists in your area for <strong>{itemName}</strong>.
            </p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-2xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Find {itemType} repair near you</span>
            </a>
          </div>
        );
      })()}

      {/* 9. Action Buttons: List for sharing / Mark as repaired / Mark as donated */}
      <div className="space-y-2 pt-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block px-1">
          Take Next Circular Action
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* List for sharing */}
          <button
            onClick={() => {
              setListSharingType('borrow');
              setIsListForSharingOpen(true);
            }}
            className="py-3 px-3 rounded-2xl bg-white border border-[#2E9E6B] text-[#2E9E6B] hover:bg-[#EAF7F0] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>List for Sharing</span>
          </button>

          {/* Mark as repaired */}
          <button
            onClick={() => setIsMarkRepairedOpen(true)}
            className="py-3 px-3 rounded-2xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#2E9E6B]/20 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark as Repaired</span>
          </button>

          {/* Mark as donated */}
          <button
            onClick={() => {
              setListSharingType('donate');
              setIsListForSharingOpen(true);
            }}
            className="py-3 px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-colors"
          >
            <Gift className="w-4 h-4" />
            <span>List as Donation</span>
          </button>
        </div>
      </div>

      {/* 10. Mandatory Disclaimer */}
      <div className="p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200 text-[11px] text-slate-500 leading-relaxed text-center">
        <strong>Disclaimer:</strong> AI estimates are preliminary. Consult a qualified technician for safety-critical repairs.
      </div>

      {/* List For Sharing Modal */}
      <ListForSharingModal
        isOpen={isListForSharingOpen}
        onClose={() => setIsListForSharingOpen(false)}
        analysis={currentAnalysis}
        asset={currentAsset}
        initialType={listSharingType}
      />

      {/* Phase 5B: Mark Repaired Modal with After Photo Attachment */}
      <MarkRepairedModal
        isOpen={isMarkRepairedOpen}
        onClose={() => setIsMarkRepairedOpen(false)}
        analysis={currentAnalysis}
        asset={currentAsset}
      />
    </div>
  );
};
