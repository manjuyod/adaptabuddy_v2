# Database Notes

- PostgREST + Supabase RLS expected; every table must include an owner column (uuid).
- Avoid server-side secrets leaking into the client; keep Supabase keys in server-only env vars.
- Reference schema + RLS alignment SQL lives in `packages/db/sql/001_reference_schema.sql` and `packages/db/sql/002_reference_rls.sql`.
- Reference data import is generated via `packages/db/scripts/import_reference_data.py` (CSV → idempotent SQL upserts).
- Keep this file as a log of decisions and operational notes.

## Migration History

| Migration | File | Applied | Description |
|-----------|------|---------|-------------|
| 20260203175906 | 001_reference_schema.sql | 2026-02-03 | Initial reference schema (exercises, muscle_groups, programs, etc.) |
| 20260203175923 | 002_reference_rls.sql | 2026-02-03 | RLS policies for reference tables |
| 20260203180111 | 003_users_privileges.sql | 2026-02-03 | Add stats_json column, tighten user update privileges |
| 20260203180516 | 004_normalize_slugs.sql | 2026-02-03 | Normalize slug constraints across tables |
| 20260204194451 | 005_stats_json_index.sql | 2026-02-04 | GIN index on users.stats_json for JSONB query performance |
| 20260205002758 | 006_fix_rls_initplan_issues.sql | 2026-02-05 | Wrap `auth.uid()` calls in subqueries for RLS initplan performance |
| 20260205002802 | 007_add_missing_fk_index.sql | 2026-02-05 | Add missing FK index on `program_slots(program_day_id)` |
| 20260205002807 | 008_remove_duplicate_index.sql | 2026-02-05 | Remove duplicate `exercise_muscle_map` index |
| 009_workout_history_tables | 009_workout_history_tables.sql | 2026-02-14 | Add `workout_logs` and `set_logs` with RLS and indexes |
| 010_sessions_complete_atomic_rpc | 010_sessions_complete_atomic_rpc.sql | 2026-02-14 | Add transactional completion RPC and workout idempotency key |
| 011_distributed_rate_limit | 011_distributed_rate_limit.sql | 2026-02-14 | Add database-backed distributed rate-limit counters and RPC |
| 012_engine_cycle_state_tables | 012_engine_cycle_state_tables.sql | 2026-02-14 | Add normalized engine-owned cycle profiles, plans, sessions, and gamification tables |
| 013_engine_13_class_taxonomy_constraints | 013_engine_13_class_taxonomy_constraints.sql | 2026-04-07 | Backfill unsupported normalized class tokens to `NULL` and constrain class archetype columns to `strength` or `hybrid` |
| 014_class_presets | 014_class_presets.sql | 2026-04-08 | Add global `classes` catalog plus normalized `class_preset_id` persistence for initialized cycles |
| 015_engine_14_gamification_state_prep | 015_engine_14_gamification_state_prep.sql | 2026-04-13 | Add richer normalized Engine 14 gamification counters and provenance columns |
| 016_engine_14_progression_states | 016_engine_14_progression_states.sql | 2026-04-14 | Add normalized per-exercise Engine 14 progression state rows keyed by active plan and exercise |
| 017_engine_15_session_traces | 017_engine_15_session_traces.sql | 2026-04-15 | Add app-owned persisted engine trace table plus completion RPC support for Wave 4 explainability/reporting read models |
| 018_engine_24_replay_debug_input_material | 018_engine_24_replay_debug_input_material.sql | 2026-05-01 | Add redacted replay debug input material to engine traces and restrict trace/RPC evidence writes to server-owned paths |
| 019_wave_7_beta_feedback_reports | 019_wave_7_beta_feedback_reports.sql | 2026-05-02 | Add authenticated user-owned beta feedback report capture table and Wave 7 RLS-controlled support feedback persistence |
| 020_wave_7_beta_feedback_sequence_grants | 020_wave_7_beta_feedback_sequence_grants.sql | 2026-05-03 | Tighten beta feedback report identity sequence grants to authenticated users only |
| 021_wave_9_season_loop_product_shell | 021_wave_9_season_loop_product_shell.sql | 2026-05-04 | Add app-owned season summaries, awards, transitions, and advance_cycle trace support |

## users.stats_json Schema

The `stats_json` JSONB column stores the app's legacy compatibility projection for
the `@adaptabuddy/contracts` `UserStats` shape. It is not the canonical engine
state model and does not own canonical analytics summaries. For initialized
cycles, normalized engine-owned tables are canonical for active cycle identity,
cursor state, and engine-owned gamification, including richer Engine 14 counters
and provenance. Deterministic read models are canonical for derived analytics
when present. `stats_json.activeProgram` remains compatibility-only.

Engine 25 ownership matrix:

| Field family | Owner | Source of truth | Status |
|--------------|-------|-----------------|--------|
| Active program (`activeProgram`) | Engine-owned cycle state projected by app | Normalized cycle profile, plan, session, and cursor tables | Compatibility projection only; normalized cycle data wins when present |
| Preferences (`preferences`) | App-owned user settings | `users.stats_json.preferences` until separately normalized | Valid app-owned state; do not use as engine boundary schema |
| Opt-ins and settings | App-owned user settings | App-owned settings/profile persistence | Valid app-owned state when explicitly collected by the app |
| Progression summaries (`mastery`, progression rollups) | Engine/read-model derived | Normalized progression state rows and deterministic read models | Summary fallback only; prefer normalized/read-model data |
| Fatigue summaries (`fatigue`) | Engine/read-model derived | Deterministic analytics/read-model sources where available | Summary fallback only; prefer deterministic read models |
| Analytics summaries (`capacities`, `progression`, volume, adherence, dashboard rollups) | Compatibility projection of derived analytics | Deterministic analytics read models | Compatibility fallback only; deterministic analytics wins when present |
| Compatibility projection fields | App compatibility layer | Normalized cycle tables or deterministic read models that produced the projection | Temporary rollout support with explicit removal gates |

Structure (aligned with `@adaptabuddy/contracts` UserStats schema):
```jsonb
{
  "activeProgram": {
    "programId": "program_uuid",
    "startedAt": "2026-05-01T00:00:00.000Z",
    "currentDayIndex": 0,
    "currentMicrocycle": 1,
    "daysPerWeek": 4
  },
  "fatigue": {
    "muscle_slug": {
      "current": 0,
      "lastUpdated": "2026-05-01T00:00:00.000Z"
    }
  },
  "mastery": {
    "exercise_slug": {
      "score": 0,
      "totalSets": 0,
      "lastUpdated": "2026-05-01T00:00:00.000Z"
    }
  },
  "capacities": {
    "exercise_slug": {
      "estimated1RM": null,
      "lastWeight": null,
      "lastReps": null,
      "confidence": 0,
      "lastPerformed": null
    }
  },
  "progression": {
    "totalWorkouts": 0,
    "weeklyVolume": 0,
    "lastWorkoutAt": null
  },
  "preferences": {
    "fatigueLevel": "moderate",
    "equipment": [],
    "injuries": [],
    "acknowledgedRisks": [],
    "optIns": {
      "allowExtremeVolume": false,
      "volumeMultiplierCap": 1,
      "specializationMode": false,
      "specializedMuscles": [],
      "allowDailyTraining": false,
      "allowDoubleSession": false,
      "chaosBlockEnabled": false,
      "ignoreDeloadRecommendations": false,
      "recoveryOverride": "normal"
    },
    "unitSystem": "lbs",
    "theme": "system"
  }
}
```

Access control:
- Client updates blocked via column-level privileges (003_users_privileges.sql)
- Server updates only via authenticated server actions
- RLS policy `users_update_own` enforces ownership check
- GIN index enables efficient nested property queries
