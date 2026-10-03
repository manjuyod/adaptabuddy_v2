# Mobile + Rust Backend MVP Plan

## Status Legend

| Tag | Meaning |
| --- | --- |
| `[ACTIVE]` | Current primary implementation lane |
| `[NEXT]` | Queued immediately after the active item |
| `[LATER]` | Downstream work after the MVP loop is stable |

## Current Direction

Adaptabuddy is focused on a small mobile health MVP:

```text
Kotlin Android app
        |
        v
Rust API backend
        |
        v
Supabase Auth + Postgres
```

The Rust backend is server-authoritative for business logic and authorization. Supabase provides user identity and durable storage. Android clients authenticate with Supabase Auth and call the Rust API with the Supabase access JWT.

Canonical references:

- MVP scope: `docs/product/mvp-scope.md`
- Roadmap: `docs/product/roadmap.md`
- Backend architecture: `docs/architecture/backend-overview.md`
- Service boundaries: `docs/architecture/service-boundaries.md`
- Android MVP plan: `docs/architecture/mobile-android-mvp.md`
- Mobile/API security: `docs/security/mobile-auth-api-security.md`
- API contracts: `docs/api/api-contracts.md`
- Data model: `docs/data/data-model.md`

## Active Queue

- `[ACTIVE]` Harden the mobile + Rust backend MVP slice.
- `[ACTIVE]` Keep `/api/v0/me/...` as the canonical mobile/client API namespace.
- `[ACTIVE]` Keep Supabase JWT validation, typed auth context, ownership checks, and RLS posture aligned with `docs/security/mobile-auth-api-security.md`.

## Next Queue

- `[NEXT]` Validate the existing Android Supabase login and `/api/v0/me/dashboard` Home flow against the local stack.
- `[NEXT]` Replace the remaining Habits, Add, Workout, and Food placeholders with authenticated API flows.
- `[NEXT]` Expand backend integration tests around auth boundaries, ownership, food CRUD, workout plan generation, workout completion, XP awards, and BMR estimates.

## Later

- `[LATER]` Add iOS/Swift after Mac-based testing is available.
- `[LATER]` Add Unity/RPG projections after the health loop is stable.
- `[LATER]` Add web/admin surfaces after the API contract settles.
- `[LATER]` Add richer workout program blending, barcode scanning, stats prompts, and app attestation once the MVP loop is usable.

## Current Constraints

- Do not put Supabase service-role keys, JWT secrets, database passwords, webhook secrets, or admin credentials in mobile clients.
- Do not trust client-supplied owner IDs.
- Do not make mobile health workflows depend on RPG features.
- Do not split backend modules into separate deployables until operational pressure requires it.
- Prefer small vertical slices over broad ecosystem work.
