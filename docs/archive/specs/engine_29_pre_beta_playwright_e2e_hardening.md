# Engine 29: Pre-Beta Playwright E2E Hardening

Archived status: complete. Engine 29 closed after the live Playwright browser suite passed the required Chromium desktop/mobile gate and the roadmap was updated to treat Playwright browser E2E as required pre-beta evidence.

## Summary

Make live Playwright browser verification a required pre-beta confidence gate for `apps/web`.
This is app-shell runtime hardening, not a Rust engine boundary revision. Wave 5 remains closed,
and `EngineInputV1`, `EngineOutputV1`, public Rust operations, and canonical replay policy remain
unchanged.

## Scope

- Expand Playwright coverage around browser-visible beta risks: auth/session boundaries,
  onboarding, settings persistence, session generation, guardrail handling, completion, history,
  analytics access, route recovery, and mobile navigation.
- Run against the configured live Supabase project with the existing managed test user.
- Keep tests serial and reset the managed test user before each scenario.
- Use Chromium desktop and Chromium mobile as the required pre-beta browser matrix.

Out of scope:
- Multi-user RLS browser scenarios.
- Destructive malformed database fixtures.
- Release promotion paperwork such as immutable commit metadata, owner assignment, or npm audit
  disposition.
- Any change to the canonical Rust engine envelopes or replay serialization policy.

## Implementation Requirements

- `npm run test:e2e:playwright` must run the required desktop and mobile Chromium projects.
- The browser suite must mutate only `SUPABASE_TEST_EMAIL`'s user state and must clean workout
  history, normalized cycle state, and compatibility `stats_json` before and after execution.
- Browser assertions must prove:
  - unauthenticated protected routes redirect to login and authenticated cookie sessions survive
    reloads
  - onboarding validation blocks incomplete setup and persists a usable profile
  - settings changes persist to Supabase and survive reload
  - missing `/workout/log` session storage redirects back to `/workout`
  - guardrail warnings require acknowledgment before workout generation
  - guardrail blockers are still reachable through the authenticated live API
  - completion sends a single browser submit, writes history, and surfaces dashboard/history output
  - authenticated analytics remains accessible with `Cache-Control: no-store`
  - mobile navigation can generate, start, log, and persist a workout smoke path

## Acceptance Criteria

- `RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright` passes against live Supabase.
- Failures retain Playwright traces.
- `docs/operations/private_beta_release_evidence_pack.md` marks Playwright browser E2E as required
  for beta readiness.
- `specs/overall_plan.md` records Engine 29 as the active pre-beta app-shell hardening spec.
- No Rust engine contract, envelope, or canonical replay-policy files are changed.
