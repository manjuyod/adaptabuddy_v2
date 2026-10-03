# Health App Workspace

This workspace is the web health app workstream for the ecosystem cutover.

During the transition, scripts proxy to `apps/web` so existing auth, Supabase, tests, and release operations keep working while imports and deployment paths are migrated.

## Commands

```bash
npm run dev --workspace frontend/health-app
npm run typecheck --workspace frontend/health-app
npm run lint --workspace frontend/health-app
npm run test --workspace frontend/health-app
```

## Health Product Scope

The health app should prioritize:

- dashboard
- calorie and food logging
- workout logging and exercise history
- habits
- goals
- progress charts
- body metrics
- account/profile settings

Progression, levels, streaks, achievements, and rewards are motivational layers over backend health events. They should support the health experience rather than dominate it.
