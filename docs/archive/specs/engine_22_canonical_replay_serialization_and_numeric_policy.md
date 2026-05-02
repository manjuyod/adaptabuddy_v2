# Engine 22: Canonical Replay Serialization and Numeric Policy

## Goal

Close the replay-policy gaps that remained after Engine 21:

- canonical byte serialization for replay-relevant engine input and output material
- replay hash algorithm and hash-version policy
- numeric representation rules required for deterministic replay across implementations

This spec completed the replay policy and Rust implementation slice for the current V1 engine envelopes. It does not add app API/UI changes, database changes, contract-package changes, or public envelope fields.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_04_scoring_selection_and_decision_logs.md`
  - `docs/archive/specs/engine_05_testing_and_replay.md`
  - `docs/archive/specs/engine_21_analytics_api_endpoint.md`
  - `docs/architecture/engine_first_architecture.md`
  - `specs/hippocampus/domain_model_notes.md`
  - `specs/hippocampus/test_strategy_notes.md`

## Current Baseline

The current accepted implementation baseline is the Rust engine in `packages/engine-rs`, with public JSON envelopes:

- `EngineInputV1`
- `EngineOutputV1`

The current public operation set remains:

- `initialize_cycle`
- `plan_session`
- `complete_session`

Replay policy already settled by prior specs:

- `replayReceipt.inputHash` covers outcome-relevant public input material:
  - `schemaVersion`
  - `operation`
  - `determinism`
  - `referenceSnapshot`
  - `stateSnapshot`
  - `policySnapshot`
  - `request`
- `replayReceipt.inputHash` excludes:
  - `metadata`
  - current non-decision free-text completion notes identified by Engine 02 and Engine 05
- `replayReceipt.outputHash` covers public output material excluding `replayReceipt` itself:
  - `schemaVersion`
  - `operation`
  - `result`
  - `statePatch`
  - `events`
  - `decisionLog`
- `replayReceipt.referenceHash` must equal `determinism.referenceHash`.
- Current Rust tests prove implementation-local replay stability for named fixtures and replay variants.

Engine 22 now closes:

- canonical byte serialization
- replay hash algorithm and hash-policy versioning
- numeric representation and quantization rules for replay-relevant material
- future fixture expectations for canonical serialization, hash behavior, numeric behavior, and cross-implementation certification

Current Rust receipt strings remain implementation-local evidence until this policy is implemented and verified. Existing receipt strings are not retroactively cross-language canonical.

## Boundary Decision

Engine 22 is a replay-policy and Rust implementation slice, not an engine-envelope revision.

This spec preserves:

- `EngineInputV1`
- `EngineOutputV1`
- `initialize_cycle`
- `plan_session`
- `complete_session`
- semantic replay-hash field membership from Engine 02, Engine 04, and Engine 05
- current decision-log and replay-receipt field meanings

This spec does not add a new public operation, schema version, app endpoint, database table, or `stats_json` projection.

Policy can be implemented behind the current V1 envelopes by treating `determinism.canonicalizationVersion` as the caller-visible replay-policy selector. A later boundary-revision spec is required only if the team decides to expose separate public fields for hash algorithm, canonical serializer name, or numeric policy.

## Closed Policy

### 1. Replay policy identity

The first accepted replay policy is:

- canonicalization and numeric policy: `canon-replay-v1`
- hash policy: `replay-hash-v1`
- hash algorithm: SHA-256
- public hash string format: `sha256:` followed by 64 lowercase hexadecimal characters

For V1 envelopes, `determinism.canonicalizationVersion` must identify the canonical input normalization, canonical JSON serialization, hash policy, and numeric representation rules used for authoritative replay hashes.

Comparison rule:

- Replay hashes are comparable only when `schemaVersion`, `operation`, `determinism.ruleVersion`, and `determinism.canonicalizationVersion` match.
- Under the preserved V1 envelopes, `outputHash` comparison is not self-contained because `EngineOutputV1` does not carry `ruleVersion` or `canonicalizationVersion`. Auditors must compare an output hash together with the originating `EngineInputV1` or an equivalent replay bundle that carries those version fields.
- `replayReceipt.policyVersion` and `replayReceipt.implementationVersion` remain receipt metadata. They do not replace `determinism.ruleVersion` or `determinism.canonicalizationVersion`.
- A future hash algorithm or incompatible canonicalization change must use a new canonicalization version or a later public boundary revision. Hashes from different policies must not be compared as equivalent evidence.

Compatibility rule:

- Existing Rust `sha256:*` receipts emitted before `canon-replay-v1` implementation are legacy implementation-local receipts.
- They may remain useful for regression evidence inside the Rust crate.
- They must not be treated as cross-language certification unless regenerated by an implementation that explicitly supports `canon-replay-v1`.

### 2. Canonical replay material

Canonicalization operates on parsed, validated, typed public values after all operation-specific normalization and replay-material projection are complete. It does not operate on raw inbound JSON text.

The canonicalization pipeline is:

1. Validate the public envelope and operation-specific request shape.
2. Reject unknown fields at the typed boundary before canonicalization.
3. Normalize domain-specific material required by prior specs, including canonical units, UTC timestamp strings, stable identifier ordering, and bounded history rules.
4. Project the exact replay material for `inputHash`, `outputHash`, or `referenceHash`.
5. Quantize replay-relevant numeric values according to this spec.
6. Serialize the projected value with the canonical JSON profile below.
7. Hash the resulting UTF-8 bytes with the active hash policy.

Failure rule:

- If validation, normalization, numeric quantization, serialization, or reference-hash verification cannot produce canonical bytes, the engine must reject the input before deterministic engine execution.
- That failure is a canonicalization or invalid-input failure, not a best-effort warning.

### 3. Canonical JSON byte profile

The canonical byte format is a constrained JSON profile:

- Encoding is UTF-8 with no byte-order mark.
- Output contains no insignificant whitespace.
- Object member names are sorted by ascending UTF-8 byte order.
- Object member names are unique after parsing. Duplicate raw JSON keys are invalid at the app edge or typed boundary.
- Arrays preserve the order of the normalized value. The generic serializer does not sort arrays.
- Arrays that represent unordered sets or keyed collections must already be normalized into deterministic order before serialization.
- Semantically ordered arrays, including `decisionLog`, performed exercise arrays, set arrays, ranked candidates, and emitted macrocycle/session order, preserve their normalized sequence.
- `null` and absent optional fields are distinct. Canonicalization does not inject `null` for an omitted field and does not drop an explicit `null` where the public schema allows it.
- Empty arrays, empty objects, omitted optional fields, and explicit `null` remain distinct canonical values.
- Booleans serialize as `true` or `false`.
- Strings serialize as JSON strings without locale, Unicode normalization, trimming, or case-folding.
- String escaping must produce valid JSON and must not escape printable ASCII except quotation mark and reverse solidus. Control characters use the shortest standard JSON escape when one exists, otherwise lowercase `\u00xx`.
- Non-ASCII Unicode scalar values serialize as UTF-8 characters, not `\u` escapes, except where a control escape is required. Invalid Unicode and lone surrogate values are invalid canonical material.
- Timestamps serialize as strings that were already normalized to UTC RFC3339 with a trailing `Z`. Offset timestamps are not accepted as canonical replay material.
- Integer numbers serialize in base 10 with no leading plus sign, no leading zeros except the literal `0`, and no exponent.
- Fixed-point decimal numbers serialize from their scaled integer representation, not directly from binary floating-point formatting. They use the minimum decimal digits needed after trimming trailing fractional zeros. Whole fixed-point values serialize as integers.

Examples:

- zero serializes as `0`, never `-0` or `0.0`
- a score value of eighty hundredths serializes as `0.8`
- a score value of eighty-eight hundredths serializes as `0.88`
- a kilogram value of 8250 centikilograms serializes as `82.5`

### 4. `referenceHash` derivation

`determinism.referenceHash` is the SHA-256 hash of the canonical JSON bytes for the normalized `referenceSnapshot` alone under `canon-replay-v1`.

Rules:

- `referenceSnapshot.referenceVersion` remains semantic reference-bundle metadata.
- `determinism.referenceHash` remains the replay content identity for the normalized reference snapshot.
- The engine must recompute the canonical reference hash before deterministic execution.
- A mismatch between the recomputed reference hash and `determinism.referenceHash` is an invalid canonical input.
- `replayReceipt.referenceHash` must copy the accepted `determinism.referenceHash`.

Existing placeholder reference hashes such as `sha256:reference-baseline` are not compliant with this policy. They remain fixture placeholders until implementation updates the fixture set.

### 5. `inputHash` derivation

`inputHash` is the SHA-256 hash of the canonical JSON bytes for the authoritative decision input material.

The material object contains exactly:

- `schemaVersion`
- `operation`
- `determinism`
- `referenceSnapshot`
- `stateSnapshot`
- `policySnapshot`
- `request`

Rules:

- `metadata` is never included.
- For `complete_session`, `request.session.notes` is removed before input hashing.
- For `complete_session`, `request.session.exercises[].sets[].notes` is removed before input hashing.
- No other fields are removed unless a later numbered spec marks them non-decision material.
- `determinism.canonicalizationVersion` is included in the hashed material. Changing the replay policy version is therefore a material hash change.
- `referenceSnapshot` is included in `inputHash` even though it also has `referenceHash`; this preserves complete offline replay material in the input receipt.
- `stateSnapshot.recentCompletions` uses the Engine 02 bounded-window canonical ordering before serialization.
- Domain-specific canonical ordering required by Engine 02 applies before generic JSON serialization. The generic canonical serializer does not infer semantic array ordering by itself.

Decision target now closed:

- Same validated canonical decision input under the same `ruleVersion` and `canonicalizationVersion` produces the same `inputHash` independent of source map ordering, locale, platform, serializer defaults, or binary floating-point rendering.

### 6. `outputHash` derivation

`outputHash` is the SHA-256 hash of the canonical JSON bytes for public output material with `replayReceipt` absent.

The material object contains exactly:

- `schemaVersion`
- `operation`
- `result`
- `statePatch`
- `events`
- `decisionLog`

Rules:

- The engine computes `outputHash` after deterministic execution and before attaching the final replay receipt.
- Equivalently, an auditor may remove `replayReceipt` from a public `EngineOutputV1` object and hash the remaining canonical public output material.
- Deterministic rejection outputs are canonicalized the same way as successful outputs.
- `decisionLog` entry order is replay-relevant and must be preserved exactly.
- `events` remains part of the hash while it remains part of `EngineOutputV1`, even though current events are optional and unmodeled.
- Empty `events` serializes as an empty array when the public output contains an empty array. An omitted optional future `events` field would be different material and would require a boundary decision.
- Omitted optional fields inside `result`, `statePatch`, `events`, and `decisionLog` remain omitted; explicit `null` is only allowed where the public schema allows it and hashes differently from omission.

Decision target now closed:

- Same canonical public output under the same `ruleVersion` and `canonicalizationVersion` produces the same `outputHash` without hashing the replay receipt into itself.

### 7. Numeric representation policy

Numeric policy is representation policy only. It does not retune scoring weights, fatigue thresholds, XP awards, progression caps, novelty budgets, class-bias limits, or any other heuristic constant.

#### 7.1 Numeric classes

Replay-relevant numeric values must belong to one of these classes:

| Class | Scale | Examples |
| --- | --- | --- |
| `count-int` | integer | reps, days, set indices, cycle indices, counters, XP, level, streak, RPE, RIR |
| `kg-cent` | 0.01 kg | bodyweight, external load, estimated 1RM, previous load references |
| `ratio-4` | 0.0001 | program blend weights, policy weights, policy bands, bounded ratios |
| `score-2` | 0.01 | public score breakdown values, total scores, fatigue compatibility, readiness percentages, public percentages |

Rules:

- `count-int` values must be JSON integers and must not have fractional input.
- `kg-cent`, `ratio-4`, and `score-2` are fixed-point values represented internally as signed or unsigned scaled integers as appropriate for the field.
- Public JSON may expose fixed-point values as JSON numbers, but the authoritative value is the scaled integer after quantization.
- Public score breakdown values and total scores use `score-2`.
- `policySnapshot.seededTieBreakBand` uses `score-2` for top-band comparison.
- Program blend weights and policy weights use `ratio-4` unless a field is explicitly a score or percentage.
- Load values use `kg-cent`.

#### 7.2 Quantization and rounding

Quantization rule:

- Caller-supplied replay input values must already fit their declared fixed-point scale after app normalization. Excess precision is invalid input, not something the engine rounds silently.
- Computed replay-relevant values are converted to the field's scaled integer by multiplying by the scale factor and rounding to nearest integer.
- Exact half increments for computed values round away from zero.
- Current V1 replay-relevant quantities are non-negative unless a later spec explicitly allows a negative value.

Comparison rule:

- Deterministic branching, ranking, equality, top-band eligibility, public result values, decision-log numeric values, and replay hashing must all use the same quantized value.
- Implementations must not branch on an unquantized binary floating-point value and then serialize a rounded value.
- For `plan_session`, score category values are quantized to `score-2` before total-score calculation. Total score is then computed from those quantized category values and quantized to `score-2` before ranking and top-band eligibility.
- If the same numeric fact appears in both `result` and `decisionLog`, the shared quantized value is authoritative. A mismatch is an engine defect.

Serialization rule:

- Canonical JSON rendering serializes fixed-point numbers from their scaled integer representation.
- Trailing fractional zeros are trimmed.
- Negative zero is not a valid canonical value and must serialize as `0` after quantization only when the scaled integer is zero.

Invalid numeric values:

- `NaN`, positive infinity, negative infinity, negative zero in replay-relevant input, and values outside field bounds are invalid.
- Fractional input for `count-int` fields is invalid.
- Caller-supplied values that cannot be represented exactly in the field's fixed-point scale are invalid.
- Computed values must be quantized before any deterministic branching, ranking, logging, public output, or replay hashing.

#### 7.3 Current V1 field guidance

Required integer fields include:

- reps, days per week, set indices, slot indices, day indices, microcycle indices, week indices, counters, XP, level, adherence streak, RPE, and RIR
- `readinessState.muscleFatigue` points
- gamification counters and progression counters

Fixed-point public fields include:

- bodyweight and load-like values as `kg-cent`
- program blend weights and policy ratio fields as `ratio-4`
- score breakdown values, computed score values, top scores, band widths, fatigue compatibility, readiness percentages, and derived public percentages as `score-2`

This guidance applies to replay-relevant material only. Display-only formatting remains app/UI-owned and must not feed replay hashes.

### 8. Events policy

Engine 22 does not decide whether the engine should emit typed domain events.

Current policy:

- While `events` remains part of `EngineOutputV1`, the current `events` material participates in `outputHash`.
- Event array order is replay-relevant.
- Event object keys use the same canonical JSON object ordering as the rest of the output material.
- If later work removes, types, or reinterprets events, that requires a separate boundary decision because it can change output hashes.

## Verification And Acceptance Rules

Acceptance for Engine 22 requires:

- the spec preserves current `EngineInputV1`, `EngineOutputV1`, and operation names;
- canonical serialization is defined as a typed-value canonical JSON byte profile rather than implementation-local serializer behavior;
- `inputHash`, `outputHash`, and `referenceHash` derivation are explicit;
- SHA-256 is selected as the first accepted V1 replay hash algorithm;
- hash comparison is explicitly version-gated by `determinism.canonicalizationVersion`;
- existing Rust hashes are described as legacy implementation-local evidence until regenerated under `canon-replay-v1`;
- numeric representation policy is clearly separate from heuristic tuning constants;
- deterministic branching, ranking, logging, public numeric output, and replay hashing use the same quantized values;
- fixture and golden expectations are stated at the policy level without inventing exact future golden payloads;
- events are kept out of scope except for current participation in `outputHash`;
- the Rust implementation slice enforces the accepted policy without changing public engine envelopes.

Implementation acceptance includes:

- deterministic unit tests for canonical serializer bytes;
- replay-hash tests for `inputHash`, `outputHash`, `referenceHash`, and canonicalization-version behavior;
- validation tests rejecting unknown fields, duplicate object keys where detectable, unsupported canonicalization versions, invalid timestamps, invalid numeric values, and reference-hash mismatch;
- numeric representation tests for rounding, quantization, invalid numeric rejection, equality/ranking boundaries, top-band inclusion, and shared result/log numeric values;
- output hashing fixtures proving `replayReceipt` is excluded from `outputHash`;
- decision-log ordering fixtures proving ordered trace material participates in `outputHash`;
- metadata-only and free-text-note variants proving authoritative hashes remain stable;
- material canonicalization-difference fixtures proving authoritative hashes change;
- existing replay-chain and baseline-golden tests updated only where the accepted policy intentionally changes receipt bytes;
- at least one fixture bundle suitable for future cross-language parity checks.

## Fixture And Golden Policy

Expected fixture classes:

- canonicalization-equivalent inputs that produce identical hashes
- material canonicalization differences that produce different hashes
- metadata-only and free-text-note variants that preserve authoritative hashes
- reference-hash mismatch fixtures that reject before engine execution
- unsupported canonicalization-version fixtures that reject before engine execution
- output hashing fixtures proving `replayReceipt` is excluded from `outputHash`
- decision-log ordering fixtures proving ordered trace material participates in `outputHash`
- event-order fixtures while `events` remains in `EngineOutputV1`
- numeric boundary fixtures for fixed-point rendering, rounding, quantization, score equality, top-band inclusion, and rejection of invalid numbers
- cross-implementation fixture bundles once another implementation exists

Golden policy:

- Keep the existing full-golden discipline from Engine 05.
- Use a small number of human-reviewable canonicalization goldens when implementation begins.
- Prefer partial assertions for branch behavior and heuristic-sensitive outputs.
- Do not update hash goldens without a written explanation of the contract or policy change.
- Do not promote existing implementation-local hash strings to cross-language golden status without regenerating them under `canon-replay-v1`.

## Explicit Out Of Scope

- app API/UI work
- database migrations or persistence-shape changes
- `users.stats_json` cleanup
- changes to `EngineInputV1` or `EngineOutputV1` unless a later accepted boundary-revision spec explicitly requires them
- new engine operations
- scoring, fatigue, XP, progression, novelty, or class-bias heuristic retuning
- typed domain-event design beyond current `events` participation in `outputHash`
- cross-language replay certification before another implementation exists and is verified against the canonical fixture bundle

## Completion Result

Engine 22 closes the replay-policy gap by selecting and implementing:

- `canon-replay-v1` as the canonical serialization and numeric policy identity;
- SHA-256 with `sha256:<lowercase-hex>` as the first replay hash policy;
- typed validated public values, not raw JSON text, as the canonicalization source;
- deterministic canonical JSON bytes with sorted object keys, preserved array order, explicit absent-versus-null behavior, and fixed-point numeric rendering;
- explicit derivation rules for `referenceHash`, `inputHash`, and `outputHash`;
- fixed-point numeric classes for counts, loads, ratios, and scores;
- fixture and golden updates for the Rust implementation, while leaving future cross-language certification for a later pass.

The completed Rust slice adds the canonical serializer, reference-hash verification, canonicalization-version enforcement with a `canon-v1` compatibility alias, hash-safe numeric validation/quantization, fixture updates, and replay-hash tests without widening the V1 public envelopes.

## Completion Target

Engine 22 closed when the team accepted and implemented this concrete replay serialization, hash-version, and numeric representation policy for the Rust MVP baseline.
