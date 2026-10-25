-- SecondLife AI - Phase 5A: Strengthen Cloudinary
-- Run this in the Supabase Dashboard -> SQL Editor -> New Query -> Run

-- 1. Add moderation_status to listings table
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'unmoderated';

DO $$
BEGIN
  ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_moderation_status_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_moderation_status_check
  CHECK (moderation_status IN ('approved', 'rejected', 'pending', 'unmoderated'));

-- 2. Add bandwidth optimization tracking columns to listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS original_bytes BIGINT DEFAULT 0;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS optimized_bytes BIGINT DEFAULT 0;

-- 3. Add tags array column to analyses table for matching & logging
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 4. Create Postgres GIN index on listings tags array for fast array containment/overlap queries
CREATE INDEX IF NOT EXISTS idx_listings_tags ON public.listings USING gin(tags);

-- 5. Create index on moderation_status for fast feed queries
CREATE INDEX IF NOT EXISTS idx_listings_moderation_status ON public.listings(moderation_status);

-- 6. Helper function to compute total bandwidth saved across all community items
CREATE OR REPLACE FUNCTION public.get_community_bandwidth_saved()
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(GREATEST(0, original_bytes - optimized_bytes)), 0)::BIGINT
  FROM public.listings
  WHERE original_bytes > 0 AND optimized_bytes > 0;
$$ LANGUAGE sql STABLE;
