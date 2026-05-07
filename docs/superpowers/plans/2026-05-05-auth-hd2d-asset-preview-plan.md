# Auth HD-2D Asset Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate individual HD-2D auth scene assets, compose them over the current auth background, and present a preview for review before changing the live auth screen.

**Architecture:** This is a preview-only asset pass. Generated images are saved under `apps/web/public/backgrounds/hd2d/auth/preview-v1/`; a static HTML preview under `.superpowers/brainstorm/auth-jrpg-visual-001/` layers those assets over the current login background and simulated auth controls. The live React auth screen remains unchanged until the preview is approved.

**Tech Stack:** OpenAI image generation, local image processing, HTML/CSS composition, existing brainstorm companion at `http://localhost:53241`.

**Current preview status:** Preview V3 is the active review artifact. It is self-contained for direct local viewing at `http://localhost:53241/auth-composited-preview-v3.html`, while still loading app public assets from the local Next dev server at `http://localhost:3000`.

**Approval status:** Preview V3 pass approved by user on 2026-05-07. This approval covers the preview composition and visual direction only; production auth wiring is still intentionally not started.

**Latest visual iteration:** `depth-atmosphere-v3.png` is now the active sky/backdrop layer in the V3 preview. It keeps the original login background hidden, adds stronger mauve-magenta tinting, and moves the sky light source toward the top left.

**Town layer iteration:** Added preview-only generated town layers inspired by the HD-2D inn references:
- `town-depth-v1.png`: distant village roofline behind the form
- `town-side-buildings-v1.png`: left/right town-edge building clusters replacing the older mismatched house layer
- `town-props-v1.png`: low lantern/signpost/barrel foreground clutter

**Floor composition iteration:** Lowered and vertically compressed the foreground floor layer in the V3 preview so the title/menu composition has more sky and town breathing room.

**Title asset iteration:** Removed the old HTML text title plus the interaction and practical light layers from the V3 preview. Generated `adaptabuddy-title-v1.png`, then replaced it with `adaptabuddy-title-v2.png`, a transparent single-line HD-2D title asset with a crest and subtle dumbbell-inspired side flourishes. The active `adaptabuddy-title-v2.png` is now a flat-white alpha mask with opacity and screen blending handled in the preview CSS; the textured source is preserved separately.

**Auth text color/type iteration:** Updated the preview-only Email, Password, Login, Sign Up, OAuth, and Google text styling to use the same flat-white family as the title, with reduced opacity and white underline/bracket accents instead of the previous warm cream/gold treatment. The auth text now uses a clean, thin non-serif font stack with slimmer input rules and selected-action brackets to better match the TitleInspo menu lettering.

---

### Task 1: Generate Source Asset Sheet

**Files:**
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/source/auth-town-gate-asset-sheet-v1.png`

- [x] **Step 1: Generate one source sheet**

Use the image generation path available in the session. Prompt for an HD-2D auth scene asset sheet with separable regions: midground architecture, natural greenery, foreground path, lantern/practical lights, atmospheric overlay, and interaction glow. Require no text, no logos, and enough spacing for cropping.

- [x] **Step 2: Save source image into workspace**

Copy the generated source into `apps/web/public/backgrounds/hd2d/auth/preview-v1/source/`.

Completion note: the preview used individually generated raw layer sources under `apps/web/public/backgrounds/hd2d/auth/preview-v1/raw/` instead of retaining a single unified source sheet.

### Task 2: Crop Individual Preview Assets

**Files:**
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/midground-architecture-v1.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/natural-environment-v1.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/foreground-stage-v1.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/practical-light-v1.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/depth-atmosphere-v1.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/depth-atmosphere-v2.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/depth-atmosphere-v3.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/interaction-light-v1.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/town-depth-v1.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/town-side-buildings-v1.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/town-props-v1.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/adaptabuddy-title-v1.png`
- Create: `apps/web/public/backgrounds/hd2d/auth/preview-v1/adaptabuddy-title-v2.png`

- [x] **Step 1: Inspect generated source**

Open the generated source and identify crop bounds for each asset role.

- [x] **Step 2: Crop with Pillow**

Write a temporary local crop script or one-off command to crop the sheet into role-based PNG files. Do not reference these preview files from production code.

Completion note: cropped/processed preview files now include the role PNGs plus `foreground-stage-v1-trimmed.png` and transparent generated title assets through `adaptabuddy-title-v2.png`.

### Task 3: Compose Review Preview

**Files:**
- Create: `.superpowers/brainstorm/auth-jrpg-visual-001/auth-composited-preview-v1.html`
- Create: `.superpowers/brainstorm/auth-jrpg-visual-001/auth-composited-preview-v3.html`

- [x] **Step 1: Build desktop preview**

Layer the current login background with the generated assets and simulated v4 auth UI: preview title asset, centered email/password, vertical action menu.

- [x] **Step 2: Build mobile preview**

Add a mobile mock that checks title scale, field placement, and vertical action spacing.

- [x] **Step 3: Review in browser companion**

Open `http://localhost:53241` and validate the newest preview file is displayed.

Completion note: refreshed screenshots were captured at:
- `.superpowers/brainstorm/auth-jrpg-visual-001/auth-composited-preview-v3-desktop.png`
- `.superpowers/brainstorm/auth-jrpg-visual-001/auth-composited-preview-v3-mobile.png`

### Task 4: Review Gate

**Files:**
- No production files changed.

- [x] **Step 1: Ask user for approval**

Ask whether to iterate on the generated assets or proceed to production implementation planning.

- [x] **Step 2: Keep generated assets marked as preview**

Do not wire preview assets into `LoginScreen` until approved.

Completion note: user direction on 2026-05-06 was to keep this as preview for now and continue the auth page from that basis. User approved the preview V3 pass on 2026-05-07. No production auth component was changed.
