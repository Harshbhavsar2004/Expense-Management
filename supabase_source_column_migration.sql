-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add `source` column to applications table
-- Values: 'web' | 'whatsapp' | 'cliq'
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web';

ALTER TABLE public.applications
  ADD CONSTRAINT applications_source_check
  CHECK (source IN ('web', 'whatsapp', 'cliq'));

-- Backfill existing rows:
--   user_phone LIKE 'cliq:%'  → cliq       (Zoho Cliq bot)
--   user_id IS NULL           → whatsapp   (WhatsApp bot — no authenticated user)
--   user_id IS NOT NULL       → web        (web app / Audit AI)
UPDATE public.applications
SET source = CASE
  WHEN user_phone LIKE 'cliq:%' THEN 'cliq'
  WHEN user_id IS NULL THEN 'whatsapp'
  ELSE 'web'
END;
