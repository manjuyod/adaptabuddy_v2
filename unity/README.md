# Unity Client

No Unity project exists yet. This folder is the Unity RPG frontend/client workstream.

Unity is a presentation layer over backend-owned health and progression state. It should not own persistent user state, health history, progression rules, achievements, or rewards.

## API Consumption

Unity should authenticate through Supabase-compatible user sessions and call the Rust API.

Primary projection:

```http
GET /clients/unity/player-state
Authorization: Bearer <supabase access token>
```

The projection returns backend-derived progression state, achievements, and presentation hints. Unity can render that as character progress, unlocks, cosmetic rewards, or RPG scenes, but the source state remains in the backend.

Useful supporting endpoints:

- `GET /progression/state`
- `GET /achievements`
- `GET /events/recent`
- `GET /health/dashboard`

RPG concepts such as classes, battles, monsters, damage, and dungeon runs belong in this client layer unless the backend needs a neutral health/progression representation.
