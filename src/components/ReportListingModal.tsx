import React, { useState } from 'react';
import { CommunityListing } from '../types';
import { useApp } from '../context/AppContext';
import { X, Flag, AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';

interface ReportListingModalProps {
  listing: CommunityListing | null;
  onClose: () => void;
}

export const ReportListingModal: React.FC<ReportListingModalProps> = ({
  listing,
  onClose,
}) => {
  // ALL HOOKS AT TOP
  const { user, openAuthModal, submitReport, showToast } = useApp();
  const [reason, setReason] = useState<string>('Inaccurate item photo or description');
  const [details, setDetails] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  if (!listing) return null;

  const reasons = [
    'Inaccurate item photo or description',
    'Prohibited or hazardous item',
    'Commercial seller / spam',
    'Item already unavailable or unresponsive',
    'Other safety or community concern',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('signin');
      return;
    }

    setSubmitting(true);
    try {
      const ok = await submitReport({
        listingId: listing.id,
        reason,
        details: details.trim() || undefined,
      });

      if (ok) {
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

        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-4">
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Flag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Report Listing</h3>
            <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
              {listing.title}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Why are you reporting this listing?
            </label>
            <div className="space-y-1.5">
              {reasons.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    reason === r
                      ? 'bg-rose-50/60 border-rose-300 text-rose-900 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="text-rose-600 focus:ring-rose-500 text-xs"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Details (Optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context to assist community review..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>
              Your report is confidential and visible only to moderation. The listing owner will not be notified of who submitted the report.
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
              <span>Submit Report</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
