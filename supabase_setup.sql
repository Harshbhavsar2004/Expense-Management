-- ── 0. Users (RBAC & Profiles) ────────────────────────────────────────────────
CREATE TABLE public.users (
    id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT        NOT NULL UNIQUE,
    full_name   TEXT,
    avatar_url  TEXT,
    phone       TEXT        UNIQUE,
    role        TEXT        NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Trigger to automatically create a user profile when a new user signs up via auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_full_name TEXT;
  meta_avatar_url TEXT;
  meta_phone TEXT;
BEGIN
  -- Extract values from raw_user_meta_data
  meta_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'given_name',
    split_part(new.email, '@', 1)
  );
  
  meta_avatar_url := COALESCE(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    ''
  );
  
  meta_phone := COALESCE(
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'phone_number',
    NULL
  );

  INSERT INTO public.users (id, email, full_name, avatar_url, phone)
  VALUES (
    new.id,
    new.email,
    meta_full_name,
    meta_avatar_url,
    meta_phone
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    phone = COALESCE(public.users.phone, EXCLUDED.phone); -- Keep existing phone if already set
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── 0.1 Helper functions for RLS ──────────────────────────────────────────────
-- Using SECURITY DEFINER to break recursion in the 'users' table policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 0.2 ID-Linking Helper ─────────────────────────────────────────────────────
-- Automatically finds user_id for a record based on user_phone/phone
CREATE OR REPLACE FUNCTION public.fill_user_id_from_phone()
RETURNS TRIGGER AS $$
DECLARE
    target_phone TEXT;
BEGIN
    -- Determine which column to use for phone (different tables use different names)
    IF TG_TABLE_NAME = 'chat_messages' THEN
        target_phone := NEW.phone;
    ELSE
        target_phone := NEW.user_phone;
    END IF;

    -- If user_id is already set, don't overwrite it
    IF NEW.user_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Update user_id if we find a match in the users table
    SELECT id INTO NEW.user_id
    FROM public.users
    WHERE phone = target_phone
    LIMIT 1;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 0.3 Receipt User ID Helper ────────────────────────────────────────────────
-- Automatically inherits user_id from the parent expense
CREATE OR REPLACE FUNCTION public.fill_receipt_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT user_id INTO NEW.user_id
    FROM public.expenses
    WHERE id = NEW.expense_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 1. Applications ────────────────────────────────────────────────────────────
CREATE TABLE public.applications (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ DEFAULT now(),
    user_id         UUID        REFERENCES public.users(id) ON DELETE CASCADE,
    user_phone      TEXT        NOT NULL,
    application_id  TEXT        NOT NULL UNIQUE,
    client_name     TEXT,
    visit_duration  TEXT,
    city            TEXT,
    city_tier       TEXT,
    participant_count INTEGER DEFAULT 1,
    participant_details JSONB DEFAULT '[]',
    status          TEXT        DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    submitted_at    TIMESTAMPTZ
);

-- ── 2. Expenses ───────────────────────────────────────────────────────────────
CREATE TABLE public.expenses (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at              TIMESTAMPTZ DEFAULT now(),
    -- User
    user_id                 UUID        REFERENCES public.users(id) ON DELETE CASCADE,
    user_phone              TEXT        NOT NULL,
    user_name               TEXT,
    session_id              TEXT,
    -- Dates
    date_range              TEXT,
    normalized_date_range   TEXT,
    -- Application Flow
    application_id          TEXT,
    client_name             TEXT,
    visit_duration          TEXT,
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
    transaction_time    TEXT,
    status              TEXT,
    raw_description     TEXT,
    user_id             UUID        REFERENCES public.users(id) ON DELETE CASCADE
);

-- ── 3. Chat messages ──────────────────────────────────────────────────────────
CREATE TABLE public.chat_messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ DEFAULT now(),
    user_id         UUID        REFERENCES public.users(id) ON DELETE CASCADE,
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

-- ── 5. Row Level Security (SaaS Data Isolation) ─────────────────────────────
-- NOTE: RLS is disabled on these tables to allow WhatsApp bot (no user session) 
-- to save data. Data isolation is managed at the API / Application layer.
ALTER TABLE public.expenses      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications  DISABLE ROW LEVEL SECURITY;

-- User policies (Keep RLS enabled for the users table)
DROP POLICY IF EXISTS "allow_all_users" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users 
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile" ON public.users 
    FOR UPDATE USING (auth.uid() = id);

-- ── 6. Automation (Triggers) ──────────────────────────────────────────────────
-- Automate user_id population for WhatsApp entries
DROP TRIGGER IF EXISTS tr_fill_app_user_id ON public.applications;
CREATE TRIGGER tr_fill_app_user_id
    BEFORE INSERT ON public.applications
    FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_phone();

DROP TRIGGER IF EXISTS tr_fill_exp_user_id ON public.expenses;
CREATE TRIGGER tr_fill_exp_user_id
    BEFORE INSERT ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_phone();

DROP TRIGGER IF EXISTS tr_fill_chat_user_id ON public.chat_messages;
CREATE TRIGGER tr_fill_chat_user_id
    BEFORE INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_phone();

DROP TRIGGER IF EXISTS tr_fill_receipt_user_id ON public.receipts;
CREATE TRIGGER tr_fill_receipt_user_id
    BEFORE INSERT ON public.receipts
    FOR EACH ROW EXECUTE FUNCTION public.fill_receipt_user_id();


-- ── MIGRATION (Run this to fix existing records with NULL user_id) ────────────
-- UPDATE public.applications
-- SET user_id = u.id
-- FROM public.users u
-- WHERE public.applications.user_id IS NULL AND public.applications.user_phone = u.phone;

-- UPDATE public.expenses
-- SET user_id = u.id
-- FROM public.users u
-- WHERE public.expenses.user_id IS NULL AND public.expenses.user_phone = u.phone;

-- UPDATE public.chat_messages
-- SET user_id = u.id
-- FROM public.users u
-- WHERE public.chat_messages.user_id IS NULL AND public.chat_messages.phone = u.phone;

-- UPDATE public.receipts
-- SET user_id = e.user_id
-- FROM public.expenses e
-- WHERE public.receipts.user_id IS NULL AND public.receipts.expense_id = e.id;


-- ── MIGRATION (Run this if you have existing tables) ──────────────────────────
-- ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS audit_explanation TEXT;
-- ... [other columns]
-- ALTER TABLE public.expenses      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
-- ALTER TABLE public.applications  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
-- ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
