-- SecondLife AI - Phase 3A: Real Listings Enhancements
-- Run this in the Supabase Dashboard -> SQL Editor -> New Query -> Run

-- 1. Add borrow_duration to listings table for sharing/borrow periods
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS borrow_duration TEXT;

-- 2. Expand status column check constraint to support lifecycle transitions:
--    'active', 'paused', 'lent', 'donated', 'claimed', 'completed', 'archived'
DO $$
BEGIN
  ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_status_check
  CHECK (status IN ('active', 'paused', 'lent', 'donated', 'claimed', 'completed', 'archived'));

-- 3. Add index on owner_id and status for fast My Listings queries
CREATE INDEX IF NOT EXISTS idx_listings_owner_status ON public.listings(owner_id, status);
