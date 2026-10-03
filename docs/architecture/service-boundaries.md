# Service Boundaries

The MVP is one Rust deployable with clear internal boundaries.

## MVP Now

- Auth/API security owns JWT validation, route class enforcement, and `AuthContext`.
- User engine owns profile, body stats, exercise stats, muscle group summaries, and profile-driven prompts.
- Food engine owns food diary entries, flexible meal type metadata, macros, nutrition targets, and BMR estimates.
- Workout generation engine owns v0 plan/day/exercise creation.
- Workout completion engine owns session lifecycle, exercise completion status, XP awards, and stat update hooks.
- RPG engine is a placeholder/projection layer only.

## Boundary Rules

- Mobile clients never send trusted owner IDs.
- Persistence rows are not the public business boundary; API DTOs are.
- Supabase RLS protects directly exposed user-owned tables.
- Backend-only operations still store `user_id` for clarity and defense in depth.
- Admin credentials and service-role access stay server-side.

## Later

- Split deployables only if operational pressure appears.
- Replace v0 workout generation with richer program blending after the basic mobile loop works.
