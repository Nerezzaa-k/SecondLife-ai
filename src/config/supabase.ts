import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// Environment variables for Supabase (client-safe anon key)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-project') &&
    !supabaseAnonKey.includes('your-anon-key')
  );
};

// Fallback dummy URL and key to prevent createClient throwing on initialization when unconfigured
const effectiveUrl = isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co';
const effectiveKey = isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase: SupabaseClient = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface UserProfile {
  id: string;
  full_name: string | null;
  neighborhood: string | null;
  city: string | null;
  avatar_url: string | null;
  show_on_leaderboard?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbAction {
  id: string;
  user_id: string;
  type: 'repaired' | 'donated' | 'borrowed' | 'lent' | 'repurposed';
  waste_kg: number;
  co2_kg: number;
  money_saved_inr: number;
  estimate_source?: 'gemini' | 'category_default';
  item_name?: string | null;
  category?: string | null;
  before_image_url?: string | null;
  after_image_url?: string | null;
  listing_id?: string | null;
  created_at: string;
}

export interface DbListing {
  id: string;
  owner_id: string;
  title: string;
  category: string;
  condition: string;
  type: 'borrow' | 'donate';
  description: string | null;
  cloudinary_public_id: string | null;
  tags: string[];
  cutout_url: string | null;
  borrow_duration?: string | null;
  status: 'active' | 'available' | 'reserved' | 'paused' | 'lent' | 'donated' | 'claimed' | 'completed' | 'archived';
  location_label: string | null;
  created_at: string;
}

export interface DbRequest {
  id: string;
  listing_id: string;
  requester_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'handed_over' | 'returned' | 'completed' | 'cancelled';
  message: string | null;
  response_note?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface DbAction {
  id: string;
  user_id: string;
  type: 'repaired' | 'donated' | 'borrowed' | 'lent' | 'repurposed';
  waste_kg: number;
  co2_kg: number;
  money_saved_inr: number;
  created_at: string;
}

export interface DbAnalysis {
  id: string;
  user_id: string;
  item_data: any;
  recommended_action: string | null;
  created_at: string;
}

export interface DbReview {
  id: string;
  request_id?: string | null;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface DbReport {
  id: string;
  reporter_id: string;
  listing_id: string;
  reason: string;
  details?: string | null;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
  created_at: string;
}
