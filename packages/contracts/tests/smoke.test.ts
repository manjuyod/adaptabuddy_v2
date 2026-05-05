import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ChaosPlanRequestSchema,
  CanonicalClassArchetypeSchema,
  CompleteSessionRequestSchema,
  DeviationAnalyzeRequestSchema,
  DeterministicAnalyticsRequestSchema,
  DeterministicAnalyticsReadModelSchema,
  DeterministicAnalyticsResponseSchema,
  GenerateSessionRequestSchema,
  GuardrailRequestSchema,
  InitializeCycleRequestSchema,
  InitializeCycleResponseSchema,
  NormalizedGamificationStateSchema,
  NormalizedProgressionStateRowSchema,
  OptInUpdateRequestSchema,
  ProgressionRecommendRequestSchema,
  RecentSessionAnalyticsSchema,
  ResolveTemplateRequestSchema,
  VolumeAllocateRequestSchema,
} from "../src";
import * as contracts from "../src";

const isSchema = (value: unknown): value is z.ZodTypeAny =>
  Boolean(value) && typeof (value as { safeParse?: unknown }).safeParse === "function";

const getTypeName = (schema: z.ZodTypeAny) =>
  (schema as unknown as { _def: { typeName: z.ZodFirstPartyTypeKind } })._def.typeName;

const buildValidValue = (schema: z.ZodTypeAny, depth = 0): unknown => {
  if (depth > 20) {
    throw new Error("Schema nesting too deep while generating valid test value");
  }

  const typeName = getTypeName(schema);

  if (typeName === z.ZodFirstPartyTypeKind.ZodOptional) {
    const inner = (schema as unknown as { _def: { innerType: z.ZodTypeAny } })._def.innerType;
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodNullable) {
    const inner = (schema as unknown as { _def: { innerType: z.ZodTypeAny } })._def.innerType;
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodDefault) {
    const inner = (schema as unknown as { _def: { innerType: z.ZodTypeAny } })._def.innerType;
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodEffects) {
    const inner = (schema as unknown as { _def: { schema: z.ZodTypeAny } })._def.schema;
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodBranded) {
    const inner = (schema as unknown as { _def: { type: z.ZodTypeAny } })._def.type;
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodPipeline) {
    const inner = (schema as unknown as { _def: { in: z.ZodTypeAny } })._def.in;
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodCatch) {
    const inner = (schema as unknown as { _def: { innerType: z.ZodTypeAny } })._def.innerType;
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodLazy) {
    const getter = (schema as unknown as { _def: { getter: () => z.ZodTypeAny } })._def.getter;
    return buildValidValue(getter(), depth + 1);
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodString) {
    const candidates = [
      "11111111-1111-1111-1111-111111111111",
      "user@example.com",
      "2026-02-13T00:00:00.000Z",
      "123",
      "seed-1",
      "main",
      "moderate",
      "normal",
      "value",
      "a",
    ];
    const match = candidates.find((candidate) => schema.safeParse(candidate).success);
    if (!match) throw new Error("Unable to generate valid string value");
    return match;
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodNumber) {
    const candidates = [1, 0, 0.5, 2.5, 5, 10, 100];
    const match = candidates.find((candidate) => schema.safeParse(candidate).success);
    if (match === undefined) throw new Error("Unable to generate valid number value");
    return match;
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodBoolean) {
    return true;
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodArray) {
    const def = (schema as unknown as { _def: { type: z.ZodTypeAny; minLength?: { value: number } } })._def;
    const min = Math.max(def.minLength?.value ?? 1, 1);
    return Array.from({ length: min }, () => buildValidValue(def.type, depth + 1));
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodRecord) {
    const valueType = (schema as unknown as { _def: { valueType: z.ZodTypeAny } })._def.valueType;
    return { key: buildValidValue(valueType, depth + 1) };
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodTuple) {
    const items = (schema as unknown as { _def: { items: z.ZodTypeAny[] } })._def.items;
    return items.map((item) => buildValidValue(item, depth + 1));
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodObject) {
    const def = (schema as unknown as { _def: { shape: (() => z.ZodRawShape) | z.ZodRawShape } })._def;
    const rawShape = typeof def.shape === "function" ? def.shape() : def.shape;
    const value: Record<string, unknown> = {};

    for (const [key, childSchema] of Object.entries(rawShape)) {
      value[key] = buildValidValue(childSchema as z.ZodTypeAny, depth + 1);
    }

    return value;
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodUnion) {
    const options = (schema as unknown as { _def: { options: z.ZodTypeAny[] } })._def.options;
    for (const option of options) {
      const candidate = buildValidValue(option, depth + 1);
      if (schema.safeParse(candidate).success) {
        return candidate;
      }
    }
    throw new Error("Unable to generate valid union value");
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodDiscriminatedUnion) {
    const def = (schema as unknown as { _def: { options: Map<string, z.ZodTypeAny> | z.ZodTypeAny[] } })._def;
    const options = def.options instanceof Map ? Array.from(def.options.values()) : def.options;
    const candidate = buildValidValue(options[0], depth + 1);
    if (!schema.safeParse(candidate).success) {
      throw new Error("Unable to generate valid discriminated union value");
    }
    return candidate;
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodLiteral) {
    return (schema as unknown as { _def: { value: unknown } })._def.value;
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodEnum) {
    return (schema as unknown as { _def: { values: string[] } })._def.values[0];
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodNativeEnum) {
    const rawValues = Object.values(
      (schema as unknown as { _def: { values: Record<string, string | number> } })._def.values
    );
    const match = rawValues.find(
      (value) => typeof value === "string" || typeof value === "number"
    );
    if (match === undefined) throw new Error("Unable to generate valid native enum value");
    return match;
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodDate) {
    return new Date("2026-02-13T00:00:00.000Z");
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodNull) {
    return null;
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodUndefined) {
    return undefined;
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodUnknown) {
    return "unknown";
  }

  if (typeName === z.ZodFirstPartyTypeKind.ZodAny) {
    return "any";
  }

  throw new Error(`Unhandled Zod schema type: ${typeName}`);
};

const schemaEntries = Object.entries(contracts)
  .filter(([name, value]) => name.endsWith("Schema") && isSchema(value))
  .sort(([a], [b]) => a.localeCompare(b));

describe("contracts smoke", () => {
  it("parses generated valid values for every exported schema", () => {
    for (const [name, schema] of schemaEntries) {
      const value = buildValidValue(schema);
      const parsed = schema.safeParse(value);
      expect(parsed.success, `${name} should parse generated valid value`).toBe(true);
    }
  });

  it("rejects obviously invalid values for every exported schema", () => {
    for (const [name, schema] of schemaEntries) {
      const parsed = schema.safeParse(Symbol.for(`invalid-${name}`));
      expect(parsed.success, `${name} should reject symbol input`).toBe(false);
    }
  });

  it("rejects key edge cases for request schemas", () => {
    expect(CanonicalClassArchetypeSchema.safeParse("strength").success).toBe(true);
    expect(CanonicalClassArchetypeSchema.safeParse("hybrid").success).toBe(true);
    expect(CanonicalClassArchetypeSchema.safeParse("legacy").success).toBe(false);
    expect(CanonicalClassArchetypeSchema.safeParse("bodybuilding").success).toBe(false);
    expect(InitializeCycleRequestSchema.safeParse({
      classPresetId: "legacy",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 1, weight: 1 }],
    }).success).toBe(false);
    expect(InitializeCycleRequestSchema.safeParse({
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: "program-1", weight: 1 }],
    }).success).toBe(false);
    expect(InitializeCycleRequestSchema.safeParse({
      classPresetId: "monk",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 1, weight: 1 }],
    }).success).toBe(false);
    expect(InitializeCycleRequestSchema.safeParse({
      classPresetId: "ninja",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 1, weight: 1 }],
    }).success).toBe(true);
    expect(InitializeCycleRequestSchema.safeParse({
      classPresetId: "powa",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "high",
      injuryMuscleGroupSlugs: ["quads"],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 1, weight: 1 }],
      programAdaptationInputs: {
        challengeBaselines: {
          push_up: { maxReps: 20 },
        },
        strengthBaselines: {
          squat: {
            estimatedOneRepMax: 225,
            unit: "lbs",
            source: "onboarding",
          },
          deadlift: {
            estimatedOneRepMax: 225,
            unit: "lbs",
          },
          bench_press: {
            estimatedOneRepMax: 100,
            unit: "lbs",
          },
          overhead_press: {
            estimatedOneRepMax: 75,
            unit: "lbs",
          },
        },
      },
    }).success).toBe(true);
    expect(contracts.AdvanceCycleRequestSchema.safeParse({
      planId: "plan-1",
      currentCycleRequest: {
        classPresetId: "powa",
        goalBias: "strength",
        availableDaysPerWeek: 3,
        fatiguePreference: "high",
        injuryMuscleGroupSlugs: ["quads"],
        macrocycleWeeks: 8,
        selectedPrograms: [
          { programId: 1, weight: 0.5 },
          { programId: 2, weight: 0.3 },
          { programId: 3, weight: 0.2 },
        ],
      },
      programAdaptationInputs: {
        challengeBaselines: {
          push_up: { maxReps: 20 },
        },
        strengthBaselines: {
          squat: {
            estimatedOneRepMax: 225,
            unit: "lbs",
          },
          deadlift: {
            estimatedOneRepMax: 225,
            unit: "lbs",
          },
          bench_press: {
            estimatedOneRepMax: 100,
            unit: "lbs",
          },
          overhead_press: {
            estimatedOneRepMax: 75,
            unit: "lbs",
          },
        },
      },
      completedSessionCount: 18,
      missedSessionCount: 0,
    }).success).toBe(true);
    expect(InitializeCycleRequestSchema.safeParse({
      classPresetId: "powa",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "high",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 1, weight: 1 }],
      programAdaptationInputs: {
        strengthBaselines: {
          squat: {
            estimatedOneRepMax: -1,
            unit: "stone",
          },
        },
      },
    }).success).toBe(false);
    expect(InitializeCycleResponseSchema.safeParse({
      status: "success",
      resolvedClassArchetype: "legacy",
    }).success).toBe(false);
    expect(InitializeCycleResponseSchema.safeParse({
      status: "success",
      planId: "plan-1",
      resolvedClassArchetype: "hybrid",
      primaryProgramId: "2001",
    }).success).toBe(false);
    expect(InitializeCycleResponseSchema.safeParse({
      status: "error",
      errors: ["bad request"],
      resolvedClassArchetype: "hybrid",
    }).success).toBe(false);
    expect(NormalizedGamificationStateSchema.safeParse({
      xp: 140,
      level: 3,
      adherenceStreak: 6,
      completedSessionCount: 12,
      missedSessionCount: 0,
      lastAdherenceOutcomeClassification: "complete_clean",
      lastAwardedAt: "2026-02-10T10:00:00.000Z",
    }).success).toBe(true);
    expect(NormalizedGamificationStateSchema.safeParse({
      xp: 140,
      level: 3,
      adherenceStreak: 6,
      completedSessionCount: -1,
      missedSessionCount: 0,
      lastAdherenceOutcomeClassification: "complete_clean",
      lastAwardedAt: "2026-02-10T10:00:00.000Z",
    }).success).toBe(false);
    expect(NormalizedProgressionStateRowSchema.safeParse({
      exerciseId: "bench-press",
      currentAction: "maintain",
      trend: "stalled",
      lastSuccessfulLoadWeight: 100,
      lastSuccessfulLoadReps: 5,
      consecutiveSuccessfulCompletions: 1,
      consecutiveStallOrRegressionCount: 0,
      swapRecommendationCount: 0,
      lastSessionOutcomeClassification: "complete_clean",
      lastCompletedAt: "2026-02-10T10:00:00.000Z",
    }).success).toBe(true);
    expect(NormalizedProgressionStateRowSchema.safeParse({
      exerciseId: "bench-press",
      currentAction: "explode",
      trend: "stalled",
      lastSuccessfulLoadWeight: 100,
      lastSuccessfulLoadReps: 5,
      consecutiveSuccessfulCompletions: 1,
      consecutiveStallOrRegressionCount: 0,
      swapRecommendationCount: 0,
      lastSessionOutcomeClassification: "complete_clean",
      lastCompletedAt: "2026-02-10T10:00:00.000Z",
    }).success).toBe(false);
    expect(DeterministicAnalyticsReadModelSchema.safeParse({
      cyclePlanId: "7",
      cycleCompletion: {
        currentSessionIndex: 1,
        currentMicrocycleIndex: 0,
        totalSessions: 3,
        completedSessions: 1,
        remainingSessions: 2,
        nextSessionIndex: 2,
        completionPercentage: 33.33,
      },
      adherence: {
        streak: 4,
        completedCount: 9,
        missedCount: 1,
        lastOutcome: "complete_clean",
        xp: 180,
        level: 3,
      },
      progression: {
        totalExercises: 1,
        trendCounts: {
          improving: 1,
          stalled: 0,
          regressing: 0,
          blocked: 0,
        },
        actionCounts: {
          overload: 1,
          maintain: 0,
          regress: 0,
          swap: 0,
        },
        swapPressure: {
          affectedExerciseCount: 0,
          recommendationCount: 0,
          exerciseIds: [],
        },
        exercises: [
          {
            exerciseId: "bench-press",
            action: "overload",
            trend: "improving",
            swapRecommendationCount: 0,
            lastOutcome: "complete_clean",
            lastCompletedAt: "2026-02-10T10:00:00.000Z",
          },
        ],
      },
      fatigueSummary: {
        items: [
          {
            muscle: "chest",
            current: 24,
            severity: "low",
          },
        ],
      },
      capacityTimeline: {
        series: [
          {
            exerciseId: "bench-press",
            exerciseLabel: "Bench Press",
            confidence: 0.8,
            points: [
              {
                date: "2026-02-10T00:00:00.000Z",
                estimated1RM: 120,
              },
            ],
          },
        ],
      },
      weeklyVolume: {
        windowStartedAt: "2026-02-04T00:00:00.000Z",
        windowEndedAt: "2026-02-10T00:00:00.000Z",
        items: [
          {
            muscle: "chest",
            sets: 12,
          },
        ],
      },
      recentSessions: [
        {
          workoutLogId: 42,
          completedAt: "2026-02-10T10:00:00.000Z",
          dayName: "Upper A",
          durationSeconds: 1800,
          totalVolume: 4200,
          setCount: 3,
          seed: "seed-1",
        },
      ],
    }).success).toBe(true);
    expect(DeterministicAnalyticsReadModelSchema.shape).toHaveProperty("fatigueSummary");
    expect(DeterministicAnalyticsReadModelSchema.shape).toHaveProperty("capacityTimeline");
    expect(DeterministicAnalyticsReadModelSchema.shape).toHaveProperty("weeklyVolume");
    expect(RecentSessionAnalyticsSchema.safeParse({
      workoutLogId: 42,
      completedAt: "2026-02-10T10:00:00.000Z",
      durationSeconds: 1800,
      totalVolume: 4200,
      setCount: 3,
      seed: "seed-1",
    }).success).toBe(false);
    expect(DeterministicAnalyticsRequestSchema.safeParse({}).success).toBe(true);
    expect(DeterministicAnalyticsRequestSchema.safeParse({ planId: "7" }).success).toBe(false);
    expect(DeterministicAnalyticsResponseSchema.safeParse({
      status: "success",
      availability: "unavailable",
      analytics: null,
    }).success).toBe(true);
    expect(DeterministicAnalyticsResponseSchema.safeParse({
      status: "error",
      errors: ["Unauthorized"],
    }).success).toBe(true);
    expect(GenerateSessionRequestSchema.safeParse({}).success).toBe(false);
    expect(CompleteSessionRequestSchema.safeParse({}).success).toBe(false);
    expect(VolumeAllocateRequestSchema.safeParse({
      totalSets: -1,
      musclePriorities: { chest: 1 },
      trainingAge: "intermediate",
    }).success).toBe(false);
    expect(ResolveTemplateRequestSchema.safeParse({
      templateId: 1,
      weekNumber: 0,
      dayNumber: 0,
    }).success).toBe(false);
    expect(ChaosPlanRequestSchema.safeParse({
      templateIds: [1],
      weeks: 1,
      daysPerWeek: 8,
    }).success).toBe(false);
    expect(ProgressionRecommendRequestSchema.safeParse({
      exerciseIds: [],
      repsMin: 6,
      repsMax: 8,
    }).success).toBe(false);
    expect(GuardrailRequestSchema.safeParse({
      action: "not-real",
      trainingAge: "intermediate",
    }).success).toBe(false);
    expect(DeviationAnalyzeRequestSchema.safeParse({
      plannedSession: {},
      actualSession: {},
      remainingPlan: [],
    }).success).toBe(false);
    expect(OptInUpdateRequestSchema.safeParse({}).success).toBe(false);
  });
});
