import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ItemAnalysis, CloudinaryAsset, ConditionType } from '../types';
import {
  X,
  Share2,
  Gift,
  Clock,
  MapPin,
  Tag,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  LogIn,
  Sparkles,
  Video,
  Film,
  Trash2,
} from 'lucide-react';
import { getCategoryFallbackImage } from '../data/seedData';
import {
  checkDuplicateListing,
  validateVideoFile,
  uploadVideoToCloudinary,
} from '../config/cloudinary';

interface ListForSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: ItemAnalysis | null;
  asset: CloudinaryAsset | null;
  initialType?: 'borrow' | 'donate';
}

const CATEGORIES = [
  'Home Appliances',
  'Kitchen Appliances',
  'Electronics & Media',
  'Tools & DIY',
  'Photography & Gear',
  'Sports & Outdoors',
  'Furniture & Decor',
  'Books & Hobby',
  'General Household',
];

const BORROW_DURATIONS = [
  '1-2 days',
  'Weekend',
  'Up to 3 days',
  '1 week',
  '2 weeks',
  'Flexible',
];

export const ListForSharingModal: React.FC<ListForSharingModalProps> = ({
  isOpen,
  onClose,
  analysis,
  asset,
  initialType = 'borrow',
}) => {
  // 1. ALL HOOKS AT THE VERY TOP
  const { user, userProfile, openAuthModal, createRealListing, showToast, setCurrentScreen } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Home Appliances');
  const [type, setType] = useState<'borrow' | 'donate'>(initialType);
  const [condition, setCondition] = useState<ConditionType>('good');
  const [description, setDescription] = useState('');
  const [borrowDuration, setBorrowDuration] = useState('Up to 3 days');
  const [locationLabel, setLocationLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Phase 5B: Duplicate detection state
  const [duplicateFound, setDuplicateFound] = useState<{
    id: string;
    title: string;
    ownerId: string;
    distance: number;
    isOwner?: boolean;
    createdAt?: string;
  } | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // Phase 5B: Short condition video state (max 15s, 30MB)
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [uploadedVideoPublicId, setUploadedVideoPublicId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Sync / prefill form whenever modal opens or analysis changes
  useEffect(() => {
    if (!isOpen) return; // Guard inside effect
    if (analysis) {
      setTitle(analysis.item_name || '');
      setCategory(analysis.category || 'Home Appliances');
      setCondition((analysis.condition as ConditionType) || 'good');
      setType(initialType);
      setDescription(
        analysis.reasoning ||
          `Inspected with SecondLife AI. ${analysis.likely_issue ? `Issue note: ${analysis.likely_issue}` : 'Ready for circular neighborhood sharing.'}`
      );
    }
    const defaultLoc = userProfile?.neighborhood || userProfile?.city || 'Local Neighborhood';
    setLocationLabel(defaultLoc);
    setValidationError(null);
    setDuplicateFound(null);
    setDuplicateConfirmed(false);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoDuration(null);
    setUploadedVideoPublicId(null);
    setVideoError(null);
  }, [isOpen, analysis, userProfile, initialType]);

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoError(null);

    const validation = await validateVideoFile(file);
    if (!validation.valid) {
      setVideoError(validation.error || 'Invalid video file.');
      return;
    }

    setVideoFile(file);
    setVideoDuration(validation.duration ? Math.round(validation.duration) : null);
    const objectUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(objectUrl);
  };

  const handleRemoveVideo = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoDuration(null);
    setUploadedVideoPublicId(null);
    setVideoError(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  // 2. EARLY RETURN AFTER ALL HOOKS
  if (!isOpen) return null;

  const imageUrl = asset?.cleanedUrl || asset?.thumbnailUrl || asset?.originalUrl || getCategoryFallbackImage(category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // 1. Check Auth Requirement
    if (!user) {
      setValidationError('You must be signed in to list an item in the community.');
      showToast('Please sign in to list items in your community circle.', 'info');
      openAuthModal('signin');
      return;
    }

    // 2. Form Validations
    if (!title.trim() || title.trim().length < 2) {
      setValidationError('Please provide a descriptive item title (at least 2 characters).');
      return;
    }

    if (!locationLabel.trim()) {
      setValidationError('Please specify a neighborhood or area label (e.g. Indiranagar, South Delhi).');
      return;
    }

    if (!description.trim()) {
      setValidationError('Please include a brief description or condition note for neighbors.');
      return;
    }

    // 3. Duplicate Detection Check (Perceptual Hash)
    if (asset?.phash && !duplicateConfirmed) {
      setIsCheckingDuplicate(true);
      try {
        const dupResult = await checkDuplicateListing(asset.phash, user?.id);
        if (dupResult.isDuplicate && dupResult.duplicateListing) {
          setDuplicateFound(dupResult.duplicateListing);
          setIsSubmitting(false);
          setIsCheckingDuplicate(false);
          return;
        }
      } catch (err) {
        console.warn('Duplicate check handled gracefully:', err);
      } finally {
        setIsCheckingDuplicate(false);
      }
    }

    setIsSubmitting(true);

    try {
      let finalVideoPublicId = uploadedVideoPublicId || undefined;

      // Upload condition video if attached and not yet uploaded
      if (videoFile && !finalVideoPublicId) {
        setIsUploadingVideo(true);
        setVideoUploadProgress(15);
        try {
          const videoRes = await uploadVideoToCloudinary(videoFile, (p) => {
            setVideoUploadProgress(p);
          });
          finalVideoPublicId = videoRes.videoPublicId;
          setUploadedVideoPublicId(videoRes.videoPublicId);
        } catch (vErr: any) {
          setVideoError(vErr.message || 'Video upload failed. You can proceed without video or try again.');
          setIsUploadingVideo(false);
          setIsSubmitting(false);
          return;
        } finally {
          setIsUploadingVideo(false);
        }
      }

      const created = await createRealListing({
        title: title.trim(),
        category,
        condition,
        type,
        description: description.trim(),
        borrowDuration: type === 'borrow' ? borrowDuration : undefined,
        locationLabel: locationLabel.trim(),
        cloudinaryPublicId: asset?.publicId,
        tags: asset?.tags && asset.tags.length > 0 ? asset.tags : [category.toLowerCase(), type, 'secondlife'],
        cutoutUrl: imageUrl,
        phash: asset?.phash,
        videoPublicId: finalVideoPublicId,
      });

      if (created) {
        showToast(`🎉 "${created.title}" is now live in the community circle!`, 'success');
        onClose();
        setCurrentScreen('community');
      } else {
        setValidationError('Failed to save listing. Please try again.');
      }
    } catch (err: any) {
      console.error('Error creating listing:', err);
      setValidationError(err.message || 'Could not save listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl border border-emerald-100 relative overflow-hidden my-auto">
        {/* Glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-100/60 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header (Sticky top) */}
        <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#EAF7F0] text-[#2E9E6B] flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">List for Neighborhood Sharing</h3>
              <p className="text-[11px] text-slate-500">Prefilled from your circular diagnostic</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Sign in Prompt banner if logged out */}
          {!user && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-semibold">Sign in required to publish listings</p>
                <p className="text-amber-700 text-[11px] mt-0.5">
                  You can edit the form now, but you will need to sign in before publishing so neighbors can reach you.
                </p>
                <button
                  type="button"
                  onClick={() => openAuthModal('signin')}
                  className="mt-2 text-xs font-bold text-[#2E9E6B] hover:underline flex items-center gap-1"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In / Create Free Account</span>
                </button>
              </div>
            </div>
          )}

          {/* Validation Error Message */}
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Phase 5B: Duplicate Photo Warning Banner */}
          {duplicateFound && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 animate-fade-in shadow-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <p className="font-bold text-amber-900 text-sm">
                    Duplicate Photo Warning
                  </p>
                  <p className="mt-1 text-amber-800">
                    This looks like a photo you've already listed: <strong className="underline decoration-amber-400 font-semibold">{duplicateFound.title}</strong> (phash match: {duplicateFound.distance} bit diff).
                  </p>
                  <p className="mt-1 text-[11px] text-amber-700">
                    You can inspect your existing listings or continue to create a new one.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDuplicateConfirmed(true);
                        setDuplicateFound(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition-colors"
                    >
                      Continue Anyway
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDuplicateFound(null);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold text-xs transition-colors"
                    >
                      Cancel Listing
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Item Preview Card */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 relative">
              <img src={imageUrl} alt="Item Preview" className="w-full h-full object-cover" />
              {asset?.cleanedUrl && (
                <span className="absolute bottom-0 right-0 bg-[#2E9E6B] text-white text-[8px] px-1 rounded-tl font-bold">
                  AI Cutout
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2E9E6B] bg-[#EAF7F0] px-1.5 py-0.2 rounded">
                  {type === 'borrow' ? 'To Lend / Borrow' : 'Free Donation'}
                </span>
                {asset?.publicId && (
                  <span className="text-[9px] text-slate-600 truncate font-mono">
                    ID: {asset.publicId.slice(0, 10)}...
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-900 truncate mt-0.5">
                {title || 'Untitled Item'}
              </h4>
              <p className="text-[10px] text-slate-500 truncate">
                {category} · Condition: {condition}
              </p>
            </div>
          </div>

          <form id="create-listing-form" onSubmit={handleSubmit} className="space-y-3.5">
            {/* Listing Type Toggle (Borrow vs Donate) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Listing Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('borrow')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    type === 'borrow'
                      ? 'bg-sky-50 text-sky-700 border-sky-400 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Lend (Borrow)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('donate')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    type === 'donate'
                      ? 'bg-amber-50 text-amber-700 border-amber-400 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>Give Away (Donate)</span>
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Listing Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Philips Steam Iron 1200W (Serviced)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
              />
            </div>

            {/* Category & Condition in 2 columns */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as ConditionType)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white capitalize focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
                >
                  <option value="like-new">Like New</option>
                  <option value="good">Good Condition</option>
                  <option value="fair">Fair (Works fine)</option>
                  <option value="damaged">Needs Minor Repair</option>
                </select>
              </div>
            </div>

            {/* Borrow Duration (if type is borrow) */}
            {type === 'borrow' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#2E9E6B]" />
                  <span>Borrow Duration Limit</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                  {BORROW_DURATIONS.slice(0, 3).map((dur) => (
                    <button
                      type="button"
                      key={dur}
                      onClick={() => setBorrowDuration(dur)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border text-center transition-all ${
                        borrowDuration === dur
                          ? 'bg-[#2E9E6B] text-white border-[#2E9E6B]'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {dur}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={borrowDuration}
                  onChange={(e) => setBorrowDuration(e.target.value)}
                  placeholder="e.g. Up to 3 days, Weekend"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
                />
              </div>
            )}

            {/* Location Label */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Area / Neighborhood Label *</span>
              </label>
              <input
                type="text"
                required
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="e.g. Indiranagar, Bengaluru or Hauz Khas"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description & Pickup Notes *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mention working condition, accessories included, and preferred pickup times..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
              />
            </div>

            {/* Phase 5B: Optional Short Condition Video (max 15s, 30MB) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-[#2E9E6B]" />
                  <span>Short Condition Video (Optional)</span>
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  Max 15s · Up to 30 MB
                </span>
              </div>

              {videoError && (
                <div className="mb-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{videoError}</span>
                </div>
              )}

              {videoPreviewUrl ? (
                <div className="space-y-2">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-40 flex items-center justify-center">
                    <video
                      src={videoPreviewUrl}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveVideo}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                      title="Remove video"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="truncate max-w-[200px]">
                      {videoFile?.name} ({((videoFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB{videoDuration ? ` · ~${videoDuration}s` : ''})
                    </span>
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="text-[#2E9E6B] font-semibold hover:underline"
                    >
                      Replace
                    </button>
                  </div>
                  {isUploadingVideo && (
                    <div className="space-y-1">
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#2E9E6B] h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${videoUploadProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 text-right">Uploading video to Cloudinary ({videoUploadProgress}%)...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => videoInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl p-3 text-center transition-all"
                >
                  <Video className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-700">
                    Add quick video of item working
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Helps neighbors verify motors, switches, and condition
                  </p>
                </div>
              )}

              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleVideoSelect}
                className="hidden"
              />
            </div>

            {/* Tags preview */}
            {asset?.tags && asset.tags.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Auto-generated tags (via Cloudinary):
                </span>
                <div className="flex flex-wrap gap-1">
                  {asset.tags.map((t, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Modal Footer (Sticky bottom) */}
        <div className="p-4 px-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-listing-form"
            disabled={isSubmitting}
            className="py-2.5 px-5 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing to Circle...</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Publish Listing</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
