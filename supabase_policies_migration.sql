-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: User-Specific Policy Table
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Create the policies table ─────────────────────────────────────────────

CREATE TABLE public.policies (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    -- ── User link ─────────────────────────────────────────────────────────
    user_id         UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    user_name       TEXT,       -- Auto-synced from public.users.full_name via trigger

    -- ── Meal Limits (₹ per day) ────────────────────────────────────────────
    meal_tier1_limit    NUMERIC     NOT NULL DEFAULT 900,   -- Tier I  cities
    meal_tier2_limit    NUMERIC     NOT NULL DEFAULT 700,   -- Tier II cities
    meal_tier3_limit    NUMERIC     NOT NULL DEFAULT 450,   -- Tier III cities

    -- ── Travel ────────────────────────────────────────────────────────────
    travel_allowed          BOOLEAN     NOT NULL DEFAULT true,
    travel_daily_limit      NUMERIC,    -- NULL = no cap

    -- ── Hotel ─────────────────────────────────────────────────────────────
    hotel_allowed           BOOLEAN     NOT NULL DEFAULT true,
    hotel_daily_limit       NUMERIC,    -- NULL = no cap

    -- ── General ───────────────────────────────────────────────────────────
    requires_receipt        BOOLEAN     NOT NULL DEFAULT true,
    reimbursement_cycle     TEXT        NOT NULL DEFAULT '15-25 of month',
    custom_notes            TEXT,       -- Admin can write freeform policy notes

    -- ── Status ────────────────────────────────────────────────────────────
    is_active               BOOLEAN     NOT NULL DEFAULT true
);


-- ── 2. Trigger: auto-fill user_name from public.users on INSERT ──────────────

CREATE OR REPLACE FUNCTION public.fill_policy_user_name()
RETURNS TRIGGER AS $$
BEGIN
    -- Fetch full_name from users table and fill user_name
    SELECT full_name INTO NEW.user_name
    FROM public.users
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_fill_policy_user_name ON public.policies;
CREATE TRIGGER tr_fill_policy_user_name
    BEFORE INSERT ON public.policies
    FOR EACH ROW
    WHEN (NEW.user_name IS NULL)
    EXECUTE FUNCTION public.fill_policy_user_name();


-- ── 3. Trigger: keep user_name in sync when users.full_name is updated ───────

CREATE OR REPLACE FUNCTION public.sync_policy_user_name()
RETURNS TRIGGER AS $$
BEGIN
    -- When a user's full_name changes, update all their policy records
    IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
        UPDATE public.policies
        SET user_name = NEW.full_name,
            updated_at = now()
        WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_policy_user_name ON public.users;
CREATE TRIGGER tr_sync_policy_user_name
    AFTER UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_policy_user_name();


-- ── 4. Trigger: auto-update updated_at on any change ─────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_policies_updated_at ON public.policies;
CREATE TRIGGER tr_policies_updated_at
    BEFORE UPDATE ON public.policies
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- ── 5. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_policies_user_id   ON public.policies(user_id);
CREATE INDEX IF NOT EXISTS idx_policies_is_active ON public.policies(is_active);


-- ── 6. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

-- Admins can read and write ALL policies
DROP POLICY IF EXISTS "Admins can manage all policies" ON public.policies;
CREATE POLICY "Admins can manage all policies"
    ON public.policies
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Employees can only read their own policy
DROP POLICY IF EXISTS "Employees can read own policy" ON public.policies;
CREATE POLICY "Employees can read own policy"
    ON public.policies
    FOR SELECT
    USING (auth.uid() = user_id);


-- ── 7. Seed default policies for all existing users ──────────────────────────
-- This inserts a default policy for every user that doesn't already have one.
-- Uses the global defaults from knowledgebase.md (900/700/450).

INSERT INTO public.policies (user_id, user_name)
SELECT
    u.id,
    u.full_name
FROM public.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.policies p WHERE p.user_id = u.id
);


-- ── 8. Verify ────────────────────────────────────────────────────────────────

-- Run this SELECT to confirm everything looks correct:
-- SELECT p.id, p.user_name, p.meal_tier1_limit, p.meal_tier2_limit,
--        p.meal_tier3_limit, p.travel_allowed, p.hotel_allowed, p.is_active
-- FROM public.policies p
-- ORDER BY p.user_name;
