-- SecondLife AI - Phase 2 Supabase Postgres Schema & RLS Policies
-- Run this in the Supabase Dashboard -> SQL Editor -> New Query -> Run

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  neighborhood TEXT,
  city TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LISTINGS TABLE
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('borrow', 'donate')),
  description TEXT,
  cloudinary_public_id TEXT,
  tags TEXT[] DEFAULT '{}',
  cutout_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'completed', 'archived')),
  location_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'returned')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ANALYSES TABLE
CREATE TABLE IF NOT EXISTS public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  item_data JSONB NOT NULL,
  recommended_action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('repaired', 'donated', 'borrowed', 'lent', 'repurposed')),
  waste_kg NUMERIC DEFAULT 0,
  co2_kg NUMERIC DEFAULT 0,
  money_saved_inr NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reviewee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful Performance Indexes
CREATE INDEX IF NOT EXISTS idx_listings_owner_id ON public.listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_requests_listing_id ON public.requests(listing_id);
CREATE INDEX IF NOT EXISTS idx_requests_requester_id ON public.requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_user_id ON public.actions(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews(reviewee_id);

-- Auto-create profile trigger on auth.users sign up (works with Email & Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, neighborhood, city)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      ''
    ),
    COALESCE(NEW.raw_user_meta_data->>'neighborhood', ''),
    COALESCE(NEW.raw_user_meta_data->>'city', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    avatar_url = CASE WHEN profiles.avatar_url IS NULL OR profiles.avatar_url = '' THEN EXCLUDED.avatar_url ELSE profiles.avatar_url END,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

----------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
----------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES RLS: Public read, user can update only their own profile
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. LISTINGS RLS: Public read, owners can create/update/delete their listings
DROP POLICY IF EXISTS "Listings are viewable by everyone" ON public.listings;
CREATE POLICY "Listings are viewable by everyone"
  ON public.listings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create listings" ON public.listings;
CREATE POLICY "Authenticated users can create listings"
  ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own listings" ON public.listings;
CREATE POLICY "Users can update their own listings"
  ON public.listings FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own listings" ON public.listings;
CREATE POLICY "Users can delete their own listings"
  ON public.listings FOR DELETE
  USING (auth.uid() = owner_id);

-- 3. REQUESTS RLS: Requester or listing owner can view/interact
DROP POLICY IF EXISTS "Requesters and listing owners can view requests" ON public.requests;
CREATE POLICY "Requesters and listing owners can view requests"
  ON public.requests FOR SELECT
  USING (
    auth.uid() = requester_id OR
    auth.uid() IN (SELECT owner_id FROM public.listings WHERE public.listings.id = requests.listing_id)
  );

DROP POLICY IF EXISTS "Authenticated users can create requests" ON public.requests;
CREATE POLICY "Authenticated users can create requests"
  ON public.requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Requesters and listing owners can update request status" ON public.requests;
CREATE POLICY "Requesters and listing owners can update request status"
  ON public.requests FOR UPDATE
  USING (
    auth.uid() = requester_id OR
    auth.uid() IN (SELECT owner_id FROM public.listings WHERE public.listings.id = requests.listing_id)
  );

-- 4. ANALYSES RLS: Users can only see & save their own analyses
DROP POLICY IF EXISTS "Users can view their own analyses" ON public.analyses;
CREATE POLICY "Users can view their own analyses"
  ON public.analyses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own analyses" ON public.analyses;
CREATE POLICY "Users can insert their own analyses"
  ON public.analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. ACTIONS RLS: Public read for impact/leaderboard stats, users can only insert their own
DROP POLICY IF EXISTS "Actions are viewable by everyone" ON public.actions;
CREATE POLICY "Actions are viewable by everyone"
  ON public.actions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own actions" ON public.actions;
CREATE POLICY "Users can insert their own actions"
  ON public.actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own actions" ON public.actions;
CREATE POLICY "Users can update their own actions"
  ON public.actions FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. REVIEWS RLS: Public read, authenticated users can write reviews
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their reviews" ON public.reviews;
CREATE POLICY "Users can insert their reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
CREATE POLICY "Users can update their own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);
