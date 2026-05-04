# Season Loop Roadmap

These diagrams show the current Season Loop runtime direction after Wave 8, Engine 30, and Wave 9, plus remaining release-only verification lanes.

## Product Loop

```mermaid
flowchart LR
  NewGame["New Game<br/>Wave 8 onboarding"]
  Initialize["initialize_cycle<br/>macrocycle season"]
  Plan["plan_session<br/>workout generation"]
  Complete["complete_session<br/>workout completion"]
  Advance["advance_cycle<br/>season rank, awards,<br/>next-cycle request"]
  Next["initialize_cycle(nextCycleRequest)<br/>next season"]

  NewGame --> Initialize
  Initialize --> Plan
  Plan --> Complete
  Complete --> SeasonDone{"season complete?"}
  SeasonDone -- no --> Plan
  SeasonDone -- yes --> Advance
  Advance --> Next
  Next --> Plan
```

## Engine And App Split

```mermaid
flowchart TB
  subgraph Engine["packages/engine-rs owns"]
    Initialize["initialize_cycle"]
    PlanSession["plan_session"]
    CompleteSession["complete_session"]
    AdvanceCycle["advance_cycle"]
    Backtest["season_loop_backtest<br/>headless multi-season harness"]
    Rank["season rank and awards"]
    NextRequest["bounded nextCycleRequest"]
  end

  subgraph App["apps/web owns"]
    NewGame["New Game onboarding"]
    AdvanceRoute["POST /api/v0/cycles/advance"]
    Persistence["season summaries,<br/>awards, transitions"]
    UI["dashboard and end-season UI"]
    StartNext["startNextSeasonFromTransition"]
    Release["live beta and release gates"]
  end

  NewGame --> Initialize
  CompleteSession --> AdvanceRoute
  AdvanceRoute --> AdvanceCycle
  AdvanceCycle --> Rank
  AdvanceCycle --> NextRequest
  AdvanceCycle --> Persistence
  Persistence --> UI
  UI --> StartNext
  StartNext --> Initialize
  Backtest --> AdvanceCycle
  NextRequest --> Initialize
  UI --> Release
```

## Parallel Documentation Waves

```mermaid
flowchart TB
  Plan["Season Loop doc pass"]
  EngineSpec["Cloud Wave A<br/>Engine 30 spec"]
  ProductSpec["Cloud Wave B<br/>Wave 9 product-shell spec"]
  Diagrams["Cloud Wave C<br/>Mermaid map pass"]
  Verification["Cloud Wave D<br/>verification matrix"]
  Integration["Integration review<br/>terminology and status alignment"]

  Plan --> EngineSpec
  Plan --> ProductSpec
  Plan --> Diagrams
  Plan --> Verification
  EngineSpec --> Integration
  ProductSpec --> Integration
  Diagrams --> Integration
  Verification --> Integration
```

## Verification Ladder

```mermaid
flowchart LR
  EngineTests["Engine local<br/>cargo test"]
  Backtests["Headless backtests<br/>multi-season replay"]
  AppTests["App local<br/>typecheck, lint, test, build"]
  MockedJourney["Mocked Season Loop<br/>Playwright journey"]
  LiveGates["Live Supabase and browser E2E<br/>release candidate only"]

  EngineTests --> Backtests
  Backtests --> AppTests
  AppTests --> MockedJourney
  MockedJourney --> LiveGates
```
