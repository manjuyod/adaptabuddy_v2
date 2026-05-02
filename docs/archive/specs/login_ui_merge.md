# Spec: Login UI Merge and Canonical Auth Route

## Status

- `State`: Completed
- `Owner`: Auth/UI
- `Last Updated`: 2026-02-16

## 0) Completion Summary (2026-02-16)

Implemented outcomes:

- Canonical render route is now `/login` (`apps/web/app/(auth)/login/page.tsx`).
- Legacy auth routes now redirect to canonical login:
  - `/auth/login` → `/login`
  - `/auth/signup` → `/login?tab=signup`
- Guard and middleware redirect contract now uses `redirectTo`.
- Post-auth server actions now consume `redirectTo` and apply safe same-origin fallback logic (`/start` fallback).
- Login and signup are merged into one tabbed login surface (`LoginScreen`) with one active form tree at a time.
- Branded auth assets were added:
  - `apps/web/public/brand/logo.svg`
  - `apps/web/public/backgrounds/login-bg.png`
  - `apps/web/public/backgrounds/login-overlay.svg`
- Tests were updated for canonical route behavior and merged login UI.

Verification run on 2026-02-16:

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run test` ✅
- `cd apps/web && npm run build` ✅

## 1) Problem Statement

The auth surface currently has fragmented route entry points and a perceived "double login" experience. We need one polished, custom login screen at `/login` with blended branded visuals and a single, predictable auth entry path.

## 2) Current-State Inventory Plan

Run these read-only checks before implementation:

1. Route surface inventory
   - Command: `rg --files apps/web/app | rg "login|signin|auth|callback"`
   - Why: discover duplicated auth route entry points and aliases.
2. Auth wiring inventory
   - Command: `rg -n "@supabase/auth-ui-react|<Auth\\b|signInWithPassword|signUp\\(|signInWithOAuth|redirectTo" apps/web`
   - Why: verify custom auth form wiring and identify widget usage.
3. Guard and middleware redirect inventory
   - Command: `rg -n "/login|/auth/login|/signin|redirectedFrom|redirectTo" apps/web/middleware.ts apps/web/src/lib/auth/guard.ts apps/web/src/lib/routes.ts`
   - Why: map canonical route and redirect query behavior.
4. Test coverage inventory
   - Command: `rg -n "auth/login|/login|getAuthGuardRedirect|LoginScreen" apps/web/tests`
   - Why: list tests requiring updates after canonical route migration.
5. Asset baseline inventory
   - Command: `rg --files apps/web/public | rg "login|signup|brand|background"`
   - Why: catalog existing auth art and avoid accidental breakage.

## 3) Current State Findings

### Routes and auth entry points

- `apps/web/app/(auth)/login/page.tsx` redirects to `ROUTES.auth.login` (`/auth/login`).
- `apps/web/app/auth/login/page.tsx` renders `LoginScreen`.
- `apps/web/app/auth/signup/page.tsx` renders `SignupScreen`.
- `apps/web/app/auth/page.tsx` redirects to `/start` or `ROUTES.auth.login`.
- `apps/web/app/(auth)/callback/route.ts` handles OAuth callback/session exchange.

### Route constants and guard/middleware

- `apps/web/src/lib/routes.ts` sets:
  - `ROUTES.auth.login = "/auth/login"`
  - `ROUTES.auth.signup = "/auth/signup"`
- `apps/web/src/lib/auth/guard.ts`:
  - uses `ROUTES.auth.login` as the unauthenticated redirect.
  - currently emits `redirectedFrom` query param.
  - treats `"/login"` as public in `PUBLIC_PATH_PREFIXES`.
- `apps/web/middleware.ts` executes the guard and preserves redirected search params.

### Auth UI composition and actions

- Login UI: `apps/web/src/modules/auth/components/login-screen.tsx`
  - image-overlay driven
  - mounts separate desktop and mobile forms simultaneously and toggles by breakpoint classes.
- Signup UI: `apps/web/src/modules/auth/components/signup-screen.tsx`
  - separate page/component with similar overlay approach.
- Server actions:
  - `apps/web/src/modules/auth/actions.ts`
  - `signInAction()` calls `supabase.auth.signInWithPassword()`.
  - `signUpAction()` calls `supabase.auth.signUp()`.
- No `@supabase/auth-ui-react` usage found.

### Existing auth-related assets

- `apps/web/public/ui/login/static_images/login_screen_full.png`
- `apps/web/public/ui/login/static_images/login_screen_mobile.png`
- `apps/web/public/ui/signup/static_images/signup_screen_full.png`
- `apps/web/public/ui/signup/static_images/signup_screen_mobile.png`

### Duplication hypothesis

Most likely contributors:

1. Multiple route surfaces (`/login` and `/auth/login`) and legacy redirects create composition ambiguity.
2. Both desktop and mobile form trees are mounted and hidden by CSS, which can look like duplicate login surfaces in some states/tools.
3. React StrictMode development behavior can amplify perceived double rendering.

Uncertainty:

- No evidence of Supabase Auth UI widget double-rendering.

## 4) Target UX

Build one polished `/login` experience:

- Full-bleed branded background.
- Centered glass-style card container.
- Card header with brand mark/title.
- Tabs for `Sign in` and `Sign up` on the same route.
- Custom email/password form (not Supabase Auth UI widget).
- Optional OAuth row placeholder, disabled by default.
- Inline auth status area for error/success messaging.

## 5) Target Component Architecture

Primary composition:

- `LoginScreen`
  - Owns page background layers and center layout shell.
- `LoginCard`
  - Owns auth interaction surface and form mode state.

Optional extraction (if needed for readability):

- `AuthTabs` (tab state and semantics)
- `EmailPasswordForm` (mode-aware sign-in/sign-up fields)
- `AuthMessage` (error/success announce region)

Implementation rule:

- Supabase calls remain in server actions (`apps/web/src/modules/auth/actions.ts`), not in visual components.

## 6) Routing Decisions

Canonical route:

- `/login`

Legacy redirects:

- `/auth/login` -> `/login` (preserve redirect query intent).
- `/auth/signup` -> `/login?tab=signup`.
- `/auth` index continues redirect behavior, but targets canonical `/login`.

Callback:

- Keep `/callback` flow and callback guard as-is.

## 7) Supabase Auth Wiring Approach

- Continue server-action SSR auth pattern via:
  - `createSupabaseServerActionClient()`
  - `signInWithPassword` for sign-in
  - `signUp` for account creation
- Keep cookie-based session model unchanged.
- OAuth:
  - define UI hook point/button region
  - keep providers disabled by default in this milestone.

## 8) Redirect Behavior

Standardize query key:

- Replace `redirectedFrom` with `redirectTo`.

Behavior:

- Middleware sends unauthenticated users to:
  - `/login?redirectTo=<path+query>`
- Post-auth success:
  - redirect to safe, same-origin path from `redirectTo`
  - fallback to `/start` when missing/invalid.

## 9) Asset Plan (MCP execution in future milestone)

Planned locations:

- `apps/web/public/brand/logo.svg`
- `apps/web/public/backgrounds/login-bg.png`
- `apps/web/public/backgrounds/login-overlay.svg` (optional)

Style direction:

- Base palette from `apps/web/src/lib/ui/palette.ts`.
- Cozy and grounded tone:
  - warm parchment highlights
  - deep brown anchors
  - restrained gold accents
- Subtle texture/grain and vignette.
- Keep contrast high enough for form legibility and accessibility.

## 10) Accessibility Checklist

- All inputs have visible labels or semantic labels with proper association.
- Correct autocomplete:
  - sign-in: `email`, `current-password`
  - sign-up: `email`, `new-password`
- Tabs implement keyboard navigation and ARIA semantics:
  - `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`
- Message area uses `aria-live` for async errors/success.
- Focus indicators remain visible and distinct.
- Contrast ratios meet baseline readability for text and controls.
- Decorative background assets use empty alt and do not carry critical information.

## 11) Definition of Done

- Exactly one canonical login experience is rendered.
- `/login` is canonical and supports both sign-in and sign-up tabs.
- `/auth/login` and `/auth/signup` redirect cleanly to canonical route.
- Successful auth redirects to safe `redirectTo` destination or `/start`.
- No auth flow regressions in middleware/guard behavior.
- No console errors/hydration warnings on login interactions.
- Accessibility checklist passes baseline manual QA.

## 12) Step-by-Step Implementation Plan (Minimal Diffs)

1. Docs updates
   - Merge this spec and mirror policy updates into repo guidance docs.
2. Route canonicalization
   - Make `/login` the render route and convert `/auth/*` login/signup pages to redirects.
3. Route constants and guard updates
   - Update route constants and guard target to canonical `/login`.
   - Migrate redirect query from `redirectedFrom` to `redirectTo`.
4. Login/signup UI merge
   - Consolidate sign-in and sign-up into one card with tabs on `/login`.
   - Remove duplicate composition paths and keep one auth surface.
5. Asset integration
   - Add branded assets under `/public/brand` and `/public/backgrounds`.
   - Wire assets into `LoginScreen` background layers.
6. QA and regression verification
   - Update and run auth guard/login route/component tests.
   - Run manual redirect and accessibility sanity checks.

## 13) Risks and Mitigations

1. Middleware redirect loops
   - Mitigation: explicit public-route handling for `/login`; route tests for authenticated and unauthenticated cases.
2. Session detection inconsistency (`getUser` vs `getSession`)
   - Mitigation: keep current dual-check pattern until intentional unification is validated.
3. Dev-only StrictMode confusion
   - Mitigation: verify behavior in production build and assert visible-surface uniqueness in tests.
4. Legacy deep links/bookmarks to `/auth/*`
   - Mitigation: maintain permanent redirects from legacy routes with query preservation.
5. A11y regression during visual redesign
   - Mitigation: checklist-based review + targeted keyboard and screen-reader smoke tests.
