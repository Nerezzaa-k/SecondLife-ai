-- Phase 4: Real Impact, Community Leaderboard & Badges
-- Migration: 20261025_phase4_real_impact.sql

-- 1. Add show_on_leaderboard opt-in toggle to profiles (default false)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS show_on_leaderboard BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_leaderboard ON public.profiles(show_on_leaderboard);

-- 2. Add item metadata, photos and source tracking to actions
ALTER TABLE public.actions
ADD COLUMN IF NOT EXISTS estimate_source TEXT DEFAULT 'gemini' CHECK (estimate_source IN ('gemini', 'category_default')),
ADD COLUMN IF NOT EXISTS item_name TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS before_image_url TEXT,
ADD COLUMN IF NOT EXISTS after_image_url TEXT,
ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_actions_user_type ON public.actions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_actions_created_at ON public.actions(created_at);

-- 3. Security Definer Function for Community Leaderboard
-- Exposes ONLY opt-in users, returning split first name, approximate area, and real aggregated stats
-- Runs with elevated definer privilege so RLS on actions table is preserved without exposing raw private rows
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

-- Security Definer View wrapping the safe function
CREATE OR REPLACE VIEW public.community_leaderboard AS
SELECT * FROM public.get_community_leaderboard();

GRANT SELECT ON public.community_leaderboard TO anon, authenticated;

-- 4. Security Definer Function for Community Totals Banner
-- Computes aggregated totals across opted-in users without exposing private rows
CREATE OR REPLACE FUNCTION public.get_community_impact_totals()
RETURNS TABLE (
  total_items_reused BIGINT,
  total_waste_kg NUMERIC,
  total_co2_kg NUMERIC,
  active_members BIGINT
) 
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COALESCE(COUNT(a.id), 0)::BIGINT AS total_items_reused,
    COALESCE(ROUND(SUM(a.waste_kg)::numeric, 1), 0) AS total_waste_kg,
    COALESCE(ROUND(SUM(a.co2_kg)::numeric, 1), 0) AS total_co2_kg,
    COALESCE(COUNT(DISTINCT p.id), 0)::BIGINT AS active_members
  FROM public.profiles p
  LEFT JOIN public.actions a ON a.user_id = p.id
  WHERE p.show_on_leaderboard = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_impact_totals() TO anon, authenticated;
