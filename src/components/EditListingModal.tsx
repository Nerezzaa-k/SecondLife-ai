import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CommunityListing, ConditionType } from '../types';
import { X, Save, Clock, MapPin, AlertCircle, Loader2 } from 'lucide-react';

interface EditListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: CommunityListing | null;
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

export const EditListingModal: React.FC<EditListingModalProps> = ({
  isOpen,
  onClose,
  listing,
}) => {
  // 1. ALL HOOKS AT THE VERY TOP
  const { updateListing, showToast } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Home Appliances');
  const [condition, setCondition] = useState<ConditionType>('good');
  const [type, setType] = useState<'borrow' | 'donate'>('borrow');
  const [description, setDescription] = useState('');
  const [borrowDuration, setBorrowDuration] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [status, setStatus] = useState<'active' | 'paused' | 'lent' | 'donated'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return; // Guard inside effect
    if (listing) {
      setTitle(listing.title || '');
      setCategory(listing.category || 'Home Appliances');
      setCondition((listing.condition as ConditionType) || 'good');
      setType(listing.type || 'borrow');
      setDescription(listing.description || '');
      setBorrowDuration(listing.availableDuration || '');
      setLocationLabel(listing.location || '');
      setStatus((listing.status as any) || 'active');
    }
    setErrorMsg(null);
  }, [isOpen, listing]);

  // 2. EARLY RETURN AFTER ALL HOOKS
  if (!isOpen || !listing) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter a listing title.');
      return;
    }
    if (!locationLabel.trim()) {
      setErrorMsg('Please enter a location / area label.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await updateListing(listing.id, {
        title: title.trim(),
        category,
        condition,
        type,
        description: description.trim(),
        borrowDuration: type === 'borrow' ? borrowDuration.trim() : undefined,
        locationLabel: locationLabel.trim(),
        status,
      });

      if (success) {
        showToast('Listing updated successfully! ✏️', 'success');
        onClose();
      } else {
        setErrorMsg('Failed to update listing. You can only edit your own listings.');
      }
    } catch (err: any) {
      console.error('Update listing error:', err);
      setErrorMsg(err.message || 'Could not update listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-emerald-100 relative overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit Listing</h3>
            <p className="text-[11px] text-slate-500">Update item details and circular status</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form id="edit-listing-form" onSubmit={handleSubmit} className="space-y-3.5">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
              />
            </div>

            {/* Type & Status */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Listing Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'borrow' | 'donate')}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
                >
                  <option value="borrow">Lend (Borrow)</option>
                  <option value="donate">Give Away (Donate)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
                >
                  <option value="active">Active (Available)</option>
                  <option value="paused">Paused (Hidden)</option>
                  <option value="lent">Lent Out</option>
                  <option value="donated">Donated / Completed</option>
                </select>
              </div>
            </div>

            {/* Category & Condition */}
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

            {/* Borrow duration if borrow */}
            {type === 'borrow' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#2E9E6B]" />
                  <span>Borrow Duration Limit</span>
                </label>
                <input
                  type="text"
                  value={borrowDuration}
                  onChange={(e) => setBorrowDuration(e.target.value)}
                  placeholder="e.g. Up to 3 days, 1 week"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
                />
              </div>
            )}

            {/* Location Label */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Area / Neighborhood *</span>
              </label>
              <input
                type="text"
                required
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
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
            form="edit-listing-form"
            disabled={isSubmitting}
            className="py-2.5 px-5 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
