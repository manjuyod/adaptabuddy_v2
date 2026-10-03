# Mobile Auth + API Security

This is the canonical security posture for the mobile-first MVP.

## MVP Now

- Mobile clients are public and untrusted.
- Mobile may hold the Supabase project URL and publishable key.
- Mobile must never hold Supabase secret keys, service-role keys, database passwords, JWT secrets, webhook secrets, or admin credentials.
- Mobile signs users in with Supabase Auth and sends the Supabase access JWT to the Rust API as `Authorization: Bearer <token>`.
- The Rust API validates Supabase JWTs on every protected route and attaches a typed `AuthContext`.
- User tokens must have the `authenticated` audience and role, a valid user UUID, and valid expiry/not-before claims. Fetching signing keys has a bounded timeout.
- Protected routes must use `AuthContext.user_id`; clients must not send or choose owner IDs.
- Authorization is enforced in Rust and, for directly exposed tables, Supabase RLS.
- Admin/service operations stay server-only.
- Direct mobile access to Supabase tables is allowed only for intentionally exposed tables with RLS enabled and reviewed.
- XP, health events, generated workout plans, and workout completion state permit owner reads but are writable only by the backend. Parent/child database references enforce matching owners.
- `ALLOW_LOCAL_DEV_TOKEN` defaults to false, including Compose. Enable it explicitly only for local backend smoke tests.
- Route classes are explicit: `public`, `user`, `internal`, and `webhook`.

## Route Classes

| Class | MVP behavior |
| --- | --- |
| `public` | No user token required. Example: `GET /api/v0/health`. |
| `user` | Requires a verified Supabase user JWT. Uses `AuthContext.user_id` for ownership. |
| `internal` | Reserved for server-only operations. Not exposed to mobile. |
| `webhook` | Reserved for signed external callbacks. Not implemented in the MVP. |

## Later

- Add Apple App Attest and Android Play Integrity after JWT validation, RLS, server-side authorization, and redacted logging are stable.
- Add abuse controls such as device reputation, tighter rate limiting, and anomaly detection after the first product loop is usable.
