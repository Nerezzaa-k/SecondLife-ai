export type ActionType = 'repair' | 'borrow' | 'donate' | 'repurpose' | 'replace' | 'maintain';
export type ConditionType = 'good' | 'fair' | 'damaged' | 'like-new';

export interface ItemAnalysis {
  item_name: string;
  category: string;
  condition: 'good' | 'fair' | 'damaged' | 'like-new';
  likely_issue: string;
  possible_causes: string[];
  troubleshooting_tips: string[];
  recommended_action: ActionType;
  reasoning: string;
  confidence: number;
  repair_cost_inr: {
    min: number;
    max: number;
  };
  replace_cost_inr: {
    min: number;
    max: number;
  };
  reuse_ideas: string[];
  estimated_waste_saved_kg: number;
  estimated_co2_saved_kg: number;
  photo_quality: {
    score: number;
    issues: string[];
    tip: string;
  };
  safety_note: string;
  tags?: string[];
  isFallback?: boolean;
  source?: string;
}

export interface CloudinaryTransformationInfo {
  name: string;
  code: string;
  description: string;
  status: 'applied' | 'simulated' | 'fallback';
}

export interface CloudinaryAsset {
  publicId: string;
  originalUrl: string;
  cleanedUrl: string;
  thumbnailUrl: string;
  damageCloseupUrl: string;
  shareableCardUrl: string;
  tags: string[];
  transformations: CloudinaryTransformationInfo[];
  isDemoFallback: boolean;
  bytes?: number;
  deliveredBytes?: number;
  savedPercent?: number;
  moderationStatus?: 'approved' | 'rejected' | 'pending' | 'unmoderated';
  phash?: string;
  videoPublicId?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  resourceType?: 'image' | 'video';
}

export interface CommunityListing {
  id: string;
  ownerId?: string;
  title: string;
  category: string;
  type: 'borrow' | 'donate';
  condition: ConditionType;
  ownerName: string;
  ownerAvatar?: string;
  ownerNeighborhood?: string;
  ownerRating: number;
  ownerReviewsCount?: number;
  ownerVerified: boolean;
  distanceKm: number;
  trustScore: number;
  trustBreakdown?: TrustScoreBreakdown;
  imageUrl: string;
  cutoutUrl?: string;
  cloudinaryPublicId?: string;
  description: string;
  tags: string[];
  availableDuration?: string;
  location: string;
  status?: 'active' | 'paused' | 'lent' | 'donated' | 'claimed' | 'completed' | 'archived';
  moderation_status?: 'approved' | 'rejected' | 'pending' | 'unmoderated';
  original_bytes?: number;
  optimized_bytes?: number;
  phash?: string;
  video_public_id?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  createdAt: string;
  is_sample?: boolean;
}

export interface Technician {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviewsCount: number;
  priceRange: string;
  distance: string;
  turnaround: string;
  verifiedBadge: boolean;
  phone: string;
  avatar: string;
  is_sample?: boolean;
}

export interface BookingConfirmation {
  id: string;
  technician: Technician;
  itemName: string;
  bookingDate: string;
  bookingTime: string;
  notes?: string;
  status: 'confirmed' | 'pending';
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface LeaderboardUser {
  rank: number;
  name: string;
  avatar: string;
  reusedCount: number;
  wasteSavedKg: number;
  co2SavedKg: number;
  badgeCount: number;
  isCurrentUser?: boolean;
  is_sample?: boolean;
}

export interface RepairStory {
  id: string;
  title: string;
  item: string;
  beforeUrl: string;
  afterUrl: string;
  wasteSavedKg: number;
  moneySavedInr: number;
  co2SavedKg: number;
  repairedBy: string;
  technique: string;
  is_sample?: boolean;
}

export interface UserStats {
  itemsReused: number;
  repairsDone: number;
  donationsDone: number;
  borrowedCount: number;
  kgWasteSaved: number;
  co2Saved: number;
  moneySavedInr: number;
}

export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'handed_over'
  | 'returned'
  | 'completed'
  | 'cancelled';

export interface ExchangeRequest {
  id: string;
  listingId: string;
  requesterId: string;
  status: RequestStatus;
  message?: string;
  responseNote?: string;
  createdAt: string;
  updatedAt?: string;

  // Listing info
  listingTitle: string;
  listingImageUrl: string;
  listingType: 'borrow' | 'donate';
  listingCategory: string;
  listingLocation: string;
  listingDuration?: string;
  listingOwnerId: string;

  // Requester profile (approximate area only)
  requesterName: string;
  requesterAvatar?: string;
  requesterNeighborhood: string;

  // Owner profile (approximate area only)
  ownerId?: string;
  ownerName: string;
  ownerAvatar?: string;
  ownerNeighborhood: string;
}

// Phase 3C: Reviews, Trust & Reports
export interface UserReview {
  id: string;
  requestId?: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  reviewerNeighborhood?: string;
  revieweeId: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface TrustScoreBreakdown {
  score: number; // 0-100
  profileCompleteness: number; // max 25
  emailVerified: number; // max 20
  completedExchanges: number; // max 30
  averageRatingScore: number; // max 15
  photoQualityScore: number; // max 10
  totalReviews: number;
  averageRating: number;
  isVerified: boolean;
}

export interface PublicUserProfile {
  id: string;
  fullName: string;
  neighborhood: string;
  city: string;
  avatarUrl?: string;
  createdAt?: string;
  completedExchanges: number;
  averageRating: number;
  reviewCount: number;
  trustScore: number;
  trustBreakdown: TrustScoreBreakdown;
  isVerified: boolean;
  reviews: UserReview[];
}

export interface ListingReport {
  id?: string;
  listingId: string;
  reporterId: string;
  reason: string;
  details?: string;
  createdAt?: string;
}

// Phase 4: Real Impact, Actions & Community
export interface UserAction {
  id: string;
  userId: string;
  type: 'repaired' | 'donated' | 'borrowed' | 'lent' | 'repurposed';
  wasteKg: number;
  co2Kg: number;
  moneySavedInr: number;
  estimateSource: 'gemini' | 'category_default';
  itemName?: string;
  category?: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  after_public_id?: string;
  afterPublicId?: string;
  listingId?: string;
  createdAt: string;
}

export interface CommunityLeaderboardEntry {
  userId: string;
  firstName: string;
  neighborhood: string;
  avatarUrl?: string;
  itemsReused: number;
  wasteSavedKg: number;
  co2SavedKg: number;
  isCurrentUser?: boolean;
}

export interface CommunityImpactTotals {
  totalItemsReused: number;
  totalWasteKg: number;
  totalCo2Kg: number;
  activeMembers: number;
}



