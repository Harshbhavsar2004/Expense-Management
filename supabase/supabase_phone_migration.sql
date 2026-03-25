-- ── Phone Number Normalization & User ID Linking Migration ──────────────────
-- This script fixes the issue where applications and expenses submitted via WhatsApp/Cliq
-- don't get linked to users because of phone number format mismatches

-- ── 1. Enhanced Phone Normalization Function ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_phone(phone_input TEXT)
RETURNS TEXT AS $$
DECLARE
    normalized TEXT;
BEGIN
    -- Handle NULL input
    IF phone_input IS NULL OR phone_input = '' THEN
        RETURN NULL;
    END IF;

    -- Remove any whitespace
    normalized := regexp_replace(phone_input, '\s+', '', 'g');

    -- Handle cliq: prefix (remove it)
    IF normalized LIKE 'cliq:%' THEN
        normalized := substring(normalized FROM 6);
    END IF;

    -- Handle international format (+91XXXXXXXXXX -> XXXXXXXXXX)
    IF normalized LIKE '+%' THEN
        -- Remove + prefix and keep only digits
        normalized := regexp_replace(normalized, '\+', '', 'g');
    END IF;

    -- Keep only digits
    normalized := regexp_replace(normalized, '[^0-9]', '', 'g');

    -- For Indian numbers, normalize to last 10 digits
    -- This handles +91, 91, 0 prefixes and even some minor typos at the start
    IF length(normalized) >= 10 THEN
        -- If it's 10 digits and starts with 6-9, it's a mobile
        -- If it's longer and contains 10 digits suffix, we take the suffix
        RETURN right(normalized, 10);
    END IF;

    RETURN normalized;

    RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── 2. Enhanced User ID Linking Function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fill_user_id_from_phone()
RETURNS TRIGGER AS $$
DECLARE
    target_phone TEXT;
    normalized_target TEXT;
    found_user_id UUID;
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

    -- Skip if no phone number
    IF target_phone IS NULL OR target_phone = '' THEN
        RETURN NEW;
    END IF;

    -- Normalize the target phone number
    normalized_target := public.normalize_phone(target_phone);

    -- If normalization failed, try exact match as fallback
    IF normalized_target IS NULL THEN
        SELECT id INTO found_user_id
        FROM public.users
        WHERE phone = target_phone
        LIMIT 1;
    ELSE
        -- Try multiple matching strategies:

        -- 1. Exact match with normalized phone
        SELECT id INTO found_user_id
        FROM public.users
        WHERE public.normalize_phone(phone) = normalized_target
        LIMIT 1;

        -- 2. If no match, try with +91 prefix
        IF found_user_id IS NULL THEN
            SELECT id INTO found_user_id
            FROM public.users
            WHERE phone = '+91' || normalized_target
            LIMIT 1;
        END IF;

        -- 3. If still no match, try exact string match as fallback
        IF found_user_id IS NULL THEN
            SELECT id INTO found_user_id
            FROM public.users
            WHERE phone = target_phone
            LIMIT 1;
        END IF;
    END IF;

    -- Set the user_id if we found a match
    IF found_user_id IS NOT NULL THEN
        NEW.user_id := found_user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Migration Script to Fix Existing Records ──────────────────────────────
-- This will update all existing applications and expenses with NULL user_id
-- by matching against the users table using the enhanced phone matching

-- Create a temporary function to update existing records
CREATE OR REPLACE FUNCTION public.migrate_user_ids()
RETURNS TABLE(updated_applications INTEGER, updated_expenses INTEGER, updated_chat_messages INTEGER) AS $$
DECLARE
    app_count INTEGER := 0;
    exp_count INTEGER := 0;
    chat_count INTEGER := 0;
BEGIN
    -- Update applications
    UPDATE public.applications
    SET user_id = sub.id
    FROM (
        SELECT a.id as app_id, u.id
        FROM public.applications a
        CROSS JOIN public.users u
        WHERE a.user_id IS NULL
          AND a.user_phone IS NOT NULL
          AND public.normalize_phone(a.user_phone) = public.normalize_phone(u.phone)
        LIMIT 1  -- In case of multiple matches, take the first one
    ) sub
    WHERE public.applications.id = sub.app_id;

    GET DIAGNOSTICS app_count = ROW_COUNT;

    -- Update expenses
    UPDATE public.expenses
    SET user_id = sub.id
    FROM (
        SELECT e.id as exp_id, u.id
        FROM public.expenses e
        CROSS JOIN public.users u
        WHERE e.user_id IS NULL
          AND e.user_phone IS NOT NULL
          AND public.normalize_phone(e.user_phone) = public.normalize_phone(u.phone)
        LIMIT 1  -- In case of multiple matches, take the first one
    ) sub
    WHERE public.expenses.id = sub.exp_id;

    GET DIAGNOSTICS exp_count = ROW_COUNT;

    -- Update chat messages
    UPDATE public.chat_messages
    SET user_id = sub.id
    FROM (
        SELECT c.id as chat_id, u.id
        FROM public.chat_messages c
        CROSS JOIN public.users u
        WHERE c.user_id IS NULL
          AND c.phone IS NOT NULL
          AND public.normalize_phone(c.phone) = public.normalize_phone(u.phone)
        LIMIT 1  -- In case of multiple matches, take the first one
    ) sub
    WHERE public.chat_messages.id = sub.chat_id;

    GET DIAGNOSTICS chat_count = ROW_COUNT;

    -- Update receipts (inherit from parent expense)
    UPDATE public.receipts
    SET user_id = e.user_id
    FROM public.expenses e
    WHERE public.receipts.user_id IS NULL
      AND public.receipts.expense_id = e.id
      AND e.user_id IS NOT NULL;

    RETURN QUERY SELECT app_count, exp_count, chat_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Run the Migration ──────────────────────────────────────────────────────
-- Execute the migration and show results
SELECT * FROM public.migrate_user_ids();

-- ── 5. Create Indexes for Better Performance ──────────────────────────────────
-- Add indexes on normalized phone numbers for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_normalized_phone ON public.users (public.normalize_phone(phone));
CREATE INDEX IF NOT EXISTS idx_applications_normalized_phone ON public.applications (public.normalize_phone(user_phone));
CREATE INDEX IF NOT EXISTS idx_expenses_normalized_phone ON public.expenses (public.normalize_phone(user_phone));
CREATE INDEX IF NOT EXISTS idx_chat_messages_normalized_phone ON public.chat_messages (public.normalize_phone(phone));

-- ── 6. Test the Enhanced Function ─────────────────────────────────────────────
-- Test with some sample phone numbers from your data
SELECT
    phone as original_phone,
    public.normalize_phone(phone) as normalized,
    CASE
        WHEN public.normalize_phone(phone) IS NOT NULL THEN
            (SELECT id FROM public.users WHERE public.normalize_phone(users.phone) = public.normalize_phone(phone) LIMIT 1)
        ELSE NULL
    END as matched_user_id
FROM (VALUES
    ('+918600437554'),
    ('918600437554'),
    ('cliq:906876792'),
    ('+9186004375554'),
    ('+91918600437552'),
    ('7488098844')
) AS test_phones(phone);

-- ── 7. Verification Query ─────────────────────────────────────────────────────
-- Check how many records still have NULL user_id after migration
SELECT
    'applications' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_ids,
    ROUND(
        (COUNT(*) FILTER (WHERE user_id IS NULL))::numeric / NULLIF(COUNT(*), 0) * 100, 2
    ) as null_percentage
FROM public.applications

UNION ALL

SELECT
    'expenses' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_ids,
    ROUND(
        (COUNT(*) FILTER (WHERE user_id IS NULL))::numeric / NULLIF(COUNT(*), 0) * 100, 2
    ) as null_percentage
FROM public.expenses

UNION ALL

SELECT
    'chat_messages' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_ids,
    ROUND(
        (COUNT(*) FILTER (WHERE user_id IS NULL))::numeric / NULLIF(COUNT(*), 0) * 100, 2
    ) as null_percentage
FROM public.chat_messages;

-- ── 8. Create Triggers to automate User ID linking ────────────────────────────
DROP TRIGGER IF EXISTS tr_applications_fill_user_id ON public.applications;
CREATE TRIGGER tr_applications_fill_user_id
BEFORE INSERT OR UPDATE OF user_phone ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_phone();

DROP TRIGGER IF EXISTS tr_expenses_fill_user_id ON public.expenses;
CREATE TRIGGER tr_expenses_fill_user_id
BEFORE INSERT OR UPDATE OF user_phone ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_phone();

DROP TRIGGER IF EXISTS tr_chat_messages_fill_user_id ON public.chat_messages;
CREATE TRIGGER tr_chat_messages_fill_user_id
BEFORE INSERT OR UPDATE OF phone ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.fill_user_id_from_phone();

-- ── 9. Cleanup ────────────────────────────────────────────────────────────────
-- Remove the temporary migration function
DROP FUNCTION IF EXISTS public.migrate_user_ids();

-- ── Summary ───────────────────────────────────────────────────────────────────
-- This migration:
-- 1. Creates phone number normalization function
-- 2. Updates the trigger function to use smart phone matching
-- 3. Migrates existing records with NULL user_id
-- 4. Adds performance indexes
-- 5. Provides verification of the migration success
--
-- After running this, all future applications/expenses from WhatsApp/Cliq
-- will automatically get linked to the correct user accounts.