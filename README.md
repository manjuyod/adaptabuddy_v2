# Adaptabuddy

Adaptabuddy is moving into a concrete mobile + Rust backend MVP.

The current product slice is:

```text
Kotlin Android app
        |
        v
Rust API backend
        |
        v
Supabase Auth + Postgres
```

The Rust API owns business logic, authorization decisions, user stats, food diary behavior, workout planning, workout completion, and backend-owned XP. Supabase provides Auth, Postgres, local development support, and RLS where direct table access is intentionally reviewed.

## Current Workstreams

- `backend/` is the Rust Axum modular monolith and API source of truth.
- `mobile/` is the Android-first Kotlin/Jetpack Compose mobile workstream.
- `supabase/` contains local Supabase CLI configuration, migrations, seed data, and SQL verification helpers.
- `migrations/` documents the local Supabase migration stream.
- `docs/` contains the current MVP architecture, product, API, data, and security docs.

## Canonical Docs

- Architecture overview: `docs/architecture.md`
- Backend overview: `docs/architecture/backend-overview.md`
- Service boundaries: `docs/architecture/service-boundaries.md`
- Android MVP plan: `docs/architecture/mobile-android-mvp.md`
- Security posture: `docs/security/mobile-auth-api-security.md`
- MVP scope: `docs/product/mvp-scope.md`
- Roadmap: `docs/product/roadmap.md`
- API contracts: `docs/api/api-contracts.md`
- Data model: `docs/data/data-model.md`
- Active implementation plan: `specs/overall_plan.md`

## Local Development

```bash
npm install

# Start local Supabase Auth/Postgres/Studio after installing the Supabase CLI.
make supabase-start
npx supabase status

# Run the Rust API in its own Docker container.
make api-container-build
make api-container-start
make api-container-status

# Smoke test the API from the host.
curl -fsS http://127.0.0.1:3000/api/v0/health
```

Useful URLs:

- Rust API: `http://127.0.0.1:3000`
- Supabase API: `http://127.0.0.1:54321`
- Supabase Studio: `http://127.0.0.1:54323`

Run `npx supabase status` after `make supabase-start` and copy the local anon, service-role, and JWT values into `.env`. Service-role and JWT secrets stay server-only. For Android, copy only the local anon/publishable key into `mobile/local.properties` as `SUPABASE_PUBLISHABLE_KEY`.

The API container is separate from the Supabase CLI `adaptabuddy-local` containers. Inside Docker it reaches Supabase through `host.docker.internal:54321` and Postgres through `host.docker.internal:54322`; keep those container-only values in root `.env` as `API_CONTAINER_SUPABASE_URL` and `API_CONTAINER_DATABASE_URL` if you need to override them.

Android emulator URLs use the host gateway:

- Rust API: `http://10.0.2.2:3000`
- Supabase Auth: `http://10.0.2.2:54321`

## Validation

```bash
cargo fmt --manifest-path backend/Cargo.toml --all
cargo check --manifest-path backend/Cargo.toml
cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path backend/Cargo.toml
```

`npm run check:backend` runs the complete backend gate, including a non-mutating formatting check. CI also runs Android unit tests, lint, and a debug build.

The legacy web production build requires matching `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_ANON_KEY`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` values. CI uses public build-only placeholders; deployments must provide their own public Supabase configuration.

Supabase validation after installing the CLI:

```bash
npx supabase start
npx supabase db reset
npx supabase db lint --local --fail-on warning
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/sql/verification_checklist.sql
```

## API Direction

The canonical mobile/client API namespace is `/api/v0/me/...`.

- `GET /api/v0/health`
- `GET /api/v0/me`
- `PATCH /api/v0/me/profile`
- `GET /api/v0/me/stats`
- `POST /api/v0/me/stats/body`
- `POST /api/v0/me/stats/exercise`
- `GET /api/v0/me/dashboard`
- `GET /api/v0/me/food/entries`
- `POST /api/v0/me/food/entries`
- `PATCH /api/v0/me/food/entries/:id`
- `DELETE /api/v0/me/food/entries/:id`
- `GET /api/v0/me/workouts/plan`
- `POST /api/v0/me/workouts/plan/generate`
- `GET /api/v0/me/workouts/sessions`
- `POST /api/v0/me/workouts/sessions`
- `GET /api/v0/me/workouts/sessions/:id`
- `PATCH /api/v0/me/workouts/sessions/:id`
- `POST /api/v0/me/workouts/sessions/:id/finish`

Mobile clients authenticate with Supabase Auth, then call the Rust API with the Supabase access JWT. Do not place service-role keys, JWT secrets, database passwords, webhook secrets, or admin credentials in mobile clients.
