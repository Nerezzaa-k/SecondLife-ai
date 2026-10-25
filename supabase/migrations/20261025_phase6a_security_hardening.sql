-- SecondLife AI - Phase 6A: Security Hardening & Privacy Protection
-- Migration: 20261025_phase6a_security_hardening.sql
-- Run this in the Supabase Dashboard -> SQL Editor -> New Query -> Run

-- 1. RESTRICT ACTIONS TABLE RLS
-- Previously, "Actions are viewable by everyone" allowed querying raw individual user action rows.
-- Restrict raw row-level SELECT to only the authenticated user who created the action.
DROP POLICY IF EXISTS "Actions are viewable by everyone" ON public.actions;
DROP POLICY IF EXISTS "Users can view their own actions" ON public.actions;

CREATE POLICY "Users can view their own actions"
  ON public.actions FOR SELECT
  USING (auth.uid() = user_id);

-- 2. HARDEN REPORTS TABLE RLS
-- Ensure reports can only be read and created by the reporter
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;
CREATE POLICY "Users can insert their own reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- 3. ENSURE LEADERBOARD PRIVACY
-- Verify the security definer function only exposes opted-in users (show_on_leaderboard = true)
-- Hides full surname (uses split_part for first name) and aggregates metrics
CREATE OR REPLACE FUNCTION public.get_community_leaderboard()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  neighborhood TEXT,
  avatar_url TEXT,
  items_reused INT,
  waste_saved_kg NUMERIC,
  co2_saved_kg NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id AS user_id,
    COALESCE(NULLIF(split_part(TRIM(p.full_name), ' ', 1), ''), 'Neighbor') AS first_name,
    COALESCE(NULLIF(TRIM(p.neighborhood), ''), NULLIF(TRIM(p.city), ''), 'Local Circle') AS neighborhood,
    COALESCE(p.avatar_url, '') AS avatar_url,
    COUNT(a.id)::int AS items_reused,
    COALESCE(ROUND(SUM(a.waste_kg)::numeric, 1), 0) AS waste_saved_kg,
    COALESCE(ROUND(SUM(a.co2_kg)::numeric, 1), 0) AS co2_saved_kg
  FROM public.profiles p
  LEFT JOIN public.actions a ON a.user_id = p.id
  WHERE p.show_on_leaderboard = true
  GROUP BY p.id, p.full_name, p.neighborhood, p.city, p.avatar_url
  ORDER BY co2_saved_kg DESC, waste_saved_kg DESC, items_reused DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_leaderboard() TO anon, authenticated;

-- Refresh the view wrapping the function
CREATE OR REPLACE VIEW public.community_leaderboard AS
SELECT * FROM public.get_community_leaderboard();

GRANT SELECT ON public.community_leaderboard TO anon, authenticated;

-- 4. HARDEN AGGREGATED RATING STATS VIEW
-- profile_rating_stats only exposes user_id, avg_rating, and review_count (no private details)
CREATE OR REPLACE VIEW public.profile_rating_stats AS
SELECT
  reviewee_id AS user_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(id) AS review_count
FROM public.reviews
GROUP BY reviewee_id;

GRANT SELECT ON public.profile_rating_stats TO anon, authenticated;
