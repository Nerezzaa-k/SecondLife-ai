import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import {
  Badge,
  BookingConfirmation,
  CloudinaryAsset,
  CommunityListing,
  ItemAnalysis,
  Technician,
  UserStats,
  ConditionType,
  ExchangeRequest,
  RequestStatus,
  UserAction,
  CommunityLeaderboardEntry,
  CommunityImpactTotals,
} from '../types';
import {
  INITIAL_BADGES,
  SEEDED_LISTINGS,
  SEEDED_TECHNICIANS,
  getCategoryFallbackImage,
} from '../data/seedData';
import {
  uploadImageToCloudinary,
  buildCleanedCutoutUrl,
  buildThumbnailUrl,
  buildDamageCloseupUrl,
  buildShareableImpactCardUrl,
  buildCloudinaryVideoUrl,
  buildVideoPosterUrl,
} from '../config/cloudinary';
import {
  supabase,
  isSupabaseConfigured,
  UserProfile,
} from '../config/supabase';
import { computeTrustScore } from '../utils/trustScore';
import { BADGE_DEFINITIONS } from '../config/badges';
import { getCategoryImpactEstimate } from '../config/impactEstimates';

export type ScreenType = 'home' | 'analyze' | 'community' | 'match' | 'impact' | 'my-listings' | 'inbox';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'warning';
}

interface MatchResultItem {
  listing: CommunityListing;
  matchScore: number;
  reason: string;
}

interface AppContextType {
  // Navigation & User
  currentScreen: ScreenType;
  setCurrentScreen: (screen: ScreenType) => void;
  userName: string;
  setUserName: (name: string) => void;
  isFirstVisit: boolean;
  completeOnboarding: (name: string) => void;

  // Supabase Auth & Profile
  user: User | null;
  userProfile: UserProfile | null;
  isAuthConfigured: boolean;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  authMode: 'signin' | 'signup';
  setAuthMode: (m: 'signin' | 'signup') => void;
  openAuthModal: (mode?: 'signin' | 'signup') => void;
  openProfileModal: () => void;
  updateUserProfile: (profile: UserProfile) => void;
  signOut: () => Promise<void>;

  // Analysis state
  currentAsset: CloudinaryAsset | null;
  setCurrentAsset: (asset: CloudinaryAsset | null) => void;
  currentAnalysis: ItemAnalysis | null;
  setCurrentAnalysis: (analysis: ItemAnalysis | null) => void;
  userDescription: string;
  setUserDescription: (desc: string) => void;
  isUploading: boolean;
  uploadProgress: number;
  isAnalyzing: boolean;
  analysisError: string | null;

  // Actions
  analyzePhoto: (fileOrUrl: File | string, description?: string) => Promise<void>;
  retryAnalysis: (customDescription?: string) => Promise<void>;
  updateAnalysisField: <K extends keyof ItemAnalysis>(field: K, value: ItemAnalysis[K]) => void;

  // User Stats, Actions & Badges (Phase 4 Real Impact)
  userStats: UserStats;
  userActions: UserAction[];
  isActionsLoading: boolean;
  communityLeaderboard: CommunityLeaderboardEntry[];
  communityTotals: CommunityImpactTotals | null;
  refreshStats: () => Promise<void>;
  badges: Badge[];
  unlockBadge: (badgeId: string) => void;
  markItemRepaired: (item: ItemAnalysis, afterPhoto?: { publicId?: string; url?: string }) => Promise<void>;
  markItemDonated: (item: ItemAnalysis) => void;
  listItemForSharing: (item: ItemAnalysis, type: 'borrow' | 'donate') => void;

  // Technicians & Bookings
  technicians: Technician[];
  bookings: BookingConfirmation[];
  createBooking: (technician: Technician, itemName: string, date: string, time: string, notes?: string) => void;

  // Community Listings & Requests
  listings: CommunityListing[];
  isListingsLoading: boolean;
  listingsError: string | null;
  refreshListings: () => Promise<void>;
  addListing: (listing: CommunityListing) => void;
  createRealListing: (formData: {
    title: string;
    category: string;
    condition: ConditionType;
    type: 'borrow' | 'donate';
    description: string;
    borrowDuration?: string;
    locationLabel: string;
    cloudinaryPublicId?: string;
    tags: string[];
    cutoutUrl?: string;
    phash?: string;
    videoPublicId?: string;
  }) => Promise<CommunityListing | null>;
  updateListing: (
    listingId: string,
    updates: {
      title?: string;
      category?: string;
      condition?: ConditionType;
      type?: 'borrow' | 'donate';
      description?: string;
      borrowDuration?: string;
      locationLabel?: string;
      status?: 'active' | 'paused' | 'lent' | 'donated' | 'claimed' | 'completed' | 'archived';
    }
  ) => Promise<boolean>;
  toggleListingStatus: (listingId: string, currentStatus?: string) => Promise<boolean>;
  markListingAsLentOrDonated: (listingId: string, type: 'lent' | 'donated') => Promise<boolean>;
  deleteListing: (listingId: string) => Promise<boolean>;
  submitListingRequest: (listingId: string, message: string) => Promise<boolean>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showSampleListings: boolean;
  setShowSampleListings: (show: boolean) => void;

  // Phase 3B: Exchange Requests & Inbox
  incomingRequests: ExchangeRequest[];
  outgoingRequests: ExchangeRequest[];
  isRequestsLoading: boolean;
  pendingIncomingCount: number;
  refreshRequests: () => Promise<void>;
  acceptRequest: (requestId: string, note?: string) => Promise<boolean>;
  declineRequest: (requestId: string, note?: string) => Promise<boolean>;
  markHandedOver: (requestId: string) => Promise<boolean>;
  completeExchange: (requestId: string) => Promise<boolean>;
  cancelRequest: (requestId: string) => Promise<boolean>;

  // Phase 3C: Reviews, Trust & Reports
  submitReview: (reviewData: {
    requestId?: string;
    revieweeId: string;
    rating: number;
    comment?: string;
  }) => Promise<boolean>;
  submitReport: (reportData: {
    listingId: string;
    reason: string;
    details?: string;
  }) => Promise<boolean>;
  publicProfileUserId: string | null;
  openPublicProfile: (userId: string) => void;
  closePublicProfile: () => void;
  reviewedRequestIds: string[];

  // Match screen
  matchQuery: string;
  setMatchQuery: (q: string) => void;
  matchResults: MatchResultItem[];
  performMatch: (query: string, photoFile?: File | Blob | string[]) => void | Promise<void>;

  // Toast
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  dismissToast: (id: string) => void;

  // Cloudinary Drawer & Settings
  isCloudinaryDrawerOpen: boolean;
  setIsCloudinaryDrawerOpen: (open: boolean) => void;
  isCloudinarySettingsOpen: boolean;
  setIsCloudinarySettingsOpen: (open: boolean) => void;

  // Legal & Safety (Phase 6B)
  isLegalModalOpen: boolean;
  legalModalTab: 'privacy' | 'terms';
  openLegalModal: (tab?: 'privacy' | 'terms') => void;
  closeLegalModal: () => void;
  deleteAccount: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'secondlife_user_name';
const STATS_STORAGE_KEY = 'secondlife_user_stats';
const LISTINGS_STORAGE_KEY = 'secondlife_community_listings';
const BOOKINGS_STORAGE_KEY = 'secondlife_user_bookings';
const SHOW_SAMPLES_STORAGE_KEY = 'secondlife_show_sample_listings';

const DEFAULT_STATS: UserStats = {
  itemsReused: 0,
  repairsDone: 0,
  donationsDone: 0,
  borrowedCount: 0,
  kgWasteSaved: 0,
  co2Saved: 0,
  moneySavedInr: 0,
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [userName, setUserNameState] = useState<string>('');
  const [isFirstVisit, setIsFirstVisit] = useState<boolean>(false);

  // Supabase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const isAuthConfigured = isSupabaseConfigured();

  // Analysis State
  const [currentAsset, setCurrentAsset] = useState<CloudinaryAsset | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<ItemAnalysis | null>(null);
  const [userDescription, setUserDescription] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastAnalyzedFileOrUrl, setLastAnalyzedFileOrUrl] = useState<File | string | null>(null);

  // User Stats & Badges (Phase 4 Real Impact)
  const [userStats, setUserStats] = useState<UserStats>(DEFAULT_STATS);
  const [userActions, setUserActions] = useState<UserAction[]>([]);
  const [isActionsLoading, setIsActionsLoading] = useState<boolean>(false);
  const [communityLeaderboard, setCommunityLeaderboard] = useState<CommunityLeaderboardEntry[]>([]);
  const [communityTotals, setCommunityTotals] = useState<CommunityImpactTotals | null>(null);
  const [badges, setBadges] = useState<Badge[]>(INITIAL_BADGES);
  const [bookings, setBookings] = useState<BookingConfirmation[]>([]);

  // Community State
  const [listings, setListings] = useState<CommunityListing[]>([]);
  const [isListingsLoading, setIsListingsLoading] = useState<boolean>(false);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSampleListings, setShowSampleListingsState] = useState<boolean>(false);

  // Phase 3B: Requests & Inbox State
  const [incomingRequests, setIncomingRequests] = useState<ExchangeRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ExchangeRequest[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState<boolean>(false);

  const pendingIncomingCount = incomingRequests.filter((r) => r.status === 'pending').length;

  // Phase 3C: Reviews, Trust & Reports State
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null);
  const [reviewedRequestIds, setReviewedRequestIds] = useState<string[]>([]);

  const openPublicProfile = (userId: string) => setPublicProfileUserId(userId);
  const closePublicProfile = () => setPublicProfileUserId(null);

  // Match State
  const [matchQuery, setMatchQuery] = useState<string>('');
  const [matchResults, setMatchResults] = useState<MatchResultItem[]>([]);

  // UI Drawers & Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isCloudinaryDrawerOpen, setIsCloudinaryDrawerOpen] = useState<boolean>(false);
  const [isCloudinarySettingsOpen, setIsCloudinarySettingsOpen] = useState<boolean>(false);

  // Phase 6B: Legal & Safety Modal
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<'privacy' | 'terms'>('privacy');

  const openLegalModal = (tab: 'privacy' | 'terms' = 'privacy') => {
    setLegalModalTab(tab);
    setIsLegalModalOpen(true);
  };
  const closeLegalModal = () => setIsLegalModalOpen(false);

  // Load User Profile from Supabase
  const loadUserProfile = async (userId: string, authUser?: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setUserProfile(data);
        if (data.full_name) {
          setUserNameState(data.full_name);
          localStorage.setItem(USER_STORAGE_KEY, data.full_name);
        }
      } else if (authUser) {
        const meta = authUser.user_metadata || {};
        const fallbackName = meta.full_name || meta.name || authUser.email?.split('@')[0] || 'Eco Member';
        const initialProfile: UserProfile = {
          id: userId,
          full_name: fallbackName,
          neighborhood: meta.neighborhood || '',
          city: meta.city || '',
          avatar_url: meta.avatar_url || meta.picture || '',
        };
        await supabase.from('profiles').upsert(initialProfile);
        setUserProfile(initialProfile);
        setUserNameState(fallbackName);
        localStorage.setItem(USER_STORAGE_KEY, fallbackName);
      }
    } catch (err) {
      console.warn('Could not load profile from Supabase:', err);
    }
  };

  // Phase 4: Load User Actions & Stats purely from Supabase actions table
  const loadUserActionsAndStats = async (userId: string) => {
    setIsActionsLoading(true);
    try {
      const { data: actionsData, error } = await supabase
        .from('actions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching actions from Supabase:', error);
      }

      if (!actionsData || actionsData.length === 0) {
        const emptyStats: UserStats = {
          itemsReused: 0,
          repairsDone: 0,
          donationsDone: 0,
          borrowedCount: 0,
          kgWasteSaved: 0,
          co2Saved: 0,
          moneySavedInr: 0,
        };
        setUserStats(emptyStats);
        setUserActions([]);
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(emptyStats));

        // Evaluate all badges against zero baseline
        setBadges((prevBadges) =>
          prevBadges.map((badge) => {
            const def = BADGE_DEFINITIONS.find((b) => b.id === badge.id);
            if (!def) return badge;
            const prog = def.calculateProgress(emptyStats, { averageRating: 0, totalReviews: 0 });
            return { ...badge, unlocked: prog.unlocked };
          })
        );
        return;
      }

      const actions: UserAction[] = actionsData.map((act: any) => ({
        id: act.id,
        userId: act.user_id,
        type: act.type,
        wasteKg: Number(act.waste_kg || 0),
        co2Kg: Number(act.co2_kg || 0),
        moneySavedInr: Number(act.money_saved_inr || 0),
        estimateSource: act.estimate_source || 'gemini',
        itemName: act.item_name || 'Circular Item',
        category: act.category,
        beforeImageUrl: act.before_image_url,
        afterImageUrl: act.after_image_url,
        after_public_id: act.after_public_id,
        afterPublicId: act.after_public_id,
        listingId: act.listing_id,
        createdAt: act.created_at,
      }));

      setUserActions(actions);

      let repairsDone = 0;
      let donationsDone = 0;
      let borrowedCount = 0;
      let kgWasteSaved = 0;
      let co2Saved = 0;
      let moneySavedInr = 0;

      for (const act of actions) {
        if (act.type === 'repaired') repairsDone += 1;
        if (act.type === 'donated') donationsDone += 1;
        if (act.type === 'borrowed' || act.type === 'lent') borrowedCount += 1;
        kgWasteSaved += act.wasteKg;
        co2Saved += act.co2Kg;
        moneySavedInr += act.moneySavedInr;
      }

      const calculatedStats: UserStats = {
        itemsReused: actions.length,
        repairsDone,
        donationsDone,
        borrowedCount,
        kgWasteSaved: parseFloat(kgWasteSaved.toFixed(1)),
        co2Saved: parseFloat(co2Saved.toFixed(1)),
        moneySavedInr: Math.round(moneySavedInr),
      };

      setUserStats(calculatedStats);
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(calculatedStats));

      // Fetch rating statistics to evaluate Five-Star Neighbor badge
      let reviewStats = { averageRating: 5.0, totalReviews: 0 };
      try {
        const { data: ratingData } = await supabase
          .from('profile_rating_stats')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (ratingData) {
          reviewStats = {
            averageRating: Number(ratingData.average_rating || 5.0),
            totalReviews: Number(ratingData.total_reviews || 0),
          };
        }
      } catch (err) {
        // Safe fallback
      }

      // Update badge states with real threshold evaluation
      setBadges((prevBadges) =>
        prevBadges.map((badge) => {
          const def = BADGE_DEFINITIONS.find((b) => b.id === badge.id);
          if (!def) return badge;
          const prog = def.calculateProgress(calculatedStats, reviewStats);
          return {
            ...badge,
            unlocked: prog.unlocked,
          };
        })
      );
    } catch (err) {
      console.warn('Could not load user stats from Supabase:', err);
    } finally {
      setIsActionsLoading(false);
    }
  };

  // Phase 4: Load Community Leaderboard and Totals from Postgres views / functions
  const loadCommunityLeaderboardAndTotals = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      // 1. Fetch community totals
      const { data: totalsData, error: totalsErr } = await supabase.rpc('get_community_impact_totals');
      if (!totalsErr && totalsData && totalsData.length > 0) {
        const row = totalsData[0];
        setCommunityTotals({
          totalItemsReused: Number(row.total_items_reused || 0),
          totalWasteKg: Number(row.total_waste_kg || 0),
          totalCo2Kg: Number(row.total_co2_kg || 0),
          activeMembers: Number(row.active_members || 0),
        });
      }

      // 2. Fetch community leaderboard
      const { data: boardData, error: boardErr } = await supabase.rpc('get_community_leaderboard');
      if (!boardErr && boardData) {
        setCommunityLeaderboard(
          boardData.map((row: any) => ({
            userId: row.user_id,
            firstName: row.first_name,
            neighborhood: row.neighborhood,
            avatarUrl: row.avatar_url,
            itemsReused: Number(row.items_reused || 0),
            wasteSavedKg: Number(row.waste_saved_kg || 0),
            co2SavedKg: Number(row.co2_saved_kg || 0),
            isCurrentUser: Boolean(user && user.id === row.user_id),
          }))
        );
      }
    } catch (err) {
      console.warn('Could not load community leaderboard from Supabase:', err);
    }
  };

  // Phase 4: Refresh stats on demand
  const refreshStats = async () => {
    if (user) {
      await loadUserActionsAndStats(user.id);
    }
    await loadCommunityLeaderboardAndTotals();
  };

  // Load Public Listings from Supabase (Newest First)
  const loadPublicListings = async () => {
    if (!isSupabaseConfigured()) {
      setIsListingsLoading(false);
      return;
    }

    setIsListingsLoading(true);
    setListingsError(null);

    try {
      const { data: dbListings, error } = await supabase
        .from('listings')
        .select('*, profiles:owner_id(full_name, avatar_url, neighborhood, city)')
        .or('is_sample.is.null,is_sample.eq.false')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (dbListings) {
        const mappedListings: CommunityListing[] = dbListings
          .filter((item: any) => item.is_sample !== true && item.moderation_status !== 'rejected')
          .map((item: any) => {
            const breakdown = computeTrustScore({
              fullName: item.profiles?.full_name,
              neighborhood: item.profiles?.neighborhood,
              city: item.profiles?.city,
              avatarUrl: item.profiles?.avatar_url,
              emailConfirmed: true,
              completedExchangesCount: 0,
              averageRating: 5.0,
              hasCutoutPhoto: Boolean(item.cutout_url),
            });

            return {
              id: item.id,
              ownerId: item.owner_id,
              title: item.title,
              category: item.category,
              type: item.type as 'borrow' | 'donate',
              condition: (item.condition as ConditionType) || 'good',
              ownerName: item.profiles?.full_name || 'Community Member',
              ownerAvatar: item.profiles?.avatar_url || '',
              ownerNeighborhood: item.profiles?.neighborhood || item.location_label || 'Local neighborhood',
              ownerRating: breakdown.averageRating,
              ownerReviewsCount: breakdown.totalReviews,
              ownerVerified: breakdown.isVerified,
              distanceKm: 0.5,
              trustScore: breakdown.score,
              trustBreakdown: breakdown,
              imageUrl: item.cutout_url || getCategoryFallbackImage(item.category),
              cutoutUrl: item.cutout_url,
              cloudinaryPublicId: item.cloudinary_public_id,
              description: item.description || '',
              tags: item.tags || [],
              location: item.location_label || item.profiles?.neighborhood || 'Local neighborhood',
              availableDuration: item.borrow_duration || (item.type === 'borrow' ? 'Up to 3 days' : undefined),
              status: item.status || 'active',
              createdAt: new Date(item.created_at).toLocaleDateString(),
              is_sample: false,
              moderation_status: item.moderation_status || 'unmoderated',
              original_bytes: item.original_bytes,
              optimized_bytes: item.optimized_bytes,
              phash: item.phash || undefined,
              video_public_id: item.video_public_id || undefined,
              videoUrl: item.video_public_id ? buildCloudinaryVideoUrl(item.video_public_id) : undefined,
              videoPosterUrl: item.video_public_id ? buildVideoPosterUrl(item.video_public_id) : undefined,
            };
          });

        setListings(mappedListings);
      }
    } catch (err: any) {
      console.warn('Error loading public listings from Supabase:', err);
      setListingsError(err.message || 'Failed to load community listings.');
    } finally {
      setIsListingsLoading(false);
    }
  };

  const refreshListings = async () => {
    await loadPublicListings();
  };

  // Phase 3B: Realistic Waste and CO2 estimates helper
  const getEstimatesForListing = (category?: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('electr') || cat.includes('appliance') || cat.includes('gadget')) {
      return { wasteKg: 4.5, co2Kg: 18.0, moneySavedInr: 2500 };
    }
    if (cat.includes('furn') || cat.includes('home')) {
      return { wasteKg: 12.0, co2Kg: 28.0, moneySavedInr: 3500 };
    }
    if (cat.includes('tool') || cat.includes('hardw')) {
      return { wasteKg: 3.5, co2Kg: 12.0, moneySavedInr: 1200 };
    }
    if (cat.includes('book') || cat.includes('media')) {
      return { wasteKg: 0.8, co2Kg: 2.5, moneySavedInr: 400 };
    }
    if (cat.includes('cloth') || cat.includes('wear') || cat.includes('fashion')) {
      return { wasteKg: 1.2, co2Kg: 8.5, moneySavedInr: 800 };
    }
    if (cat.includes('sport') || cat.includes('cycle') || cat.includes('fitness')) {
      return { wasteKg: 3.0, co2Kg: 9.0, moneySavedInr: 1500 };
    }
    if (cat.includes('toy') || cat.includes('kid') || cat.includes('baby')) {
      return { wasteKg: 2.0, co2Kg: 6.0, moneySavedInr: 900 };
    }
    return { wasteKg: 2.5, co2Kg: 7.0, moneySavedInr: 1000 };
  };

  // Phase 3B: Load incoming and outgoing exchange requests
  const loadRequests = async (targetUserId?: string) => {
    const uid = targetUserId || user?.id;
    if (!uid || !isSupabaseConfigured()) {
      return;
    }

    setIsRequestsLoading(true);
    try {
      const { data: dbRequests, error } = await supabase
        .from('requests')
        .select(`
          id,
          listing_id,
          requester_id,
          status,
          message,
          response_note,
          created_at,
          updated_at,
          listings:listing_id (
            id,
            title,
            type,
            category,
            condition,
            cutout_url,
            cloudinary_public_id,
            location_label,
            borrow_duration,
            owner_id,
            profiles:owner_id (
              id,
              full_name,
              avatar_url,
              neighborhood,
              city
            )
          ),
          profiles:requester_id (
            id,
            full_name,
            avatar_url,
            neighborhood,
            city
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error loading requests:', error);
        return;
      }

      if (dbRequests) {
        const incoming: ExchangeRequest[] = [];
        const outgoing: ExchangeRequest[] = [];

        for (const row of dbRequests as any[]) {
          const listing = row.listings;
          const requester = row.profiles;
          const owner = listing?.profiles;

          const reqItem: ExchangeRequest = {
            id: row.id,
            listingId: row.listing_id,
            requesterId: row.requester_id,
            status: row.status as RequestStatus,
            message: row.message || '',
            responseNote: row.response_note || '',
            createdAt: new Date(row.created_at).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            updatedAt: row.updated_at,

            listingTitle: listing?.title || 'Community Item',
            listingImageUrl: listing?.cutout_url || getCategoryFallbackImage(listing?.category),
            listingType: (listing?.type as 'borrow' | 'donate') || 'borrow',
            listingCategory: listing?.category || 'General',
            listingLocation: listing?.location_label || owner?.neighborhood || 'Local Area',
            listingDuration: listing?.borrow_duration,
            listingOwnerId: listing?.owner_id || '',

            requesterName: requester?.full_name || 'Neighbor',
            requesterAvatar: requester?.avatar_url || '',
            requesterNeighborhood: requester?.neighborhood || requester?.city || 'Local area',

            ownerName: owner?.full_name || 'Item Owner',
            ownerAvatar: owner?.avatar_url || '',
            ownerNeighborhood: owner?.neighborhood || owner?.city || 'Local area',
          };

          if (listing?.owner_id === uid) {
            incoming.push(reqItem);
          }
          if (row.requester_id === uid) {
            outgoing.push(reqItem);
          }
        }

        setIncomingRequests(incoming);
        setOutgoingRequests(outgoing);
      }
    } catch (err) {
      console.warn('Failed to load requests from Supabase:', err);
    } finally {
      setIsRequestsLoading(false);
    }
  };

  const refreshRequests = async () => {
    if (user) {
      await loadRequests(user.id);
    }
  };

  // Supabase Auth Listener & State Init
  useEffect(() => {
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser(session.user);
          loadUserProfile(session.user.id, session.user);
          loadUserActionsAndStats(session.user.id);
          loadRequests(session.user.id);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          loadUserProfile(session.user.id, session.user);
          loadUserActionsAndStats(session.user.id);
          loadPublicListings();
          loadRequests(session.user.id);
        } else {
          setUser(null);
          setUserProfile(null);
          setUserStats(DEFAULT_STATS);
          localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(DEFAULT_STATS));
          setIncomingRequests([]);
          setOutgoingRequests([]);
        }
      });

      loadPublicListings();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  // Phase 3B: Realtime & Window Focus Refetch for requests
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return;

    loadRequests(user.id);

    const channel = supabase
      .channel('public:requests_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
        },
        () => {
          loadRequests(user.id);
        }
      )
      .subscribe();

    const handleFocus = () => {
      loadRequests(user.id);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user?.id]);

  // Initialize from LocalStorage (fallbacks and local preferences)
  useEffect(() => {
    try {
      const storedName = localStorage.getItem(USER_STORAGE_KEY);
      if (storedName && storedName.trim()) {
        setUserNameState(storedName);
        setIsFirstVisit(false);
      } else {
        setIsFirstVisit(!user);
      }

      const storedSamplesPref = localStorage.getItem(SHOW_SAMPLES_STORAGE_KEY);
      if (storedSamplesPref !== null) {
        setShowSampleListingsState(storedSamplesPref !== 'false');
      }

      const storedStats = localStorage.getItem(STATS_STORAGE_KEY);
      if (storedStats) {
        const parsed = JSON.parse(storedStats);
        if (parsed.itemsReused === 3 && parsed.kgWasteSaved === 8.4) {
          setUserStats(DEFAULT_STATS);
          localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(DEFAULT_STATS));
        } else {
          setUserStats({
            itemsReused: parsed.itemsReused || 0,
            repairsDone: parsed.repairsDone || 0,
            donationsDone: parsed.donationsDone || 0,
            borrowedCount: parsed.borrowedCount || 0,
            kgWasteSaved: parsed.kgWasteSaved || 0,
            co2Saved: parsed.co2Saved || 0,
            moneySavedInr: parsed.moneySavedInr || 0,
          });
        }
      } else {
        setUserStats(DEFAULT_STATS);
      }

      const storedBookings = localStorage.getItem(BOOKINGS_STORAGE_KEY);
      if (storedBookings) {
        setBookings(JSON.parse(storedBookings));
      }

      const storedListings = localStorage.getItem(LISTINGS_STORAGE_KEY);
      if (storedListings && !isSupabaseConfigured()) {
        const parsed = JSON.parse(storedListings);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const nonSample = parsed.filter((item: CommunityListing) => {
            if (item.is_sample) return false;
            if (item.id && item.id.startsWith('list-') && parseInt(item.id.replace('list-', ''), 10) <= 18) {
              return false;
            }
            return true;
          });
          setListings(nonSample);
        }
      }
    } catch (e) {
      console.error('LocalStorage init error', e);
    }
  }, [user]);

  const setUserName = (name: string) => {
    const trimmed = name.trim();
    setUserNameState(trimmed);
    localStorage.setItem(USER_STORAGE_KEY, trimmed);
    if (userProfile) {
      setUserProfile({ ...userProfile, full_name: trimmed });
    }
  };

  const updateUserProfile = (updated: UserProfile) => {
    setUserProfile(updated);
    if (updated.full_name) {
      setUserName(updated.full_name);
    }
    showToast('Profile updated!', 'success');
  };

  const openAuthModal = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const openProfileModal = () => {
    setIsProfileModalOpen(true);
  };

  const signOut = async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase sign out error:', err);
      }
    }
    setUser(null);
    setUserProfile(null);
    setUserNameState('');
    setUserStats(DEFAULT_STATS);
    setUserActions([]);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(DEFAULT_STATS));
    showToast('Signed out successfully.', 'info');
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      // 1. Call secure server endpoint
      const res = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        // Fallback directly to Supabase RPC
        const { error: rpcErr } = await supabase.rpc('delete_user_account_data');
        if (rpcErr) {
          throw new Error(rpcErr.message || 'Could not complete account deletion');
        }
      }

      // 2. Sign out auth session
      if (isSupabaseConfigured()) {
        try {
          await supabase.auth.signOut();
        } catch {}
      }

      // 3. Reset user state
      setUser(null);
      setUserProfile(null);
      setUserNameState('');
      setUserStats(DEFAULT_STATS);
      setUserActions([]);
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(DEFAULT_STATS));
      showToast('Your account and associated data have been permanently deleted.', 'info');
      await refreshListings();
    } catch (err: any) {
      console.error('Account deletion error:', err);
      showToast(err.message || 'Failed to delete account. Please try again.', 'warning');
      throw err;
    }
  };

  const setShowSampleListings = (show: boolean) => {
    setShowSampleListingsState(show);
    localStorage.setItem(SHOW_SAMPLES_STORAGE_KEY, show.toString());
  };

  const completeOnboarding = (name: string) => {
    const finalName = name.trim() || 'Eco Pioneer';
    setUserName(finalName);
    setIsFirstVisit(false);
    showToast(`Welcome to SecondLife AI, ${finalName}! 🌱`, 'success');
  };

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const unlockBadge = (badgeId: string) => {
    setBadges((prev) =>
      prev.map((b) => (b.id === badgeId && !b.unlocked ? { ...b, unlocked: true, unlockedAt: 'Just now' } : b))
    );
  };

  const fileToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Main flow: Upload photo -> Cloudinary processes it -> Gemini analyzes it -> Best Next Action
  const analyzePhoto = async (fileOrUrl: File | string, description = '') => {
    setLastAnalyzedFileOrUrl(fileOrUrl);
    setAnalysisError(null);
    setIsUploading(true);
    setUploadProgress(0);
    setCurrentScreen('analyze');

    try {
      let asset: CloudinaryAsset;
      let base64Image = '';

      if (typeof fileOrUrl === 'string') {
        setUploadProgress(40);
        const response = await fetch(fileOrUrl);
        const blob = await response.blob();
        setUploadProgress(70);
        base64Image = await fileToBase64(blob);

        const { data: sessionData } = await supabase.auth.getSession();
        const sessionToken = sessionData.session?.access_token;
        const uploadRes = await uploadImageToCloudinary(blob, (p) => setUploadProgress(p), sessionToken);
        asset = uploadRes.asset;
        if (uploadRes.notice) {
          showToast(uploadRes.notice, 'info');
        }
      } else {
        base64Image = await fileToBase64(fileOrUrl);
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionToken = sessionData.session?.access_token;
        const uploadRes = await uploadImageToCloudinary(fileOrUrl, (p) => setUploadProgress(p), sessionToken);
        asset = uploadRes.asset;
        if (uploadRes.notice) {
          showToast(uploadRes.notice, 'info');
        }
      }

      setIsUploading(false);
      setCurrentAsset(asset);
      setUserDescription(description);

      // Send to Gemini Vision API via server endpoint
      setIsAnalyzing(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const currentToken = sessionData.session?.access_token;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }

      const apiRes = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBase64: base64Image,
          imageUrl: asset.originalUrl,
          description,
          tags: asset.tags,
        }),
      });

      if (apiRes.status === 401) {
        showToast('Please sign in to analyze items with AI.', 'warning');
        openAuthModal('signin');
        setIsAnalyzing(false);
        return;
      }

      if (!apiRes.ok) {
        throw new Error(`Analysis server returned ${apiRes.status}`);
      }

      const resData = await apiRes.json();
      if (!resData.data) {
        throw new Error('Analysis response missing data');
      }

      // Attach Cloudinary tags to analysis data
      if (asset.tags && asset.tags.length > 0) {
        resData.data.tags = asset.tags;
      }

      setCurrentAnalysis(resData.data);
      if (resData.notice) {
        showToast(resData.notice, 'info');
      }

      // Persist analysis to Supabase if logged in (with Cloudinary tags)
      if (user && isSupabaseConfigured()) {
        supabase
          .from('analyses')
          .insert({
            user_id: user.id,
            item_data: resData.data,
            recommended_action: resData.data.recommended_action || null,
            tags: asset.tags || [],
          })
          .then(({ error }) => {
            if (error) console.warn('Could not persist analysis to Supabase:', error);
          });
      }
    } catch (err: any) {
      console.error('Photo analysis error:', err);
      setAnalysisError(err.message || 'Analysis could not be completed. Please check your photo and try again.');
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  const retryAnalysis = async (customDescription?: string) => {
    if (lastAnalyzedFileOrUrl) {
      const descToUse = customDescription !== undefined ? customDescription : userDescription;
      setUserDescription(descToUse);
      await analyzePhoto(lastAnalyzedFileOrUrl, descToUse);
    }
  };

  const updateAnalysisField = <K extends keyof ItemAnalysis>(field: K, value: ItemAnalysis[K]) => {
    if (!currentAnalysis) return;
    setCurrentAnalysis({ ...currentAnalysis, [field]: value });
  };

  // Actions from Analysis screen with Supabase persistence
  const markItemRepaired = async (item: ItemAnalysis, afterPhoto?: { publicId?: string; url?: string }) => {
    const hasGemini = Boolean(item.estimated_waste_saved_kg);
    const catEstimate = getCategoryImpactEstimate(item.category, 'repaired');
    const waste = item.estimated_waste_saved_kg || catEstimate.wasteKg;
    const co2 = item.estimated_co2_saved_kg || catEstimate.co2Kg;
    const savedInr =
      item.replace_cost_inr?.min && item.repair_cost_inr?.min
        ? Math.max(0, item.replace_cost_inr.min - item.repair_cost_inr.min)
        : catEstimate.moneySavedInr;
    const source = hasGemini ? 'gemini' : 'category_default';

    const afterImageUrl = afterPhoto?.url || currentAsset?.cleanedUrl || currentAsset?.originalUrl || null;
    const afterPublicId = afterPhoto?.publicId || null;

    // Persist to Supabase
    if (user && isSupabaseConfigured()) {
      try {
        await supabase.from('actions').insert({
          user_id: user.id,
          type: 'repaired',
          waste_kg: waste,
          co2_kg: co2,
          money_saved_inr: savedInr,
          estimate_source: source,
          item_name: item.item_name || 'Repaired Item',
          category: item.category || 'General',
          before_image_url: currentAsset?.originalUrl || null,
          after_image_url: afterImageUrl,
          after_public_id: afterPublicId,
        });
        await loadUserActionsAndStats(user.id);
        await loadCommunityLeaderboardAndTotals();
      } catch (err) {
        console.warn('Could not persist repaired action to Supabase:', err);
      }
    } else {
      const updatedStats: UserStats = {
        ...userStats,
        itemsReused: (userStats.itemsReused || 0) + 1,
        repairsDone: (userStats.repairsDone || 0) + 1,
        donationsDone: userStats.donationsDone || 0,
        borrowedCount: userStats.borrowedCount || 0,
        kgWasteSaved: parseFloat(((userStats.kgWasteSaved || 0) + waste).toFixed(1)),
        co2Saved: parseFloat(((userStats.co2Saved || 0) + co2).toFixed(1)),
        moneySavedInr: (userStats.moneySavedInr || 0) + savedInr,
      };
      setUserStats(updatedStats);
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updatedStats));
    }

    showToast(`Great job! Repaired "${item.item_name}". +${waste} kg waste diverted! 🛠️`, 'success');
  };

  const markItemDonated = async (item: ItemAnalysis) => {
    const hasGemini = Boolean(item.estimated_waste_saved_kg);
    const catEstimate = getCategoryImpactEstimate(item.category, 'donated');
    const waste = item.estimated_waste_saved_kg || catEstimate.wasteKg;
    const co2 = item.estimated_co2_saved_kg || catEstimate.co2Kg;
    const source = hasGemini ? 'gemini' : 'category_default';

    const donateTrust = computeTrustScore({
      fullName: userProfile?.full_name || userName || 'You',
      neighborhood: userProfile?.neighborhood || 'Near your location',
      avatarUrl: userProfile?.avatar_url || '',
      completedExchangesCount: (userStats.donationsDone || 0) + (userStats.borrowedCount || 0) + (userStats.repairsDone || 0),
      averageRating: 5.0,
      reviewsCount: 0,
      photoQualityScore: item.photo_quality?.score,
      hasCutoutPhoto: Boolean(currentAsset?.cleanedUrl),
      emailConfirmed: Boolean(user?.email),
    });

    const newListing: CommunityListing = {
      id: `list-${Date.now()}`,
      ownerId: user?.id,
      title: item.item_name,
      category: item.category || 'Household',
      type: 'donate',
      condition: item.condition === 'good' ? 'good' : 'fair',
      ownerName: userProfile?.full_name || userName || 'You',
      ownerAvatar: userProfile?.avatar_url || '',
      ownerNeighborhood: userProfile?.neighborhood || 'Near your location',
      ownerRating: 5.0,
      ownerReviewsCount: 0,
      ownerVerified: donateTrust.isVerified,
      distanceKm: 0.1,
      trustScore: donateTrust.score,
      trustBreakdown: donateTrust,
      imageUrl: currentAsset?.cleanedUrl || currentAsset?.originalUrl || getCategoryFallbackImage(item.category),
      cutoutUrl: currentAsset?.cleanedUrl,
      cloudinaryPublicId: currentAsset?.publicId,
      description: item.reasoning || 'Donated via SecondLife AI circular assessment.',
      tags: [item.category.toLowerCase(), 'donate', 'secondlife'],
      location: userProfile?.neighborhood || 'Near your location',
      status: 'active',
      createdAt: 'Just now',
      is_sample: false,
    };

    addListing(newListing);

    if (user && isSupabaseConfigured()) {
      try {
        await supabase.from('actions').insert({
          user_id: user.id,
          type: 'donated',
          waste_kg: waste,
          co2_kg: co2,
          money_saved_inr: 0,
          estimate_source: source,
          item_name: item.item_name,
          category: item.category || 'General',
          before_image_url: currentAsset?.originalUrl || null,
          after_image_url: currentAsset?.cleanedUrl || null,
        });
        await loadUserActionsAndStats(user.id);
        await loadCommunityLeaderboardAndTotals();

        const { data } = await supabase
          .from('listings')
          .insert({
            owner_id: user.id,
            title: item.item_name,
            category: item.category || 'Household',
            condition: item.condition === 'good' ? 'good' : 'fair',
            type: 'donate',
            description: item.reasoning || 'Donated via SecondLife AI circular assessment.',
            cloudinary_public_id: currentAsset?.publicId || null,
            tags: [item.category.toLowerCase(), 'donate', 'secondlife'],
            cutout_url: currentAsset?.cleanedUrl || currentAsset?.originalUrl || getCategoryFallbackImage(item.category),
            status: 'active',
            location_label: userProfile?.neighborhood || 'Near your location',
          })
          .select()
          .single();

        if (data) {
          newListing.id = data.id;
        }
      } catch (err) {
        console.warn('Could not persist donated action or listing:', err);
      }
    } else {
      const updatedStats: UserStats = {
        ...userStats,
        itemsReused: (userStats.itemsReused || 0) + 1,
        repairsDone: userStats.repairsDone || 0,
        donationsDone: (userStats.donationsDone || 0) + 1,
        borrowedCount: userStats.borrowedCount || 0,
        kgWasteSaved: parseFloat(((userStats.kgWasteSaved || 0) + waste).toFixed(1)),
        co2Saved: parseFloat(((userStats.co2Saved || 0) + co2).toFixed(1)),
        moneySavedInr: userStats.moneySavedInr || 0,
      };
      setUserStats(updatedStats);
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updatedStats));
    }

    unlockBadge('badge-2');
    showToast(`"${item.item_name}" marked as donated and posted to Community! 🎁`, 'success');
  };

  const listItemForSharing = async (item: ItemAnalysis, type: 'borrow' | 'donate') => {
    const isBorrow = type === 'borrow';
    const waste = item.estimated_waste_saved_kg || 1.5;
    const co2 = item.estimated_co2_saved_kg || 3.0;
    const savedInr = isBorrow ? 500 : 0;

    const updatedStats: UserStats = {
      ...userStats,
      itemsReused: (userStats.itemsReused || 0) + 1,
      repairsDone: userStats.repairsDone || 0,
      donationsDone: isBorrow ? (userStats.donationsDone || 0) : (userStats.donationsDone || 0) + 1,
      borrowedCount: isBorrow ? (userStats.borrowedCount || 0) + 1 : (userStats.borrowedCount || 0),
      kgWasteSaved: parseFloat(((userStats.kgWasteSaved || 0) + waste).toFixed(1)),
      co2Saved: parseFloat(((userStats.co2Saved || 0) + co2).toFixed(1)),
      moneySavedInr: (userStats.moneySavedInr || 0) + savedInr,
    };
    setUserStats(updatedStats);
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updatedStats));

    const borrowTrust = computeTrustScore({
      fullName: userProfile?.full_name || userName || 'You',
      neighborhood: userProfile?.neighborhood || 'Near your location',
      avatarUrl: userProfile?.avatar_url || '',
      completedExchangesCount: (userStats.donationsDone || 0) + (userStats.borrowedCount || 0) + (userStats.repairsDone || 0),
      averageRating: 5.0,
      reviewsCount: 0,
      photoQualityScore: item.photo_quality?.score,
      hasCutoutPhoto: Boolean(currentAsset?.cleanedUrl || currentAsset?.thumbnailUrl),
      emailConfirmed: Boolean(user?.email),
    });

    const newListing: CommunityListing = {
      id: `list-${Date.now()}`,
      ownerId: user?.id,
      title: item.item_name,
      category: item.category || 'Household',
      type,
      condition: item.condition === 'good' ? 'good' : 'fair',
      ownerName: userProfile?.full_name || userName || 'You',
      ownerAvatar: userProfile?.avatar_url || '',
      ownerNeighborhood: userProfile?.neighborhood || 'Near your location',
      ownerRating: 5.0,
      ownerReviewsCount: 0,
      ownerVerified: borrowTrust.isVerified,
      distanceKm: 0.1,
      trustScore: borrowTrust.score,
      trustBreakdown: borrowTrust,
      imageUrl: currentAsset?.thumbnailUrl || currentAsset?.originalUrl || getCategoryFallbackImage(item.category),
      cutoutUrl: currentAsset?.cleanedUrl || currentAsset?.thumbnailUrl,
      cloudinaryPublicId: currentAsset?.publicId,
      description: item.reasoning || 'Inspected with SecondLife AI.',
      tags: [item.category.toLowerCase(), type, 'shared'],
      availableDuration: isBorrow ? 'Up to 3 days' : undefined,
      location: userProfile?.neighborhood || 'Near your location',
      status: 'active',
      createdAt: 'Just now',
      is_sample: false,
    };

    addListing(newListing);

    if (user && isSupabaseConfigured()) {
      const hasGemini = Boolean(item.estimated_waste_saved_kg);
      const catEstimate = getCategoryImpactEstimate(item.category, isBorrow ? 'borrowed' : 'donated');
      const actualWaste = item.estimated_waste_saved_kg || catEstimate.wasteKg;
      const actualCo2 = item.estimated_co2_saved_kg || catEstimate.co2Kg;
      const actualMoney = isBorrow ? catEstimate.moneySavedInr : 0;
      const source = hasGemini ? 'gemini' : 'category_default';

      try {
        await supabase
          .from('actions')
          .insert({
            user_id: user.id,
            type: isBorrow ? 'borrowed' : 'donated',
            waste_kg: actualWaste,
            co2_kg: actualCo2,
            money_saved_inr: actualMoney,
            estimate_source: source,
            item_name: item.item_name,
            category: item.category || 'General',
            before_image_url: currentAsset?.originalUrl || null,
            after_image_url: currentAsset?.thumbnailUrl || null,
          });
        await loadUserActionsAndStats(user.id);
        await loadCommunityLeaderboardAndTotals();
      } catch (err) {
        console.warn('Could not persist action:', err);
      }

      supabase
        .from('listings')
        .insert({
          owner_id: user.id,
          title: item.item_name,
          category: item.category || 'Household',
          condition: item.condition === 'good' ? 'good' : 'fair',
          type,
          description: item.reasoning || 'Inspected with SecondLife AI.',
          cloudinary_public_id: currentAsset?.publicId || null,
          tags: [item.category.toLowerCase(), type, 'shared'],
          cutout_url: currentAsset?.thumbnailUrl || currentAsset?.originalUrl || getCategoryFallbackImage(item.category),
          status: 'active',
          location_label: userProfile?.neighborhood || 'Near your location',
        })
        .select()
        .single()
        .then(({ data, error }) => {
          if (data) {
            newListing.id = data.id;
          }
          if (error) console.warn('Could not persist listing:', error);
        });
    }

    unlockBadge('badge-2');
    showToast(`"${item.item_name}" is now listed for ${type} in your neighborhood! 🤝`, 'success');
    setCurrentScreen('community');
  };

  // Phase 3A: Create Real Listing from the editable form
  const createRealListing = async (formData: {
    title: string;
    category: string;
    condition: ConditionType;
    type: 'borrow' | 'donate';
    description: string;
    borrowDuration?: string;
    locationLabel: string;
    cloudinaryPublicId?: string;
    tags: string[];
    cutoutUrl?: string;
    phash?: string;
    videoPublicId?: string;
  }): Promise<CommunityListing | null> => {
    if (!user) {
      openAuthModal('signin');
      showToast('Please sign in to publish your listing.', 'info');
      return null;
    }

    const isBorrow = formData.type === 'borrow';

    try {
      let createdId = `list-${Date.now()}`;
      let createdTime = new Date().toLocaleDateString();

      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('listings')
          .insert({
            owner_id: user.id,
            title: formData.title,
            category: formData.category,
            condition: formData.condition,
            type: formData.type,
            description: formData.description,
            borrow_duration: isBorrow ? (formData.borrowDuration || 'Up to 3 days') : null,
            location_label: formData.locationLabel,
            cloudinary_public_id: formData.cloudinaryPublicId || null,
            tags: formData.tags || [],
            cutout_url: formData.cutoutUrl || null,
            status: 'active',
            moderation_status: currentAsset?.moderationStatus || 'unmoderated',
            original_bytes: currentAsset?.bytes || null,
            optimized_bytes: currentAsset?.deliveredBytes || null,
            phash: formData.phash || currentAsset?.phash || null,
            video_public_id: formData.videoPublicId || null,
          })
          .select('*, profiles:owner_id(full_name, avatar_url, neighborhood, city)')
          .single();

        if (error) throw error;
        if (data) {
          createdId = data.id;
          createdTime = new Date(data.created_at).toLocaleDateString();
        }

        const catEstimate = getCategoryImpactEstimate(formData.category, isBorrow ? 'borrowed' : 'donated');
        // Record impact action
        await supabase.from('actions').insert({
          user_id: user.id,
          type: isBorrow ? 'borrowed' : 'donated',
          waste_kg: catEstimate.wasteKg,
          co2_kg: catEstimate.co2Kg,
          money_saved_inr: isBorrow ? catEstimate.moneySavedInr : 0,
          estimate_source: 'category_default',
          item_name: formData.title,
          category: formData.category,
          after_image_url: formData.cutoutUrl || null,
          listing_id: createdId.startsWith('list-') ? null : createdId,
        });

        await loadUserActionsAndStats(user.id);
        await loadCommunityLeaderboardAndTotals();
      }

      const postTrust = computeTrustScore({
        fullName: userProfile?.full_name || userName || 'You',
        neighborhood: formData.locationLabel,
        avatarUrl: userProfile?.avatar_url || '',
        completedExchangesCount: (userStats.donationsDone || 0) + (userStats.borrowedCount || 0) + (userStats.repairsDone || 0),
        averageRating: 5.0,
        reviewsCount: 0,
        hasCutoutPhoto: Boolean(formData.cutoutUrl),
        emailConfirmed: Boolean(user?.email),
      });

      const newListing: CommunityListing = {
        id: createdId,
        ownerId: user.id,
        title: formData.title,
        category: formData.category,
        type: formData.type,
        condition: formData.condition,
        ownerName: userProfile?.full_name || userName || 'You',
        ownerAvatar: userProfile?.avatar_url || '',
        ownerNeighborhood: formData.locationLabel,
        ownerRating: 5.0,
        ownerReviewsCount: 0,
        ownerVerified: postTrust.isVerified,
        distanceKm: 0.1,
        trustScore: postTrust.score,
        trustBreakdown: postTrust,
        imageUrl: formData.cutoutUrl || getCategoryFallbackImage(formData.category),
        cutoutUrl: formData.cutoutUrl,
        cloudinaryPublicId: formData.cloudinaryPublicId,
        description: formData.description,
        tags: formData.tags,
        availableDuration: isBorrow ? (formData.borrowDuration || 'Up to 3 days') : undefined,
        location: formData.locationLabel,
        status: 'active',
        createdAt: createdTime,
        is_sample: false,
        moderation_status: currentAsset?.moderationStatus || 'unmoderated',
        original_bytes: currentAsset?.bytes,
        optimized_bytes: currentAsset?.deliveredBytes,
        phash: formData.phash || currentAsset?.phash,
        video_public_id: formData.videoPublicId,
        videoUrl: formData.videoPublicId ? buildCloudinaryVideoUrl(formData.videoPublicId) : undefined,
        videoPosterUrl: formData.videoPublicId ? buildVideoPosterUrl(formData.videoPublicId) : undefined,
      };

      setListings((prev) => [newListing, ...prev]);

      // Update user stats
      const updatedStats: UserStats = {
        ...userStats,
        itemsReused: (userStats.itemsReused || 0) + 1,
        donationsDone: !isBorrow ? (userStats.donationsDone || 0) + 1 : (userStats.donationsDone || 0),
        borrowedCount: isBorrow ? (userStats.borrowedCount || 0) + 1 : (userStats.borrowedCount || 0),
        kgWasteSaved: parseFloat(((userStats.kgWasteSaved || 0) + 2.0).toFixed(1)),
        co2Saved: parseFloat(((userStats.co2Saved || 0) + 4.0).toFixed(1)),
        moneySavedInr: (userStats.moneySavedInr || 0) + (isBorrow ? 500 : 0),
      };
      setUserStats(updatedStats);
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updatedStats));

      return newListing;
    } catch (err: any) {
      console.error('Error creating real listing:', err);
      showToast('Could not save listing: ' + (err.message || 'Unknown error'), 'warning');
      return null;
    }
  };

  // Phase 3A: Update an existing listing
  const updateListing = async (
    listingId: string,
    updates: {
      title?: string;
      category?: string;
      condition?: ConditionType;
      type?: 'borrow' | 'donate';
      description?: string;
      borrowDuration?: string;
      locationLabel?: string;
      status?: 'active' | 'paused' | 'lent' | 'donated' | 'claimed' | 'completed' | 'archived';
    }
  ): Promise<boolean> => {
    if (!user) {
      showToast('You must be signed in to update a listing.', 'warning');
      return false;
    }

    try {
      if (isSupabaseConfigured() && !listingId.startsWith('list-')) {
        const payload: any = {};
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.condition !== undefined) payload.condition = updates.condition;
        if (updates.type !== undefined) payload.type = updates.type;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.borrowDuration !== undefined) payload.borrow_duration = updates.borrowDuration;
        if (updates.locationLabel !== undefined) payload.location_label = updates.locationLabel;
        if (updates.status !== undefined) payload.status = updates.status;

        const { error } = await supabase
          .from('listings')
          .update(payload)
          .eq('id', listingId)
          .eq('owner_id', user.id);

        if (error) throw error;
      }

      setListings((prev) =>
        prev.map((l) => {
          if (l.id === listingId) {
            return {
              ...l,
              ...(updates.title !== undefined && { title: updates.title }),
              ...(updates.category !== undefined && { category: updates.category }),
              ...(updates.condition !== undefined && { condition: updates.condition }),
              ...(updates.type !== undefined && { type: updates.type }),
              ...(updates.description !== undefined && { description: updates.description }),
              ...(updates.borrowDuration !== undefined && { availableDuration: updates.borrowDuration }),
              ...(updates.locationLabel !== undefined && { location: updates.locationLabel }),
              ...(updates.status !== undefined && { status: updates.status }),
            };
          }
          return l;
        })
      );

      return true;
    } catch (err: any) {
      console.error('Update listing error:', err);
      showToast('Could not update listing: ' + (err.message || 'Error'), 'warning');
      return false;
    }
  };

  // Phase 3A: Pause or resume a listing
  const toggleListingStatus = async (listingId: string, currentStatus?: string): Promise<boolean> => {
    const nextStatus = currentStatus === 'paused' ? 'active' : 'paused';
    const ok = await updateListing(listingId, { status: nextStatus });
    if (ok) {
      showToast(nextStatus === 'paused' ? 'Listing paused (hidden from community).' : 'Listing resumed and active! 🟢', 'info');
    }
    return ok;
  };

  // Phase 3A: Mark as lent or donated
  const markListingAsLentOrDonated = async (listingId: string, type: 'lent' | 'donated'): Promise<boolean> => {
    const ok = await updateListing(listingId, { status: type });
    if (ok) {
      if (user && isSupabaseConfigured()) {
        const catEstimate = getCategoryImpactEstimate('General', type);
        await supabase.from('actions').insert({
          user_id: user.id,
          type: type === 'lent' ? 'lent' : 'donated',
          waste_kg: catEstimate.wasteKg,
          co2_kg: catEstimate.co2Kg,
          money_saved_inr: type === 'lent' ? catEstimate.moneySavedInr : 0,
          estimate_source: 'category_default',
          item_name: 'Community Item',
          category: 'General',
          listing_id: listingId.startsWith('list-') ? null : listingId,
        });
        await loadUserActionsAndStats(user.id);
        await loadCommunityLeaderboardAndTotals();
      }
      showToast(type === 'lent' ? 'Marked as Lent out! 🤝' : 'Marked as Donated! 🎁', 'success');
    }
    return ok;
  };

  // Phase 3A: Delete listing
  const deleteListing = async (listingId: string): Promise<boolean> => {
    if (!user) {
      showToast('You must be signed in to delete a listing.', 'warning');
      return false;
    }

    try {
      if (isSupabaseConfigured() && !listingId.startsWith('list-')) {
        const { error } = await supabase
          .from('listings')
          .delete()
          .eq('id', listingId)
          .eq('owner_id', user.id);

        if (error) throw error;
      }

      setListings((prev) => prev.filter((l) => l.id !== listingId));
      showToast('Listing deleted successfully.', 'info');
      return true;
    } catch (err: any) {
      console.error('Delete listing error:', err);
      showToast('Could not delete listing: ' + (err.message || 'Error'), 'warning');
      return false;
    }
  };

  const addListing = (listing: CommunityListing) => {
    setListings((prev) => {
      const updated = [listing, ...prev];
      localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Phase 3B: Submit request for an item (persisting to Supabase requests table)
  const submitListingRequest = async (listingId: string, message: string): Promise<boolean> => {
    if (!user) {
      openAuthModal('signin');
      showToast('Please sign in to request community items.', 'info');
      return false;
    }

    const listing = listings.find((l) => l.id === listingId);
    if (listing && listing.ownerId === user.id) {
      showToast('You cannot request your own listing.', 'warning');
      return false;
    }

    // Check duplicate pending in state
    const duplicate = outgoingRequests.some(
      (r) => r.listingId === listingId && r.status === 'pending'
    );
    if (duplicate) {
      showToast('You already have a pending request for this item.', 'warning');
      return false;
    }

    if (isSupabaseConfigured()) {
      // Also check duplicate in database
      const { data: existing } = await supabase
        .from('requests')
        .select('id')
        .eq('listing_id', listingId)
        .eq('requester_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        showToast('You already have a pending request for this item. Check your Inbox!', 'warning');
        return false;
      }

      const { error } = await supabase.from('requests').insert({
        listing_id: listingId,
        requester_id: user.id,
        status: 'pending',
        message: message.trim() || null,
      });

      if (error) {
        console.error('Request creation error:', error);
        showToast(`Could not send request: ${error.message}`, 'warning');
        return false;
      }

      await loadRequests(user.id);
    } else {
      // Memory fallback for demo / test
      const newReq: ExchangeRequest = {
        id: `req-${Date.now()}`,
        listingId,
        requesterId: user.id,
        status: 'pending',
        message: message.trim(),
        createdAt: 'Just now',
        listingTitle: listing?.title || 'Community Item',
        listingImageUrl: listing?.imageUrl || '',
        listingType: listing?.type || 'borrow',
        listingCategory: listing?.category || 'General',
        listingLocation: listing?.location || 'Local area',
        listingDuration: listing?.availableDuration,
        listingOwnerId: listing?.ownerId || '',
        requesterName: userProfile?.full_name || userName || 'You',
        requesterAvatar: userProfile?.avatar_url || '',
        requesterNeighborhood: userProfile?.neighborhood || 'Near your location',
        ownerName: listing?.ownerName || 'Owner',
        ownerAvatar: listing?.ownerAvatar || '',
        ownerNeighborhood: listing?.ownerNeighborhood || 'Local area',
      };
      setOutgoingRequests((prev) => [newReq, ...prev]);
    }

    showToast('Request sent to owner! Track updates in your Inbox.', 'success');
    return true;
  };

  // Phase 3B: Accept Request
  const acceptRequest = async (requestId: string, note?: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const req = incomingRequests.find((r) => r.id === requestId);
      if (!req) return false;

      if (isSupabaseConfigured()) {
        const { error: reqErr } = await supabase
          .from('requests')
          .update({
            status: 'accepted',
            response_note: note?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId);
        if (reqErr) throw reqErr;

        // Update listing to 'reserved'
        const { error: listErr } = await supabase
          .from('listings')
          .update({ status: 'reserved' })
          .eq('id', req.listingId);
        if (listErr) console.warn('Listing status update warning:', listErr);

        await loadRequests(user.id);
        await loadPublicListings();
      } else {
        setIncomingRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: 'accepted', responseNote: note?.trim() } : r))
        );
      }

      showToast(`Request accepted! Item marked as Reserved for ${req.requesterName}.`, 'success');
      return true;
    } catch (err: any) {
      console.error('Accept request error:', err);
      showToast(`Could not accept: ${err.message || 'Error'}`, 'warning');
      return false;
    }
  };

  // Phase 3B: Decline Request
  const declineRequest = async (requestId: string, note?: string): Promise<boolean> => {
    if (!user) return false;
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('requests')
          .update({
            status: 'declined',
            response_note: note?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId);
        if (error) throw error;

        await loadRequests(user.id);
      } else {
        setIncomingRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: 'declined', responseNote: note?.trim() } : r))
        );
      }

      showToast('Request declined.', 'info');
      return true;
    } catch (err: any) {
      console.error('Decline request error:', err);
      showToast(`Could not decline: ${err.message || 'Error'}`, 'warning');
      return false;
    }
  };

  // Phase 3B: Mark Handed Over (Owner confirms handover)
  const markHandedOver = async (requestId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const req = incomingRequests.find((r) => r.id === requestId);
      if (!req) return false;

      if (isSupabaseConfigured()) {
        const { error: reqErr } = await supabase
          .from('requests')
          .update({
            status: 'handed_over',
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId);
        if (reqErr) throw reqErr;

        if (req.listingType === 'borrow') {
          await supabase
            .from('listings')
            .update({ status: 'lent' })
            .eq('id', req.listingId);
        }

        await loadRequests(user.id);
        await loadPublicListings();
      } else {
        setIncomingRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: 'handed_over' } : r))
        );
      }

      showToast(`Marked as handed over to ${req.requesterName}! 🤝`, 'success');
      return true;
    } catch (err: any) {
      console.error('Handover error:', err);
      showToast(`Could not mark handed over: ${err.message || 'Error'}`, 'warning');
      return false;
    }
  };

  // Phase 3B: Complete Exchange (Requester marks returned/received, calculates impact)
  const completeExchange = async (requestId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const req =
        outgoingRequests.find((r) => r.id === requestId) ||
        incomingRequests.find((r) => r.id === requestId);
      if (!req) return false;

      const catEstimate = getCategoryImpactEstimate(req.listingCategory, req.listingType === 'borrow' ? 'borrowed' : 'donated');
      const isBorrow = req.listingType === 'borrow';
      const targetReqStatus: RequestStatus = isBorrow ? 'returned' : 'completed';
      const targetListingStatus = isBorrow ? 'active' : 'donated';

      if (isSupabaseConfigured()) {
        // Try atomic RPC procedure first
        const { error: rpcErr } = await supabase.rpc('complete_exchange', {
          p_request_id: requestId,
          p_completed_by: user.id,
          p_waste_kg: catEstimate.wasteKg,
          p_co2_kg: catEstimate.co2Kg,
          p_money_saved_inr: catEstimate.moneySavedInr,
        });

        if (rpcErr) {
          console.warn('RPC complete_exchange fallback to direct updates:', rpcErr);
          await supabase
            .from('requests')
            .update({
              status: targetReqStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', requestId);

          await supabase
            .from('listings')
            .update({ status: targetListingStatus })
            .eq('id', req.listingId);

          // Insert action for caller
          await supabase.from('actions').insert({
            user_id: user.id,
            type: 'borrowed',
            waste_kg: catEstimate.wasteKg,
            co2_kg: catEstimate.co2Kg,
            money_saved_inr: catEstimate.moneySavedInr,
            estimate_source: 'category_default',
            item_name: req.listingTitle,
            category: req.listingCategory,
            after_image_url: req.listingImageUrl,
            listing_id: req.listingId.startsWith('list-') ? null : req.listingId,
          });

          // Insert action for partner
          const partnerId = user.id === req.requesterId ? req.listingOwnerId : req.requesterId;
          if (partnerId) {
            await supabase.from('actions').insert({
              user_id: partnerId,
              type: isBorrow ? 'lent' : 'donated',
              waste_kg: catEstimate.wasteKg,
              co2_kg: catEstimate.co2Kg,
              money_saved_inr: isBorrow ? catEstimate.moneySavedInr : 0,
              estimate_source: 'category_default',
              item_name: req.listingTitle,
              category: req.listingCategory,
              after_image_url: req.listingImageUrl,
              listing_id: req.listingId.startsWith('list-') ? null : req.listingId,
            });
          }
        }

        await loadRequests(user.id);
        await loadPublicListings();
        await loadUserActionsAndStats(user.id);
        await loadCommunityLeaderboardAndTotals();
      } else {
        setOutgoingRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: targetReqStatus } : r))
        );
        setIncomingRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: targetReqStatus } : r))
        );
      }

      // Update local stats state
      setUserStats((prev) => ({
        ...prev,
        itemsReused: prev.itemsReused + 1,
        borrowedCount: isBorrow ? prev.borrowedCount + 1 : prev.borrowedCount,
        donationsDone: !isBorrow ? prev.donationsDone + 1 : prev.donationsDone,
        kgWasteSaved: parseFloat((prev.kgWasteSaved + catEstimate.wasteKg).toFixed(1)),
        co2Saved: parseFloat((prev.co2Saved + catEstimate.co2Kg).toFixed(1)),
        moneySavedInr: prev.moneySavedInr + catEstimate.moneySavedInr,
      }));

      showToast(
        isBorrow
          ? `Returned safely! 🎉 Saved ${catEstimate.wasteKg}kg waste and ₹${catEstimate.moneySavedInr}!`
          : `Item received! 🎁 Diverted ${catEstimate.wasteKg}kg waste from landfill!`,
        'success'
      );
      return true;
    } catch (err: any) {
      console.error('Complete exchange error:', err);
      showToast(`Could not complete exchange: ${err.message || 'Error'}`, 'warning');
      return false;
    }
  };

  // Phase 3B: Cancel Request
  const cancelRequest = async (requestId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('requests')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId);
        if (error) throw error;

        await loadRequests(user.id);
      } else {
        setOutgoingRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: 'cancelled' } : r))
        );
      }

      showToast('Request cancelled.', 'info');
      return true;
    } catch (err: any) {
      console.error('Cancel request error:', err);
      showToast(`Could not cancel: ${err.message || 'Error'}`, 'warning');
      return false;
    }
  };

  // Phase 3C: Submit Review for an Exchange
  const submitReview = async (reviewData: {
    requestId?: string;
    revieweeId: string;
    rating: number;
    comment?: string;
  }): Promise<boolean> => {
    if (!user) {
      openAuthModal('signin');
      return false;
    }

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('reviews').insert({
          request_id: reviewData.requestId || null,
          reviewer_id: user.id,
          reviewee_id: reviewData.revieweeId,
          rating: reviewData.rating,
          comment: reviewData.comment || null,
        });

        if (error) {
          console.error('Submit review error:', error);
          if (error.code === '23505') {
            showToast('You have already submitted a review for this exchange.', 'info');
            return false;
          }
          showToast(`Could not submit review: ${error.message}`, 'warning');
          return false;
        }

        if (reviewData.requestId) {
          setReviewedRequestIds((prev) => [...prev, reviewData.requestId!]);
        }
      } else {
        if (reviewData.requestId) {
          setReviewedRequestIds((prev) => [...prev, reviewData.requestId!]);
        }
      }

      showToast('Thank you! Your review has been published ⭐', 'success');
      return true;
    } catch (err: any) {
      console.error('Submit review error:', err);
      showToast(`Error saving review: ${err.message || 'Unknown'}`, 'warning');
      return false;
    }
  };

  // Phase 3C: Submit Report for a Listing
  const submitReport = async (reportData: {
    listingId: string;
    reason: string;
    details?: string;
  }): Promise<boolean> => {
    if (!user) {
      openAuthModal('signin');
      return false;
    }

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('reports').insert({
          reporter_id: user.id,
          listing_id: reportData.listingId,
          reason: reportData.reason,
          details: reportData.details || null,
          status: 'pending',
        });

        if (error) {
          console.error('Submit report error:', error);
          showToast(`Could not submit report: ${error.message}`, 'warning');
          return false;
        }
      }

      showToast('Report received. Thank you for keeping our community safe! 🛡️', 'success');
      return true;
    } catch (err: any) {
      console.error('Submit report error:', err);
      showToast(`Error saving report: ${err.message || 'Unknown'}`, 'warning');
      return false;
    }
  };

  // Technician Bookings
  const createBooking = (technician: Technician, itemName: string, date: string, time: string, notes?: string) => {
    const booking: BookingConfirmation = {
      id: `bk-${Date.now()}`,
      technician,
      itemName,
      bookingDate: date,
      bookingTime: time,
      notes,
      status: 'confirmed',
    };

    const updated = [booking, ...bookings];
    setBookings(updated);
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(updated));
    showToast(`Booking confirmed with ${technician.name} for ${date} at ${time}! 📅`, 'success');
  };

  // Keyword / Semantic / Cloudinary Auto-Tag similarity matching
  const performMatch = async (query: string, photoFileOrTags?: File | Blob | string[]) => {
    setMatchQuery(query || (photoFileOrTags ? 'Visual photo search' : ''));
    let photoTags: string[] = [];

    if (photoFileOrTags) {
      if (Array.isArray(photoFileOrTags)) {
        photoTags = photoFileOrTags;
      } else {
        try {
          showToast('Extracting visual tags via Cloudinary...', 'info');
          const { data: sessionData } = await supabase.auth.getSession();
          const sessionToken = sessionData.session?.access_token;
          const uploadRes = await uploadImageToCloudinary(photoFileOrTags, undefined, sessionToken);
          photoTags = uploadRes.asset.tags || [];
          if (photoTags.length > 0) {
            showToast(`Visual tags matched: ${photoTags.slice(0, 3).join(', ')}`, 'success');
          }
        } catch (err: any) {
          console.warn('Photo tag matching upload error:', err);
          showToast('Could not extract image tags, falling back to text search.', 'info');
        }
      }
    }

    const qLower = (query || '').toLowerCase().trim();
    const tokens = qLower.split(/\s+/).filter((t) => t.length > 2);

    const activeRealListings = listings.filter(
      (l) => !l.is_sample && l.status !== 'paused' && l.moderation_status !== 'rejected'
    );

    const scored = activeRealListings.map((listing) => {
      let score = 0;
      let reasons: string[] = [];
      let matchedTags: string[] = [];

      const titleLower = listing.title.toLowerCase();
      const catLower = listing.category.toLowerCase();
      const descLower = listing.description.toLowerCase();
      const listingTags = (listing.tags || []).map((t) => t.toLowerCase());

      // 1. Tag Overlap Matching (from photo or passed tags)
      if (photoTags.length > 0) {
        for (const pTag of photoTags) {
          const ptLower = pTag.toLowerCase();
          const directTag = listingTags.find((lt) => lt === ptLower || lt.includes(ptLower) || ptLower.includes(lt));
          if (directTag) {
            score += 45;
            if (!matchedTags.includes(directTag)) {
              matchedTags.push(directTag);
            }
          } else if (titleLower.includes(ptLower)) {
            score += 35;
            if (!matchedTags.includes(ptLower)) {
              matchedTags.push(ptLower);
            }
          } else if (catLower.includes(ptLower)) {
            score += 25;
            if (!matchedTags.includes(ptLower)) {
              matchedTags.push(ptLower);
            }
          }
        }
      }

      // 2. Keyword tokens matching (from text query)
      for (const token of tokens) {
        if (titleLower.includes(token)) {
          score += 45;
          reasons.push(`Direct title match for "${token}"`);
        }
        const tagHit = listingTags.find((lt) => lt.includes(token));
        if (tagHit) {
          score += 30;
          if (!matchedTags.includes(tagHit)) {
            matchedTags.push(tagHit);
          }
        }
        if (catLower.includes(token)) {
          score += 25;
          reasons.push(`Category "${listing.category}"`);
        }
        if (descLower.includes(token)) {
          score += 15;
        }
      }

      // Highlight matched tags prominently
      if (matchedTags.length > 0) {
        reasons.unshift(`Matched on: ${matchedTags.join(', ')}`);
      }

      if (listing.distanceKm < 1.0) score += 10;
      if (listing.ownerVerified) score += 5;

      const reason =
        reasons.length > 0
          ? reasons.join(' • ')
          : `Available locally (${listing.distanceKm} km away) in ${listing.category}`;

      return {
        listing,
        matchScore: Math.min(score, 99),
        reason,
      };
    });

    const filtered = scored
      .filter((item) => item.matchScore > 15 || (tokens.length === 0 && photoTags.length === 0))
      .sort((a, b) => b.matchScore - a.matchScore);

    setMatchResults(filtered);
    setCurrentScreen('match');
  };

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        setCurrentScreen,
        userName,
        setUserName,
        isFirstVisit,
        completeOnboarding,
        user,
        userProfile,
        isAuthConfigured,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isProfileModalOpen,
        setIsProfileModalOpen,
        authMode,
        setAuthMode,
        openAuthModal,
        openProfileModal,
        updateUserProfile,
        signOut,
        currentAsset,
        setCurrentAsset,
        currentAnalysis,
        setCurrentAnalysis,
        userDescription,
        setUserDescription,
        isUploading,
        uploadProgress,
        isAnalyzing,
        analysisError,
        analyzePhoto,
        retryAnalysis,
        updateAnalysisField,
        userStats,
        badges,
        unlockBadge,
        markItemRepaired,
        markItemDonated,
        listItemForSharing,
        technicians: SEEDED_TECHNICIANS,
        bookings,
        createBooking,
        listings,
        isListingsLoading,
        listingsError,
        refreshListings,
        addListing,
        createRealListing,
        updateListing,
        toggleListingStatus,
        markListingAsLentOrDonated,
        deleteListing,
        submitListingRequest,
        incomingRequests,
        outgoingRequests,
        isRequestsLoading,
        pendingIncomingCount,
        refreshRequests,
        acceptRequest,
        declineRequest,
        markHandedOver,
        completeExchange,
        cancelRequest,
        submitReview,
        submitReport,
        publicProfileUserId,
        openPublicProfile,
        closePublicProfile,
        reviewedRequestIds,
        searchQuery,
        setSearchQuery,
        showSampleListings,
        setShowSampleListings,
        matchQuery,
        setMatchQuery,
        matchResults,
        performMatch,
        toasts,
        showToast,
        dismissToast,
        isCloudinaryDrawerOpen,
        setIsCloudinaryDrawerOpen,
        isCloudinarySettingsOpen,
        setIsCloudinarySettingsOpen,
        userActions,
        isActionsLoading,
        communityLeaderboard,
        communityTotals,
        refreshStats,
        isLegalModalOpen,
        legalModalTab,
        openLegalModal,
        closeLegalModal,
        deleteAccount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
