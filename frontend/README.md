# Frontend

The primary general-purpose frontend is the health app.

```text
frontend/health-app/  workspace facade for the migrated health app
apps/web/             current Next.js implementation during cutover
```

The active UI is being reframed around dashboard, nutrition, workouts, habits, goals, body metrics, progress, and settings. RPG/title-menu concepts are no longer the primary entry path and should move toward the Unity client workstream when they remain useful.

Run the health app:

```bash
npm run dev:health-app
npm run typecheck:health-app
npm run lint:health-app
npm run test:health-app
```
