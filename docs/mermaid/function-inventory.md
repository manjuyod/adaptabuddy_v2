# Function Inventory

This inventory is grouped around runtime entry points and service surfaces. It includes exported functions and the internal helpers that currently define the main app and engine behavior.

## App API Routes

```mermaid
flowchart TB
  Health["GET /api/health<br/>getSupabaseStatus"]
  AuthCallback["GET /(auth)/callback<br/>Supabase code exchange"]
  Workouts["POST /api/v0/workouts/generate<br/>handleGenerateWorkout"]
  Initialize["POST /api/v0/sessions/initialize<br/>handleInitializeCycle"]
  Generate["POST /api/v0/sessions/generate<br/>handleGenerateSession"]
  Complete["POST /api/v0/sessions/complete<br/>handleCompleteSession"]
  HistoryList["GET /api/v0/history/list<br/>getWorkoutHistory"]
  HistoryDetail["GET /api/v0/history/[workoutId]<br/>getWorkoutDetail"]
  ActiveCycle["GET /api/v0/reporting/active-cycle<br/>getActiveCycleReporting"]
  Analytics["GET /api/v0/reporting/analytics<br/>getDeterministicAnalyticsReadModel"]
  Preferences["POST /api/v0/preferences/update<br/>handlePreferencesUpdate"]
  Optins["POST /api/v0/optins/update<br/>handleOptInUpdate"]
  Support["POST /api/v0/support/feedback<br/>submitBetaFeedback"]
  Templates["POST /api/v0/templates/resolve<br/>handleResolveTemplate"]
  Guardrails["POST /api/v0/guardrails/evaluate<br/>handleGuardrailEvaluate"]
  Volume["POST /api/v0/volume/allocate<br/>handleVolumeAllocate"]
  Progression["GET /api/v0/progression/recommend<br/>handleProgressionRecommend"]
  Deviation["POST /api/v0/deviation/analyze<br/>handleDeviationAnalyze"]
  Chaos["POST /api/v0/chaos/plan<br/>handleChaosPlan"]
```

## Module Services And Actions

```mermaid
flowchart TB
  subgraph Auth
    SignIn["signInAction"]
    SignUp["signUpAction"]
    SignOut["signOutAction"]
    Logout["logoutUserSession"]
    ToAuthed["toAuthedUser"]
  end

  subgraph Onboarding
    CompleteOnboarding["completeOnboarding"]
    NormalizeOnboarding["normalizeList<br/>fatiguePreferenceToLevel<br/>normalizeProgramWeights"]
  end

  subgraph Programs
    AvailablePrograms["getAvailablePrograms"]
    ProgramCatalog["getProgramCatalog"]
    ActiveCycleView["getUserActiveCycleView"]
    ActiveProgram["getUserActiveProgram"]
    ProgramById["getProgramById"]
    UpdateActiveProgram["updateUserActiveProgram"]
    ActivateProgramAction["activateProgramAction"]
  end

  subgraph Cycles
    InitializeCycle["handleInitializeCycle"]
    ParseClass["parseCanonicalClassArchetype<br/>parseClassPresetId"]
    ShapePrograms["toProgramSelectionPayload<br/>shapeSelectedProgramsForPreset"]
    VerifyTemplates["findProgramTemplateIntegrityErrors"]
    Projection["buildProjection"]
    CleanupCycle["cleanupInitializedCycleState"]
  end

  subgraph Sessions
    GenerateSession["handleGenerateSession"]
    CompleteSession["handleCompleteSession"]
    RecentHistory["getRecentWorkoutHistory"]
    PlanInput["buildCycleBackedPlanSessionEngineInput"]
    CompleteInput["buildCycleBackedCompleteSessionEngineInput"]
    Trace["persistEngineSessionTrace<br/>persistCompletionTrace<br/>rollbackEngineSessionTrace"]
    NormalizedCompletion["syncNormalizedCycleCompletion<br/>rollbackNormalizedCycleCompletion"]
    Compatibility["buildCycleCompatibilityProjection<br/>persistCycleCompatibilityProjection<br/>repairCompatibilityProjectionForCurrentCycle"]
  end

  subgraph Reporting
    PlanReplay["derivePlanSessionReplayDebugBundle"]
    CompleteReplay["deriveWorkoutCompletionReplayDebugBundle"]
    PlanExplanation["derivePlanSessionExplanation"]
    CompletionExplanation["deriveWorkoutCompletionExplanation"]
    ActiveReporting["getActiveCycleReporting"]
    AnalyticsReadModel["getDeterministicAnalyticsReadModel"]
    CompletionReadModels["getWorkoutCompletionReadModels"]
    Drift["detectStatsJsonCompatibilityDrift"]
  end

  subgraph ReadsAndSettings
    WorkoutHistory["getWorkoutHistory"]
    WorkoutDetail["getWorkoutDetail"]
    PreferencesUpdate["handlePreferencesUpdate"]
    OptInUpdate["handleOptInUpdate"]
    BetaFeedback["submitBetaFeedback"]
    TemplateResolve["handleResolveTemplate"]
  end

  subgraph EngineLikeEndpoints
    GenerateWorkout["handleGenerateWorkout"]
    GuardrailEvaluate["handleGuardrailEvaluate"]
    VolumeAllocate["handleVolumeAllocate"]
    ProgressionRecommend["handleProgressionRecommend"]
    DeviationAnalyze["handleDeviationAnalyze"]
    ChaosPlan["handleChaosPlan"]
  end

  CompleteOnboarding --> ProgramById
  CompleteOnboarding --> InitializeCycle
  InitializeCycle --> ShapePrograms
  InitializeCycle --> Projection
  GenerateSession --> PlanInput
  CompleteSession --> CompleteInput
  GenerateSession --> Trace
  CompleteSession --> Trace
  CompleteSession --> NormalizedCompletion
  ActiveReporting --> PlanReplay
  ActiveReporting --> CompleteReplay
```

## Shared App Libraries

```mermaid
flowchart TB
  subgraph RouteHandling["api/routeHandler.ts"]
    JsonResponse["jsonResponse"]
    RunAuthedRoute["runAuthedRoute"]
    ParseJson["parseJsonWithSchema"]
    ParseWithSchema["parseWithSchema"]
  end

  subgraph SupabaseClients["supabase clients"]
    BrowserClient["getBrowserClient"]
    ServerClient["getClient"]
    AdminClient["createSupabaseAdminClient"]
    ServerComponent["createSupabaseServerComponentClient"]
    ServerAction["createSupabaseServerActionClient"]
    MiddlewareClient["createSupabaseMiddlewareClient"]
  end

  subgraph AuthGuards["auth and routes"]
    Guard["getAuthGuardRedirect"]
    Redirect["resolveSafeRedirectTo"]
    CallbackRedirect["resolveSafeCallbackRedirect"]
    Routes["ROUTES<br/>isAuthPath"]
  end

  subgraph SecurityAndObs["security and observability"]
    RateLimit["rateLimit"]
    Headers["applySecurityHeaders"]
    RequestId["resolveRequestId<br/>attachRequestIdHeader"]
    Logger["logServerEvent"]
  end

  subgraph EngineAndData["engine and data helpers"]
    Runner["runEngineInput"]
    Replay["serializeCanonicalReplayJson<br/>computeCanonicalReplayReferenceHash"]
    DbTransforms["getDefaultUserStats<br/>buildFatigueState<br/>toExerciseData<br/>toProgramSlot<br/>toProgramDay<br/>toTemplateDay<br/>toProgramTemplate"]
    Ids["toLookupId<br/>toLookupIds<br/>toStringId"]
    Start["resolveStartScreen"]
  end

  RunAuthedRoute --> ParseJson
  RunAuthedRoute --> RateLimit
  RunAuthedRoute --> RequestId
  RunAuthedRoute --> SupabaseClients
  Guard --> Routes
  Runner --> EngineAndData
```

## UI Components

```mermaid
flowchart TB
  subgraph ShellComponents
    NavigationBar["NavigationBar"]
    AuthModeToggle["AuthModeToggle"]
    ServiceWorkerRegistration["ServiceWorkerRegistration"]
    ScreenFrame["ScreenFrame"]
    ResponsiveScreenFrame["ResponsiveScreenFrame"]
    DebugLayer["DebugLayer"]
  end

  subgraph AuthComponents
    AuthShell["AuthShell"]
    LoginScreen["LoginScreen"]
    SignupScreen["SignupScreen"]
    SignOutButton["SignOutButton"]
  end

  subgraph GameComponents
    TitleMenuScreen["TitleMenuScreen"]
    ProgramsClient["ProgramsClient"]
    WorkoutClient["WorkoutClient"]
    LogClient["LogClient"]
    GenerateClient["GenerateClient"]
    WorkoutRenderer["WorkoutRenderer"]
    DebugPanel["DebugPanel"]
  end

  subgraph OnboardingComponents
    OnboardingWizard["OnboardingWizard"]
    CharacterStep["CharacterStep"]
    EquipmentStep["EquipmentStep"]
    CycleStep["CycleStep"]
    ProgramBlendStep["ProgramBlendStep"]
    RecoveryStep["RecoveryStep"]
    ConfirmationStep["ConfirmationStep"]
  end

  subgraph ReadModelComponents
    HistoryList["HistoryList"]
    HistoryDetail["HistoryDetail"]
    SettingsPreferencesPanel["SettingsPreferencesPanel"]
    OptInSettingsPanel["OptInSettingsPanel"]
    BetaFeedbackPanel["BetaFeedbackPanel"]
    ProgressionTimelineChart["ProgressionTimelineChart"]
  end

  OnboardingWizard --> CharacterStep
  OnboardingWizard --> EquipmentStep
  OnboardingWizard --> CycleStep
  OnboardingWizard --> ProgramBlendStep
  OnboardingWizard --> RecoveryStep
  OnboardingWizard --> ConfirmationStep
```

## Contracts

```mermaid
flowchart TB
  AuthContracts["auth<br/>SessionUserSchema<br/>EmailPasswordSchema<br/>SignUpWithPasswordSchema"]
  CyclesContracts["cycles<br/>InitializeCycleRequestSchema<br/>InitializeCycleResponseSchema<br/>gamification/progression rows"]
  SessionsContracts["sessions<br/>generate and complete schemas"]
  EngineContracts["engine<br/>GeneratedSessionSchema<br/>CompletedSessionSchema<br/>StatsUpdateSchema"]
  DbContracts["db<br/>reference and log row schemas"]
  ProgramsContracts["programs<br/>catalog, day, slot, active program"]
  ReportingContracts["reporting<br/>analytics, active cycle,<br/>replay debug bundles"]
  FeatureContracts["chaos, deviation, guardrails,<br/>history, optins, preferences,<br/>progression, support,<br/>templates, volume, workouts"]

  AuthContracts --> RouteValidation["route and action validation"]
  CyclesContracts --> RouteValidation
  SessionsContracts --> RouteValidation
  EngineContracts --> RouteValidation
  DbContracts --> AppPersistence["app persistence transforms"]
  ProgramsContracts --> AppPersistence
  ReportingContracts --> ReadModels["dashboard/workout/history read models"]
  FeatureContracts --> RouteValidation
```

## Rust Engine Functions

```mermaid
flowchart TB
  PublicOps["public operations<br/>plan_session<br/>initialize_cycle<br/>complete_session"]
  Boundary["boundary<br/>parse_input<br/>parse_output<br/>to_public_input<br/>to_public_output<br/>parse_result_value"]
  Adaptation["adaptation<br/>derived_input_hash<br/>derived_output_hash<br/>build_replay_receipt<br/>operation-specific planners"]
  Constraints["constraints<br/>hard_block_records<br/>blocked_candidate_ids<br/>collapse_rejection_for_hard_blocks"]
  Progression["progression<br/>classify_trend<br/>branch_plan_action<br/>classify_completion<br/>action_from_completion<br/>progression_state_patch"]
  StateUpdate["state_update<br/>build_completion_state_patch<br/>apply_engine_owned_state_patch"]
  Derivations["derivations<br/>clamp_f64<br/>round_f64<br/>normalize_slug<br/>plan_progression_need<br/>fatigue_compatibility<br/>recommended_session_id"]
  Rng["rng<br/>fnv1a64<br/>sha256_hex<br/>derive_subseed<br/>seeded_fraction<br/>seeded_index<br/>seeded_order"]
  Replay["replay<br/>accepted_canonicalization_version<br/>canonical_policy_version<br/>quantize_f64<br/>hash_value<br/>canonical_json_bytes"]
  Logging["logging<br/>decision_log_entry<br/>filter_log<br/>score_log<br/>tie_break_log<br/>classify_log<br/>award_xp_log<br/>replay_receipt"]
  Binaries["bin<br/>engine_runner<br/>inspect_engine"]

  Binaries --> PublicOps
  PublicOps --> Boundary
  Boundary --> Adaptation
  Adaptation --> Constraints
  Adaptation --> Progression
  Adaptation --> StateUpdate
  Adaptation --> Derivations
  Adaptation --> Rng
  Adaptation --> Logging
  Adaptation --> Replay
```
