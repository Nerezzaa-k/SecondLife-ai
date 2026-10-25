import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ItemAnalysis, CloudinaryAsset } from '../types';
import {
  X,
  Wrench,
  Camera,
  Upload,
  CheckCircle2,
  Loader2,
  Sparkles,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { uploadImageToCloudinary } from '../config/cloudinary';

interface MarkRepairedModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: ItemAnalysis;
  asset: CloudinaryAsset | null;
}

export const MarkRepairedModal: React.FC<MarkRepairedModalProps> = ({
  isOpen,
  onClose,
  analysis,
  asset,
}) => {
  const { markItemRepaired, showToast, setCurrentScreen } = useApp();

  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [afterPreviewUrl, setAfterPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Photo size exceeds 10 MB. Please choose a smaller photo.');
      return;
    }

    setAfterFile(file);
    const url = URL.createObjectURL(file);
    setAfterPreviewUrl(url);
  };

  const handleRemovePhoto = () => {
    if (afterPreviewUrl) {
      URL.revokeObjectURL(afterPreviewUrl);
    }
    setAfterFile(null);
    setAfterPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setError(null);

    try {
      let afterPhotoData: { publicId?: string; url?: string } | undefined = undefined;

      if (afterFile) {
        setUploadProgress(20);
        const uploadResult = await uploadImageToCloudinary(afterFile, (p) => {
          setUploadProgress(p);
        });
        afterPhotoData = {
          publicId: uploadResult.asset.publicId,
          url: uploadResult.asset.cleanedUrl || uploadResult.asset.originalUrl,
        };
      }

      await markItemRepaired(analysis, afterPhotoData);
      onClose();
      showToast('Repair logged successfully! Check your updated Impact stats.', 'success');
      setCurrentScreen('impact');
    } catch (err: any) {
      console.error('Failed to log repair:', err);
      setError(err.message || 'Could not save repair. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-emerald-100 relative overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Log Completed Repair</h3>
              <p className="text-[11px] text-slate-500">Record diverted waste & celebrate your fix</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Item details */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
            {asset?.originalUrl && (
              <img
                src={asset.originalUrl}
                alt={analysis.item_name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-slate-900 truncate">{analysis.item_name}</h4>
              <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                Diverts ~{analysis.estimated_waste_saved_kg || 1.8} kg waste · ~{analysis.estimated_co2_saved_kg || 4.2} kg CO2
              </p>
            </div>
          </div>

          {/* Attach After Photo Section */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              Attach "After" Repair Photo <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <p className="text-[11px] text-slate-500 leading-tight">
              Upload a photo of your repaired item to unlock interactive Before/After sliders on your personal Impact page.
            </p>

            {afterPreviewUrl ? (
              <div className="relative rounded-2xl overflow-hidden aspect-4/3 bg-slate-100 border border-slate-200 group">
                <img
                  src={afterPreviewUrl}
                  alt="After Repair Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-[#2E9E6B] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  After Repair Photo
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                  title="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-emerald-300/80 hover:border-[#2E9E6B] bg-emerald-50/30 hover:bg-emerald-50/60 rounded-2xl p-6 text-center transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-[#2E9E6B] flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">Snap or upload "After" repair photo</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Supports JPG, PNG, WEBP (max 10 MB)</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2E9E6B]" />
                  <span>Uploading to Cloudinary & recording impact...</span>
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#2E9E6B] h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="py-2.5 px-5 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{afterFile ? 'Save Repair with After Photo' : 'Confirm Repair'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
