import type { FatigueLevel, UnitSystem } from "../contracts";
import { equipmentOptions } from "./EquipmentStep";

type ConfirmationStepProps = {
  equipment: string[];
  fatigueLevel: FatigueLevel;
  unitSystem: UnitSystem;
  programName: string | null;
  submitError: string | null;
};

const equipmentLabelByValue = new Map(
  equipmentOptions.map((option) => [option.value, option.label]),
);

const formatEquipment = (value: string) => equipmentLabelByValue.get(value) ?? value;

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function ConfirmationStep({
  equipment,
  fatigueLevel,
  unitSystem,
  programName,
  submitError,
}: ConfirmationStepProps) {
  return (
    <section className="space-y-4" data-testid="onboarding-step-confirmation">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step 4 of 4</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">Confirm Setup</h2>
        <p className="mt-1 text-sm text-slate-400">
          Review your settings, then start your training profile.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Equipment</p>
          <p className="mt-1 text-slate-200">
            {equipment.map((entry) => formatEquipment(entry)).join(", ")}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Fatigue Level</p>
          <p className="mt-1 text-slate-200">{titleCase(fatigueLevel)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Unit System</p>
          <p className="mt-1 text-slate-200">{unitSystem.toUpperCase()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Program</p>
          <p className="mt-1 text-slate-200">{programName ?? "Unknown program"}</p>
        </div>
      </div>

      {submitError ? (
        <p className="text-sm text-red-400" data-testid="onboarding-submit-error">
          {submitError}
        </p>
      ) : null}
    </section>
  );
}
