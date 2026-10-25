-- SecondLife AI - Phase 3B: Request Flow Enhancements
-- Run this in the Supabase Dashboard -> SQL Editor -> New Query -> Run

-- 1. Add response_note and updated_at to requests table
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS response_note TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Expand requests.status constraint to support full lifecycle:
--    'pending', 'accepted', 'declined', 'handed_over', 'returned', 'completed', 'cancelled'
DO $$
BEGIN
  ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_status_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.requests
  ADD CONSTRAINT requests_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'handed_over', 'returned', 'completed', 'cancelled'));

-- 3. Ensure listings.status constraint includes 'reserved' and 'available'
DO $$
BEGIN
  ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_status_check
  CHECK (status IN ('active', 'available', 'reserved', 'paused', 'lent', 'donated', 'claimed', 'completed', 'archived'));

-- 4. Prevent duplicate pending requests for the same listing by the same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_request
  ON public.requests (listing_id, requester_id)
  WHERE status = 'pending';

-- 5. Additional performance indexes for Inbox queries
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON public.requests(created_at DESC);

-- 6. Update actions RLS policy to allow inserting actions for exchange partners on completion
DROP POLICY IF EXISTS "Users can insert exchange actions" ON public.actions;
CREATE POLICY "Users can insert exchange actions"
  ON public.actions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.requests r
      JOIN public.listings l ON l.id = r.listing_id
      WHERE (r.status IN ('returned', 'completed', 'handed_over'))
        AND ((r.requester_id = auth.uid() AND l.owner_id = actions.user_id)
          OR (l.owner_id = auth.uid() AND r.requester_id = actions.user_id))
    )
  );

-- 7. Stored Procedure for atomic exchange completion (Security Definer)
-- This safely creates action records for both owner and requester and updates statuses
CREATE OR REPLACE FUNCTION public.complete_exchange(
  p_request_id UUID,
  p_completed_by UUID,
  p_waste_kg NUMERIC DEFAULT 2.5,
  p_co2_kg NUMERIC DEFAULT 6.0,
  p_money_saved_inr NUMERIC DEFAULT 1000
)
RETURNS JSONB AS $$
DECLARE
  v_req RECORD;
  v_listing RECORD;
  v_new_req_status TEXT;
  v_new_listing_status TEXT;
BEGIN
  -- Fetch request
  SELECT * INTO v_req FROM public.requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- Fetch listing
  SELECT * INTO v_listing FROM public.listings WHERE id = v_req.listing_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  -- Ensure caller is owner or requester
  IF p_completed_by != v_req.requester_id AND p_completed_by != v_listing.owner_id THEN
    RAISE EXCEPTION 'Not authorized to complete this exchange';
  END IF;

  -- Determine target statuses based on listing type
  IF v_listing.type = 'borrow' THEN
    v_new_req_status := 'returned';
    v_new_listing_status := 'active'; -- available again!
  ELSE
    v_new_req_status := 'completed';
    v_new_listing_status := 'donated';
  END IF;

  -- Update request
  UPDATE public.requests
  SET status = v_new_req_status, updated_at = NOW()
  WHERE id = p_request_id;

  -- Update listing
  UPDATE public.listings
  SET status = v_new_listing_status
  WHERE id = v_listing.id;

  -- Insert action for Owner
  INSERT INTO public.actions (user_id, type, waste_kg, co2_kg, money_saved_inr)
  VALUES (
    v_listing.owner_id,
    CASE WHEN v_listing.type = 'borrow' THEN 'lent' ELSE 'donated' END,
    p_waste_kg,
    p_co2_kg,
    CASE WHEN v_listing.type = 'borrow' THEN p_money_saved_inr ELSE 0 END
  );

  -- Insert action for Requester
  INSERT INTO public.actions (user_id, type, waste_kg, co2_kg, money_saved_inr)
  VALUES (
    v_req.requester_id,
    'borrowed',
    p_waste_kg,
    p_co2_kg,
    p_money_saved_inr
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_status', v_new_req_status,
    'listing_status', v_new_listing_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
