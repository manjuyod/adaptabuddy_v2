# API Contracts

The canonical mobile/client namespace is `/api/v0/me/...`. `/me/...` aliases are convenience aliases and should not replace the versioned contract.

## Public

- `GET /api/v0/health`

## User

- `GET /api/v0/me`
- `PATCH /api/v0/me/profile`
- `GET /api/v0/me/stats`
- `POST /api/v0/me/stats/body`
- `POST /api/v0/me/stats/exercise`
- `GET /api/v0/me/dashboard`
- `GET /api/v0/me/food/entries`
- `POST /api/v0/me/food/entries`
- `PATCH /api/v0/me/food/entries/:id`
- `DELETE /api/v0/me/food/entries/:id`
- `GET /api/v0/me/workouts/plan`
- `POST /api/v0/me/workouts/plan/generate`
- `GET /api/v0/me/workouts/sessions`
- `POST /api/v0/me/workouts/sessions`
- `GET /api/v0/me/workouts/sessions/:id`
- `PATCH /api/v0/me/workouts/sessions/:id`
- `POST /api/v0/me/workouts/sessions/:id/finish`

All user routes require `Authorization: Bearer <supabase access token>`.

Profile PATCH accepts partial JSON: omitted fields retain their current values,
and explicit `null` clears nullable fields. `unitSystem` cannot be null. Profile
fields and nutrition targets update together, preserving concurrent changes to
unrelated fields.

Unauthorized user routes return:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Missing or invalid access token"
  }
}
```

## Dashboard

`GET /api/v0/me/dashboard` returns the authenticated mobile Home shell. The user ID is derived from the verified Supabase JWT, not from a client parameter.

Daily food macros and activity flags use the current UTC date. A zero-calorie food entry still counts as logged. The next workout comes from an active plan's unfinished scheduled days; body stats are stale when no weight is available or the latest weight is more than 30 days old.

```json
{
  "user": {
    "id": "00000000-0000-0000-0000-000000000001",
    "display_name": null
  },
  "today": {
    "calories_consumed": 0,
    "protein_g": 0,
    "carbs_g": 0,
    "fat_g": 0
  },
  "body": {
    "latest_weight": null,
    "weight_unit": "lb",
    "last_updated": null
  },
  "workout": {
    "next_workout_date": null,
    "next_workout_name": null,
    "recommendation": "No workout generated yet"
  },
  "habits": {
    "food_logged_today": false,
    "workout_completed_today": false,
    "stats_stale": true
  }
}
```

## Status Values

Workout/session statuses:

- `planned`
- `started`
- `completed`
- `partially_completed`
- `skipped`
- `cancelled`

Exercise completion statuses:

- `completed`
- `partial`
- `skipped`
- `failed`

Food meal types:

- `breakfast`
- `lunch`
- `dinner`
- `snack`
- `other`

Session completion is atomic and replay-safe: retrying a finished session returns its saved result without awarding XP again. A finished, skipped, or cancelled session cannot be reopened through the status endpoint. Invalid input returns `400`; an incompatible state transition returns `409`.

Food creation, legacy workout recording, habit check-ins, body metrics, and goal
changes commit their associated events and XP in the same transaction. An event
or XP write failure rolls back the primary change. Repeating a goal completion
does not append another completion event until the goal has been reopened.
