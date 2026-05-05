# Auth HD-2D Layered Cutouts Design

## Status

- State: Approved design direction
- Date: 2026-05-05
- Wave: Wave 13 full-app HD-2D UI/UX pass
- Scope: `apps/web` auth screen UI and visual assets only

## Routes

- `/login`
- `/auth`
- `/auth/login`
- `/auth/signup`
- `/(auth)/login`

`/login` is the rendered auth screen route. `/auth`, `/auth/login`, and `/auth/signup` redirect into the shared login route with the appropriate tab or auth state.

## Current Screenshot References

- Desktop baseline: `docs/superpowers/specs/assets/2026-05-05-auth-current-desktop.png`
- Mobile baseline: `docs/superpowers/specs/assets/2026-05-05-auth-current-mobile.png`

## GitNexus Impact Summary

Pre-implementation impact analysis was run for `LoginScreen` in `apps/web/src/modules/auth/components/login-screen.tsx`.

- Risk: LOW
- Direct indexed callers: 0
- Indexed affected execution flows: 0
- Note: the route file `apps/web/app/(auth)/login/page.tsx` imports and renders `LoginScreen`, so implementation review should still treat `/login` as the primary behavioral surface even though the graph did not attach that route as an upstream caller.

Before editing any additional named function, class, or method, run GitNexus impact for that symbol.

## UX Problem Statement

The current auth screen already has a strong HD-2D village background and an elegant cinematic title. The weakness is that the auth controls float over the art without enough in-world anchoring. On desktop the form feels delicate but weightless; on mobile the title, fields, and small horizontal action row are cramped and hard to parse.

The next pass should preserve the cinematic village mood while making the screen feel like a natural JRPG opening/title interaction.

## Approved Design Direction

Use an environment-first, layered-cutout composition. The screen should feel like a composed HD-2D miniature set assembled from multiple visual layers, not a background image with random props sprinkled on top.

The approved v4 composition is:

- A large low-opacity `ADAPTABUDDY` logo spanning a wider section of the screen, similar to a cinematic Final Fantasy-style opening title.
- Centered email and password fields beneath the title.
- Auth actions stacked vertically beneath the fields, closer to a JRPG title/menu command list.
- Natural, cinematic environment layers around the form: asymmetric houses, roof edges, trees, shrubs, foreground path, lanterns, haze, and subtle save-point light.
- No heavy login panel. The scene and light treatment should create the interaction focus.

## HD-2D Scene Brief

The player arrives at a quiet village gate at dusk. Warm house windows and lanterns frame a central path. The title hangs across the sky and architecture as a low-opacity cinematic overlay. The auth menu sits in the center as the first interaction point, lit by a soft save-point glow rather than enclosed in a box.

The scene should feel natural and lived-in:

- Asymmetry is preferred over symmetrical framing.
- Assets should overlap with depth and atmospheric haze.
- Props should look integrated into the existing village lighting.
- The composition should remain readable on both desktop and mobile.

## Generated Layer List

Store new project assets under:

```text
apps/web/public/backgrounds/hd2d/auth/
```

Do not overwrite the existing login background or inspiration assets.

Required layers:

- `background-grade`: non-destructive darkening, contrast, vignette, and warm atmospheric treatment over the existing village background.
- `depth-atmosphere`: warm sky shaft, fog, and optional parallax haze.
- `midground-architecture`: asymmetric house, roof, tower, or gate-edge cutouts that frame the auth area.
- `natural-environment`: clustered trees, shrubs, moss, and path-edge greenery.
- `foreground-stage`: cobblestone, bridge, or village path strip to create a foreground plane.
- `interaction-light`: subtle save-point glow behind the centered form.
- `practical-light`: lantern pair, window glow accents, or small warm light sources that explain the form illumination.

Optional layers if the first pass feels thin:

- `notice-board` or signpost
- barrels, crates, mailbox, or small village clutter
- small training-guild pennant if the screen needs a stronger game identity

## Composition Rules

- Keep the existing village background as the base unless generation tests prove it cannot support the approved direction.
- Compose from multiple layers so the page reads as HD-2D depth: distant atmosphere, midground architecture, foreground path, and interaction light.
- Do not use flat sticker-like cutouts. Generated assets need matching warm window light, crisp pixel/voxel detail, shallow depth, and cinematic rim light.
- Avoid a large opaque auth card or panel.
- Keep the logo broad and low opacity; it should feel like part of the cinematic scene, not a blocking banner.
- Center email and password fields. Stack actions vertically.
- Preserve auth semantics and form behavior.

## Animation Notes

- Add only subtle motion in this pass if implementation scope allows: title fade, menu entrance, lantern flicker, slow haze drift, and focus glow.
- Respect `prefers-reduced-motion`.
- Reduced motion should keep the title, fields, actions, and focus state clear without drifting haze or animated glow pulses.

## UI Acceptance Criteria

- Desktop shows the large low-opacity `ADAPTABUDDY` title across the upper scene.
- Email and password fields are centered and readable over the background.
- Actions are vertically stacked, with a clear default/focused action.
- The environment feels composed from HD-2D layers rather than decorated with isolated props.
- The existing village background remains recognizable.
- No controls overlap each other on desktop or mobile.
- Mobile preserves the title/menu hierarchy without shrinking actions into unreadable text.
- OAuth and Google placeholder actions remain clearly non-primary until implemented.

## Accessibility And Reduced Motion Criteria

- Labels, buttons, password reveal, alerts, and status text remain accessible by role/name.
- Keyboard focus is visible for all actions and fields.
- Text contrast is readable against the art and lighting effects.
- Auth state messages retain `role="alert"` or `role="status"` as appropriate.
- Reduced motion disables haze drift, glow pulsing, and large entrance movement.

## Tests To Add Or Update

- Update `apps/web/tests/login-screen.test.tsx` for the vertical action stack and any revised accessible names.
- Add assertions that sign-in is default, sign-up tab still works, redirect hidden field remains intact, and password reveal remains accessible.
- If a shared auth scene component is extracted, add a targeted component test for layer rendering and reduced-motion class/state behavior where practical.

## Browser Verification Evidence Required After Implementation

- Capture desktop screenshot at approximately `1440x900`.
- Capture mobile screenshot at approximately `390x844`.
- Verify no text overlap, blocked controls, or unreadable contrast.
- Verify normal motion and reduced-motion behavior.
- Verify `/login`, `/auth`, `/auth/login`, and `/auth/signup?redirectTo=...` route behavior still resolves correctly.

## Out Of Scope

- Auth behavior changes
- Supabase changes
- API, database, engine, or persistence changes
- New OAuth or Google implementation
- Replacing accessible form controls with image-only UI

## Open Visual Debt

- Exact generated asset prompts are not finalized in this design. They should be written during implementation planning, one layer at a time.
- Final asset filenames should be versioned after selected outputs are saved.
- The current `useFormState` deprecation warning is visible in browser console; this is not part of the visual design but should be considered during implementation planning if the touched component is updated.
