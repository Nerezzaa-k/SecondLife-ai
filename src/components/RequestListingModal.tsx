import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CommunityListing } from '../types';
import {
  X,
  Calendar,
  MessageSquare,
  ShieldCheck,
  Send,
  MapPin,
  Loader2,
  AlertCircle,
  LogIn,
  CheckCircle2,
  Video,
} from 'lucide-react';
import { buildCloudinaryVideoUrl, buildVideoPosterUrl } from '../config/cloudinary';

interface RequestListingModalProps {
  listing: CommunityListing | null;
  onClose: () => void;
}

export const RequestListingModal: React.FC<RequestListingModalProps> = ({ listing, onClose }) => {
  // 1. ALL HOOKS DECLARED AT THE VERY TOP
  const {
    user,
    userProfile,
    userName,
    outgoingRequests,
    submitListingRequest,
    openAuthModal,
    showToast,
    setCurrentScreen,
  } = useApp();

  const [duration, setDuration] = useState('1-2 days');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync default duration or message when listing changes
  useEffect(() => {
    if (listing) {
      setErrorMsg(null);
      if (listing.availableDuration) {
        setDuration(listing.availableDuration);
      }
    }
  }, [listing?.id]);

  // 2. Early return AFTER all hooks
  if (!listing) return null;

  const isOwner = Boolean(user && listing.ownerId && user.id === listing.ownerId);
  const isBorrow = listing.type === 'borrow';

  // Check if a pending request from this user already exists
  const hasDuplicatePending = outgoingRequests.some(
    (r) => r.listingId === listing.id && r.status === 'pending'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user) {
      openAuthModal('signin');
      return;
    }

    if (isOwner) {
      setErrorMsg('You cannot request your own listing.');
      showToast('You cannot request your own listing.', 'warning');
      return;
    }

    if (hasDuplicatePending) {
      setErrorMsg('You already have a pending request for this item. Check your Inbox!');
      showToast('You already have a pending request for this item.', 'warning');
      return;
    }

    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      setErrorMsg('Please write a short friendly message to the neighbor.');
      showToast('Please enter a message for the owner.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const fullMessage = isBorrow && duration ? `[Requested Duration: ${duration}] ${trimmedMsg}` : trimmedMsg;
      const success = await submitListingRequest(listing.id, fullMessage);
      if (success) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Listing Header Preview */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-4">
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50"
          />
          <div className="min-w-0 flex-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                isBorrow ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isBorrow ? 'Borrow Request' : 'Claim Donation'}
            </span>
            <h4 className="font-bold text-sm text-slate-900 truncate mt-0.5">
              {listing.title}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate">
              <span className="font-medium text-slate-700 truncate">{listing.ownerName}</span>
              <span>·</span>
              <span className="flex items-center gap-0.5 truncate text-[11px]">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                {listing.ownerNeighborhood || listing.location}
              </span>
            </div>

            {/* Cloudinary Tags */}
            {listing.tags && listing.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {listing.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Bandwidth Optimization Indicator */}
            {listing.original_bytes && (
              <div className="mt-2 p-1.5 px-2 rounded-lg bg-emerald-50 border border-emerald-200/60 text-[10px] text-emerald-900 flex items-center justify-between">
                <span className="font-semibold">⚡ Bandwidth:</span>
                <span>
                  Original {(listing.original_bytes / (1024 * 1024)).toFixed(2)} MB · delivered {((listing.optimized_bytes || listing.original_bytes * 0.22) / 1024).toFixed(1)} KB (saved {Math.round(((listing.original_bytes - (listing.optimized_bytes || listing.original_bytes * 0.22)) / listing.original_bytes) * 100)}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Phase 5B: Short Condition Video Player (Lazy-loaded with Cloudinary poster) */}
        {listing.video_public_id && (
          <div className="mb-4 space-y-1.5 animate-fade-in">
            <div className="flex items-center justify-between text-xs text-slate-700 font-semibold px-0.5">
              <span className="flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-[#2E9E6B]" />
                <span>Working Condition Video</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Cloudinary f_auto,q_auto</span>
            </div>
            <div className="rounded-2xl overflow-hidden bg-black aspect-video border border-slate-200 shadow-inner">
              <video
                controls
                playsInline
                preload="none"
                poster={listing.videoPosterUrl || buildVideoPosterUrl(listing.video_public_id)}
                src={listing.videoUrl || buildCloudinaryVideoUrl(listing.video_public_id)}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {/* Auth prompt if not logged in */}
        {!user && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs text-amber-800">
              <LogIn className="w-4 h-4 text-amber-600" />
              <span>Sign-in required to request items</span>
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Connect with your local community to coordinate handovers and reuse.
            </p>
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="w-full py-2 px-3 rounded-xl bg-[#2E9E6B] text-white font-semibold text-xs hover:bg-[#237E55] transition-colors shadow-xs"
            >
              Sign In to Continue
            </button>
          </div>
        )}

        {/* Owner Block Banner */}
        {isOwner && (
          <div className="mb-4 p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs text-slate-800">
              <AlertCircle className="w-4 h-4 text-[#2E9E6B]" />
              <span>This is your own listing</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              You cannot send a borrow request for an item you listed. You can manage or edit it in My Listings.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                setCurrentScreen('my-listings');
              }}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 text-white font-semibold text-xs hover:bg-slate-900 transition-colors"
            >
              Go to My Listings
            </button>
          </div>
        )}

        {/* Duplicate Pending Request Banner */}
        {hasDuplicatePending && !isOwner && (
          <div className="mb-4 p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs text-sky-800">
              <CheckCircle2 className="w-4 h-4 text-sky-600" />
              <span>Request already pending</span>
            </div>
            <p className="text-[11px] text-sky-700 leading-relaxed">
              You already submitted a request for this item. You can track updates or message the owner from your Exchange Inbox.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                setCurrentScreen('inbox');
              }}
              className="w-full py-2 px-3 rounded-xl bg-sky-600 text-white font-semibold text-xs hover:bg-sky-700 transition-colors shadow-xs"
            >
              Open Exchange Inbox
            </button>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Request Form (Enabled only if user is logged in, not owner, not duplicate) */}
        {!isOwner && !hasDuplicatePending && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isBorrow && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#2E9E6B]" />
                  <span>Borrow duration</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['1-2 days', 'Weekend', '1 week'].map((option) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => setDuration(option)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                        duration === option
                          ? 'bg-[#2E9E6B] text-white border-[#2E9E6B] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-[#2E9E6B]" />
                  <span>Message to {listing.ownerName}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Required</span>
              </label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Hi ${listing.ownerName}! I'm in ${
                  userProfile?.neighborhood || 'the neighborhood'
                } and would love to ${isBorrow ? 'borrow this for a quick project' : 'claim this donation'}. When is a good time for handover?`}
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
              />
            </div>

            {/* Phase 6B: Community Safety Tips */}
            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Safety Tips for Lending & Exchanges</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-950/80 pl-0.5 leading-snug">
                <li>Meet in public places (e.g. apartment gate, café, society clubhouse).</li>
                <li>Check and test item condition together before accepting or returning.</li>
                <li>Never share exact street addresses, flat numbers, or private details.</li>
              </ul>
            </div>

            {/* Privacy Guard Notice */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2E9E6B] shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Guaranteed:</strong> Only your name and approximate neighborhood (
                {userProfile?.neighborhood || 'local area'}) are shared with the owner. Contact details are never revealed.
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || !user}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#2E9E6B]/20 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{submitting ? 'Sending Request...' : 'Send Request'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
