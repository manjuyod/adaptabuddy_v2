import type { FatigueLevel, UnitSystem } from "../contracts";
import { equipmentOptions } from "./EquipmentStep";

type ConfirmationStepProps = {
  classPresetId: string;
  goalBias: string;
  equipment: string[];
  fatigueLevel: FatigueLevel;
  unitSystem: UnitSystem;
  injuries: string[];
  availableDaysPerWeek: number;
  macrocycleWeeks: number;
  programs: Array<{ name: string; percent: number }>;
  submitError: string | null;
};

const equipmentLabelByValue = new Map(
  equipmentOptions.map((option) => [option.value, option.label]),
);

const classPresetLabelByValue = new Map([
  ["classless", "Classless"],
  ["bb", "Big Body"],
  ["powa", "Power-Oriented"],
  ["ninja", "Ninja"],
]);

const goalBiasLabelByValue = new Map([
  ["strength", "Strength"],
  ["hypertrophy", "Hypertrophy"],
  ["balanced", "Balanced"],
  ["conditioning", "Conditioning"],
]);

const formatEquipment = (value: string) => equipmentLabelByValue.get(value) ?? value;
const formatClassPreset = (value: string) => classPresetLabelByValue.get(value) ?? value;
const formatGoalBias = (value: string) => goalBiasLabelByValue.get(value) ?? value;

export function ConfirmationStep({
  classPresetId,
  goalBias,
  equipment,
  fatigueLevel,
  unitSystem,
  injuries,
  availableDaysPerWeek,
  macrocycleWeeks,
  programs,
  submitError,
}: ConfirmationStepProps) {
  const totalPercent = programs.reduce((sum, program) => sum + program.percent, 0);
  return (
    <section className="space-y-4" data-testid="onboarding-step-confirmation">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step 6 of 6</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">Confirm Setup</h2>
        <p className="mt-1 text-sm text-slate-400">
          Review your profile setup before we generate your first cycle.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Character</p>
          <p className="mt-1 text-slate-200">Class preset: {formatClassPreset(classPresetId)}</p>
          <p className="mt-1 text-slate-200">Goal bias: {formatGoalBias(goalBias)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Gear</p>
          <p className="mt-1 text-slate-200">{equipment.map((entry) => formatEquipment(entry)).join(", ")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Recovery</p>
          <p className="mt-1 text-slate-200">Fatigue: {fatigueLevel}</p>
          <p className="mt-1 text-slate-200">Units: {unitSystem.toUpperCase()}</p>
          <p className="mt-1 text-slate-200">
            Injuries: {injuries.length > 0 ? injuries.join(", ") : "None"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Cycle</p>
          <p className="mt-1 text-slate-200">
            {availableDaysPerWeek} days / week for {macrocycleWeeks} weeks
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Program Blend</p>
          <p className="mt-1 text-slate-200">
            Total: {totalPercent.toFixed(0)}%
          </p>
          <ul className="mt-2 list-disc pl-5">
            {programs.map((program) => (
              <li key={program.name}>
                {program.name}: {program.percent.toFixed(0)}%
              </li>
            ))}
          </ul>
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
