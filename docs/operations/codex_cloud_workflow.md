# Codex Cloud Workflow

This runbook prepares Codex cloud tasks for repository work that should become GitHub pull requests. Keep the cloud environment focused on non-secret setup, deterministic checks, and small reviewable changes.

## Environment Setup

Configure the Codex cloud environment from the repository root.

Recommended setup script:

```bash
bash scripts/codex/setup.sh
```

Recommended maintenance script:

```bash
bash scripts/codex/maintenance.sh
```

Required runtime/tooling expectations:

- Node.js 20
- npm with lockfile installs through `npm ci`
- Rust/Cargo available for `packages/engine-rs`
- Internet access during setup only

The setup scripts install npm workspaces and prefetch Rust engine dependencies. They intentionally do not run app builds or tests, so task startup stays fast and verification remains explicit in the agent work log.

## Environment Variables

Set non-secret defaults in the Codex environment when useful:

```text
NEXT_TELEMETRY_DISABLED=1
RUN_SUPABASE_E2E_VERIFICATION=0
RUN_PLAYWRIGHT_E2E=0
```

Do not put production secrets in repo files. Only configure live Supabase credentials for tasks that explicitly require live verification.

Use environment variables, not secrets, for values the agent must inspect during the task:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_TEST_EMAIL`
- `SUPABASE_TEST_PASSWORD`

Use secrets only for setup-time material. Codex removes secrets before the agent phase, so do not store values there if tests need them after setup.

Live verification keys:

- Prefer a dedicated non-production Supabase project.
- Use `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_TARGET_SERVICE_ROLE_KEY` only for explicit live E2E tasks.
- Keep `RUN_SUPABASE_E2E_VERIFICATION=0` and `RUN_PLAYWRIGHT_E2E=0` for normal PR work.

## Network Policy

Default agent-phase internet access should stay off. If a task needs network access, prefer a narrow allowlist and read-only methods.

Recommended allowlist for dependency or documentation tasks:

- `github.com`
- `githubusercontent.com`
- `npmjs.com`
- `npmjs.org`
- `crates.io`
- `static.crates.io`
- `index.crates.io`
- `rustup.rs`
- `nodejs.org`
- `developers.openai.com`
- `platform.openai.com`

Allowed methods should normally be `GET`, `HEAD`, and `OPTIONS`. Avoid unrestricted internet access unless the task cannot be completed otherwise and the resulting work log is reviewed carefully.

## Task Routing Rules

Use Codex cloud for branchable PR work:

- documentation and runbook updates
- deterministic engine changes
- app-shell changes that can be verified without production secrets
- test, lint, typecheck, build, and CI repair

Do not use cloud tasks to:

- inspect or modify `.env`
- rotate credentials
- apply live database migrations
- promote release candidates without explicit human approval
- mutate roadmap/spec plans without explicit confirmation

## Usage Throttle Policy

Track GPT-5.3 Codex Spark / Blaziken usage and regular Codex cloud usage separately before starting cloud work.

- If either usage pool is near 10% remaining, avoid starting nonessential work on that pool.
- If both Spark/Blaziken and regular Codex cloud usage are near 10% remaining, pause Codex cloud usage entirely until quota returns.
- Exceptions require explicit human approval and should be limited to urgent release, security, or production-blocking work.

## Spark-First Coding Rule

For first-pass implementation of bounded coding tasks, route the initial patch to GPT-5.3 Codex Spark / Blaziken before deeper review.

Use this pattern for the first pass:

```text
Use Blaziken / GPT-5.3 Codex Spark for the first implementation pass.
Scope: <files or module>
Task: <bounded change>
Return: files inspected, files changed, verification run, risks, and recommended next action.
Do not revert unrelated edits. Do not expand scope beyond the files listed without explaining why.
```

After the Spark first pass, a stronger reviewer or main Codex session should inspect the diff, run the relevant gates, and handle integration risks.

Skip Spark-first only when:

- the task is a high-risk architecture decision
- the change spans multiple tightly coupled subsystems
- a production secret, auth boundary, RLS policy, or release promotion decision is involved
- the user explicitly asks for direct senior-agent implementation

## Required Verification

The default pre-PR gate is:

```bash
npm run ci:quality
```

This runs:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:engine`

For product-shell release candidates, also run the manual gates from `docs/operations/deployment_verification_checklist.md`.

## Season Loop Cloud Wave Matrix

Use this matrix for the Season Loop doc pass and follow-on implementation tasks.

| Wave | Scope | Default verification | Live services |
| --- | --- | --- | --- |
| A | Engine 30 spec and Rust implementation | `npm run test:engine` plus Engine 30 backtest gates | none |
| B | Wave 9 app/API/contracts/product-shell work | `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` | none |
| C | Mermaid and documentation maps | Markdown link review and Mermaid render or parse check | none |
| D | Verification docs and cloud runbooks | Review against this runbook and `specs/overall_plan.md` | none |
| Integration | Cross-wave terminology and status alignment | `npm run ci:quality` when code changes exist; doc checks for doc-only work | none by default |

Season Loop work stays local-first:

- Engine evidence comes from deterministic fixtures, replay receipts, and headless backtests.
- Product-shell evidence comes from mocked local app tests and local browser journeys.
- Live Supabase and live Playwright gates resume only for release candidates after the Season Loop is complete enough to test meaningful behavior.
- Do not inspect `.env`, use live Supabase credentials, or enable `RUN_SUPABASE_E2E_VERIFICATION=1` / `RUN_PLAYWRIGHT_E2E=1` in normal cloud tasks.

For live Supabase E2E:

```bash
RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts
```

For Playwright browser E2E:

```bash
RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright
```

## Pull Request Standard

Every Codex cloud PR should include:

- summary of changed files
- verification commands and results
- skipped checks with a concrete reason
- note whether Spark/Blaziken was used for first-pass coding
- any secrets, live services, or manual release gates intentionally avoided
