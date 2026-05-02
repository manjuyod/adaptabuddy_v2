"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProgramCatalogItem } from "@/modules/programs/contracts";
import { completeOnboarding } from "../actions";
import type { FatigueLevel, UnitSystem } from "../contracts";
import { ConfirmationStep } from "./ConfirmationStep";
import { EquipmentStep } from "./EquipmentStep";
import { PreferencesStep } from "./PreferencesStep";
import { ProgramStep } from "./ProgramStep";

type OnboardingWizardProps = {
  programs: ProgramCatalogItem[];
  fetchError?: string;
};

type StepKey = "equipment" | "preferences" | "program" | "confirmation";

const steps: Array<{ key: StepKey; label: string }> = [
  { key: "equipment", label: "Equipment" },
  { key: "preferences", label: "Preferences" },
  { key: "program", label: "Program" },
  { key: "confirmation", label: "Confirm" },
];

export function OnboardingWizard({ programs, fetchError }: OnboardingWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState(0);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [fatigueLevel, setFatigueLevel] = useState<FatigueLevel>("moderate");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("kg");
  const [programId, setProgramId] = useState<number | null>(null);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [programError, setProgramError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === programId) ?? null,
    [programId, programs],
  );

  const toggleEquipment = (value: string) => {
    setEquipmentError(null);
    setEquipment((previous) =>
      previous.includes(value)
        ? previous.filter((entry) => entry !== value)
        : [...previous, value],
    );
  };

  const goNext = () => {
    if (currentStep === 0 && equipment.length === 0) {
      setEquipmentError("Choose at least one equipment option before continuing.");
      return;
    }

    if (currentStep === 2 && programId === null) {
      setProgramError("Choose a program before continuing.");
      return;
    }

    setProgramError(null);
    setEquipmentError(null);
    setSubmitError(null);
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const goBack = () => {
    setSubmitError(null);
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const handleStartTraining = () => {
    if (programId === null) {
      setCurrentStep(2);
      setProgramError("Choose a program before starting.");
      return;
    }

    setSubmitError(null);
    startTransition(async () => {
      const result = await completeOnboarding({
        equipment,
        fatigueLevel,
        unitSystem,
        programId,
      });

      if (result.status === "error") {
        setSubmitError(result.error ?? "Unable to complete onboarding.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6" data-testid="onboarding-wizard">
      <header className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">New Game Setup</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Create Your Training Profile</h1>
        <p className="mt-1 text-sm text-slate-400">
          We&apos;ll use these choices to generate your first workout on the dashboard.
        </p>
      </header>

      <ol className="grid gap-2 sm:grid-cols-4" aria-label="Onboarding progress">
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
          <EquipmentStep
            selectedEquipment={equipment}
            onToggle={toggleEquipment}
            error={equipmentError}
          />
        ) : null}

        {currentStep === 1 ? (
          <PreferencesStep
            fatigueLevel={fatigueLevel}
            unitSystem={unitSystem}
            onFatigueChange={setFatigueLevel}
            onUnitChange={setUnitSystem}
          />
        ) : null}

        {currentStep === 2 ? (
          <ProgramStep
            programs={programs}
            selectedProgramId={programId}
            onSelect={(value) => {
              setProgramError(null);
              setProgramId(value);
            }}
            error={programError}
            fetchError={fetchError}
          />
        ) : null}

        {currentStep === 3 ? (
          <ConfirmationStep
            equipment={equipment}
            fatigueLevel={fatigueLevel}
            unitSystem={unitSystem}
            programName={selectedProgram?.name ?? null}
            submitError={submitError}
          />
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
