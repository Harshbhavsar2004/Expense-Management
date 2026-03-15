-- ─────────────────────────────────────────────────────────────────────────────
-- FRISTINE INFOTECH — EXPENSE TRACKER DATABASE SCHEMA
-- Run this in your Supabase SQL Editor → New Query → Run (Ctrl+Enter)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop tables if re-running (safe — CASCADE removes dependent rows)
DROP TABLE IF EXISTS public.receipts  CASCADE;
DROP TABLE IF EXISTS public.expenses  CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;

-- ── 1. Expenses ───────────────────────────────────────────────────────────────
CREATE TABLE public.expenses (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at              TIMESTAMPTZ DEFAULT now(),
    -- User
    user_phone              TEXT        NOT NULL,
    user_name               TEXT,
    session_id              TEXT,
    -- Dates
    date_range              TEXT,
    normalized_date_range   TEXT,
    -- Category
    expense_type            TEXT,
    sub_category            TEXT,
    -- Amount
    claimed_amount          TEXT,
    claimed_amount_numeric  NUMERIC,
    -- Participants
    participant_type        TEXT,
    participant_count       INTEGER,
    participant_names       TEXT[],
    -- Verification
    verified                BOOLEAN     DEFAULT false,
    verified_at             TIMESTAMPTZ,
    mismatches              TEXT[]      DEFAULT '{}',
    -- Receipt totals
    total_receipt_amount    NUMERIC     DEFAULT 0,
    amount_match            BOOLEAN     DEFAULT false,
    date_match              BOOLEAN     DEFAULT false,
    audit_explanation       TEXT,
    audit_timeline          TEXT[],
    city                    TEXT,
    city_tier               TEXT
);

-- ── 2. Receipts ───────────────────────────────────────────────────────────────
CREATE TABLE public.receipts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ DEFAULT now(),
    expense_id          UUID        REFERENCES public.expenses(id) ON DELETE CASCADE,
    media_id            TEXT,
    extracted_amount    TEXT,
    utr_number          TEXT,
    transaction_id      TEXT,
    payment_method      TEXT,
    merchant            TEXT,
    transaction_date    TEXT,
    status              TEXT,
    raw_description     TEXT
);

-- ── 3. Chat messages ──────────────────────────────────────────────────────────
CREATE TABLE public.chat_messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ DEFAULT now(),
    phone           TEXT        NOT NULL,
    role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT        NOT NULL,
    message_type    TEXT        DEFAULT 'text',
    media_id        TEXT,
    image_analysis  JSONB
);

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX idx_expenses_phone      ON public.expenses(user_phone);
CREATE INDEX idx_expenses_created_at ON public.expenses(created_at DESC);
CREATE INDEX idx_receipts_expense_id ON public.receipts(expense_id);
CREATE INDEX idx_chat_phone          ON public.chat_messages(phone);
CREATE INDEX idx_chat_created_at     ON public.chat_messages(created_at DESC);

-- ── 5. Row Level Security (permissive for development) ────────────────────────
ALTER TABLE public.expenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_expenses"      ON public.expenses      FOR ALL USING (true);
CREATE POLICY "allow_all_receipts"      ON public.receipts      FOR ALL USING (true);
CREATE POLICY "allow_all_chat_messages" ON public.chat_messages FOR ALL USING (true);

-- ── MIGRATION (Run this if you have existing tables) ──────────────────────────
-- ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS audit_explanation TEXT;
-- ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS audit_timeline    TEXT[];
-- ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS city              TEXT;
-- ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS city_tier         TEXT;