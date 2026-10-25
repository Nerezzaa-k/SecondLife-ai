import React, { useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Download, Share2, Sparkles, Leaf, Copy, Check } from 'lucide-react';
import { buildShareableImpactCardUrl, getActiveCloudName } from '../config/cloudinary';

interface ShareImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  wasteSavedKg?: number;
  co2SavedKg?: number;
}

export const ShareImpactModal: React.FC<ShareImpactModalProps> = ({
  isOpen,
  onClose,
  wasteSavedKg,
  co2SavedKg,
}) => {
  const { userStats, userName, currentAsset, showToast } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageError, setImageError] = React.useState(false);

  const totalActions = userStats.itemsReused || 0;
  const isZeroActions = totalActions === 0;

  const finalWaste = isZeroActions ? 0 : (wasteSavedKg !== undefined ? wasteSavedKg : userStats.kgWasteSaved);
  const finalCo2 = isZeroActions ? 0 : (co2SavedKg !== undefined ? co2SavedKg : userStats.co2Saved);
  const finalUser = userName || 'Eco Pioneer';
  const cloudName = getActiveCloudName();

  const cloudinaryCardUrl = buildShareableImpactCardUrl(
    currentAsset?.publicId || 'sample',
    finalWaste,
    finalCo2,
    finalUser,
    cloudName
  );

  // Render high-res impact card on canvas (for download & fallback)
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set dimensions: 800x500 high-res card
    canvas.width = 800;
    canvas.height = 500;

    // Background gradient: Rich forest green
    const grad = ctx.createLinearGradient(0, 0, 800, 500);
    grad.addColorStop(0, '#163b2a');
    grad.addColorStop(0.6, '#0f291d');
    grad.addColorStop(1, '#081710');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 500);

    // Subtle geometric pattern
    ctx.strokeStyle = 'rgba(46, 158, 107, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 800; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 500);
      ctx.stroke();
    }
    for (let j = 0; j < 500; j += 40) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(800, j);
      ctx.stroke();
    }

    // Circular accent glow
    const glow = ctx.createRadialGradient(700, 100, 10, 700, 100, 250);
    glow.addColorStop(0, 'rgba(46, 158, 107, 0.35)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 800, 500);

    // SecondLife AI Header Pill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(50, 45, 210, 38, 12);
    ctx.fill();

    ctx.fillStyle = '#86efac';
    ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('🌱 SecondLife AI Impact', 65, 70);

    // Cloudinary Powered tag
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Powered by Cloudinary l_text', 560, 70);

    // Main Quote: "I saved X kg waste and Y kg CO2 with SecondLife AI"
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
    const line1 = `I saved ${finalWaste} kg waste & ${finalCo2} kg CO2`;
    const line2 = `with SecondLife AI`;
    ctx.fillText(line1, 50, 175);
    ctx.fillText(line2, 50, 220);

    // Subtext & tagline
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Smart Choices. Longer Lives. · #CircularEconomy', 50, 265);

    // Stats Grid Box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(50, 310, 700, 120, 16);
    ctx.fill();
    ctx.stroke();

    // Stat 1: Waste Diverted
    ctx.fillStyle = '#2E9E6B';
    ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${finalWaste} kg`, 80, 365);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Landfill Waste Diverted', 80, 395);

    // Stat 2: CO2 Prevented
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${finalCo2} kg`, 330, 365);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Embodied CO2 Prevented', 330, 395);

    // Stat 3: Community Hero
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${finalUser}`, 560, 360);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(isZeroActions ? 'Future Circular Champion' : 'Verified Circular Champion', 560, 395);

    // Footer timestamp
    ctx.fillStyle = '#64748b';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(`VERIFIED SECONDLIFE BADGE · ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`, 50, 465);
  }, [isOpen, finalWaste, finalCo2, finalUser, isZeroActions]);

  if (!isOpen) return null;

  const downloadCanvasImage = () => {
    if (isZeroActions) {
      showToast('Complete your first circular action to generate a shareable badge!', 'info');
      return;
    }
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `secondlife-impact-${finalUser.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    showToast('Impact card downloaded! Ready to share on social media. 🌟', 'success');
  };

  const copyOverlayUrl = () => {
    if (isZeroActions) {
      showToast('Complete your first circular action to unlock badge sharing.', 'info');
      return;
    }
    navigator.clipboard.writeText(cloudinaryCardUrl);
    showToast('Cloudinary l_text delivery URL copied! 📋', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Shareable Impact Badge
            </h3>
            <p className="text-[11px] text-slate-500">
              Personalized Cloudinary <code className="text-emerald-700 font-mono">l_text</code> overlay
            </p>
          </div>
        </div>

        {isZeroActions && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Your impact starts with your first item!</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Complete a repair, donation, or loan to calculate your real impact metrics and unlock your shareable badge.
              </p>
            </div>
          </div>
        )}

        {/* Live Canvas Graphic Preview / Cloudinary Fallback */}
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-md mb-4 bg-slate-900 relative">
          {!imageError && !isZeroActions && cloudName !== 'server-managed' ? (
            <img
              src={cloudinaryCardUrl}
              alt="Cloudinary Impact Card"
              className="w-full h-auto block max-h-[240px] object-contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <canvas
              ref={canvasRef}
              className="w-full h-auto block"
              style={{ maxHeight: '240px', objectFit: 'contain' }}
            />
          )}
          {imageError && (
            <div className="absolute top-2 right-2 bg-slate-900/80 text-[10px] text-slate-300 px-2 py-0.5 rounded-full">
              Canvas fallback render
            </div>
          )}
        </div>

        {/* Cloudinary Transformation details */}
        <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl mb-4 text-[11px] space-y-1">
          <div className="flex items-center justify-between text-slate-600 font-medium">
            <span>Cloudinary Text Overlay Spec:</span>
            <button
              onClick={copyOverlayUrl}
              disabled={isZeroActions}
              className={`flex items-center gap-1 font-semibold ${
                isZeroActions ? 'text-slate-400 cursor-not-allowed' : 'text-[#2E9E6B] hover:underline'
              }`}
            >
              <Copy className="w-3 h-3" />
              <span>Copy URL</span>
            </button>
          </div>
          <code className="block font-mono text-[10px] text-slate-500 truncate bg-white p-1.5 rounded border border-slate-200">
            {isZeroActions ? 'Awaiting your first circular exchange...' : `l_text:Arial_32_bold:I%20saved%20${finalWaste}%20kg...`}
          </code>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={downloadCanvasImage}
            disabled={isZeroActions}
            className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-colors ${
              isZeroActions
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-[#2E9E6B] hover:bg-[#237E55] text-white shadow-[#2E9E6B]/20'
            }`}
            title={isZeroActions ? 'Complete an action to download' : 'Download PNG'}
          >
            <Download className="w-4 h-4" />
            <span>{isZeroActions ? 'Complete First Item to Share' : 'Download Card (PNG)'}</span>
          </button>

          <button
            onClick={copyOverlayUrl}
            disabled={isZeroActions}
            className={`py-2.5 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center transition-colors ${
              isZeroActions
                ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
            title={isZeroActions ? 'Complete an action to copy' : 'Copy Cloudinary URL'}
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
