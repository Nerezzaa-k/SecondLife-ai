-- SecondLife AI - Phase 3C: Reviews, Trust, and Reports
-- Run this in the Supabase Dashboard -> SQL Editor -> New Query -> Run

-- 1. Add request_id to public.reviews to link review to specific exchange
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE;

-- 2. Enforce one review per person per exchange
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_review_per_exchange
  ON public.reviews(request_id, reviewer_id)
  WHERE request_id IS NOT NULL;

-- 3. Performance indexes for reviews
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_request_id ON public.reviews(request_id);

-- 4. Create REPORTS Table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reports
CREATE INDEX IF NOT EXISTS idx_reports_listing_id ON public.reports(listing_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);

-- 5. Row Level Security for REPORTS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;
CREATE POLICY "Users can insert their own reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- 6. Helper View / Aggregation for User Ratings & Trust
CREATE OR REPLACE VIEW public.profile_rating_stats AS
SELECT
  reviewee_id AS user_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(id) AS review_count
FROM public.reviews
GROUP BY reviewee_id;
