-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add `cliq_user_id` column to users table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cliq_user_id text UNIQUE;
