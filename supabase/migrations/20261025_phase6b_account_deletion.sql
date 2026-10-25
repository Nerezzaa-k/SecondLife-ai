-- SecondLife AI - Phase 6B: Account Deletion & Data Privacy
-- Migration: 20261025_phase6b_account_deletion.sql
-- Run this in the Supabase Dashboard -> SQL Editor -> New Query -> Run

-- 1. SECURE DATABASE FUNCTION FOR COMPLETE ACCOUNT DATA PURGE
-- Allows an authenticated user to permanently delete all their personal data,
-- listings, requests, reviews, analyses, reports, and profile records.
CREATE OR REPLACE FUNCTION public.delete_user_account_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Retrieve ID of currently authenticated caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Delete user reports (both submitted reports and reports regarding user listings)
  DELETE FROM public.reports WHERE reporter_id = v_user_id;
  DELETE FROM public.reports WHERE listing_id IN (
    SELECT id FROM public.listings WHERE owner_id = v_user_id
  );

  -- 2. Delete user reviews (as reviewer and reviewee)
  DELETE FROM public.reviews WHERE reviewer_id = v_user_id OR reviewee_id = v_user_id;

  -- 3. Delete user exchange requests (both outgoing and incoming for user listings)
  DELETE FROM public.requests WHERE requester_id = v_user_id;
  DELETE FROM public.requests WHERE listing_id IN (
    SELECT id FROM public.listings WHERE owner_id = v_user_id
  );

  -- 4. Delete user circular actions and Gemini vision analyses
  DELETE FROM public.actions WHERE user_id = v_user_id;
  DELETE FROM public.analyses WHERE user_id = v_user_id;

  -- 5. Delete all user listings
  DELETE FROM public.listings WHERE owner_id = v_user_id;

  -- 6. Delete user profile record
  DELETE FROM public.profiles WHERE id = v_user_id;
END;
$$;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account_data() TO authenticated;
