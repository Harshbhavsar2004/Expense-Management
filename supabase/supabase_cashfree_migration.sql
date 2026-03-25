-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Cashfree Payouts Integration
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Payout configuration table (single-row admin settings)
CREATE TABLE IF NOT EXISTS public.payout_config (
  id              integer PRIMARY KEY DEFAULT 1,
  auto_payout_enabled boolean NOT NULL DEFAULT false,
  fixed_amount    numeric  NOT NULL DEFAULT 5000,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
-- Seed the single config row
INSERT INTO public.payout_config (id, auto_payout_enabled, fixed_amount)
VALUES (1, false, 5000)
ON CONFLICT (id) DO NOTHING;

-- 2. Bank details on users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc           text,
  ADD COLUMN IF NOT EXISTS bank_account_name   text,
  ADD COLUMN IF NOT EXISTS cashfree_bene_id    text,
  ADD COLUMN IF NOT EXISTS bank_verified       boolean DEFAULT false;

-- 3. Payout tracking on applications table
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS cashfree_transfer_id text,
  ADD COLUMN IF NOT EXISTS payout_status        text,         -- PENDING | SUCCESS | FAILURE | REVERSED
  ADD COLUMN IF NOT EXISTS payout_initiated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS payout_completed_at  timestamptz;
