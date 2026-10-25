import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ZoomIn, Layers, AlertTriangle, Loader2 } from 'lucide-react';

interface BeforeAfterSliderProps {
  originalUrl: string;
  cleanedUrl: string;
  damageCloseupUrl?: string;
  itemName?: string;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  originalUrl,
  cleanedUrl,
  damageCloseupUrl,
  itemName = 'Item',
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isCloseupMode, setIsCloseupMode] = useState(false);
  const [cutoutStatus, setCutoutStatus] = useState<'processing' | 'ready' | 'fallback'>('processing');
  const [retryAttempt, setRetryAttempt] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Robust cutout loading with multi-attempt retry for e_background_removal processing delay
  useEffect(() => {
    // If cleanedUrl is identical to original (e.g. offline fallback simulation without cutout), mark fallback
    if (!cleanedUrl || cleanedUrl === originalUrl) {
      setCutoutStatus('fallback');
      return;
    }

    setCutoutStatus('processing');
    setRetryAttempt(0);

    let isCancelled = false;

    const attemptLoad = (attempt: number) => {
      if (isCancelled) return;
      setRetryAttempt(attempt);

      const testImg = new Image();
      // Add retry & cache-busting timestamp on subsequent attempts to bypass cached 423/pending responses
      const urlToTest = attempt === 0
        ? cleanedUrl
        : `${cleanedUrl}${cleanedUrl.includes('?') ? '&' : '?'}retry=${attempt}&t=${Date.now()}`;

      testImg.src = urlToTest;

      testImg.onload = () => {
        if (!isCancelled) {
          setCutoutStatus('ready');
        }
      };

      testImg.onerror = () => {
        if (isCancelled) return;
        if (attempt < 3) {
          // Cloudinary e_background_removal typically takes 2-5s to process asynchronously on first upload
          const nextDelay = (attempt + 1) * 2000;
          timeoutRef.current = setTimeout(() => {
            attemptLoad(attempt + 1);
          }, nextDelay);
        } else {
          // Exceeded retries - gracefully fall back to original
          setCutoutStatus('fallback');
        }
      };
    };

    attemptLoad(0);

    return () => {
      isCancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [cleanedUrl, originalUrl]);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  const handleMouseDown = () => setIsDragging(true);

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Determine which image to show on the comparison/right side
  const currentDisplayUrl = isCloseupMode && damageCloseupUrl
    ? damageCloseupUrl
    : cutoutStatus === 'fallback'
    ? originalUrl
    : cleanedUrl;

  return (
    <div className="space-y-2">
      {/* View Switcher Controls */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Layers className="w-3.5 h-3.5 text-[#2E9E6B]" />
          <span className="font-medium">Compare visual states</span>
        </div>

        {damageCloseupUrl && (
          <button
            type="button"
            onClick={() => setIsCloseupMode(!isCloseupMode)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
              isCloseupMode
                ? 'bg-[#EAF7F0] text-[#2E9E6B] border-[#2E9E6B]/40 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{isCloseupMode ? 'Exit Close-up' : 'Cloudinary Damage Zoom'}</span>
          </button>
        )}
      </div>

      {/* Main Image Slider Viewport */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onClick={(e) => handleMove(e.clientX)}
        className="relative w-full aspect-4/3 rounded-2xl overflow-hidden select-none bg-slate-100 cursor-ew-resize border border-[#E8E6DF] shadow-inner"
      >
        {/* Right side: Cleaned / Cloudinary Cutout */}
        <div className="absolute inset-0 w-full h-full bg-[#f4f3ec] bg-grid-pattern flex items-center justify-center">
          {cutoutStatus === 'processing' && !isCloseupMode ? (
            <div className="flex flex-col items-center justify-center p-4 text-center space-y-2 animate-fade-in">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#2E9E6B] flex items-center justify-center shadow-xs">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 block">
                  Removing background...
                </span>
                <span className="text-[11px] text-slate-500 max-w-[220px] block leading-snug">
                  Cloudinary e_background_removal in progress{retryAttempt > 0 ? ` (retry ${retryAttempt}/3)` : ''}
                </span>
              </div>
            </div>
          ) : (
            <img
              src={currentDisplayUrl}
              alt={`${itemName} Cleaned`}
              className="w-full h-full object-contain p-2"
            />
          )}
        </div>

        {/* Left side: Original Image clipped by slider position */}
        <div
          className="absolute inset-0 h-full overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={originalUrl}
            alt={`${itemName} Original`}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%',
              maxWidth: 'none',
            }}
          />
        </div>

        {/* Divider Line & Slider Handle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
          style={{ left: `${sliderPosition}%` }}
        >
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-md border-2 border-[#2E9E6B] flex items-center justify-center text-[#2E9E6B] pointer-events-auto hover:scale-110 active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] font-bold">◀</span>
              <span className="text-[10px] font-bold">▶</span>
            </div>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-2.5 left-2.5 pointer-events-none">
          <span className="bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded-md">
            Original Photo
          </span>
        </div>

        <div className="absolute top-2.5 right-2.5 pointer-events-none flex items-center gap-1">
          <span className="bg-[#2E9E6B]/90 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {isCloseupMode
              ? 'Cloudinary Zoom'
              : cutoutStatus === 'processing'
              ? 'Removing background...'
              : cutoutStatus === 'fallback'
              ? 'Original (Cutout unavailable)'
              : 'Cloudinary Cutout'}
          </span>
        </div>

        {/* Helper bottom caption */}
        <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
          <span className="bg-black/50 backdrop-blur-xs text-white/90 text-[10px] font-medium px-2.5 py-0.5 rounded-full">
            Drag slider left or right to compare
          </span>
        </div>
      </div>

      {/* Fallback Warning Notice when background removal fails or add-on is unavailable */}
      {cutoutStatus === 'fallback' && (
        <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-[11px] text-amber-950 flex items-start gap-2.5 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">Background removal fallback active</span>
            <p className="text-amber-800 leading-relaxed">
              Cloudinary background removal timed out or the add-on is not active on this account. Displaying original photo instead.
            </p>
          </div>
        </div>
      )}

      {/* Damage Zoom Explanation */}
      {isCloseupMode && (
        <div className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-[11px] text-emerald-950 flex items-start gap-2.5 shadow-xs animate-fade-in">
          <Sparkles className="w-4 h-4 text-[#2E9E6B] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-emerald-950">Damage Zoom Transformations Applied:</span>
              <code className="px-1.5 py-0.5 rounded bg-white border border-emerald-200 font-mono text-[10px] text-emerald-800 font-semibold">
                c_crop,g_auto,w_500,h_500,z_1.7,f_auto,q_auto
              </code>
            </div>
            <p className="text-[11px] text-emerald-800/90 leading-relaxed">
              <strong>How it works:</strong> Cloudinary detects the highest-entropy wear/damage region (<code>g_auto</code>), crops to 500×500px with 1.7× optical zoom (<code>z_1.7</code>), and delivers using automatic WebP/AVIF format and adaptive compression (<code>f_auto,q_auto</code>).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
