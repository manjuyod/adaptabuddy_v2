# Engine-First Architecture

## Purpose

This document is the canonical architecture reference for the engine-first pivot.

Adaptabuddy is prioritizing the deterministic training decision core before further expanding the product shell. The current accepted MVP baseline is the standalone Rust engine in `packages/engine-rs`, and the long-term intent is to keep expanding that isolated engine boundary in a way that remains testable, replayable, and reasoned about in isolation. This document stays language-neutral at the contract boundary while distinguishing the current Rust MVP from future boundary expansion.

## Why the Project Is Pivoting

The most complex and differentiating part of the system is not the web shell. It is the rule system that:
- selects candidate programs and templates
- filters them through hard constraints
- scores them according to recovery and preference signals
- makes seeded deterministic selections
- emits explanations that can be replayed and audited

Building the engine as the primary architectural object creates:
- clearer separation of concerns
- stronger deterministic guarantees
- better portability from the current Rust MVP toward a broader standalone engine
- cleaner testing and regression control for decision logic

Tradeoff:
- progress on product-shell surfaces may appear slower in the short term
- the system gains a more defensible foundation for complex behavior

## Architecture Split

### Engine Layer Responsibilities

The engine is responsible for:
- candidate generation
- hard-constraint filtering
- soft scoring and ranking
- recovery and fatigue budgeting
- seeded weighted selection
- deterministic state-transition math
- warning and guardrail evaluation
- raw structured output generation
- structured decision logging and replay receipts

The engine is not responsible for:
- auth
- UI rendering
- frontend state management
- direct DB access
- Supabase client usage
- request authentication
- API wrapper responses
- rate limiting
- security headers
- persistence-specific storage formats

### App Layer Responsibilities

The app shell is responsible for:
- auth and cookie sessions
- route guards and middleware
- API transport and request authentication
- edge validation and input coercion
- rate limiting and security headers
- DB reads and writes
- RLS-backed ownership enforcement
- assembling normalized engine input snapshots
- converting units into canonical engine units before invocation
- persisting engine outputs into app-owned storage shapes
- UI state, presentation, onboarding, settings, and release/runtime operations

## Boundary Principles

- The engine consumes normalized domain snapshots, not DB rows.
- The engine boundary uses stable string identifiers or slugs, not Supabase integer primary keys.
- The app is the only owner of persistence, transport, auth, and enforcement concerns.
- Zod remains a TypeScript adapter and validation layer, not the canonical cross-language engine schema.
- `users.stats_json` is an app persistence shape, not the canonical engine state model.
- Theme and other display-only preferences stay outside the engine boundary.
- Once a cycle is initialized, the canonical source for initialized-cycle identity, active cursor state, and engine-owned gamification state is the normalized table set in `packages/db/sql/`.
- `users.stats_json.activeProgram` is a compatibility projection only when a normalized active cycle exists.

## Boundary-Crossing Data Model

The engine boundary is defined around explicit snapshots:

1. `referenceSnapshot`
- exercise library
- program metadata
- broader reference domains such as templates, blocks, and muscle maps as later normalization work

2. `stateSnapshot`
- athlete profile
- readiness state
- injury state
- performance state
- progression state
- gamification state
- active program state
- recent completion summaries needed for deterministic reasoning

3. `policySnapshot`
- thresholds and toggles that affect deterministic engine behavior

4. `request`
- operation-specific payload for the decision being requested

5. `determinism`
- seed
- caller-supplied effective time
- rule version
- reference snapshot version or hash
- canonicalization version

6. `metadata`
- request correlation identifiers only
- must not change engine outcomes

## Current Rust MVP Boundary

The current `packages/engine-rs` baseline implements a narrower public boundary than the long-term architecture:

- supported public operations are `initialize_cycle`, `plan_session`, and `complete_session`
- `EngineInputV1` and `EngineOutputV1` are the public JSON envelopes
- `referenceSnapshot`, `stateSnapshot`, and `policySnapshot` are parsed into typed Rust structs before engine execution
- `request`, `metadata`, and `events` remain JSON envelope values in the MVP
- malformed request payloads are rejected before engine execution
- schema-version mismatches are rejected on both parse and serialize paths
- `statePatch` is semantic and engine-owned, not storage-shaped
- `events` remain optional and unmodeled in the MVP

Future operations and wider boundary surface area remain later boundary-revision work and should not be backfilled into the MVP contract by implication.

## Active Boundary Expansion: Season Loop

Engine 30 is the accepted next boundary-revision direction after the current Rust MVP:

- add `advance_cycle` as the season-transition operation
- evaluate completed macrocycle seasons deterministically
- emit rank, awards, bounded evolution, and a valid next-cycle request
- prove the loop through a headless local backtest harness before live beta evidence is treated as the primary architecture signal

The Season Loop does not move app responsibilities into the engine. `apps/web` still owns auth, transport, validation, persistence, RLS, UI, and release operations. The engine owns the deterministic decision behind season rank and next-cycle direction.

## Engine Contract

### `EngineInputV1`

Current public envelope:

```text
EngineInputV1
- schemaVersion
- operation
- determinism
- referenceSnapshot
- stateSnapshot
- policySnapshot
- request
- metadata
```

Current public field requirements:
- `schemaVersion`: contract version only; current value is `engine.v1`
- `operation`: one of
  - `initialize_cycle`
  - `plan_session`
  - `complete_session`
- `determinism`:
  - `seed`
  - `effectiveAt`
  - `ruleVersion`
  - `referenceHash`
  - `canonicalizationVersion`
- `referenceSnapshot`: normalized engine-facing reference data in the public envelope, parsed into typed Rust structs internally
- `stateSnapshot`: only decision-relevant mutable state in the public envelope, parsed into typed Rust structs internally
- `policySnapshot`: explicit thresholds and toggles used by the engine, parsed into a typed Rust policy struct internally
- `request`: operation-specific payload that remains a JSON envelope value in the MVP
- `metadata`: request or trace IDs that do not affect decisions

Current contract guidance:
- reject unknown fields at the typed boundary and in operation-specific request validation
- use stable arrays or deterministic keyed containers when ordering matters
- use UTC timestamps only when time is an explicit input
- never let the engine consult system clock, locale, environment, or external randomness

Long-term note:
- future boundary revisions may add explicit RNG algorithm or additional versioning fields, but those are not part of the current public `EngineInputV1` struct

### `EngineOutputV1`

Current public envelope:

```text
EngineOutputV1
- schemaVersion
- operation
- result
- statePatch
- events
- decisionLog
- replayReceipt
```

Current public field requirements:
- `result`: typed success payload or typed deterministic rejection
- `statePatch`: semantic deterministic state changes, not storage-shaped merge blobs
- `events`: optional raw JSON array in the MVP; may become a typed contract later if adopted
- `decisionLog`: structured explanation trace parsed into typed log structs internally
- `replayReceipt`:
  - `inputHash`
  - `outputHash`
  - `seedUsed`
  - `effectiveAt`
  - `implementationVersion`
  - `policyVersion`
  - `referenceHash`

Current result payload examples:
- `initialize_cycle`: resolved class archetype, weighted program blend, expanded macrocycle sessions, and initial gamification snapshot
- `plan_session`: selected session metadata, selected exercise IDs, progression action summary, score breakdown
- `complete_session`: session outcome classification, updated progression summary, awarded XP summary, level-up indicator, warnings
- deterministic rejection: typed rejection status, rejection code, and blocked candidate IDs when applicable

## Decision Model

The intended decision pipeline is:

1. Normalize inputs into engine-facing snapshots.
2. Load the requested operation and relevant policy context.
3. Generate candidate programs, templates, or exercise selections as required by the operation.
4. Apply hard constraints and record typed rejection reasons.
5. Compute soft scores for surviving candidates.
6. Apply recovery and fatigue budgeting.
7. Perform seeded selection or deterministic classification as required by the operation.
8. Emit raw structured outputs, deterministic state patch, and structured decision log.
9. Emit replay receipt sufficient for offline reproduction.

## Invariants

- Same canonical input plus same seed and rule versions yields the same output.
- The engine performs no IO.
- The engine reads no external clock or environment state.
- All referenced identifiers in outputs must exist in the input snapshots.
- Output ordering must preserve structural ordering requirements from the request or reference snapshots.
- Deterministic rejection paths must use typed codes, not ad hoc prose.
- Explanation artifacts must match the actual executed decision path.
- State patches must remain engine-owned semantic updates.

## Determinism and Replay Requirements

- The caller provides `effectiveAt`; the engine never calls wall clock time.
- Reference, policy, and state snapshots must be versioned or hashable.
- Canonical serialization rules must be documented before cross-language replay is considered stable.
- Numeric precision rules must be fixed at the contract boundary before cross-language stability is claimed.
- Replay bundles must be sufficient to rerun the decision offline with no DB or API access.

Current MVP note:
- RNG algorithm choice is currently implementation-owned in the Rust MVP; if surfaced publicly later, it must be versioned as part of the boundary contract.
- The Wave 3 projection-cleanup boundary is complete; normalized cycle tables are now the canonical app-side source for initialized-cycle identity, cursor, and gamification state.
- `users.stats_json.activeProgram` remains only as a compatibility fallback for pre-cycle and legacy flows.

Open unresolved items:
- final event-versus-patch output policy

## Decision-Log Requirements

The decision log is structured first and human-readable second.

Each step should include:
- `stepType`
- `ruleId`
- `inputsUsed`
- target or candidate identifier where relevant
- computed values where relevant
- outcome

Examples by operation:
- session planning: filters, scored candidates, tie-breaks, final selection
- completion: formulas used, source observations, thresholds crossed, resulting patch entries
- future guardrails or broader planning operations: triggered rule, severity, blocker status, opt-in effect

Human-readable summaries should be derived from the structured decision log rather than used as the canonical explanation data.

## Testing Strategy (Spec Only)

The engine-first testing philosophy is:
- fixture-based deterministic tests
- golden or snapshot outputs for stable reference cases
- seed-based replayability checks
- property or invariant testing for core decision rules
- regression fixtures for edge conditions and no-solution cases

The purpose is to validate the decision core in isolation before app integration concerns are allowed to dominate design.

## Roadmap Snapshot

This architecture document defines the engine/app boundary. It does not own the full roadmap ledger.

Roadmap details, active queue status, latest completed numbered spec, wave status, and acceptance criteria live in `specs/overall_plan.md`.

Historical completed specs live under `docs/archive/specs/` and are indexed by `docs/archive/specs/README.md`.

Durable handoff/status memory lives under `docs/hippocampus/` and `specs/hippocampus/`.

## Risks and Tradeoffs

Benefits:
- cleaner separation of concerns
- stronger deterministic guarantees
- easier isolated testing
- stronger portability from the current Rust MVP toward broader standalone-engine use
- clearer explainability and replay support

Costs:
- slower visible app-shell progress during early phases
- additional contract design work up front
- more explicit adapter boundaries to maintain
- eventual multi-language toolchain complexity

Open risks to keep explicit:
- persistence shapes biasing the engine model
- DB-centric identifiers leaking into the engine boundary
- mixed app-owned versus engine-owned state remaining underspecified
- app-built engine inputs lagging behind completed Rust replay policy
