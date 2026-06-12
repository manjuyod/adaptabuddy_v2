import { describe, expect, it } from "vitest";
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

type ParseResult = { success: true; data: unknown } | { success: false; error?: unknown };
type TestSchema = {
  safeParse: (value: unknown) => ParseResult;
  constructor?: { name?: string };
  _def?: Record<string, unknown>;
  def?: Record<string, unknown>;
  unwrap?: () => TestSchema;
  element?: TestSchema;
  valueType?: TestSchema;
  options?: TestSchema[] | string[];
  values?: Set<unknown>;
  enum?: Record<string, string | number>;
  shape?: Record<string, TestSchema> | (() => Record<string, TestSchema>);
};

const isSchema = (value: unknown): value is TestSchema =>
  Boolean(value) && typeof (value as { safeParse?: unknown }).safeParse === "function";

const getSchemaKind = (schema: TestSchema) => schema.constructor?.name ?? "Unknown";
const getSchemaDef = (schema: TestSchema) => schema._def ?? schema.def ?? {};
const getInnerSchema = (schema: TestSchema) => {
  if (typeof schema.unwrap === "function") {
    return schema.unwrap();
  }

  const def = getSchemaDef(schema);
  return (def.innerType ?? def.schema ?? def.type ?? def.in) as TestSchema | undefined;
};
const getObjectShape = (schema: TestSchema) => {
  const def = getSchemaDef(schema);
  const shape = schema.shape ?? (def.shape as TestSchema["shape"] | undefined);
  if (!shape) {
    throw new Error("Unable to inspect object schema shape");
  }

  return typeof shape === "function" ? shape() : shape;
};
const getSchemaOptions = (schema: TestSchema) => {
  const def = getSchemaDef(schema);
  const options = schema.options ?? (def.options as TestSchema[] | string[] | undefined);
  if (!options) return undefined;
  return options instanceof Map ? Array.from(options.values()) : options;
};

const buildValidValue = (schema: TestSchema, depth = 0): unknown => {
  if (depth > 20) {
    throw new Error("Schema nesting too deep while generating valid test value");
  }

  const typeName = getSchemaKind(schema);

  if (typeName === "ZodOptional") {
    const inner = getInnerSchema(schema);
    if (!inner) throw new Error("Unable to inspect optional schema");
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === "ZodNullable") {
    const inner = getInnerSchema(schema);
    if (!inner) throw new Error("Unable to inspect nullable schema");
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === "ZodDefault") {
    const inner = getInnerSchema(schema);
    if (!inner) throw new Error("Unable to inspect defaulted schema");
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === "ZodEffects") {
    const inner = getInnerSchema(schema);
    if (!inner) throw new Error("Unable to inspect effects schema");
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === "ZodBranded") {
    const inner = getInnerSchema(schema);
    if (!inner) throw new Error("Unable to inspect branded schema");
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === "ZodPipeline") {
    const inner = getInnerSchema(schema);
    if (!inner) throw new Error("Unable to inspect pipeline schema");
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === "ZodCatch") {
    const inner = getInnerSchema(schema);
    if (!inner) throw new Error("Unable to inspect catch schema");
    return buildValidValue(inner, depth + 1);
  }

  if (typeName === "ZodLazy") {
    const getter = getSchemaDef(schema).getter as (() => TestSchema) | undefined;
    if (!getter) throw new Error("Unable to inspect lazy schema");
    return buildValidValue(getter(), depth + 1);
  }

  if (typeName === "ZodString" || typeName === "ZodGUID") {
    const candidates = [
      "11111111-1111-4111-8111-111111111111",
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

  if (typeName === "ZodNumber") {
    const candidates = [1, 0, 0.5, 2.5, 5, 10, 100];
    const match = candidates.find((candidate) => schema.safeParse(candidate).success);
    if (match === undefined) throw new Error("Unable to generate valid number value");
    return match;
  }

  if (typeName === "ZodBoolean") {
    return true;
  }

  if (typeName === "ZodArray") {
    const def = getSchemaDef(schema) as { minLength?: { value: number }; element?: TestSchema; type?: TestSchema };
    const min = Math.max(def.minLength?.value ?? 1, 1);
    const element = schema.element ?? def.element ?? def.type;
    if (!element) throw new Error("Unable to inspect array element schema");
    return Array.from({ length: min }, () => buildValidValue(element, depth + 1));
  }

  if (typeName === "ZodRecord") {
    const valueType = schema.valueType ?? (getSchemaDef(schema).valueType as TestSchema | undefined);
    if (!valueType) throw new Error("Unable to inspect record value schema");
    return { key: buildValidValue(valueType, depth + 1) };
  }

  if (typeName === "ZodTuple") {
    const items = getSchemaDef(schema).items as TestSchema[] | undefined;
    if (!items) throw new Error("Unable to inspect tuple items");
    return items.map((item) => buildValidValue(item, depth + 1));
  }

  if (typeName === "ZodObject") {
    const rawShape = getObjectShape(schema);
    const value: Record<string, unknown> = {};

    for (const [key, childSchema] of Object.entries(rawShape)) {
      value[key] = buildValidValue(childSchema as z.ZodTypeAny, depth + 1);
    }

    return value;
  }

  if (typeName === "ZodUnion") {
    const options = getSchemaOptions(schema) as TestSchema[] | undefined;
    if (!options) throw new Error("Unable to inspect union options");
    for (const option of options) {
      const candidate = buildValidValue(option, depth + 1);
      if (schema.safeParse(candidate).success) {
        return candidate;
      }
    }
    throw new Error("Unable to generate valid union value");
  }

  if (typeName === "ZodDiscriminatedUnion") {
    const options = getSchemaOptions(schema) as TestSchema[] | undefined;
    if (!options) {
      throw new Error("Unable to generate valid discriminated union value");
    }
    const candidate = buildValidValue(options[0], depth + 1);
    if (!schema.safeParse(candidate).success) {
      throw new Error("Unable to generate valid discriminated union value");
    }
    return candidate;
  }

  if (typeName === "ZodLiteral") {
    if (schema.values instanceof Set) {
      return Array.from(schema.values)[0];
    }

    const def = getSchemaDef(schema);
    const values = def.values as unknown[] | undefined;
    return values?.[0] ?? def.value;
  }

  if (typeName === "ZodEnum") {
    const options = getSchemaOptions(schema);
    if (Array.isArray(options) && typeof options[0] === "string") {
      return options[0];
    }

    const def = getSchemaDef(schema);
    const entries = (schema.enum ?? def.entries ?? def.values) as
      | Record<string, string | number>
      | string[]
      | undefined;
    if (Array.isArray(entries)) return entries[0];
    if (entries) return Object.values(entries)[0];
    throw new Error("Unable to generate valid enum value");
  }

  if (typeName === "ZodNativeEnum") {
    const values = getSchemaDef(schema).values as Record<string, string | number> | undefined;
    if (!values) throw new Error("Unable to inspect native enum values");
    const rawValues = Object.values(values);
    const match = rawValues.find(
      (value) => typeof value === "string" || typeof value === "number"
    );
    if (match === undefined) throw new Error("Unable to generate valid native enum value");
    return match;
  }

  if (typeName === "ZodDate") {
    return new Date("2026-02-13T00:00:00.000Z");
  }

  if (typeName === "ZodNull") {
    return null;
  }

  if (typeName === "ZodUndefined") {
    return undefined;
  }

  if (typeName === "ZodUnknown") {
    return "unknown";
  }

  if (typeName === "ZodAny") {
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
      let value: unknown;
      try {
        value = buildValidValue(schema);
      } catch (error) {
        throw new Error(`${name}: ${(error as Error).message}`);
      }
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
