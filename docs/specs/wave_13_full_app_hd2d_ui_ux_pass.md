# Wave 13: Full-App HD-2D UI/UX And Animation Pass

## Goal

Run a full-app, page-by-page UI/UX pass that turns the current beta product shell into a coherent HD-2D training game interface without changing engine, database, API, auth, or persistence boundaries.

The pass should preserve the working Season Loop while improving first impression, navigation, onboarding clarity, workout ergonomics, dashboard readability, settings/support usability, loading/error states, animation feel, and mobile/desktop polish.

## Status

- `State`: Planned
- `Priority`: High after current release/deploy gate
- `Depends On`:
  - `Wave 7: Private Beta Operations And Learning Loop`
  - `docs/specs/wave_12_product_shell_reentry.md`
  - latest release-candidate hosted deploy smoke status in `docs/operations/private_beta_release_record.md`

## Boundary Decision

Wave 13 is product-shell UI/UX work.

The app shell owns:

- React/Next page composition
- shared UI components
- generated visual assets
- page transitions and micro-interactions
- browser accessibility and responsive behavior
- release and E2E evidence for the UI pass

The engine remains responsible for:

- deterministic training decisions
- replay receipts
- season rank, awards, and next-cycle direction
- deterministic patches and decision logs

The UI may present engine output, but it must not invent new engine decisions, reinterpret replay material, or let DB rows/API wrappers define engine state.

## Design Direction

The visual target is HD-2D: layered scene art, atmospheric depth, crisp interactive UI, and game-system presentation. Current inspiration lives in:

```text
apps/web/public/backgrounds/inspiration/
```

Primary direction:

- Use layered page compositions: background scene, atmospheric lighting, optional focal character/prop, and readable UI layer.
- Use translucent dark panels, angled game-menu motifs, icon-led controls, and high-contrast focus/active states.
- Keep real training workflows fast, readable, and touch-friendly.
- Adapt the body heatmap/progress reference for functional training analysis where useful.
- Avoid decorative card nesting, unreadable text over busy art, layout shifts, and animation that slows core workout actions.

## Animation Direction

Add Motion for React as the app animation dependency:

```bash
npm install motion --workspace apps/web
```

Implementation imports should use:

```ts
import { motion } from "motion/react";
```

Shared animation primitives should cover:

- route/page transition timing
- panel entrance timing
- menu focus movement
- loading shimmer/skeleton timing
- hover and tap feedback
- season-rank reveal timing
- reduced-motion fallbacks

All animation must respect `prefers-reduced-motion`. Reduced mode should keep state changes clear with minimal opacity or timing changes and no springy movement.

## Page Inventory And Execution Order

Execute in end-to-end user journey order.

1. Entry/public:
   - `/`
   - `/start`
   - `/title/start`
   - `/title/continue`
   - `/auth`
   - `/auth/login`
   - `/auth/signup`
   - `/(auth)/login`
2. Onboarding/new game:
   - `/onboarding`
3. Main shell/navigation:
   - `/(game)/layout`
   - desktop navigation
   - mobile bottom navigation
4. Dashboard and season loop:
   - `/dashboard`
   - dashboard loading state
5. Program selection/context:
   - `/programs`
   - programs loading state
6. Workout loop:
   - `/workout`
   - `/workout/log`
   - workout loading state
7. History/progress:
   - `/history`
   - `/history/[workoutId]`
   - history loading state
8. Settings/support:
   - `/settings`
   - `/settings/debug`
   - settings loading state
   - beta feedback panel
   - preferences/opt-in panels
9. System/support states:
   - `/offline`
   - `/debug`
   - root error boundary
   - game error boundary
   - not-found page

## Page Packet Template

Each page or route cluster should get a page packet before implementation. Store packets beside the implementation plan or in a Wave 13 operations/design note.

Required packet fields:

- route(s)
- current desktop screenshot reference
- current mobile screenshot reference
- GitNexus impact summary before editing existing symbols
- UX problem statement
- HD-2D scene brief
- generated layer list
- animation notes
- UI acceptance criteria
- accessibility and reduced-motion criteria
- tests to add or update
- browser verification evidence
- open visual debt, if any

## Asset Pipeline

Generated page assets should be stored under a dedicated project namespace, for example:

```text
apps/web/public/backgrounds/hd2d/
```

Each page cluster should define layered asset roles before generation:

- `background`: full scene or environment
- `atmosphere`: lighting, fog, vignette, or depth overlay
- `focal`: optional character, object, emblem, or workout visual anchor
- `texture`: optional panel/menu texture or subtle UI treatment

Do not overwrite inspiration assets. New generated assets should use descriptive, versioned filenames and should be referenced only after they are saved in the workspace.

## Planned Implementation Surface

Expected app-shell changes include:

- shared motion token module under `apps/web/src/lib/ui/`
- optional shared animated shell/page primitives once page work begins
- page-specific HD-2D backgrounds and layered wrappers
- navigation and menu interaction polish
- loading and error state polish
- targeted UI tests for changed components
- Playwright screenshot or browser evidence for each completed cluster

Engine, API, Supabase schema, and Rust crates are out of scope unless a separate accepted spec requires them.

## Local-First Verification

Per page cluster:

```bash
npm run test --workspace apps/web -- <targeted test file>
npm run typecheck --workspace apps/web
```

Browser verification:

- capture desktop and mobile screenshots for every completed cluster
- check no text overlap, blocked controls, unreadable contrast, or broken responsive state
- verify normal-motion and reduced-motion behavior for animated shell/page components

Hybrid live gate:

- use local or mocked browser flows for most pages
- use live Supabase Playwright only for onboarding, workout logging, and season transition clusters
- keep live Supabase verification outside the default green lane unless explicitly scoped as release verification

Final full-app gate:

```bash
npm run typecheck
npm run lint
npm run test
cd apps/web && npm run build
RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright
```

## Exit Criteria

- Every route cluster in the inventory has a page packet with screenshot evidence and acceptance criteria.
- Motion is installed and used through shared app-shell animation primitives.
- Every major page has an HD-2D layered visual direction and saved workspace assets where needed.
- Core training workflows remain fast and touch-friendly on mobile and desktop.
- Reduced-motion mode is verified for animated surfaces.
- Hybrid E2E evidence exists for onboarding, workout logging, and season transition.
- Final local quality gate and browser E2E gate are recorded before release promotion.

## Out Of Scope

- Engine-boundary changes
- DB schema changes
- API contract changes unless required by a later accepted app-shell spec
- live Supabase as the default per-change gate
- generated art replacing basic controls, icons, or accessible labels
