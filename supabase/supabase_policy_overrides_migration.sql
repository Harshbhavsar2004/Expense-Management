-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Temporary Policy Overrides
-- Safe to run — only ADDs columns and creates new views/functions.
-- Run AFTER supabase_policies_migration.sql
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Add temporary override columns to public.policies ─────────────────────
--
-- Logic:
--   • Base columns (meal_tier1_limit etc.) = permanent default for this user
--   • Override columns = temporary values set by admin for a date window
--   • override_valid_from / override_valid_until = the active window
--   • When now() is OUTSIDE the window → effective policy = base values
--   • When now() is INSIDE  the window → effective policy = override values
--   • Admin clears override by setting override_valid_until = NULL or a past date

ALTER TABLE public.policies
    ADD COLUMN IF NOT EXISTS override_meal_tier1_limit    NUMERIC,
    ADD COLUMN IF NOT EXISTS override_meal_tier2_limit    NUMERIC,
    ADD COLUMN IF NOT EXISTS override_meal_tier3_limit    NUMERIC,
    ADD COLUMN IF NOT EXISTS override_travel_daily_limit  NUMERIC,
    ADD COLUMN IF NOT EXISTS override_hotel_daily_limit   NUMERIC,
    ADD COLUMN IF NOT EXISTS override_valid_from          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS override_valid_until         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS override_reason              TEXT,
    ADD COLUMN IF NOT EXISTS override_set_by              UUID REFERENCES public.users(id) ON DELETE SET NULL;


-- ── 2. Computed view: effective_policies ─────────────────────────────────────
--
-- Always returns the CORRECT values for right now.
-- If a temporary override is active → returns override values.
-- Otherwise → returns base (permanent) values.
-- Frontend and audit agent should query THIS view, not policies directly.

CREATE OR REPLACE VIEW public.effective_policies AS
SELECT
    p.id,
    p.user_id,
    p.user_name,

    -- ── Is an override currently active? ──────────────────────────────────
    (
        p.override_valid_from  IS NOT NULL AND
        p.override_valid_until IS NOT NULL AND
        now() >= p.override_valid_from AND
        now() <= p.override_valid_until
    ) AS has_active_override,

    -- ── Override window info ───────────────────────────────────────────────
    p.override_valid_from,
    p.override_valid_until,
    p.override_reason,
    p.override_set_by,

    -- ── Effective meal limits ──────────────────────────────────────────────
    CASE
        WHEN p.override_valid_from IS NOT NULL
             AND p.override_valid_until IS NOT NULL
             AND now() >= p.override_valid_from
             AND now() <= p.override_valid_until
             AND p.override_meal_tier1_limit IS NOT NULL
        THEN p.override_meal_tier1_limit
        ELSE p.meal_tier1_limit
    END AS effective_meal_tier1_limit,

    CASE
        WHEN p.override_valid_from IS NOT NULL
             AND p.override_valid_until IS NOT NULL
             AND now() >= p.override_valid_from
             AND now() <= p.override_valid_until
             AND p.override_meal_tier2_limit IS NOT NULL
        THEN p.override_meal_tier2_limit
        ELSE p.meal_tier2_limit
    END AS effective_meal_tier2_limit,

    CASE
        WHEN p.override_valid_from IS NOT NULL
             AND p.override_valid_until IS NOT NULL
             AND now() >= p.override_valid_from
             AND now() <= p.override_valid_until
             AND p.override_meal_tier3_limit IS NOT NULL
        THEN p.override_meal_tier3_limit
        ELSE p.meal_tier3_limit
    END AS effective_meal_tier3_limit,

    -- ── Effective travel limit ─────────────────────────────────────────────
    CASE
        WHEN p.override_valid_from IS NOT NULL
             AND p.override_valid_until IS NOT NULL
             AND now() >= p.override_valid_from
             AND now() <= p.override_valid_until
             AND p.override_travel_daily_limit IS NOT NULL
        THEN p.override_travel_daily_limit
        ELSE p.travel_daily_limit
    END AS effective_travel_daily_limit,

    -- ── Effective hotel limit ──────────────────────────────────────────────
    CASE
        WHEN p.override_valid_from IS NOT NULL
             AND p.override_valid_until IS NOT NULL
             AND now() >= p.override_valid_from
             AND now() <= p.override_valid_until
             AND p.override_hotel_daily_limit IS NOT NULL
        THEN p.override_hotel_daily_limit
        ELSE p.hotel_daily_limit
    END AS effective_hotel_daily_limit,

    -- ── Base (permanent) values always visible ─────────────────────────────
    p.meal_tier1_limit       AS base_meal_tier1_limit,
    p.meal_tier2_limit       AS base_meal_tier2_limit,
    p.meal_tier3_limit       AS base_meal_tier3_limit,
    p.travel_daily_limit     AS base_travel_daily_limit,
    p.hotel_daily_limit      AS base_hotel_daily_limit,

    -- ── Other policy flags ─────────────────────────────────────────────────
    p.travel_allowed,
    p.hotel_allowed,
    p.requires_receipt,
    p.reimbursement_cycle,
    p.custom_notes,
    p.is_active,
    p.created_at,
    p.updated_at

FROM public.policies p;


-- ── 3. Helper function: get_effective_policy(user_id) ────────────────────────
--
-- Called by the audit agent or backend to fetch the live policy for a user.
-- Returns a single row from effective_policies.

CREATE OR REPLACE FUNCTION public.get_effective_policy(p_user_id UUID)
RETURNS TABLE (
    user_id                   UUID,
    user_name                 TEXT,
    has_active_override       BOOLEAN,
    override_valid_from       TIMESTAMPTZ,
    override_valid_until      TIMESTAMPTZ,
    override_reason           TEXT,
    effective_meal_tier1_limit NUMERIC,
    effective_meal_tier2_limit NUMERIC,
    effective_meal_tier3_limit NUMERIC,
    effective_travel_daily_limit NUMERIC,
    effective_hotel_daily_limit  NUMERIC,
    travel_allowed            BOOLEAN,
    hotel_allowed             BOOLEAN,
    requires_receipt          BOOLEAN,
    reimbursement_cycle       TEXT,
    custom_notes              TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        ep.user_id,
        ep.user_name,
        ep.has_active_override,
        ep.override_valid_from,
        ep.override_valid_until,
        ep.override_reason,
        ep.effective_meal_tier1_limit,
        ep.effective_meal_tier2_limit,
        ep.effective_meal_tier3_limit,
        ep.effective_travel_daily_limit,
        ep.effective_hotel_daily_limit,
        ep.travel_allowed,
        ep.hotel_allowed,
        ep.requires_receipt,
        ep.reimbursement_cycle,
        ep.custom_notes
    FROM public.effective_policies ep
    WHERE ep.user_id = p_user_id
    LIMIT 1;
$$;


-- ── 4. Helper function: set_temporary_override (called by admin) ──────────────
--
-- Admin calls this to set a temporary policy for a user.
-- Example:
--   SELECT public.set_temporary_override(
--       '<employee_user_id>',
--       '<admin_user_id>',
--       1200, 900, 600,         -- override meal limits
--       NULL, NULL,             -- override travel/hotel limits (NULL = keep base)
--       now(),                  -- valid from today
--       now() + interval '15 days',
--       'Conference in Mumbai – higher meal allowance'
--   );

CREATE OR REPLACE FUNCTION public.set_temporary_override(
    p_user_id               UUID,
    p_set_by                UUID,
    p_meal_tier1            NUMERIC DEFAULT NULL,
    p_meal_tier2            NUMERIC DEFAULT NULL,
    p_meal_tier3            NUMERIC DEFAULT NULL,
    p_travel_limit          NUMERIC DEFAULT NULL,
    p_hotel_limit           NUMERIC DEFAULT NULL,
    p_valid_from            TIMESTAMPTZ DEFAULT now(),
    p_valid_until           TIMESTAMPTZ DEFAULT (now() + interval '15 days'),
    p_reason                TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.policies
    SET
        override_meal_tier1_limit   = p_meal_tier1,
        override_meal_tier2_limit   = p_meal_tier2,
        override_meal_tier3_limit   = p_meal_tier3,
        override_travel_daily_limit = p_travel_limit,
        override_hotel_daily_limit  = p_hotel_limit,
        override_valid_from         = p_valid_from,
        override_valid_until        = p_valid_until,
        override_reason             = p_reason,
        override_set_by             = p_set_by,
        updated_at                  = now()
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No policy found for user_id: %', p_user_id;
    END IF;
END;
$$;


-- ── 5. Helper function: clear_override (revert to default immediately) ────────
--
-- Admin can clear a temporary override before it expires.
-- SELECT public.clear_override('<employee_user_id>');

CREATE OR REPLACE FUNCTION public.clear_override(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.policies
    SET
        override_meal_tier1_limit   = NULL,
        override_meal_tier2_limit   = NULL,
        override_meal_tier3_limit   = NULL,
        override_travel_daily_limit = NULL,
        override_hotel_daily_limit  = NULL,
        override_valid_from         = NULL,
        override_valid_until        = NULL,
        override_reason             = NULL,
        override_set_by             = NULL,
        updated_at                  = now()
    WHERE user_id = p_user_id;
END;
$$;


-- ── 6. Verify ────────────────────────────────────────────────────────────────

-- After running, check the view works:
-- SELECT user_name, has_active_override,
--        effective_meal_tier1_limit, effective_meal_tier2_limit, effective_meal_tier3_limit,
--        override_valid_from, override_valid_until, override_reason
-- FROM public.effective_policies
-- ORDER BY user_name;
