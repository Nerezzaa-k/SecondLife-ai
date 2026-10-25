import React, { useState } from 'react';
import { ExchangeRequest } from '../types';
import { useApp } from '../context/AppContext';
import { X, Star, Loader2, Heart, ShieldCheck } from 'lucide-react';

interface LeaveReviewModalProps {
  request: ExchangeRequest | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

export const LeaveReviewModal: React.FC<LeaveReviewModalProps> = ({
  request,
  onClose,
  onSubmitted,
}) => {
  // ALL HOOKS AT THE TOP
  const { user, submitReview, showToast } = useApp();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  if (!request || !user) return null;

  const isOwner = user.id === request.listingOwnerId;
  const revieweeId = isOwner ? request.requesterId : request.listingOwnerId;
  const revieweeName = isOwner ? request.requesterName : request.ownerName;
  const revieweeArea = isOwner ? request.requesterNeighborhood : request.ownerNeighborhood;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      showToast('Please select a rating between 1 and 5 stars.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const success = await submitReview({
        requestId: request.id,
        revieweeId,
        rating,
        comment: comment.trim(),
      });

      if (success) {
        if (onSubmitted) onSubmitted();
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

        <div className="text-center pb-3 border-b border-slate-100 mb-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-2 shadow-xs">
            <Star className="w-6 h-6 fill-amber-400 stroke-amber-500" />
          </div>
          <h3 className="font-bold text-base text-slate-900">
            Review your Exchange
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Rate your handover experience with <span className="font-semibold text-slate-700">{revieweeName}</span> ({revieweeArea})
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Star Rating Selector */}
          <div className="flex flex-col items-center gap-1.5 py-1">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-7 h-7 transition-colors ${
                      star <= (hoverRating || rating)
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-slate-200 fill-slate-100'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-semibold text-slate-700">
              {rating === 5 && 'Outstanding! 🌟'}
              {rating === 4 && 'Great experience 👍'}
              {rating === 3 && 'Good / as expected 👌'}
              {rating === 2 && 'Fair / minor issues 😐'}
              {rating === 1 && 'Poor experience 👎'}
            </span>
          </div>

          {/* Comment text */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Short Comment (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`Share a kind word about ${revieweeName} for the community...`}
              rows={3}
              maxLength={280}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
            />
            <div className="text-[10px] text-slate-400 text-right mt-0.5">
              {comment.length}/280
            </div>
          </div>

          <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[11px] text-emerald-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Reviews build neighbor Trust Scores and promote safe reuse.</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#2E9E6B]/20 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Heart className="w-3.5 h-3.5" />}
            <span>{submitting ? 'Submitting Review...' : 'Submit Review'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
