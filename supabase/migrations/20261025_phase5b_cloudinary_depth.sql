-- SecondLife AI - Phase 5B: More Cloudinary Depth
-- Run this in the Supabase Dashboard -> SQL Editor -> New Query -> Run

-- 1. Add phash (perceptual hash) and video_public_id to listings table
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS phash TEXT,
  ADD COLUMN IF NOT EXISTS video_public_id TEXT;

-- 2. Add after_public_id to actions table for verified repair before/after tracking
ALTER TABLE public.actions
  ADD COLUMN IF NOT EXISTS after_public_id TEXT;

-- 3. Indexes for fast lookup on perceptual hash and condition videos
CREATE INDEX IF NOT EXISTS idx_listings_phash
  ON public.listings(phash)
  WHERE phash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_video_public_id
  ON public.listings(video_public_id)
  WHERE video_public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_actions_after_public_id
  ON public.actions(after_public_id)
  WHERE after_public_id IS NOT NULL;
