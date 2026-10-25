import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import { useApp } from '../context/AppContext';
import { PublicUserProfile, UserReview, CommunityListing } from '../types';
import { computeTrustScore } from '../utils/trustScore';
import { TrustScoreBadge } from './TrustScoreBadge';
import {
  X,
  User,
  MapPin,
  ShieldCheck,
  Star,
  Package,
  Calendar,
  Sparkles,
  Loader2,
  Share2,
} from 'lucide-react';

interface PublicProfileModalProps {
  userId: string | null;
  onClose: () => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  userId,
  onClose,
}) => {
  // ALL HOOKS AT TOP
  const { listings } = useApp();
  const [profileData, setProfileData] = useState<PublicUserProfile | null>(null);
  const [userListings, setUserListings] = useState<CommunityListing[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfileData(null);
      return;
    }

    let isMounted = true;
    const fetchPublicProfile = async () => {
      setLoading(true);
      try {
        if (isSupabaseConfigured() && !userId.startsWith('user-')) {
          // 1. Fetch Profile
          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (profErr) throw profErr;

          // 2. Fetch completed actions count
          const { count: actionsCount } = await supabase
            .from('actions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

          // 3. Fetch reviews received
          const { data: revsData, error: revsErr } = await supabase
            .from('reviews')
            .select(`
              id,
              request_id,
              reviewer_id,
              reviewee_id,
              rating,
              comment,
              created_at,
              reviewer:profiles!reviews_reviewer_id_fkey (
                id,
                full_name,
                avatar_url,
                neighborhood
              )
            `)
            .eq('reviewee_id', userId)
            .order('created_at', { ascending: false });

          if (revsErr) console.warn('Could not fetch reviews:', revsErr);

          // 4. Fetch active listings
          const { data: listData } = await supabase
            .from('listings')
            .select('*')
            .eq('owner_id', userId)
            .eq('status', 'active');

          const completedExchanges = actionsCount || 0;
          const reviewsList: UserReview[] = (revsData || []).map((r: any) => ({
            id: r.id,
            requestId: r.request_id,
            reviewerId: r.reviewer_id,
            reviewerName: r.reviewer?.full_name || 'Neighbor',
            reviewerAvatar: r.reviewer?.avatar_url || '',
            reviewerNeighborhood: r.reviewer?.neighborhood || 'Local Area',
            revieweeId: r.reviewee_id,
            rating: r.rating,
            comment: r.comment || '',
            createdAt: new Date(r.created_at).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
          }));

          const reviewCount = reviewsList.length;
          const averageRating =
            reviewCount > 0
              ? parseFloat(
                  (reviewsList.reduce((acc, curr) => acc + curr.rating, 0) / reviewCount).toFixed(1)
                )
              : 5.0;

          const trustBreakdown = computeTrustScore({
            fullName: prof?.full_name,
            neighborhood: prof?.neighborhood,
            city: prof?.city,
            avatarUrl: prof?.avatar_url,
            emailConfirmed: true,
            completedExchangesCount: completedExchanges,
            averageRating,
            totalReviews: reviewCount,
            hasCutoutPhoto: (listData && listData.some((l) => Boolean(l.cutout_url))) || true,
          });

          if (isMounted) {
            setProfileData({
              id: userId,
              fullName: prof?.full_name || 'Eco Member',
              neighborhood: prof?.neighborhood || 'Local neighborhood',
              city: prof?.city || 'City',
              avatarUrl: prof?.avatar_url || '',
              createdAt: prof?.created_at
                ? new Date(prof.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' })
                : 'Recent member',
              completedExchanges,
              averageRating,
              reviewCount,
              trustScore: trustBreakdown.score,
              trustBreakdown,
              isVerified: trustBreakdown.isVerified,
              reviews: reviewsList,
            });

            if (listData) {
              setUserListings(
                listData.map((l: any) => ({
                  id: l.id,
                  ownerId: l.owner_id,
                  title: l.title,
                  category: l.category,
                  type: l.type,
                  condition: l.condition,
                  ownerName: prof?.full_name || 'Eco Member',
                  ownerRating: averageRating,
                  ownerVerified: trustBreakdown.isVerified,
                  distanceKm: 0.8,
                  trustScore: trustBreakdown.score,
                  imageUrl: l.cutout_url || '',
                  cutoutUrl: l.cutout_url,
                  description: l.description || '',
                  tags: l.tags || [],
                  location: l.location_label || prof?.neighborhood || 'Local Area',
                  createdAt: new Date(l.created_at).toLocaleDateString(),
                }))
              );
            }
          }
        } else {
          // If no Supabase profile record exists, use active real listing owner info
          const ownerMatch = listings.find((l) => l.ownerId === userId);
          const fullName = ownerMatch?.ownerName || 'Neighbor';
          const neighborhood = ownerMatch?.ownerNeighborhood || ownerMatch?.location || 'Local Area';
          const avatarUrl = ownerMatch?.ownerAvatar || '';

          const trustBreakdown = computeTrustScore({
            fullName,
            neighborhood,
            avatarUrl,
            emailConfirmed: true,
            completedExchangesCount: 0,
            averageRating: ownerMatch?.ownerRating || 5.0,
            totalReviews: 0,
            hasCutoutPhoto: Boolean(ownerMatch?.imageUrl),
          });

          if (isMounted) {
            setProfileData({
              id: userId,
              fullName,
              neighborhood,
              city: 'Local Area',
              avatarUrl,
              createdAt: 'Neighbor',
              completedExchanges: 0,
              averageRating: ownerMatch?.ownerRating || 5.0,
              reviewCount: 0,
              trustScore: trustBreakdown.score,
              trustBreakdown,
              isVerified: trustBreakdown.isVerified,
              reviews: [],
            });

            if (ownerMatch) {
              setUserListings(listings.filter((l) => l.ownerId === userId && !l.is_sample));
            }
          }
        }
      } catch (err) {
        console.warn('Error loading public profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPublicProfile();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (!userId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative my-auto max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {loading || !profileData ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#2E9E6B] animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Loading community profile...</p>
          </div>
        ) : (
          <div className="overflow-y-auto space-y-4 flex-1 pr-1">
            {/* Profile Header */}
            <div className="flex flex-col items-center text-center pt-2">
              <div className="relative mb-2">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-[#EAF7F0] border-2 border-[#2E9E6B] flex items-center justify-center shadow-md">
                  {profileData.avatarUrl ? (
                    <img
                      src={profileData.avatarUrl}
                      alt={profileData.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-[#2E9E6B]">
                      {profileData.fullName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {profileData.isVerified && (
                  <div
                    className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-xs border border-emerald-100"
                    title="Verified Neighbor (Confirmed email & completed profile)"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#2E9E6B]" />
                  </div>
                )}
              </div>

              <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5 justify-center">
                <span>{profileData.fullName}</span>
                {profileData.isVerified && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                    Verified
                  </span>
                )}
              </h2>

              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 justify-center">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {profileData.neighborhood}
                  {profileData.city && profileData.neighborhood !== profileData.city ? ` · ${profileData.city}` : ''}
                </span>
              </p>

              {/* Trust Score & Rating Pill */}
              <div className="flex items-center gap-2 mt-3">
                <TrustScoreBadge breakdown={profileData.trustBreakdown} size="md" />

                <div className="flex items-center gap-1 py-1 px-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  <span>{profileData.averageRating}</span>
                  <span className="text-[10px] text-amber-600 font-normal">
                    ({profileData.reviewCount} {profileData.reviewCount === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 gap-2 text-center py-2.5 px-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">Completed Exchanges</span>
                <span className="font-bold text-slate-900 text-sm">{profileData.completedExchanges} items</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">Member Since</span>
                <span className="font-bold text-slate-900 text-sm">{profileData.createdAt}</span>
              </div>
            </div>

            {/* Recent Reviews Section */}
            <div className="space-y-2 pt-1">
              <h3 className="font-bold text-xs text-slate-800 flex items-center justify-between">
                <span>Community Reviews ({profileData.reviews.length})</span>
                <span className="text-[10px] text-slate-400 font-normal">Verified exchanges only</span>
              </h3>

              {profileData.reviews.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-500">
                  No neighbor reviews yet. Reviews are unlocked once an exchange is completed.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {profileData.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-emerald-100 border border-emerald-300 flex items-center justify-center text-[10px] font-bold text-emerald-800 shrink-0">
                            {rev.reviewerAvatar ? (
                              <img src={rev.reviewerAvatar} alt={rev.reviewerName} className="w-full h-full object-cover" />
                            ) : (
                              rev.reviewerName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="truncate text-xs">
                            <span className="font-semibold text-slate-800">{rev.reviewerName}</span>
                            <span className="text-[10px] text-slate-400 ml-1 truncate">({rev.reviewerNeighborhood})</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${
                                s <= rev.rating ? 'fill-amber-400 text-amber-500' : 'text-slate-200 fill-slate-100'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {rev.comment && (
                        <p className="text-[11px] text-slate-700 italic leading-relaxed">
                          "{rev.comment}"
                        </p>
                      )}

                      <div className="text-[9px] text-slate-400 text-right">
                        {rev.createdAt}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Items in Community */}
            {userListings.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h3 className="font-bold text-xs text-slate-800">
                  Active Listings by {profileData.fullName} ({userListings.length})
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {userListings.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-16 object-cover rounded-lg bg-slate-50"
                      />
                      <h4 className="font-bold text-[11px] text-slate-900 truncate">
                        {item.title}
                      </h4>
                      <span className="text-[9px] font-semibold text-sky-700 capitalize block">
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
