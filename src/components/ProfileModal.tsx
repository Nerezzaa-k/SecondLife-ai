import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured, UserProfile } from '../config/supabase';
import { uploadImageToCloudinary } from '../config/cloudinary';
import { useApp } from '../context/AppContext';
import { TrustScoreBadge } from './TrustScoreBadge';
import { computeTrustScore } from '../utils/trustScore';
import {
  X,
  User,
  MapPin,
  Camera,
  Upload,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Package,
  Inbox,
  ShieldCheck,
  Eye,
  Trash2,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  userEmail?: string;
  onProfileUpdated: (updated: UserProfile) => void;
  onSignOut: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  userEmail,
  onProfileUpdated,
  onSignOut,
}) => {
  // 1. ALL HOOKS DECLARED AT THE VERY TOP (before any early returns)
  const { setCurrentScreen, userStats, openPublicProfile, deleteAccount } = useApp();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood || '');
  const [city, setCity] = useState(profile?.city || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(Boolean(profile?.show_on_leaderboard));

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const userBreakdown = useMemo(() => {
    return computeTrustScore({
      fullName,
      neighborhood: neighborhood || city,
      avatarUrl,
      completedExchangesCount: (userStats?.donationsDone || 0) + (userStats?.borrowedCount || 0) + (userStats?.repairsDone || 0),
      averageRating: 5.0,
      reviewsCount: 0,
      hasCutoutPhoto: true,
      emailConfirmed: Boolean(userEmail),
    });
  }, [fullName, neighborhood, city, avatarUrl, userStats, userEmail]);

  // 2. Synchronize internal state with profile prop whenever profile changes or modal opens
  // Guarantees hook execution on EVERY render regardless of isOpen
  useEffect(() => {
    if (!isOpen) return; // Guard inside the effect instead of skipping the hook
    if (profile) {
      setFullName(profile.full_name || '');
      setNeighborhood(profile.neighborhood || '');
      setCity(profile.city || '');
      setAvatarUrl(profile.avatar_url || '');
      setShowOnLeaderboard(Boolean(profile.show_on_leaderboard));
    }
    setMessage(null);
  }, [isOpen, profile]);

  // 3. CONDITIONAL EARLY RETURN AFTER ALL HOOKS
  if (!isOpen) return null;

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setUploadProgress(10);
    setMessage(null);

    try {
      const res = await uploadImageToCloudinary(file, (p) => setUploadProgress(p));
      const newAvatarUrl = res.asset.cleanedUrl || res.asset.originalUrl;
      setAvatarUrl(newAvatarUrl);
      setMessage({ type: 'success', text: 'Avatar uploaded! Click Save to apply changes.' });
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      setMessage({ type: 'error', text: err.message || 'Avatar upload failed. Check Cloudinary settings.' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    if (!profile?.id) {
      setMessage({ type: 'error', text: 'No active profile ID found.' });
      setIsSaving(false);
      return;
    }

    try {
      const updated: UserProfile = {
        id: profile.id,
        full_name: fullName.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        avatar_url: avatarUrl.trim(),
        show_on_leaderboard: showOnLeaderboard,
        updated_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('profiles').upsert(updated);
        if (error) throw error;
      }

      onProfileUpdated(updated);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Save profile error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOutClick = async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Supabase sign out error:', err);
    } finally {
      onSignOut();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* Scrollable Container with max-height and flex-col for sticky footer */}
      <div className="bg-white rounded-3xl max-w-sm w-full max-h-[90vh] flex flex-col shadow-2xl border border-emerald-100 relative overflow-hidden my-auto">
        {/* Glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-100/60 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header (Sticky top) */}
        <div className="p-5 pb-3 border-b border-slate-100 relative flex items-center justify-between shrink-0 bg-white">
          <div>
            <h3 className="text-lg font-bold text-[#1C241F]">Your Eco Profile</h3>
            <p className="text-xs text-slate-500">Manage your circular identity</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Feedback Messages */}
          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Avatar with Cloudinary upload */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[#EAF7F0] border-2 border-[#2E9E6B] flex items-center justify-center shadow-md">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-[#2E9E6B]" />
                )}
              </div>

              {/* Upload trigger overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity cursor-pointer disabled:opacity-100"
                title="Change Avatar with Cloudinary"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-5 h-5 mb-0.5" />
                    <span className="text-[9px] font-semibold">Change</span>
                  </>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileSelect}
                className="hidden"
              />
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="mt-2 text-xs font-semibold text-[#2E9E6B] hover:text-[#237E55] flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploadingAvatar ? `Uploading (${uploadProgress}%)...` : 'Upload avatar photo'}</span>
            </button>
            <span className="text-[10px] text-slate-400">Processed securely via Cloudinary</span>

            {/* Trust Score & Verification Badge */}
            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
              <TrustScoreBadge breakdown={userBreakdown} size="md" />
              {userBreakdown.isVerified ? (
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2E9E6B]" />
                  <span>Verified Neighbor</span>
                </span>
              ) : (
                <span
                  className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium"
                  title="Verified Badge requires email and completed profile (Name, Neighborhood, Avatar)"
                >
                  Unverified · Complete Profile
                </span>
              )}
            </div>
          </div>

          {/* Profile Form */}
          <form id="profile-form" onSubmit={handleSaveProfile} className="space-y-3">
            {userEmail && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Email Account
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    disabled
                    value={userEmail}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 cursor-not-allowed"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Display Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B] text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Neighborhood
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="e.g. Indiranagar"
                    className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B] text-xs text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2E9E6B] text-xs text-slate-900"
                />
              </div>
            </div>

            {/* Community Leaderboard Opt-in Toggle */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="leaderboard-toggle" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Community Leaderboard
                </label>
                <input
                  id="leaderboard-toggle"
                  type="checkbox"
                  checked={showOnLeaderboard}
                  onChange={(e) => setShowOnLeaderboard(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2E9E6B] focus:ring-[#2E9E6B] accent-[#2E9E6B] cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Show my circular milestones (first name, neighborhood, and CO2 saved) on the public community leaderboard.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 px-4 rounded-xl bg-[#2E9E6B] hover:bg-[#237E55] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{isSaving ? 'Saving Changes...' : 'Save Profile'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setCurrentScreen('my-listings');
                  onClose();
                }}
                className="w-full py-2 px-3 rounded-xl border border-emerald-200 text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/70 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                <span>View & Manage My Listings</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (profile?.id) {
                    openPublicProfile(profile.id);
                  }
                }}
                className="w-full mt-2 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Preview My Public Profile</span>
              </button>

              {/* Phase 6B: Danger Zone Account Deletion */}
              <div className="mt-4 pt-3 border-t border-rose-100">
                {!isConfirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="w-full py-2 px-3 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Delete Account & Data</span>
                  </button>
                ) : (
                  <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-center space-y-2 animate-fade-in">
                    <p className="text-[11px] text-rose-800 font-medium leading-snug">
                      Permanently delete your profile, active listings, exchange requests, reviews, and circular metrics? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={async () => {
                          setIsDeleting(true);
                          try {
                            await deleteAccount();
                            onClose();
                          } catch {
                            setIsDeleting(false);
                          }
                        }}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setIsConfirmingDelete(false)}
                        className="py-1.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer (Sticky bottom with Sign Out button always visible) */}
        <div className="p-3.5 px-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[170px]" title={userEmail || fullName || 'Member'}>
            {fullName || userEmail || 'Member'}
          </span>
          <button
            type="button"
            onClick={handleSignOutClick}
            className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-rose-50 transition-colors border border-rose-200/80 bg-white shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
