import React, { useState } from 'react';
import { ExchangeRequest } from '../types';
import { X, CheckCircle2, XCircle, Loader2, ShieldAlert } from 'lucide-react';

interface AcceptDeclineModalProps {
  request: ExchangeRequest | null;
  mode: 'accept' | 'decline' | null;
  onClose: () => void;
  onConfirm: (requestId: string, note?: string) => Promise<boolean>;
}

export const AcceptDeclineModal: React.FC<AcceptDeclineModalProps> = ({
  request,
  mode,
  onClose,
  onConfirm,
}) => {
  // ALL HOOKS AT THE TOP
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!request || !mode) return null;

  const isAccept = mode === 'accept';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const ok = await onConfirm(request.id, note.trim() || undefined);
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
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isAccept ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {isAccept ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              {isAccept ? 'Accept Exchange Request' : 'Decline Exchange Request'}
            </h3>
            <p className="text-[11px] text-slate-500">
              For item: <span className="font-semibold text-slate-700">{request.listingTitle}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 space-y-1">
            <div className="font-semibold text-slate-800">
              Requester: {request.requesterName} ({request.requesterNeighborhood})
            </div>
            {request.message && (
              <p className="italic text-slate-600 line-clamp-2">
                "{request.message}"
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isAccept ? 'Add a pickup note (optional)' : 'Add a note (optional)'}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isAccept
                  ? 'e.g. "Available after 6 PM on weekdays near Indiranagar metro station."'
                  : 'e.g. "Apologies, item is currently not available."'
              }
              rows={3}
              maxLength={280}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
            />
            <div className="text-[10px] text-slate-400 text-right mt-1">
              {note.length}/280 characters
            </div>
          </div>

          {isAccept ? (
            <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[11px] text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Accepting will reserve the listing and notify {request.requesterName}. After handing over the item, mark it as "Handed Over".
              </span>
            </div>
          ) : (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <span>
                Declining lets other neighbors know the item is still available or in use.
              </span>
            </div>
          )}

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
              className={`flex-1 py-2.5 px-3 rounded-xl text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 ${
                isAccept
                  ? 'bg-[#2E9E6B] hover:bg-[#237E55]'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>{isAccept ? 'Confirm & Reserve' : 'Confirm Decline'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
