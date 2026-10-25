import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Star,
  ShieldCheck,
  PlusCircle,
} from 'lucide-react';
import { CommunityListing } from '../types';
import { getCategoryFallbackImage } from '../data/seedData';
import { RequestListingModal } from '../components/RequestListingModal';
import { PostRequestModal } from '../components/PostRequestModal';

export const MatchResultsScreen: React.FC = () => {
  const { matchQuery, matchResults, setCurrentScreen, performMatch } = useApp();
  const [newSearch, setNewSearch] = useState(matchQuery);
  const [activeListingForRequest, setActiveListingForRequest] = useState<CommunityListing | null>(null);
  const [isPostRequestOpen, setIsPostRequestOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSearch.trim()) return;
    performMatch(newSearch);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Back to Home / Search bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentScreen('home')}
          className="p-2 rounded-xl bg-white border border-[#E8E6DF] text-slate-700 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={newSearch}
            onChange={(e) => setNewSearch(e.target.value)}
            placeholder="Search items to borrow or claim..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#E8E6DF] text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
          />
        </form>
      </div>

      {/* Query Banner */}
      <div className="p-3.5 rounded-2xl bg-[#EAF7F0] border border-[#2E9E6B]/30 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-[#2E9E6B] font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Circular Match Results</span>
          </div>
          <p className="text-xs text-slate-800 mt-0.5">
            Looking for: <strong className="text-slate-950 font-bold">"{matchQuery || 'All items'}"</strong>
          </p>
        </div>

        <span className="text-xs font-semibold text-emerald-800 bg-white px-2.5 py-1 rounded-xl shadow-xs">
          {matchResults.length} found
        </span>
      </div>

      {/* Match Results List */}
      {matchResults.length === 0 ? (
        <div className="py-12 px-6 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              No direct matches found nearby
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              Don't buy it yet! Post a request to your neighborhood circle and someone might lend it within an hour.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-xs mx-auto">
            <button
              onClick={() => setIsPostRequestOpen(true)}
              className="py-2.5 px-4 rounded-xl bg-[#2E9E6B] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-[#2E9E6B]/20"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Post Request to Neighbors</span>
            </button>

            <button
              onClick={() => setCurrentScreen('community')}
              className="py-2.5 px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
            >
              Browse All Listings
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {matchResults.map(({ listing, matchScore, reason }) => {
            const isBorrow = listing.type === 'borrow';

            return (
              <div
                key={listing.id}
                className="bg-white rounded-2xl border border-[#E8E6DF] p-3.5 shadow-xs hover:border-[#2E9E6B] transition-all space-y-2.5"
              >
                <div className="flex gap-3">
                  <img
                    src={listing.imageUrl || getCategoryFallbackImage(listing.category)}
                    alt={listing.title}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getCategoryFallbackImage(listing.category);
                    }}
                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isBorrow ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {isBorrow ? 'Borrow' : 'Donate'}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {matchScore}% Match
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 mt-1 truncate">
                      {listing.title}
                    </h4>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                      <span>{listing.ownerName}</span>
                      {listing.ownerVerified && (
                        <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                      )}
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {listing.distanceKm} km
                      </span>
                    </div>
                  </div>
                </div>

                {/* "Why this matches" Line */}
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2E9E6B] shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold text-slate-900">Why this matches: </strong>
                    <span>{reason}</span>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => setActiveListingForRequest(listing)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-[#2E9E6B] text-white text-xs font-semibold transition-colors"
                >
                  {isBorrow ? 'Request to Borrow' : 'Claim Item'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <RequestListingModal
        listing={activeListingForRequest}
        onClose={() => setActiveListingForRequest(null)}
      />

      <PostRequestModal
        isOpen={isPostRequestOpen}
        onClose={() => setIsPostRequestOpen(false)}
      />
    </div>
  );
};
