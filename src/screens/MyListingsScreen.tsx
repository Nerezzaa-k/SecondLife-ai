import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CommunityListing } from '../types';
import { getCategoryFallbackImage } from '../data/seedData';
import {
  Package,
  PlusCircle,
  Pause,
  Play,
  Edit2,
  Trash2,
  CheckCircle2,
  Gift,
  Share2,
  AlertCircle,
  LogIn,
  MapPin,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { EditListingModal } from '../components/EditListingModal';

export const MyListingsScreen: React.FC = () => {
  const {
    user,
    listings,
    openAuthModal,
    setCurrentScreen,
    toggleListingStatus,
    markListingAsLentOrDonated,
    deleteListing,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [editingListing, setEditingListing] = useState<CommunityListing | null>(null);
  const [listingToDelete, setListingToDelete] = useState<CommunityListing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // If user is not logged in, prompt sign in
  if (!user) {
    return (
      <div className="py-12 px-4 text-center space-y-4 max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-[#EAF7F0] text-[#2E9E6B] flex items-center justify-center mx-auto shadow-sm">
          <Package className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Manage Your Listings</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
          Sign in to view, edit, pause, or mark your community items as lent or donated.
        </p>
        <button
          onClick={() => openAuthModal('signin')}
          className="py-2.5 px-6 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs inline-flex items-center gap-2 shadow-sm transition-colors"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In to Continue</span>
        </button>
      </div>
    );
  }

  // Filter listings owned by this user
  const myListings = listings.filter((l) => l.ownerId === user.id);

  const filtered = myListings.filter((l) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return l.status === 'active' || !l.status;
    if (activeTab === 'paused') return l.status === 'paused';
    if (activeTab === 'completed') return l.status === 'lent' || l.status === 'donated' || l.status === 'completed';
    return true;
  });

  const handleDeleteConfirm = async () => {
    if (!listingToDelete) return;
    setIsDeleting(true);
    try {
      const ok = await deleteListing(listingToDelete.id);
      if (ok) {
        setListingToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentScreen('community')}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
            title="Back to Community Circle"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#1C241F]">My Listings</h2>
            <p className="text-xs text-slate-500">Manage items you are lending or donating</p>
          </div>
        </div>

        <button
          onClick={() => setCurrentScreen('analyze')}
          className="py-1.5 px-3 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add New</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 text-xs">
        {[
          { id: 'all', label: `All (${myListings.length})` },
          { id: 'active', label: `Active (${myListings.filter((l) => l.status === 'active' || !l.status).length})` },
          { id: 'paused', label: `Paused (${myListings.filter((l) => l.status === 'paused').length})` },
          { id: 'completed', label: `Completed (${myListings.filter((l) => l.status === 'lent' || l.status === 'donated' || l.status === 'completed').length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Listings List */}
      {filtered.length === 0 ? (
        <div className="py-12 px-4 text-center space-y-3 bg-white rounded-3xl border border-dashed border-slate-300 p-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800">
            {myListings.length === 0 ? 'You have no listings yet' : 'No listings in this view'}
          </h4>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {myListings.length === 0
              ? 'Photograph any household item or gear to analyze its condition and share it with your local circle!'
              : 'Try selecting another tab above to see your other items.'}
          </p>
          {myListings.length === 0 && (
            <button
              onClick={() => setCurrentScreen('analyze')}
              className="mt-2 py-2 px-4 rounded-xl bg-[#2E9E6B] text-white text-xs font-semibold hover:bg-[#237E55] transition-colors inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Photograph an Item</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((listing) => {
            const isBorrow = listing.type === 'borrow';
            const isPaused = listing.status === 'paused';
            const isCompleted = listing.status === 'lent' || listing.status === 'donated' || listing.status === 'completed';

            return (
              <div
                key={listing.id}
                className={`bg-white rounded-2xl border p-4 shadow-2xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 ${
                  isPaused ? 'border-amber-200 bg-amber-50/20' : isCompleted ? 'border-slate-200 bg-slate-50/50' : 'border-[#E8E6DF]'
                }`}
              >
                {/* Item Thumbnail & Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                    <img
                      src={listing.imageUrl || getCategoryFallbackImage(listing.category)}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute bottom-0 inset-x-0 text-center text-[8px] font-bold uppercase py-0.5 text-white ${
                        isBorrow ? 'bg-sky-600' : 'bg-amber-500'
                      }`}
                    >
                      {isBorrow ? 'Borrow' : 'Donate'}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                        {listing.title}
                      </h4>
                      {/* Status badge */}
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md ${
                          isPaused
                            ? 'bg-amber-100 text-amber-800'
                            : isCompleted
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {listing.status || 'Active'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 truncate">
                      {listing.category} · Condition: <span className="capitalize">{listing.condition}</span>
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {listing.location}
                      </span>
                      {listing.availableDuration && (
                        <span>· {listing.availableDuration}</span>
                      )}
                      <span>· {listing.createdAt}</span>
                    </div>
                  </div>
                </div>

                {/* Owner Actions Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  {/* Edit */}
                  <button
                    onClick={() => setEditingListing(listing)}
                    title="Edit listing details"
                    className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 text-xs flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Edit</span>
                  </button>

                  {/* Pause / Resume */}
                  <button
                    onClick={() => toggleListingStatus(listing.id, listing.status)}
                    title={isPaused ? 'Resume listing' : 'Pause listing (hide from community)'}
                    className={`p-2 rounded-xl text-xs font-medium border flex items-center gap-1 transition-colors ${
                      isPaused
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span className="text-[11px]">{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>

                  {/* Mark as Lent / Donated */}
                  {!isCompleted && (
                    <button
                      onClick={() => markListingAsLentOrDonated(listing.id, isBorrow ? 'lent' : 'donated')}
                      title={isBorrow ? 'Mark as Lent out' : 'Mark as Donated'}
                      className="p-2 rounded-xl bg-[#EAF7F0] text-[#2E9E6B] hover:bg-[#2E9E6B] hover:text-white border border-[#2E9E6B]/30 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{isBorrow ? 'Lent' : 'Donated'}</span>
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => setListingToDelete(listing)}
                    title="Delete listing permanently"
                    className="p-2 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/60 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Listing Modal */}
      <EditListingModal
        isOpen={Boolean(editingListing)}
        onClose={() => setEditingListing(null)}
        listing={editingListing}
      />

      {/* Delete Confirmation Modal */}
      {listingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 relative">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">
              Delete this listing?
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1 mb-5">
              Are you sure you want to delete <strong className="text-slate-800">"{listingToDelete.title}"</strong>?
              This action cannot be undone.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setListingToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
