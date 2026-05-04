// @vitest-environment jsdom

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProgramCatalogItem } from "@/modules/programs/contracts";
import { completeOnboarding } from "@/modules/onboarding/actions";
import { CharacterStep } from "@/modules/onboarding/components/CharacterStep";
import { ConfirmationStep } from "@/modules/onboarding/components/ConfirmationStep";
import { CycleStep } from "@/modules/onboarding/components/CycleStep";
import { EquipmentStep } from "@/modules/onboarding/components/EquipmentStep";
import { RecoveryStep } from "@/modules/onboarding/components/PreferencesStep";
import { OnboardingWizard } from "@/modules/onboarding/components/OnboardingWizard";
import { ProgramBlendStep } from "@/modules/onboarding/components/ProgramStep";

const mockRouter = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/modules/onboarding/actions", () => ({
  completeOnboarding: vi.fn(),
}));

const mockedCompleteOnboarding = vi.mocked(completeOnboarding);

const programs: ProgramCatalogItem[] = [
  {
    id: 1,
    slug: "upper-lower",
    name: "Upper Lower",
    description: "Balanced hypertrophy split",
    default_days_per_week: 4,
    min_days_per_week: 3,
    max_days_per_week: 5,
    is_active: true,
    muscleCoverage: [
      { muscle: "chest", score: 3.4 },
      { muscle: "back", score: 3.1 },
    ],
    days: [],
  },
  {
    id: 2,
    slug: "full-body",
    name: "Full Body",
    description: "High frequency hybrid",
    default_days_per_week: 3,
    min_days_per_week: 3,
    max_days_per_week: 4,
    is_active: true,
    muscleCoverage: [
      { muscle: "quads", score: 2.2 },
      { muscle: "hamstrings", score: 2.4 },
    ],
    days: [],
  },
];

const strengthPrograms: ProgramCatalogItem[] = [
  ...programs,
  {
    id: 3,
    slug: "powerlifting-core",
    name: "Powerlifting Core",
    description: "Heavy compound training",
    default_days_per_week: 3,
    min_days_per_week: 3,
    max_days_per_week: 4,
    is_active: true,
    muscleCoverage: [
      { muscle: "chest", score: 3.8 },
      { muscle: "back", score: 3.5 },
    ],
    days: [],
    templateKind: "slot_based",
    requiresStrengthBaselines: true,
  },
  {
    id: 4,
    slug: "bench-press-challenge",
    name: "Bench Press Challenge",
    description: "Challenge progression",
    default_days_per_week: 3,
    min_days_per_week: 3,
    max_days_per_week: 3,
    is_active: true,
    muscleCoverage: [{ muscle: "chest", score: 4 }],
    days: [],
    templateKind: "challenge_progression",
    adaptiveSummary: "Adaptive challenge progression for Bench Press",
    challengeExerciseSlug: "bench-press",
    challengeExerciseLabel: "Bench Press",
    requiresStrengthBaselines: true,
  },
];

const muscles = [
  { id: "m1", slug: "shoulder", name: "Shoulder" },
  { id: "m2", slug: "lower_back", name: "Lower Back" },
];

describe("Spec 8 onboarding wizard", () => {
  beforeEach(() => {
    mockRouter.push.mockReset();
    mockRouter.refresh.mockReset();
    mockedCompleteOnboarding.mockReset();
    mockedCompleteOnboarding.mockResolvedValue({ status: "success" });
  });

  it("enforces step validation and completes onboarding", async () => {
    const user = userEvent.setup();
    render(
      <OnboardingWizard
        programs={programs}
        muscleGroups={muscles}
        fetchError={undefined}
      />,
    );

    const click = async (testId: string) => {
      await act(async () => {
        await user.click(screen.getByTestId(testId));
      });
    };

    expect(await screen.findByTestId("onboarding-step-character")).toBeTruthy();
    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-gear")).toBeTruthy();
    await click("onboarding-next");
    expect(screen.getByTestId("onboarding-equipment-error")).toBeTruthy();

    await click("onboarding-equipment-barbell");
    await click("onboarding-equipment-dumbbell");
    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-recovery")).toBeTruthy();

    await click("onboarding-fatigue-low");
    await click("onboarding-unit-lbs");
    await click("onboarding-injury-shoulder");
    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-cycle")).toBeTruthy();

    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-program-blend")).toBeTruthy();
    await act(async () => {
      await user.clear(screen.getByTestId("onboarding-program-input-1"));
      await user.type(screen.getByTestId("onboarding-program-input-1"), "70");
      await user.clear(screen.getByTestId("onboarding-program-input-2"));
      await user.type(screen.getByTestId("onboarding-program-input-2"), "30");
    });
    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-confirmation")).toBeTruthy();
    expect(screen.getByText(/class preset:\s*Classless/i)).toBeTruthy();
    expect(screen.getByText(/goal bias:\s*Strength/i)).toBeTruthy();
    expect(screen.getByText(/fatigue:\s*light/i)).toBeTruthy();

    await click("onboarding-start");

    expect(mockedCompleteOnboarding).toHaveBeenCalledWith({
      equipment: ["barbell", "dumbbell"],
      fatiguePreference: "low",
      unitSystem: "lbs",
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      injuryMuscleGroupSlugs: ["shoulder"],
      macrocycleWeeks: 8,
      selectedPrograms: [
        { programId: 1, weight: 70 },
        { programId: 2, weight: 30 },
      ],
    });
    expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it("collects strength and challenge baselines together when required", async () => {
    const user = userEvent.setup();
    const click = async (testId: string) => {
      await act(async () => {
        await user.click(screen.getByTestId(testId));
      });
    };

    render(
      <OnboardingWizard
        programs={strengthPrograms}
        muscleGroups={muscles}
        fetchError={undefined}
      />,
    );

    await click("onboarding-next");
    await click("onboarding-equipment-barbell");
    await click("onboarding-next");
    await click("onboarding-fatigue-low");
    await click("onboarding-next");
    await click("onboarding-next");

    expect(await screen.findByTestId("onboarding-step-program-blend")).toBeTruthy();

    await act(async () => {
      await user.clear(screen.getByTestId("onboarding-program-input-3"));
      await user.type(screen.getByTestId("onboarding-program-input-3"), "60");
      await user.clear(screen.getByTestId("onboarding-program-input-4"));
      await user.type(screen.getByTestId("onboarding-program-input-4"), "40");
    });

    expect(await screen.findByTestId("onboarding-strength-baseline-squat")).toBeTruthy();

    await act(async () => {
      await user.clear(screen.getByTestId("onboarding-strength-baseline-squat"));
      await user.type(screen.getByTestId("onboarding-strength-baseline-squat"), "180");
      await user.clear(screen.getByTestId("onboarding-strength-baseline-deadlift"));
      await user.type(screen.getByTestId("onboarding-strength-baseline-deadlift"), "220");
      await user.clear(screen.getByTestId("onboarding-strength-baseline-bench_press"));
      await user.type(screen.getByTestId("onboarding-strength-baseline-bench_press"), "140");
      await user.clear(screen.getByTestId("onboarding-strength-baseline-overhead_press"));
      await user.type(screen.getByTestId("onboarding-strength-baseline-overhead_press"), "100");
      await user.clear(screen.getByTestId("onboarding-challenge-baseline-bench-press"));
      await user.type(screen.getByTestId("onboarding-challenge-baseline-bench-press"), "12");
    });

    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-confirmation")).toBeTruthy();
    await click("onboarding-start");

    expect(mockedCompleteOnboarding).toHaveBeenCalledWith({
      equipment: ["barbell"],
      fatiguePreference: "low",
      unitSystem: "kg",
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [
        { programId: 3, weight: 60 },
        { programId: 4, weight: 40 },
      ],
      challengeBaselines: {
        "bench-press": { maxReps: 12 },
      },
      strengthBaselines: {
        squat: {
          estimatedOneRepMax: 180,
          unit: "kg",
          source: "onboarding",
        },
        deadlift: {
          estimatedOneRepMax: 220,
          unit: "kg",
          source: "onboarding",
        },
        bench_press: {
          estimatedOneRepMax: 140,
          unit: "kg",
          source: "onboarding",
        },
        overhead_press: {
          estimatedOneRepMax: 100,
          unit: "kg",
          source: "onboarding",
        },
      },
    });
  });

  it("shows server action errors on confirmation step", async () => {
    const user = userEvent.setup();
    const click = async (testId: string) => {
      await act(async () => {
        await user.click(screen.getByTestId(testId));
      });
    };

    mockedCompleteOnboarding.mockResolvedValue({
      status: "error",
      error: "Failed to save onboarding choices.",
    });

    render(
      <OnboardingWizard
        programs={programs}
        muscleGroups={muscles}
        fetchError={undefined}
      />,
    );

    await click("onboarding-next");
    await screen.findByTestId("onboarding-step-gear");
    await click("onboarding-equipment-barbell");
    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-recovery")).toBeTruthy();
    await click("onboarding-fatigue-high");
    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-cycle")).toBeTruthy();
    await click("onboarding-next");
    expect(await screen.findByTestId("onboarding-step-program-blend")).toBeTruthy();
    await act(async () => {
      await user.clear(screen.getByTestId("onboarding-program-input-1"));
      await user.type(screen.getByTestId("onboarding-program-input-1"), "100");
    });
    await click("onboarding-next");
    await screen.findByTestId("onboarding-step-confirmation");
    await click("onboarding-start");

    expect(screen.getByTestId("onboarding-submit-error")).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("keeps thrown submit failures on the confirmation step", async () => {
    const user = userEvent.setup();
    const click = async (testId: string) => {
      await act(async () => {
        await user.click(screen.getByTestId(testId));
      });
    };

    mockedCompleteOnboarding.mockRejectedValue(new Error("server action rejected"));

    render(
      <OnboardingWizard
        programs={programs}
        muscleGroups={muscles}
        fetchError={undefined}
      />,
    );

    await click("onboarding-next");
    await click("onboarding-equipment-barbell");
    await click("onboarding-next");
    await click("onboarding-next");
    await click("onboarding-next");
    await act(async () => {
      await user.clear(screen.getByTestId("onboarding-program-input-1"));
      await user.type(screen.getByTestId("onboarding-program-input-1"), "100");
    });
    await click("onboarding-next");
    await screen.findByTestId("onboarding-step-confirmation");
    await click("onboarding-start");

    expect(await screen.findByTestId("onboarding-submit-error")).toBeTruthy();
    expect(screen.getByTestId("onboarding-step-confirmation")).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe("Onboarding step components", () => {
  it("renders each step component shape", () => {
    render(<CharacterStep
      classPresetId="classless"
      goalBias="strength"
      onClassPresetChange={() => {}}
      onGoalBiasChange={() => {}}
    />);
    expect(screen.getByTestId("onboarding-step-character")).toBeTruthy();

    render(
      <EquipmentStep selectedEquipment={["barbell"]} onToggle={() => {}} error={null} />,
    );
    expect(screen.getByTestId("onboarding-step-gear")).toBeTruthy();

    render(
      <RecoveryStep
        fatiguePreference="low"
        unitSystem="kg"
        onFatigueChange={() => {}}
        onUnitChange={() => {}}
        selectedInjuryMuscleGroupSlugs={[]}
        availableInjuries={muscles}
        onToggleInjury={() => {}}
        error={null}
      />,
    );
    expect(screen.getByTestId("onboarding-step-recovery")).toBeTruthy();

    render(
      <CycleStep
        availableDaysPerWeek={3}
        macrocycleWeeks={8}
        onAvailableDaysChange={() => {}}
        onMacrocycleWeeksChange={() => {}}
      />,
    );
    expect(screen.getByTestId("onboarding-step-cycle")).toBeTruthy();

    render(
      <ProgramBlendStep
        programs={programs}
        programSelections={[
          { programId: 1, weight: 50 },
          { programId: 2, weight: 0 },
        ]}
        onWeightChange={() => {}}
        error={null}
      />,
    );
    expect(screen.getByTestId("onboarding-step-program-blend")).toBeTruthy();

    render(
      <ConfirmationStep
        classPresetId="classless"
        goalBias="strength"
        equipment={["barbell"]}
        fatigueLevel="light"
        unitSystem="kg"
        injuries={["shoulder"]}
        availableDaysPerWeek={4}
        macrocycleWeeks={8}
        programs={[{ name: "Upper Lower", percent: 100 }]}
        submitError={null}
      />,
    );
    expect(screen.getByTestId("onboarding-step-confirmation")).toBeTruthy();
  });
});
