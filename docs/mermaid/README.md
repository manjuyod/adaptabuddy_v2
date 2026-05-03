# Mermaid Diagrams

This directory captures the current AdaptaBuddy vNext app/service surface as Mermaid diagrams.

Scope:
- Runtime app shell: `apps/web/app`, `apps/web/src/modules`, and `apps/web/src/lib`
- Adapter contracts: `packages/contracts/src`
- Accepted deterministic engine baseline: `packages/engine-rs/src`
- Tests, archive docs, and planning ledgers are intentionally excluded

Files:
- [app-service-map.md](app-service-map.md) - high-level app shell, module service, persistence, and engine map
- [api-route-service-map.md](api-route-service-map.md) - API route handlers and the services they call
- [engine-function-map.md](engine-function-map.md) - Rust engine public operations and supporting deterministic helpers
- [function-inventory.md](function-inventory.md) - current exported runtime functions plus major internal helpers by area
- [runtime-function-surface.md](runtime-function-surface.md) - file-by-file runtime function surface for services, actions, libs, and UI components

Notes:
- These diagrams are documentation only. They do not define architecture beyond the canonical engine-first docs.
- `apps/web` remains the auth/UI/API/DB shell. `packages/engine-rs` remains the deterministic engine baseline.
- Generated GitNexus context was used for key service call relationships, then source files were checked directly for exported functions and route handlers.
