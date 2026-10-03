# Architecture

Adaptabuddy is currently a mobile-first health MVP backed by a Rust API.

```text
Kotlin Android app
        |
        v
Rust API modular monolith
        |
        v
Supabase Auth + Postgres
```

The Rust backend is the source of truth for business logic. Mobile clients are public and untrusted. Supabase supplies Auth and Postgres, while Rust validates access JWTs, attaches typed auth context, and enforces route-level ownership.

## Current Boundaries

- Android is the first client surface.
- Rust API owns user profile, stats, food diary, workout planning, workout completion, XP, and route authorization.
- Supabase Auth owns identity.
- Supabase Postgres stores durable state.
- RLS protects any table intentionally exposed outside the backend.
- RPG, Unity, iOS, web, and admin surfaces are later work.

## MVP References

- Backend overview: `docs/architecture/backend-overview.md`
- Service boundaries: `docs/architecture/service-boundaries.md`
- Android MVP plan: `docs/architecture/mobile-android-mvp.md`
- Mobile/API security: `docs/security/mobile-auth-api-security.md`
- Product scope: `docs/product/mvp-scope.md`
- Product roadmap: `docs/product/roadmap.md`
- API contract: `docs/api/api-contracts.md`
- Data model: `docs/data/data-model.md`
- Active implementation plan: `specs/overall_plan.md`
