import { describe, expect, it } from "vitest";
import {
  ProgramAdaptationInputsSchema,
} from "../src/cycles";
import {
  CompleteOnboardingInputSchema,
  OnboardingCycleInputSchema,
} from "../src/onboarding";

const validStrengthBaselines = {
  squat: {
    estimatedOneRepMax: 180,
    unit: "kg",
    source: "coach-estimate",
  },
  deadlift: {
    estimatedOneRepMax: 220,
    unit: "kg",
  },
  bench_press: {
    estimatedOneRepMax: 120,
    unit: "kg",
  },
  overhead_press: {
    estimatedOneRepMax: 75,
    unit: "kg",
  },
} as const;

describe("strength baselines contracts", () => {
  it("accepts strength baselines in program adaptation inputs", () => {
    const parsed = ProgramAdaptationInputsSchema.parse({
      challengeBaselines: {
        hamstrings: {
          maxReps: 12,
        },
      },
      strengthBaselines: validStrengthBaselines,
    });

    expect(parsed.strengthBaselines.squat.estimatedOneRepMax).toBe(180);
    expect(parsed.challengeBaselines.hamstrings.maxReps).toBe(12);
  });

  it("preserves strength baselines through onboarding schemas", () => {
    const cycleInput = {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 4,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 1001, weight: 1 }],
      challengeBaselines: {
        hamstrings: {
          maxReps: 12,
        },
      },
      strengthBaselines: validStrengthBaselines,
    } as const;

    const onboardingCycleParsed = OnboardingCycleInputSchema.parse(cycleInput);
    const completeOnboardingParsed = CompleteOnboardingInputSchema.parse({
      equipment: ["barbell"],
      unitSystem: "kg",
      ...cycleInput,
    });

    expect(onboardingCycleParsed.strengthBaselines).toEqual(validStrengthBaselines);
    expect(completeOnboardingParsed.strengthBaselines).toEqual(validStrengthBaselines);
  });
});
