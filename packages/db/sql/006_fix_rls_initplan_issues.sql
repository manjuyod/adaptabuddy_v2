-- Migration: fix_rls_initplan_issues
-- Created: 2026-02-04
-- Description: Fix RLS initplan issues on users table by wrapping auth.uid() calls in subqueries
--              This prevents re-evaluation of auth.uid() for each row, improving query performance
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- Rollback: Re-create policies using auth.uid() directly instead of (select auth.uid())

-- UP Migration

-- Drop existing policies
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;

-- Recreate policies with subquery-wrapped auth.uid() to avoid initplan re-evaluation
CREATE POLICY users_select_own ON public.users
    FOR SELECT
    USING ((select auth.uid()) = id);

CREATE POLICY users_insert_own ON public.users
    FOR INSERT
    WITH CHECK ((select auth.uid()) = id);

CREATE POLICY users_update_own ON public.users
    FOR UPDATE
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

-- DOWN Migration (for reference)
-- DROP POLICY IF EXISTS users_select_own ON public.users;
-- DROP POLICY IF EXISTS users_insert_own ON public.users;
-- DROP POLICY IF EXISTS users_update_own ON public.users;
--
-- CREATE POLICY users_select_own ON public.users
--     FOR SELECT
--     USING (auth.uid() = id);
--
-- CREATE POLICY users_insert_own ON public.users
--     FOR INSERT
--     WITH CHECK (auth.uid() = id);
--
-- CREATE POLICY users_update_own ON public.users
--     FOR UPDATE
--     USING (auth.uid() = id)
--     WITH CHECK (auth.uid() = id);
