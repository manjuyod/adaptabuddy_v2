# Database Migrations

Supabase CLI migrations live in `supabase/migrations/`.

The current local migration stream is:

- `20260612032017_remote_baseline.sql` establishes the local schema baseline.
- `20260612033000_health_ecosystem_events.sql` adds health ecosystem events and supporting RLS policies.
- `20260620090000_mobile_rust_backend_mvp.sql` adds the mobile/Rust backend MVP fields and tables for BMR inputs, food metadata/macros, exercise stats, muscle group stats, XP events, workout plans, workout days, planned exercises, and session exercise completion.

Use these commands for local reset and migration validation:

```bash
npx supabase start
npx supabase db reset
npx supabase db lint --local --fail-on warning
```

The checklist query file is intentionally outside the migration stream at `supabase/sql/verification_checklist.sql`.

Remote pulls are read-only by default:

```bash
make supabase-link
make supabase-pull-schema
make supabase-pull-data
make supabase-import-remote-data
```

Raw remote data dumps are written to ignored files such as `supabase/seed.remote.sql`. Those dumps can contain auth users, sessions, refresh tokens, or real user data and must not be committed. Keep only sanitized reference/catalog seed data in `supabase/seed.sql`.
