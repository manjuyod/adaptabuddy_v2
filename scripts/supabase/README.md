# Storage regression checks

`node --test scripts/supabase/import-remote-data.test.mjs` verifies that imports
reject nonlocal database URLs before starting any database command. The import
itself resets and replaces local data; it is not a verification command.

Legacy dump imports reset without seeding to migration `20261003091000`, replay
the old-schema dump, then apply newer migrations. This order lets the exercise
catalog migration repair imported data before validating its new constraints.
The reset, replay, and migration steps use the same checked loopback URL. Dumps
with the new exercise catalog columns require a separately reviewed import
format and are rejected before any database command.

The source-backed catalog and its validation are described in
[`docs/data/exercise-catalog-audit.md`](../../docs/data/exercise-catalog-audit.md).
Run `supabase/sql/exercise_catalog_regression.sql` after migrations and seed to
check catalog anatomy, categories, source metadata, program selection metadata,
and reference-table permissions. Its fixtures roll back.

`supabase/sql/exercise_replacement_coverage.sql` reports current home/gym
candidate coverage, including replacements for an exercise whose equipment is
unavailable. `supabase/sql/exercise_replacement_regression.sql` checks equipment
AND/OR rules, variant deduplication, tracking differences, and required anatomy
coverage; its fixtures also roll back. See
[`docs/data/exercise-replacement-coverage.md`](../../docs/data/exercise-replacement-coverage.md)
for the measured gaps and the distinction between catalog candidates and the
current runtime swap behavior.

The Rust storage integration tests are ignored by default because they insert
fixtures. Run them against a disposable migrated PostgreSQL database, never a
production database or a populated development database. These PowerShell
commands create an isolated container with temporary storage; they do not start
or reset the existing Supabase project.

```powershell
docker run --detach --rm --name adaptabuddy-storage-test `
  --publish 127.0.0.1:55432:5432 --tmpfs /var/lib/postgresql/data `
  --env POSTGRES_PASSWORD=local-audit-only postgres:16-alpine

# Wait until this reports accepting connections before continuing.
docker exec adaptabuddy-storage-test pg_isready -U postgres

# Minimal Supabase role/auth bootstrap for schema and storage tests.
@'
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
$$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
grant usage on schema auth to public;
grant execute on function auth.uid() to public;
'@ | docker exec -i adaptabuddy-storage-test psql -U postgres -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'Bootstrap failed' }

Get-ChildItem -LiteralPath 'supabase/migrations' -Filter '*.sql' |
  Sort-Object Name | ForEach-Object {
    Get-Content -LiteralPath $_.FullName -Raw |
      docker exec -i adaptabuddy-storage-test psql -U postgres -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($_.Name)" }
  }
Get-Content -LiteralPath 'supabase/seed.sql' -Raw |
  docker exec -i adaptabuddy-storage-test psql -U postgres -v ON_ERROR_STOP=1 -q
if ($LASTEXITCODE -ne 0) { throw 'Seed failed' }
Get-Content -LiteralPath 'supabase/sql/mvp_storage_regression.sql' -Raw |
  docker exec -i adaptabuddy-storage-test psql -U postgres -v ON_ERROR_STOP=1 -q
if ($LASTEXITCODE -ne 0) { throw 'SQL regression failed' }

$env:STORAGE_TEST_DATABASE_URL = 'postgresql://postgres:local-audit-only@127.0.0.1:55432/postgres'
cargo test --manifest-path backend/Cargo.toml -p storage -- --include-ignored
cargo test --manifest-path backend/Cargo.toml -p api-server --test postgres_api -- --include-ignored
cargo test --manifest-path backend/Cargo.toml -p api-server --test workout_replacements --test workout_replacement_boundaries -- --ignored --test-threads=1

# Stop only the disposable container created above when finished.
docker stop adaptabuddy-storage-test
Remove-Item Env:STORAGE_TEST_DATABASE_URL
```

Coverage includes owner relationships, RLS reads, denied direct XP writes,
anonymous completion RPC denial and server-only rate-limit RPC privileges,
optional food macros, concurrent food patches, concurrent session completion,
single XP/event awards, completed history, and transaction rollback on child
write failures. Additional suites inject event/XP failures across food, legacy
workouts, habits, body metrics, and goals, and verify selective profile patches
under concurrent updates. SQL fixtures use a transaction that rolls back. Rust tests use
random user IDs and delete their fixtures on success; failed fixtures remain
only until the disposable container stops.

This checks real PostgreSQL queries and schema behavior with a minimal auth
schema. Supabase config declares PostgreSQL 15; an already running local stack
can use a different engine version. Check `show server_version` when recording
validation results. The standalone harness above uses PostgreSQL 16.

Replacement tests additionally verify catalog-backed browsing, variant
deduplication, equipment AND/OR sets, exclusions across aliases, per-side/time/
distance prescriptions, preserved cautions, and concurrent session/swap writes.
These fixtures remain only in the disposable database; do not run them against
the populated local Supabase instance.

After catalog migrations, run `supabase/sql/exercise_catalog_regression.sql`,
`supabase/sql/exercise_replacement_regression.sql`, and
`supabase/sql/exercise_replacement_contract_regression.sql` through the same
`psql -v ON_ERROR_STOP=1` invocation. They roll back their fixtures. The read-only
`supabase/sql/exercise_replacement_contract_audit.sql` prints classifications,
raw zero/one candidate counts and every explicit coverage requirement. See
[the coverage report](../../docs/data/exercise-replacement-coverage.md) for the
acceptance definition and measured results.

## Full local Supabase verification

After starting local Supabase and applying pending local migrations, run:

```powershell
npx supabase db lint --local --fail-on warning
$localStatus = (& npx supabase status --output json 2>$null | ConvertFrom-Json)
$env:LOCAL_SUPABASE_URL = $localStatus.API_URL
$env:LOCAL_SUPABASE_DB_URL = $localStatus.DB_URL
$env:LOCAL_SUPABASE_ANON_KEY = $localStatus.ANON_KEY
$env:LOCAL_SUPABASE_SERVICE_ROLE_KEY = $localStatus.SERVICE_ROLE_KEY
$env:LOCAL_SUPABASE_JWT_SECRET = $localStatus.JWT_SECRET
try {
  node scripts/supabase/verify-local-stack.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Local Supabase verification failed' }
} finally {
  'LOCAL_SUPABASE_URL', 'LOCAL_SUPABASE_DB_URL', 'LOCAL_SUPABASE_ANON_KEY',
  'LOCAL_SUPABASE_SERVICE_ROLE_KEY', 'LOCAL_SUPABASE_JWT_SECRET' |
    ForEach-Object { Remove-Item -LiteralPath "Env:$_" -ErrorAction SilentlyContinue }
  Remove-Variable localStatus
}
```

The script rejects non-loopback destinations, creates two temporary Auth users,
checks password login and refresh, verifies PostgREST owner isolation and denied
XP/RPC writes, then passes a real access token to the Rust API integration test.
It deletes its Auth users and their data in `finally`. It does not reset the
database or print credentials. Do not point the disposable-storage tests above
at a populated local database: those tests inject temporary schema failures.

To check a running Rust container as well, set
`LOCAL_RUST_API_URL=http://127.0.0.1:3000` for the verification command. It checks
the HTTP dashboard with the refreshed Supabase token and confirms that the
server reads the same persisted food row.
