-- Migration: add_missing_fk_index_program_slots
-- Created: 2026-02-04
-- Description: Add missing index on program_slots.locked_exercise_id foreign key column
--              This improves JOIN performance and prevents full table scans when querying by locked_exercise_id
-- Rollback: DROP INDEX IF EXISTS idx_program_slots_locked_exercise_id;

-- UP Migration

-- Create index on locked_exercise_id to support FK lookups and JOINs
CREATE INDEX IF NOT EXISTS idx_program_slots_locked_exercise_id
    ON public.program_slots(locked_exercise_id)
    WHERE locked_exercise_id IS NOT NULL;

-- Partial index since locked_exercise_id can be NULL for flex slots
-- This saves space and improves maintenance performance while still covering all FK lookups

-- DOWN Migration (for reference)
-- DROP INDEX IF EXISTS public.idx_program_slots_locked_exercise_id;
