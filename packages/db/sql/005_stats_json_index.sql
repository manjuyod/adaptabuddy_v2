-- Migration: add_stats_json_gin_index
-- Created: 2026-02-04
-- Applied: 20260204194451
-- Description: Add GIN index on users.stats_json for efficient JSONB queries
-- Rollback: DROP INDEX IF EXISTS idx_users_stats_json;

-- Context:
-- The stats_json column was added in migration 003_users_privileges (20260203180111)
-- with type JSONB and default '{}'::jsonb. RLS policies already cover this column
-- via the users_update_own policy. This migration adds only the performance index.

-- UP Migration
BEGIN;

-- Create GIN index for JSONB queries on stats_json
-- This enables efficient queries on nested JSONB properties like:
--   WHERE stats_json @> '{"fatigue": {"chest": 0.5}}'
--   WHERE stats_json ? 'mastery'
--   WHERE stats_json -> 'fatigue' ->> 'quads' > '0.5'
CREATE INDEX IF NOT EXISTS idx_users_stats_json ON users USING GIN (stats_json);

COMMENT ON INDEX idx_users_stats_json IS 'GIN index for efficient JSONB queries on user workout statistics';

COMMIT;

-- DOWN Migration (for reference)
-- BEGIN;
-- DROP INDEX IF EXISTS idx_users_stats_json;
-- COMMIT;
