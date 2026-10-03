# Infrastructure

Local infrastructure is intentionally small:

- Supabase CLI owns the local Auth/Postgres/RLS stack.
- Docker Compose owns the Rust API container and an optional health app container.
- A plain Postgres fallback profile exists only for isolated API smoke work.

## Supabase

Install the Supabase CLI, then run:

```bash
npx supabase start
npx supabase status
npx supabase db reset
npx supabase db lint --local --fail-on warning
npx supabase stop
```

`supabase/config.toml` uses local ports:

- API: `54321`
- DB: `54322`
- Studio: `54323`

## Compose

```bash
docker compose -f infra/docker-compose.yml config
make api-container-build
make api-container-start
make api-container-status
curl -fsS http://127.0.0.1:3000/api/v0/health
```

The API container publishes host port `3000` by default so Android debug builds can use `API_BASE_URL=http://10.0.2.2:3000`. Supabase still runs through `npx supabase start`; the API container reaches Supabase Auth at `host.docker.internal:54321` and local Postgres at `host.docker.internal:54322`.

Server-only values such as `SUPABASE_JWT_SECRET`, service-role keys, and database URLs belong in root `.env`, never in `mobile/local.properties`.

Optional health app container:

```bash
docker compose -f infra/docker-compose.yml --profile web up --build
```

The optional health app publishes host port `3001` by default to avoid conflicting with the API on `3000`.

Optional plain Postgres fallback:

```bash
docker compose -f infra/docker-compose.yml --profile standalone-postgres up postgres
```
