-- Migration: remove_duplicate_index_emm_muscle
-- Created: 2026-02-04
-- Description: Remove duplicate index emm_muscle from exercise_muscle_map table
--              Both emm_muscle and exercise_muscle_map_muscle_group_id_idx index the same column
--              Keeping exercise_muscle_map_muscle_group_id_idx as it has a clearer, more descriptive name
-- Rollback: CREATE INDEX emm_muscle ON public.exercise_muscle_map(muscle_group_id);

-- UP Migration

-- Drop the duplicate index with the less descriptive name
DROP INDEX IF EXISTS public.emm_muscle;

-- The index exercise_muscle_map_muscle_group_id_idx remains to support:
-- - Foreign key lookups from muscle_groups
-- - Queries filtering by muscle_group_id
-- - JOINs between exercise_muscle_map and muscle_groups

-- DOWN Migration (for reference)
-- CREATE INDEX emm_muscle ON public.exercise_muscle_map USING btree (muscle_group_id);
