ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS audit_sources       JSONB;

-- reimbursable_amount: the capped amount this expense will actually be reimbursed
-- Set by audit agent: min(claimed, policy_limit). Blocking tags (failed/duplicate) → 0.
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS reimbursable_amount NUMERIC;

-- status + submitted_at on applications (may be missing if table was created early)
ALTER TABLE public.applications
    ADD COLUMN IF NOT EXISTS status              TEXT        DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS submitted_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_claimed       NUMERIC     DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reimbursable_amount NUMERIC     DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reimbursable_count  INTEGER     DEFAULT 0,
    ADD COLUMN IF NOT EXISTS flagged_count       INTEGER     DEFAULT 0;

-- Add CHECK constraint only if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'applications_status_check'
    ) THEN
        ALTER TABLE public.applications
            ADD CONSTRAINT applications_status_check
            CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));
    END IF;
END $$;


-- ── 2. check_utr_duplicate ───────────────────────────────────────────────────
--    Called by the audit agent with the anon key.
--    SECURITY DEFINER = runs as DB owner, bypasses RLS completely.
--    Searches ALL users' receipts — anon key cannot do this directly.
--
--    Usage:
--      POST /rest/v1/rpc/check_utr_duplicate
--      {"p_utr_number": "4201234567891", "p_current_expense_id": "uuid-here"}

CREATE OR REPLACE FUNCTION public.check_utr_duplicate(
    p_utr_number          TEXT,
    p_current_expense_id  UUID
)
RETURNS TABLE (
    is_duplicate         BOOLEAN,
    existing_expense_id  UUID,
    existing_created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        TRUE::BOOLEAN           AS is_duplicate,
        r.expense_id            AS existing_expense_id,
        e.created_at            AS existing_created_at
    FROM public.receipts r
    JOIN public.expenses e ON e.id = r.expense_id
    WHERE r.utr_number = p_utr_number
      AND r.expense_id IS DISTINCT FROM p_current_expense_id
    LIMIT 1;

    -- If the query returned nothing, emit a "no duplicate" row
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT FALSE::BOOLEAN, NULL::UUID, NULL::TIMESTAMPTZ;
    END IF;
END;
$$;


-- ── 3. Grant execute to anon and authenticated roles ─────────────────────────
GRANT EXECUTE ON FUNCTION public.check_utr_duplicate(TEXT, UUID)
    TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_effective_policy(UUID)
    TO anon, authenticated;


-- ── Verify ───────────────────────────────────────────────────────────────────
-- SELECT * FROM public.check_utr_duplicate('TEST_UTR', gen_random_uuid());
