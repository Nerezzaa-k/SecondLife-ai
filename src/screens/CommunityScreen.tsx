import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CommunityListing } from '../types';
import { getCategoryFallbackImage } from '../data/seedData';
import {
  Search,
  PlusCircle,
  ShieldCheck,
  Star,
  MapPin,
  Tag,
  Share2,
  Gift,
  CheckCircle2,
  SlidersHorizontal,
  RefreshCw,
  AlertCircle,
  Package,
  Layers,
  User,
  Flag,
  Video,
} from 'lucide-react';
import { RequestListingModal } from '../components/RequestListingModal';
import { PostRequestModal } from '../components/PostRequestModal';
import { MyListingsScreen } from './MyListingsScreen';
import { TrustScoreBadge } from '../components/TrustScoreBadge';
import { ReportListingModal } from '../components/ReportListingModal';
import { computeTrustScore } from '../utils/trustScore';
import { buildCloudinarySrcSet, buildLqipUrl } from '../config/cloudinary';

export const CommunityScreen: React.FC = () => {
  const {
    user,
    listings,
    isListingsLoading,
    listingsError,
    refreshListings,
    searchQuery,
    setSearchQuery,
    currentScreen,
    setCurrentScreen,
    openPublicProfile,
  } = useApp();

  const [mainView, setMainView] = useState<'feed' | 'my-listings'>(
    currentScreen === 'my-listings' ? 'my-listings' : 'feed'
  );

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'borrow' | 'donate'>('all');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [maxDistance, setMaxDistance] = useState<number>(5.0);

  const [activeListingForRequest, setActiveListingForRequest] = useState<CommunityListing | null>(null);
  const [isPostRequestOpen, setIsPostRequestOpen] = useState<boolean>(false);
  const [listingToReport, setListingToReport] = useState<CommunityListing | null>(null);

  const categories = [
    'all',
    'Photography & Gear',
    'Home Appliances',
    'Kitchen Appliances',
    'Furniture & Decor',
    'Electronics & Media',
    'Tools & DIY',
    'Sports & Outdoors',
    'Books & Hobby',
  ];

  const userOwnedCount = useMemo(() => {
    return user ? listings.filter((l) => l.ownerId === user.id).length : 0;
  }, [listings, user]);

  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      // Exclude sample rows
      if (item.is_sample) {
        return false;
      }
      // Hide paused listings from public explore feed unless user is owner
      if (item.status === 'paused' && (!user || item.ownerId !== user.id)) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      // Type filter (borrow/donate)
      if (selectedType !== 'all' && item.type !== selectedType) {
        return false;
      }
      // Verified only
      if (verifiedOnly && !item.ownerVerified) {
        return false;
      }
      // Max distance
      if (item.distanceKm > maxDistance) {
        return false;
      }
      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesTags = item.tags.some((t) => t.toLowerCase().includes(q));
        const matchesOwner = item.ownerName.toLowerCase().includes(q);
        const matchesLoc = item.location.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesTags && !matchesOwner && !matchesLoc) return false;
      }

      return true;
    });
  }, [listings, selectedCategory, selectedType, verifiedOnly, maxDistance, searchQuery, user]);

  // If user requested My Listings tab or screen
  if (mainView === 'my-listings') {
    return <MyListingsScreen />;
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Top Header & Feed vs My Listings Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1C241F] tracking-tight">
            Neighborhood Circle
          </h2>
          <p className="text-xs text-slate-500">
            {filteredListings.length} {filteredListings.length === 1 ? 'item' : 'items'} available locally
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* My Listings Switcher */}
          <button
            onClick={() => setMainView('my-listings')}
            className="py-1.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Package className="w-3.5 h-3.5 text-[#2E9E6B]" />
            <span>My Listings</span>
            {userOwnedCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#2E9E6B] text-white text-[10px] font-bold flex items-center justify-center">
                {userOwnedCount}
              </span>
            )}
          </button>

          {/* Post an item */}
          <button
            onClick={() => setIsPostRequestOpen(true)}
            className="py-1.5 px-3 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Post Request</span>
          </button>
        </div>
      </div>

      {/* Error state banner with retry */}
      {listingsError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{listingsError}</span>
          </div>
          <button
            onClick={refreshListings}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] flex items-center gap-1 shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search items, tools, books, appliances, neighbors..."
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[#E8E6DF] text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Segmented Type Filter */}
          <div className="flex items-center bg-slate-200/60 p-0.5 rounded-xl text-xs font-medium">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                selectedType === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setSelectedType('borrow')}
              className={`px-3 py-1 rounded-lg transition-all ${
                selectedType === 'borrow'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Borrow
            </button>
            <button
              onClick={() => setSelectedType('donate')}
              className={`px-3 py-1 rounded-lg transition-all ${
                selectedType === 'donate'
                  ? 'bg-white text-amber-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Donate
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Verified Only Toggle */}
            <button
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all ${
                verifiedOnly
                  ? 'bg-[#EAF7F0] text-[#2E9E6B] border-[#2E9E6B]/40'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified only</span>
            </button>

            {/* Refresh button */}
            <button
              onClick={refreshListings}
              title="Refresh listings"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#2E9E6B] hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isListingsLoading ? 'animate-spin text-[#2E9E6B]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Categories scrollable pill list */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg whitespace-nowrap text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isListingsLoading && listings.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 animate-pulse">
              <div className="aspect-4/3 bg-slate-200 rounded-xl" />
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
              <div className="h-6 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : filteredListings.length === 0 ? (
        /* Empty State */
        listings.filter((i) => !i.is_sample).length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-white rounded-3xl border border-dashed border-slate-300 p-6">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF7F0] text-[#2E9E6B] flex items-center justify-center mx-auto shadow-2xs">
              <Package className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-900">
              No items nearby yet. Be the first to list something.
            </p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Share gear, tools, books, or appliances with your neighbors to keep them circulating.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setCurrentScreen('analyze')}
                className="py-2 px-4 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>List an item</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center space-y-3 bg-white rounded-3xl border border-dashed border-slate-300 p-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              No items matched your current filters
            </p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Try resetting your search query or choosing another category.
            </p>
            <div className="pt-1">
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedType('all');
                  setVerifiedOnly(false);
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-[#2E9E6B] hover:underline"
              >
                Reset all filters
              </button>
            </div>
          </div>
        )
      ) : (
        /* Grid of listings */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredListings.map((listing) => {
            const isBorrow = listing.type === 'borrow';
            const isOwner = Boolean(user && listing.ownerId === user.id);

            return (
              <div
                key={listing.id}
                className={`bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                  isOwner ? 'border-[#2E9E6B]/50 ring-1 ring-[#2E9E6B]/20' : 'border-[#E8E6DF] hover:border-[#2E9E6B]/40'
                }`}
              >
                <div>
                  {/* Item Image with Fallback & Cloudinary Responsive Delivery */}
                  <div
                    className="relative aspect-4/3 bg-slate-100 overflow-hidden group bg-cover bg-center"
                    style={{
                      backgroundImage: listing.cloudinaryPublicId
                        ? `url(${buildLqipUrl(listing.cloudinaryPublicId)})`
                        : undefined,
                    }}
                  >
                    <img
                      src={listing.imageUrl || getCategoryFallbackImage(listing.category)}
                      srcSet={
                        listing.cloudinaryPublicId
                          ? buildCloudinarySrcSet(listing.cloudinaryPublicId, [320, 640, 960])
                          : undefined
                      }
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      alt={listing.title}
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getCategoryFallbackImage(listing.category);
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Condition Video Indicator Badge */}
                    {listing.video_public_id && (
                      <div className="absolute top-2.5 right-14 z-10 pointer-events-none">
                        <span className="bg-black/75 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md border border-white/20">
                          <Video className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Video</span>
                        </span>
                      </div>
                    )}

                    {/* Type Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs ${
                          isBorrow ? 'bg-sky-600 text-white' : 'bg-amber-500 text-white'
                        }`}
                      >
                        {isBorrow ? 'Borrow' : 'Donate'}
                      </span>

                      {isOwner && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#2E9E6B] text-white shadow-xs">
                          Your Listing
                        </span>
                      )}

                      {isOwner && listing.moderation_status && listing.moderation_status !== 'approved' && (
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500 text-white shadow-xs"
                          title="Visible only to you: unmoderated status"
                        >
                          {listing.moderation_status === 'pending' ? 'Pending' : 'Unmoderated'}
                        </span>
                      )}

                      {listing.status && listing.status !== 'active' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-800 text-white capitalize">
                          {listing.status}
                        </span>
                      )}
                    </div>

                    {/* Computed Trust Score with Tooltip breakdown */}
                    <div className="absolute top-2.5 right-2.5">
                      <TrustScoreBadge
                        breakdown={
                          listing.trustBreakdown ||
                          computeTrustScore({
                            fullName: listing.ownerName,
                            neighborhood: listing.ownerNeighborhood || listing.location,
                            avatarUrl: listing.ownerAvatar,
                            completedExchangesCount: 0,
                            averageRating: listing.ownerRating || 5.0,
                            reviewsCount: listing.ownerReviewsCount || 0,
                            hasCutoutPhoto: Boolean(listing.imageUrl),
                            emailConfirmed: true,
                          })
                        }
                        size="sm"
                      />
                    </div>

                    {/* Distance & Condition pill at bottom of image */}
                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                      <span className="bg-white/90 backdrop-blur-xs text-slate-800 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                        <MapPin className="w-2.5 h-2.5 text-slate-500" />
                        <span>{listing.distanceKm} km away</span>
                      </span>
                      <span className="bg-white/90 backdrop-blur-xs text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-md capitalize shadow-xs">
                        {listing.condition}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 space-y-2">
                    {/* Item title */}
                    <h3 className="font-bold text-sm text-slate-900 line-clamp-1">
                      {listing.title}
                    </h3>

                    {/* Owner Card Info (Avatar, Name, Neighborhood, Rating) + Public Profile + Report */}
                    <div className="flex items-center justify-between gap-2 py-1.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => listing.ownerId && openPublicProfile(listing.ownerId)}
                        className="flex items-center gap-2 min-w-0 text-left hover:opacity-80 transition-opacity group/owner flex-1"
                        title="View neighbor profile"
                      >
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-[#EAF7F0] border border-[#2E9E6B]/40 flex items-center justify-center text-[11px] font-bold text-[#2E9E6B] shrink-0">
                          {listing.ownerAvatar ? (
                            <img
                              src={listing.ownerAvatar}
                              alt={listing.ownerName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            listing.ownerName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 text-xs font-semibold text-slate-800 truncate">
                            <span className="truncate group-hover/owner:text-[#2E9E6B] transition-colors">
                              {listing.ownerName}
                            </span>
                            {listing.ownerVerified && (
                              <span title="Verified Neighbor" className="inline-flex">
                                <ShieldCheck className="w-3.5 h-3.5 text-[#2E9E6B] shrink-0" />
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                            <span className="truncate flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              {listing.ownerNeighborhood || listing.location}
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-0.5 text-amber-600 font-semibold shrink-0">
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                              {listing.ownerRating ? Number(listing.ownerRating).toFixed(1) : '5.0'}
                              <span className="text-slate-400 font-normal">
                                ({listing.ownerReviewsCount ?? 0})
                              </span>
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Report Listing Button */}
                      {!isOwner && (
                        <button
                          type="button"
                          onClick={() => setListingToReport(listing)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                          title="Report listing"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Description preview */}
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {listing.description}
                    </p>

                    {/* Interactive Tag Chips */}
                    {listing.tags && listing.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {listing.tags.slice(0, 4).map((tag, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery(tag);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-[#EAF7F0] text-slate-600 hover:text-[#2E9E6B] font-medium transition-colors cursor-pointer"
                            title={`Filter by #${tag}`}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Bytes Saved Metric (if recorded) */}
                    {listing.original_bytes && (
                      <div className="text-[10px] font-medium text-emerald-800 bg-[#EAF7F0] px-2 py-1 rounded-lg flex items-center justify-between">
                        <span>Optimized delivery:</span>
                        <span className="font-bold">
                          {listing.optimized_bytes
                            ? `Saved ${Math.round(((listing.original_bytes - listing.optimized_bytes) / listing.original_bytes) * 100)}% bytes`
                            : 'f_auto,q_auto optimized'}
                        </span>
                      </div>
                    )}

                    {listing.availableDuration && (
                      <div className="text-[11px] font-medium text-sky-700 bg-sky-50 px-2 py-1 rounded-lg">
                        ⏱ Available: {listing.availableDuration}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Button */}
                <div className="p-3.5 pt-0">
                  {isOwner ? (
                    <button
                      onClick={() => setMainView('my-listings')}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Package className="w-3.5 h-3.5 text-[#2E9E6B]" />
                      <span>Manage Your Listing</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveListingForRequest(listing)}
                      className={`w-full py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors ${
                        isBorrow
                          ? 'bg-sky-600 hover:bg-sky-700 text-white'
                          : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                    >
                      {isBorrow ? (
                        <>
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Request to Borrow</span>
                        </>
                      ) : (
                        <>
                          <Gift className="w-3.5 h-3.5" />
                          <span>Claim Donation</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
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

      <ReportListingModal
        listing={listingToReport}
        onClose={() => setListingToReport(null)}
      />
    </div>
  );
};
