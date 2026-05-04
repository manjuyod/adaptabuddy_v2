import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  BundleContractMismatchError,
  HashMismatchError,
  InvalidNumericMaterialError,
  MetadataOnlyStabilityMismatchError,
  ReferenceHashMismatchError,
  ReplayCertificationBundle,
  ReplayCertificationFailure,
  UnsupportedCanonicalizationVersionError,
  ReplayInputManifest,
  ReplayManifest,
  ReplayOutputManifest,
  verifyReplayCertificationBundle,
  verifyMetadataOnlyStability,
  verifyReplayManifest,
} from "../src/replay-certification";

const loadEngine28Bundle = (): ReplayCertificationBundle =>
  JSON.parse(
    readFileSync(
      new URL(
        "../../engine-rs/fixtures/replay-certification/engine_28_manifest.json",
        import.meta.url
      ),
      "utf8"
    )
  ) as ReplayCertificationBundle;

const REPLAY_BASELINE_INPUT: ReplayInputManifest = {
  schemaVersion: "engine.v1",
  operation: "plan_session",
  determinism: {
    seed: "seed-plan-session-baseline",
    effectiveAt: "2026-02-13T10:00:00.000Z",
    ruleVersion: "rules-2026-02",
    referenceHash: "sha256:ba49fccccc6a22098b9cdd5dd9b26eb51617a0e52ab69183e4e64609dfe21fb4",
    canonicalizationVersion: "canon-replay-v1",
  },
  referenceSnapshot: {
    referenceVersion: "2026-02",
    exercises: [
      {
        id: "bench-press",
        slug: "bench-press",
        name: "Bench Press",
        movementPattern: "push",
        equipment: ["barbell", "bench"],
        tags: ["compound"],
      },
      {
        id: "incline-dumbbell-press",
        slug: "incline-dumbbell-press",
        name: "Incline Dumbbell Press",
        movementPattern: "push",
        equipment: ["dumbbells", "bench"],
        tags: ["compound"],
      },
      {
        id: "barbell-row",
        slug: "barbell-row",
        name: "Barbell Row",
        movementPattern: "pull",
        equipment: ["barbell"],
        tags: ["compound"],
      },
    ],
    programs: [
      {
        id: "program-upper-1",
        slug: "upper-strength",
        name: "Upper Strength",
        daysPerWeek: 3,
      },
    ],
  },
  stateSnapshot: {
    athleteProfile: {
      height: 178,
      weight: 82.5,
      trainingAge: 3,
      goalBias: "strength",
      availableDaysPerWeek: 3,
      classArchetype: "hybrid",
    },
    readinessState: {
      systemicFatigue: "moderate",
      muscleFatigue: {
        chest: 20,
        back: 12,
      },
    },
    injuryState: {
      activeLimitations: [],
      blockedMovementPatterns: [],
    },
    performanceState: {
      knownLifts: {
        "bench-press": {
          estimated1RM: 112.5,
          lastWeight: 100,
          lastReps: 5,
        },
      },
    },
    progressionState: {
      records: [
        {
          exerciseId: "bench-press",
          previousPerformanceReference: {
            weight: 100,
            reps: 5,
          },
          trend: "improving",
          currentAction: "maintain",
          consecutiveSuccessfulCompletions: 1,
          consecutiveStallOrRegressionCount: 0,
          swapRecommendationCount: 0,
          lastSessionOutcomeClassification: "complete_clean",
          lastCompletedAt: "2026-02-10T10:00:00.000Z",
        },
      ],
    },
    gamificationState: {
      xp: 140,
      level: 3,
      adherenceStreak: 6,
      completedSessionCount: 12,
      missedSessionCount: 0,
      lastAdherenceOutcomeClassification: "complete_clean",
      lastAwardedAt: "2026-02-10T10:00:00.000Z",
    },
    activeProgramState: {
      programId: "program-upper-1",
      currentDayIndex: 1,
      currentMicrocycle: 2,
    },
    recentCompletions: [
      {
        exerciseId: "bench-press",
        completedAt: "2026-02-10T10:00:00.000Z",
        quality: "complete_clean",
      },
    ],
  },
  policySnapshot: {
    noveltyBudget: 1,
    classArchetypeBias: 0.1,
    fatigueBlockThreshold: "severe",
    seededTieBreakBand: 0.05,
  },
  request: {
    programId: "program-upper-1",
    sessionFocus: "upper_push",
    microcycleIndex: 2,
  },
  metadata: {
    correlationId: "trace-plan-session-baseline",
  },
};

const REPLAY_BASELINE_OUTPUT: ReplayOutputManifest = {
  schemaVersion: "engine.v1",
  operation: "plan_session",
  result: {
    progressionActionSummary: [
      {
        action: "overload",
        exerciseId: "bench-press",
        trend: "improving",
      },
      {
        action: "maintain",
        exerciseId: "incline-dumbbell-press",
        trend: "stalled",
      },
    ],
    recommendedMovementFamily: "upper_push",
    recommendedSessionId: "program-upper-1-upper-push-m2",
    scoreBreakdown: {
      classBias: 0.1,
      fatigueCompatibility: 0.88,
      novelty: 0.02,
      progressionNeed: 0.92,
    },
    selectedExerciseIds: ["bench-press", "incline-dumbbell-press"],
    sessionRationale:
      "Fresh enough to overload the main push pattern while preserving shoulder safety.",
  },
  statePatch: {},
  events: [],
  decisionLog: [
    {
      details: {
        enumeratedCandidateIds: ["bench-press", "incline-dumbbell-press", "barbell-row"],
        preferredScopeBucket: "push",
        resolvedFocus: "upper_push",
        survivingScopeBucket: "push",
        wideningApplied: false,
      },
      inputsUsed: [{ path: "request.sessionFocus" }, { path: "referenceSnapshot.exercises" }],
      outcome: "preferred_scope",
      ruleId: "candidate_scope",
      stepType: "scope",
    },
    {
      details: {
        blocked: [],
        evaluatedCandidateIds: ["bench-press", "incline-dumbbell-press", "barbell-row"],
        survivingCandidateIds: ["bench-press", "incline-dumbbell-press"],
      },
      inputsUsed: [
        { path: "stateSnapshot.injuryState.blockedMovementPatterns" },
        { path: "stateSnapshot.injuryState.activeLimitations" },
        { path: "stateSnapshot.readinessState.systemicFatigue" },
      ],
      outcome: "survivors_retained",
      ruleId: "candidate_filter",
      stepType: "filter",
    },
    {
      candidateId: "bench-press",
      computedValue: 0.84,
      details: {
        breakdown: {
          classBias: 0.1,
          fatigueCompatibility: 0.88,
          novelty: 0.02,
          progressionNeed: 0.92,
        },
        eligibleForTopBand: true,
        rankPosition: 1,
      },
      inputsUsed: [
        { path: "stateSnapshot.progressionState.records", stableId: "bench-press" },
        { path: "stateSnapshot.readinessState.muscleFatigue", stableId: "bench-press" },
        { path: "policySnapshot.classArchetypeBias" },
        { path: "policySnapshot.noveltyBudget" },
      ],
      outcome: "scored",
      ruleId: "soft_scoring",
      stepType: "score",
    },
    {
      candidateId: "incline-dumbbell-press",
      computedValue: 0.81,
      details: {
        breakdown: {
          classBias: 0.1,
          fatigueCompatibility: 0.88,
          novelty: 0.02,
          progressionNeed: 0.85,
        },
        eligibleForTopBand: true,
        rankPosition: 2,
      },
      inputsUsed: [
        { path: "stateSnapshot.progressionState.records", stableId: "incline-dumbbell-press" },
        { path: "stateSnapshot.readinessState.muscleFatigue", stableId: "incline-dumbbell-press" },
        { path: "policySnapshot.classArchetypeBias" },
        { path: "policySnapshot.noveltyBudget" },
      ],
      outcome: "scored",
      ruleId: "soft_scoring",
      stepType: "score",
    },
    {
      computedValue: 0,
      details: {
        bandWidth: 0.05,
        eligibleCandidateIds: ["bench-press", "incline-dumbbell-press"],
        selectedCandidateId: "bench-press",
        selectedIndex: 0,
        topScore: 0.84,
      },
      inputsUsed: [{ path: "determinism.seed" }, { path: "request.microcycleIndex" }],
      outcome: "selected",
      ruleId: "seeded_selection",
      stepType: "tie_break",
    },
    {
      candidateId: "bench-press",
      details: {
        rankedCandidateIds: ["bench-press", "incline-dumbbell-press"],
        selectedCandidateId: "bench-press",
      },
      outcome: "selected",
      ruleId: "final_selection",
      stepType: "final_selection",
    },
  ],
  replayReceipt: {
    inputHash: "sha256:e91c90236357dee55876a4cc87d8b0b6411a0402d64195e06875726e62ac5bda",
    outputHash: "sha256:2c83284194f6d37c8f4a323d1b5095d022d1162c621ee505810b01c5200442f3",
    seedUsed: "seed-plan-session-baseline",
    effectiveAt: "2026-02-13T10:00:00.000Z",
    implementationVersion: "engine-rs-mvp-0",
    policyVersion: "policy-2026-02",
    referenceHash: "sha256:ba49fccccc6a22098b9cdd5dd9b26eb51617a0e52ab69183e4e64609dfe21fb4",
  },
};

const REPLAY_BASELINE_MANIFEST: ReplayManifest = {
  input: REPLAY_BASELINE_INPUT,
  output: REPLAY_BASELINE_OUTPUT,
  expected: {
    inputHash: "sha256:e91c90236357dee55876a4cc87d8b0b6411a0402d64195e06875726e62ac5bda",
    outputHash: "sha256:2c83284194f6d37c8f4a323d1b5095d022d1162c621ee505810b01c5200442f3",
    referenceHash: "sha256:ba49fccccc6a22098b9cdd5dd9b26eb51617a0e52ab69183e4e64609dfe21fb4",
  },
};

describe("replay certification verifier", () => {
  const cloneManifest = (manifest: ReplayManifest): ReplayManifest => {
    return JSON.parse(JSON.stringify(manifest)) as ReplayManifest;
  };

  it("reproduces reference, input, and output hashes from the manifest", () => {
    const result = verifyReplayManifest(REPLAY_BASELINE_MANIFEST);
    expect(result).toEqual({
      referenceHash: REPLAY_BASELINE_MANIFEST.expected.referenceHash,
      inputHash: REPLAY_BASELINE_MANIFEST.expected.inputHash,
      outputHash: REPLAY_BASELINE_MANIFEST.expected.outputHash,
    });
  });

  it("accepts legacy canonicalization aliases for replay hash computation", () => {
    const legacyManifest = cloneManifest(REPLAY_BASELINE_MANIFEST);
    legacyManifest.input.determinism.canonicalizationVersion = "canon-v1";
    const result = verifyReplayManifest(legacyManifest);
    expect(result.inputHash).toBe(REPLAY_BASELINE_MANIFEST.expected.inputHash);
  });

  it("throws for unsupported canonicalization version", () => {
    const invalidVersionManifest = cloneManifest(REPLAY_BASELINE_MANIFEST);
    invalidVersionManifest.input.determinism.canonicalizationVersion = "canon-v99";
    expect(() => verifyReplayManifest(invalidVersionManifest)).toThrow(
      UnsupportedCanonicalizationVersionError
    );
  });

  it("throws for reference hash mismatch", () => {
    const invalidReferenceManifest = cloneManifest(REPLAY_BASELINE_MANIFEST);
    invalidReferenceManifest.input.determinism.referenceHash = "sha256:badbeef";
    expect(() => verifyReplayManifest(invalidReferenceManifest)).toThrow(
      ReferenceHashMismatchError
    );
  });

  it("throws for invalid numeric material", () => {
    const invalidNumericManifest = cloneManifest(REPLAY_BASELINE_MANIFEST);
    invalidNumericManifest.input.stateSnapshot.athleteProfile.weight = 82.555;
    expect(() => verifyReplayManifest(invalidNumericManifest)).toThrow(
      InvalidNumericMaterialError
    );
  });

  it("throws when replay numeric containers are malformed", () => {
    const invalidNumericManifest = cloneManifest(REPLAY_BASELINE_MANIFEST);
    invalidNumericManifest.input.stateSnapshot.performanceState.knownLifts = 0;
    expect(() => verifyReplayManifest(invalidNumericManifest)).toThrow(
      InvalidNumericMaterialError
    );
  });

  it("throws for invalid initialize-cycle ratio material", () => {
    const bundle = loadEngine28Bundle();
    const initializeFixture = bundle.fixtures.find(
      (fixture) => fixture.fixtureId === "initialize-cycle-baseline"
    );
    expect(initializeFixture).toBeDefined();

    const invalidProgramWeight = cloneManifest(initializeFixture as ReplayManifest);
    invalidProgramWeight.input.request.selectedPrograms[0].weight = 0.00001;
    expect(() => verifyReplayManifest(invalidProgramWeight)).toThrow(
      InvalidNumericMaterialError
    );

    const invalidMuscleTarget = cloneManifest(initializeFixture as ReplayManifest);
    invalidMuscleTarget.input.request.selectedPrograms[0].days[0].slots[0].muscleTargets.chest =
      0.00001;
    expect(() => verifyReplayManifest(invalidMuscleTarget)).toThrow(
      InvalidNumericMaterialError
    );
  });

  it("detects metadata-only stability mismatch", () => {
    const baseline = cloneManifest(REPLAY_BASELINE_MANIFEST).input;

    const metadataOnlyVariant = cloneManifest(REPLAY_BASELINE_MANIFEST);
    metadataOnlyVariant.input.metadata = { correlationId: "trace-plan-session-metadata-only" };
    const stable = verifyMetadataOnlyStability(baseline, metadataOnlyVariant.input);
    expect(stable.baselineInputHash).toBe(stable.metadataVariantInputHash);

    const nonMetadataVariant = cloneManifest(REPLAY_BASELINE_MANIFEST);
    nonMetadataVariant.input.stateSnapshot.athleteProfile.goalBias = "power";
    expect(() =>
      verifyMetadataOnlyStability(baseline, nonMetadataVariant.input)
    ).toThrow(MetadataOnlyStabilityMismatchError);
  });

  it("throws for hash mismatch", () => {
    const wrongHashManifest = cloneManifest(REPLAY_BASELINE_MANIFEST);
    wrongHashManifest.expected.outputHash = "sha256:000000000000000000000000000000000000000000000000000000000000000000";
    expect(() => verifyReplayManifest(wrongHashManifest)).toThrow(HashMismatchError);
  });

  it("throws when output replay receipts do not match computed hashes", () => {
    const staleReceiptManifest = cloneManifest(REPLAY_BASELINE_MANIFEST);
    staleReceiptManifest.output.replayReceipt.inputHash =
      "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    expect(() => verifyReplayManifest(staleReceiptManifest)).toThrow(
      BundleContractMismatchError
    );

    const staleSeedReceiptManifest = cloneManifest(REPLAY_BASELINE_MANIFEST);
    staleSeedReceiptManifest.output.replayReceipt.seedUsed = "seed-from-a-different-run";
    expect(() => verifyReplayManifest(staleSeedReceiptManifest)).toThrow(
      BundleContractMismatchError
    );
  });

  it("throws for invalid output state patch numeric material", () => {
    const bundle = loadEngine28Bundle();
    const completeFixture = bundle.fixtures.find(
      (fixture) => fixture.fixtureId === "complete-baseline"
    );
    expect(completeFixture).toBeDefined();

    const invalidOutputNumericManifest = cloneManifest(completeFixture as ReplayManifest);
    invalidOutputNumericManifest.output.statePatch.gamificationState.xp = 140.5;
    expect(() => verifyReplayManifest(invalidOutputNumericManifest)).toThrow(
      InvalidNumericMaterialError
    );
  });

  
  it("accepts advance_cycle as a valid operation contract pair", () => {
    const advanceManifest: ReplayManifest = structuredClone(REPLAY_BASELINE_MANIFEST);
    advanceManifest.input.operation = "advance_cycle";
    advanceManifest.output.operation = "advance_cycle";

    expect(() => verifyReplayManifest(advanceManifest)).toThrow(HashMismatchError);
    expect(() => verifyReplayManifest(advanceManifest)).not.toThrow(BundleContractMismatchError);
  });
it("throws when input and output operations are paired incorrectly", () => {
    const mismatchedOperationManifest = cloneManifest(REPLAY_BASELINE_MANIFEST);
    mismatchedOperationManifest.output.operation = "complete_session";
    expect(() => verifyReplayManifest(mismatchedOperationManifest)).toThrow(
      BundleContractMismatchError
    );
  });

  it("verifies the checked-in Engine 28 Rust fixture bundle", () => {
    const bundle = loadEngine28Bundle();
    const results = verifyReplayCertificationBundle(bundle);
    expect(results).toHaveLength(bundle.fixtures.length);

    const fixtureIds = bundle.fixtures.map((fixture) => fixture.fixtureId);
    expect(fixtureIds).toEqual([
      "initialize-cycle-baseline",
      "plan-baseline",
      "plan-no-solution",
      "plan-injury-blocked",
      "complete-baseline",
      "complete-note-only-variant",
    ]);
  });

  it("rejects malformed checked-in bundle contract fields", () => {
    const invalidManifestVersion = loadEngine28Bundle();
    invalidManifestVersion.manifestVersion = "engine-28-replay-certification-v0";
    expect(() => verifyReplayCertificationBundle(invalidManifestVersion)).toThrow(
      BundleContractMismatchError
    );

    const invalidHashAlgorithm = loadEngine28Bundle();
    (invalidHashAlgorithm as unknown as { hashAlgorithm: string }).hashAlgorithm = "md5";
    expect(() => verifyReplayCertificationBundle(invalidHashAlgorithm)).toThrow(
      BundleContractMismatchError
    );

    const missingNegativeFixtures = loadEngine28Bundle();
    missingNegativeFixtures.negativeFixtures = [];
    expect(() => verifyReplayCertificationBundle(missingNegativeFixtures)).toThrow(
      BundleContractMismatchError
    );
  });

  it("proves the checked-in complete-session note-only fixture is non-material", () => {
    const bundle = loadEngine28Bundle();
    const baseline = bundle.fixtures.find((fixture) => fixture.fixtureId === "complete-baseline");
    const noteOnly = bundle.fixtures.find(
      (fixture) => fixture.fixtureId === "complete-note-only-variant"
    );

    expect(baseline).toBeDefined();
    expect(noteOnly).toBeDefined();
    expect(noteOnly?.expected.inputHash).toBe(baseline?.expected.inputHash);
    expect(noteOnly?.expected.outputHash).toBe(baseline?.expected.outputHash);
  });

  it("classifies checked-in Engine 28 negative fixtures", () => {
    const bundle = loadEngine28Bundle();
    const negativeFixtureIds = (bundle.negativeFixtures ?? []).map((fixture) => fixture.fixtureId);
    expect(negativeFixtureIds).toEqual([
      "unsupported-canonicalization-version",
      "reference-hash-mismatch-rejection",
      "invalid-numeric-material",
    ]);

    for (const negativeFixture of bundle.negativeFixtures ?? []) {
      const matchingOutput = bundle.fixtures.find(
        (fixture) => fixture.input.operation === negativeFixture.input.operation
      )?.output;
      expect(matchingOutput).toBeDefined();

      const manifest: ReplayManifest = {
        input: negativeFixture.input,
        output: matchingOutput as ReplayOutputManifest,
        expected: {
          referenceHash: negativeFixture.input.determinism.referenceHash,
          inputHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          outputHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        },
      };

      try {
        verifyReplayManifest(manifest);
        throw new Error(`${negativeFixture.fixtureId} unexpectedly verified`);
      } catch (error) {
        expect(error).toBeInstanceOf(ReplayCertificationFailure);
        expect((error as ReplayCertificationFailure).kind).toBe(
          negativeFixture.expectedFailureKind
        );
      }
    }
  });
});
