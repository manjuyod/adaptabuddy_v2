# Backend

`backend/` is the Rust modular monolith for Adaptabuddy. It owns the mobile MVP API, health data, progression state, event history, and client-facing projections.

## Layout

```text
apps/api-server/       Axum HTTP API binary
crates/core-domain/    IDs, timestamps, event primitives
crates/shared-types/   API DTOs
crates/auth/           Supabase/local JWT session extraction
crates/storage/        Postgres repository and in-memory test store
crates/events/         Append-only health-event service
crates/workouts/       Workout sessions and history
crates/nutrition/      Food logs and targets
crates/habits/         Habit definitions and check-ins
crates/body-metrics/   Body metric entries
crates/goals/          Goal lifecycle
crates/progression/    XP, levels, and streak derivation
crates/achievements/   Achievement derivation
crates/analytics/      Dashboard composition
```

Domains are crates/modules, not runtime services. `apps/api-server` is the single deployable API service.

## Run

```bash
cargo run --manifest-path backend/Cargo.toml -p api-server
```

The API listens on `API_BIND_ADDR` or `0.0.0.0:3000`.

Host runs load `.env` from the working directory or its parents, while preserving exported environment variables. Configure `DATABASE_URL` for durable storage; startup warns when it falls back to memory.

For the containerized local workflow, keep Supabase running through the Supabase CLI and start only the Rust API with Compose:

```bash
make supabase-start
npx supabase status
make api-container-build
make api-container-start
curl -fsS http://127.0.0.1:3000/api/v0/health
```

## Test

```bash
cargo fmt --manifest-path backend/Cargo.toml --all
cargo check --manifest-path backend/Cargo.toml
cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path backend/Cargo.toml
```

## Auth

The API accepts Supabase access tokens from `Authorization: Bearer <token>` or the `sb-access-token` cookie. Android clients should use the bearer-token path. Local development can use `ALLOW_LOCAL_DEV_TOKEN=true` with `Bearer local-dev-token` only for backend tests and smoke checks.

Configured local Supabase JWT validation uses `SUPABASE_JWT_SECRET`. Keep that value server-only. Android uses the Supabase publishable/anon key for Auth and sends the resulting access JWT to this API.

`ALLOW_LOCAL_DEV_TOKEN` is opt-in outside tests. Mobile clients must use Supabase Auth tokens, not local-dev tokens. The canonical security posture is documented in `docs/security/mobile-auth-api-security.md`.

## Persistence

`storage::AppStore` uses Postgres when `DATABASE_URL` is configured. Without it, the executable uses an in-memory store whose contents are lost on restart. Domain and endpoint tests can also use that store without external services. Durable schema migrations live in `supabase/migrations/`.

Current mobile MVP persistence shape is documented in `docs/data/data-model.md`; API contracts are documented in `docs/api/api-contracts.md`.

## Local Mobile Flow

Host-run Rust processes use loopback:

```env
API_BIND_ADDR=0.0.0.0:3000
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_JWT_SECRET=replace-with-local-supabase-jwt-secret
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

The API container uses host-gateway addresses instead of loopback for Supabase services:

```env
API_PORT=3000
API_CONTAINER_SUPABASE_URL=http://host.docker.internal:54321
API_CONTAINER_DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:54322/postgres
SUPABASE_JWT_SECRET=replace-with-local-supabase-jwt-secret
```

Android emulator calls use the host gateway:

```text
Rust API: http://10.0.2.2:3000
Supabase Auth: http://10.0.2.2:54321
```
