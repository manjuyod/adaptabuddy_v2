"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProgramCatalogItem } from "@/modules/programs/contracts";
import {
  type CompleteOnboardingInput,
  type CompleteOnboardingResult,
  type FatigueLevel,
  type GoalBias,
  type OnboardingFatiguePreference,
  type SelectableClassPresetId,
  type UnitSystem,
} from "../contracts";
import { completeOnboarding } from "../actions";
import { CharacterStep } from "./CharacterStep";
import { ConfirmationStep } from "./ConfirmationStep";
import { CycleStep } from "./CycleStep";
import { EquipmentStep } from "./EquipmentStep";
import { RecoveryStep } from "./PreferencesStep";
import { ProgramBlendStep } from "./ProgramStep";

type OnboardingWizardProps = {
  programs: ProgramCatalogItem[];
  muscleGroups: Array<{ id: string; slug: string; name: string }>;
  fetchError?: string;
  muscleFetchError?: string | null;
};

type StepKey =
  | "character"
  | "gear"
  | "recovery"
  | "cycle"
  | "program-blend"
  | "confirmation";

const steps: Array<{ key: StepKey; label: string }> = [
  { key: "character", label: "Character" },
  { key: "gear", label: "Gear" },
  { key: "recovery", label: "Recovery" },
  { key: "cycle", label: "Cycle" },
  { key: "program-blend", label: "Program Blend" },
  { key: "confirmation", label: "Confirm" },
];

type ProgramWeight = { programId: number; weight: number };

const strengthLiftSlugs = [
  "squat",
  "deadlift",
  "bench_press",
  "overhead_press",
] as const;

type StrengthLiftSlug = (typeof strengthLiftSlugs)[number];

const initialProgramWeights = (
  programs: ProgramCatalogItem[],
): ProgramWeight[] =>
  programs.map((program) => ({ programId: program.id, weight: 0 }));

const challengeExerciseSlug = (program: ProgramCatalogItem) => {
  if ((program.templateKind ?? "slot_based") !== "challenge_progression") {
    return null;
  }

  return program.challengeExerciseSlug ?? null;
};

const programImpliesStrengthBaselines = (program: ProgramCatalogItem) => {
  if (program.requiresStrengthBaselines) {
    return true;
  }

  const text = [
    program.slug,
    program.name,
    program.adaptiveSummary,
    challengeExerciseSlug(program),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return ["strength", "powerlifting", "bench"].some((needle) =>
    text.includes(needle),
  );
};

export function OnboardingWizard({
  programs,
  muscleGroups,
  fetchError,
  muscleFetchError,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState(0);
  const [classPresetId, setClassPresetId] =
    useState<SelectableClassPresetId>("classless");
  const [goalBias, setGoalBias] = useState<GoalBias>("strength");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [fatiguePreference, setFatiguePreference] =
    useState<OnboardingFatiguePreference>("moderate");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("kg");
  const [injuryMuscleGroupSlugs, setInjuryMuscleGroupSlugs] = useState<
    string[]
  >([]);
  const [availableDaysPerWeek, setAvailableDaysPerWeek] = useState(3);
  const [macrocycleWeeks, setMacrocycleWeeks] = useState(8);
  const [programWeights, setProgramWeights] = useState<ProgramWeight[]>(() =>
    initialProgramWeights(programs),
  );
  const [challengeBaselines, setChallengeBaselines] = useState<
    Record<string, number | undefined>
  >({});
  const [strengthBaselines, setStrengthBaselines] = useState<
    Record<StrengthLiftSlug, number | undefined>
  >({
    squat: undefined,
    deadlift: undefined,
    bench_press: undefined,
    overhead_press: undefined,
  });
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [programError, setProgramError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedPrograms = useMemo(
    () =>
      programWeights
        .filter((entry) => entry.weight > 0)
        .map((entry) => ({
          programId: entry.programId,
          weight: entry.weight,
        })),
    [programWeights],
  );

  const mappedFatigueLevel = useMemo<FatigueLevel>(() => {
    if (fatiguePreference === "low") {
      return "light";
    }
    if (fatiguePreference === "high") {
      return "hard";
    }
    return "moderate";
  }, [fatiguePreference]);

  const selectedInjuryLabels = useMemo(() => {
    const nameBySlug = new Map(
      muscleGroups.map((group) => [group.slug, group.name]),
    );
    return injuryMuscleGroupSlugs.map((slug) => nameBySlug.get(slug) ?? slug);
  }, [injuryMuscleGroupSlugs, muscleGroups]);

  const onToggleEquipment = (value: string) => {
    setEquipment((previous) =>
      previous.includes(value)
        ? previous.filter((entry) => entry !== value)
        : [...previous, value],
    );
  };

  const onToggleInjury = (slug: string) => {
    setInjuryMuscleGroupSlugs((previous) =>
      previous.includes(slug)
        ? previous.filter((entry) => entry !== slug)
        : [...previous, slug],
    );
  };

  const onProgramWeightChange = (programId: number, percent: number) => {
    setProgramError(null);
    const program = programs.find((candidate) => candidate.id === programId);
    if (
      (program?.templateKind ?? "slot_based") !== "slot_based" &&
      percent > 0
    ) {
      setAvailableDaysPerWeek(3);
    }
    setProgramWeights((previous) =>
      previous.map((entry) =>
        entry.programId === programId ? { ...entry, weight: percent } : entry,
      ),
    );
  };

  const onChallengeBaselineChange = (
    exerciseSlug: string,
    maxReps: number | undefined,
  ) => {
    setProgramError(null);
    setChallengeBaselines((previous) => ({
      ...previous,
      [exerciseSlug]: maxReps,
    }));
  };

  const onStrengthBaselineChange = (
    liftSlug: StrengthLiftSlug,
    estimatedOneRepMax: number | undefined,
  ) => {
    setProgramError(null);
    setStrengthBaselines((previous) => ({
      ...previous,
      [liftSlug]: estimatedOneRepMax,
    }));
  };

  const goNext = () => {
    setSubmitError(null);

    if (currentStep === 1 && equipment.length === 0) {
      setEquipmentError(
        "Choose at least one piece of equipment before continuing.",
      );
      return;
    }

    if (
      currentStep === 3 &&
      (availableDaysPerWeek < 1 || macrocycleWeeks < 1)
    ) {
      setCycleError("Choose valid cycle settings before continuing.");
      return;
    }

    if (currentStep === 4 && selectedPrograms.length === 0) {
      setProgramError(
        "Select at least one program and set a positive percentage.",
      );
      return;
    }

    if (currentStep === 4) {
      if (programWeights.some((entry) => entry.weight < 0)) {
        setProgramError("Program percentages must be positive.");
        return;
      }
      if (
        requiresStrengthBaselines &&
        strengthLiftSlugs.some(
          (slug) => strengthBaselines[slug] === undefined,
        )
      ) {
        setProgramError(
          "Enter squat, deadlift, bench press, and overhead press baselines before continuing.",
        );
        return;
      }
      const requiredChallengeSlug = activeProgram
        .map(challengeExerciseSlug)
        .find((slug): slug is string => typeof slug === "string");
      if (
        requiredChallengeSlug &&
        challengeBaselines[requiredChallengeSlug] === undefined
      ) {
        setProgramError(
          "Enter your max-rep baseline for the selected challenge program.",
        );
        return;
      }
      if (
        activeProgram.some(
          (program) => (program.templateKind ?? "slot_based") !== "slot_based",
        ) &&
        availableDaysPerWeek !== 3
      ) {
        setAvailableDaysPerWeek(3);
      }
    }

    if (currentStep === 2 && !fatiguePreference) {
      setRecoveryError("Choose a fatigue preference before continuing.");
      return;
    }

    setEquipmentError(null);
    setProgramError(null);
    setRecoveryError(null);
    setCycleError(null);
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const goBack = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const handleStartTraining = () => {
    const payload: CompleteOnboardingInput = {
      equipment,
      fatiguePreference,
      unitSystem,
      classPresetId,
      goalBias,
      availableDaysPerWeek,
      injuryMuscleGroupSlugs,
      macrocycleWeeks,
      selectedPrograms,
      ...(Object.values(challengeBaselines).some((value) => value !== undefined)
        ? {
            challengeBaselines: Object.fromEntries(
              Object.entries(challengeBaselines)
                .filter(
                  (entry): entry is [string, number] => entry[1] !== undefined,
                )
                .map(([slug, maxReps]) => [slug, { maxReps }]),
            ),
          }
        : {}),
      ...(requiresStrengthBaselines
        ? {
            strengthBaselines: {
              squat: {
                estimatedOneRepMax: strengthBaselines.squat ?? 0,
                unit: unitSystem,
                source: "onboarding",
              },
              deadlift: {
                estimatedOneRepMax: strengthBaselines.deadlift ?? 0,
                unit: unitSystem,
                source: "onboarding",
              },
              bench_press: {
                estimatedOneRepMax: strengthBaselines.bench_press ?? 0,
                unit: unitSystem,
                source: "onboarding",
              },
              overhead_press: {
                estimatedOneRepMax: strengthBaselines.overhead_press ?? 0,
                unit: unitSystem,
                source: "onboarding",
              },
            },
          }
        : {}),
    };

    setSubmitError(null);
    startTransition(async () => {
      let result: CompleteOnboardingResult;
      try {
        result = (await completeOnboarding(
          payload,
        )) as CompleteOnboardingResult;
      } catch {
        setSubmitError("Unable to complete onboarding. Please try again.");
        return;
      }

      if (result.status === "error") {
        setSubmitError(result.error ?? "Unable to complete onboarding.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  };

  const activeProgram = programs.filter((program) =>
    selectedPrograms.some((selection) => selection.programId === program.id),
  );
  const requiresStrengthBaselines = activeProgram.some(
    programImpliesStrengthBaselines,
  );

  return (
    <div className="space-y-6" data-testid="onboarding-wizard">
      <header className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          New Game Setup
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">
          Create Your Training Profile
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          We&apos;ll use these choices to generate your first workout on the
          dashboard.
        </p>
      </header>

      <ol
        className="grid gap-2 sm:grid-cols-6"
        aria-label="Onboarding progress"
      >
        {steps.map((step, index) => {
          const isCurrent = currentStep === index;
          const isComplete = currentStep > index;
          return (
            <li
              key={step.key}
              className={`rounded-md border px-3 py-2 text-xs uppercase tracking-[0.12em] ${
                isCurrent
                  ? "border-amber-500 bg-amber-900/20 text-amber-100"
                  : isComplete
                    ? "border-emerald-500/60 bg-emerald-900/20 text-emerald-200"
                    : "border-slate-800 bg-slate-900/40 text-slate-400"
              }`}
              data-testid={`onboarding-progress-${step.key}`}
            >
              {index + 1}. {step.label}
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        {currentStep === 0 ? (
          <CharacterStep
            classPresetId={classPresetId}
            goalBias={goalBias}
            onClassPresetChange={setClassPresetId}
            onGoalBiasChange={setGoalBias}
          />
        ) : null}

        {currentStep === 1 ? (
          <EquipmentStep
            selectedEquipment={equipment}
            onToggle={onToggleEquipment}
            error={equipmentError}
          />
        ) : null}

        {currentStep === 2 ? (
          <RecoveryStep
            fatiguePreference={fatiguePreference}
            unitSystem={unitSystem}
            onFatigueChange={setFatiguePreference}
            onUnitChange={setUnitSystem}
            selectedInjuryMuscleGroupSlugs={injuryMuscleGroupSlugs}
            onToggleInjury={onToggleInjury}
            availableInjuries={muscleGroups}
            error={recoveryError}
          />
        ) : null}

        {currentStep === 3 ? (
          <CycleStep
            availableDaysPerWeek={availableDaysPerWeek}
            macrocycleWeeks={macrocycleWeeks}
            onAvailableDaysChange={setAvailableDaysPerWeek}
            onMacrocycleWeeksChange={setMacrocycleWeeks}
          />
        ) : null}

        {currentStep === 4 ? (
          <ProgramBlendStep
            programs={programs}
            programSelections={programWeights}
            challengeBaselines={challengeBaselines}
            strengthBaselines={strengthBaselines}
            showStrengthBaselines={requiresStrengthBaselines}
            onWeightChange={onProgramWeightChange}
            onChallengeBaselineChange={onChallengeBaselineChange}
            onStrengthBaselineChange={onStrengthBaselineChange}
            error={programError}
          />
        ) : null}

        {currentStep === 5 ? (
          <ConfirmationStep
            classPresetId={classPresetId}
            goalBias={goalBias}
            equipment={equipment}
            fatigueLevel={mappedFatigueLevel}
            unitSystem={unitSystem}
            injuries={selectedInjuryLabels}
            availableDaysPerWeek={availableDaysPerWeek}
            macrocycleWeeks={macrocycleWeeks}
            programs={activeProgram.map((program) => ({
              name: program.name,
              percent:
                selectedPrograms.find(
                  (selection) => selection.programId === program.id,
                )?.weight ?? 0,
            }))}
            submitError={submitError}
          />
        ) : null}

        {fetchError ? (
          <p className="mt-4 rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">
            {fetchError}
          </p>
        ) : null}
        {muscleFetchError ? (
          <p className="mt-4 rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">
            {muscleFetchError}
          </p>
        ) : null}
        {cycleError ? (
          <p
            className="mt-4 text-sm text-red-400"
            data-testid="onboarding-cycle-error"
          >
            {cycleError}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={currentStep === 0 || isPending}
          className="rounded-md border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="onboarding-back"
        >
          Back
        </button>

        {currentStep < steps.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
            data-testid="onboarding-next"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStartTraining}
            disabled={isPending}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            data-testid="onboarding-start"
          >
            {isPending ? "Saving..." : "Start Training"}
          </button>
        )}
      </div>
    </div>
  );
}
