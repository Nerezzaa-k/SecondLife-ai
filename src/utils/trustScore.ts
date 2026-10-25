import { TrustScoreBreakdown } from '../types';

export interface TrustScoreInput {
  fullName?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  emailConfirmed?: boolean;
  completedExchangesCount?: number;
  averageRating?: number; // 1 to 5
  totalReviews?: number;
  reviewsCount?: number;
  hasCutoutPhoto?: boolean;
  photoQualityScore?: number;
}

/**
 * Computes a transparent, 0-100 Community Trust Score based on:
 * - Profile Completeness: max 25 pts (name, area, avatar)
 * - Email Verification: max 20 pts
 * - Completed Exchanges: max 30 pts (handover track record)
 * - Community Rating: max 15 pts (neighbor review stars)
 * - Photo Quality: max 10 pts (Cloudinary AI cutout / real photography)
 *
 * Verified rule: Verified email + fully completed profile
 */
export function computeTrustScore(input: TrustScoreInput): TrustScoreBreakdown {
  // 1. Profile Completeness (max 25 pts)
  let profileCompleteness = 0;
  if (input.fullName && input.fullName.trim().length > 1) {
    profileCompleteness += 10;
  }
  if ((input.neighborhood && input.neighborhood.trim().length > 1) || (input.city && input.city.trim().length > 1)) {
    profileCompleteness += 10;
  }
  if (input.avatarUrl && input.avatarUrl.trim().length > 0) {
    profileCompleteness += 5;
  }

  // 2. Email Verification (max 20 pts)
  const emailVerified = input.emailConfirmed !== false ? 20 : 0;

  // 3. Completed Exchanges (max 30 pts)
  const count = input.completedExchangesCount || 0;
  let completedExchanges = 5;
  if (count === 1) completedExchanges = 15;
  else if (count === 2) completedExchanges = 22;
  else if (count >= 3) completedExchanges = Math.min(30, 22 + (count - 2) * 4);

  // 4. Community Rating (max 15 pts)
  const totalReviews = input.totalReviews || 0;
  const averageRating = input.averageRating || 0;
  let averageRatingScore = 10;
  if (totalReviews > 0 && averageRating > 0) {
    averageRatingScore = Math.round((Math.min(5, averageRating) / 5) * 15);
  }

  // 5. Photo Quality (max 10 pts)
  const photoQualityScore = input.hasCutoutPhoto ? 10 : 7;

  const total = Math.min(
    100,
    profileCompleteness + emailVerified + completedExchanges + averageRatingScore + photoQualityScore
  );

  // Verified Badge Rule: verified email + completed profile
  const isProfileComplete = Boolean(
    input.fullName &&
    (input.neighborhood || input.city) &&
    input.avatarUrl
  );
  const isVerified = Boolean((input.emailConfirmed !== false) && isProfileComplete);

  return {
    score: total,
    profileCompleteness,
    emailVerified,
    completedExchanges,
    averageRatingScore,
    photoQualityScore,
    totalReviews,
    averageRating: parseFloat((averageRating || (totalReviews === 0 ? 5.0 : 0)).toFixed(1)),
    isVerified,
  };
}
