import type { GoalBias, SelectableClassPresetId } from "../contracts";

type CharacterStepProps = {
  classPresetId: SelectableClassPresetId;
  goalBias: GoalBias;
  onClassPresetChange: (value: SelectableClassPresetId) => void;
  onGoalBiasChange: (value: GoalBias) => void;
};

const classPresetOptions = [
  { value: "classless", label: "Classless (balanced)" },
  { value: "bb", label: "Big Body (BB)" },
  { value: "powa", label: "Power-Oriented" },
  { value: "ninja", label: "Ninja (calisthenics focus)" },
] as const;

const goalBiasOptions: GoalBias[] = [
  "strength",
  "hypertrophy",
  "balanced",
  "conditioning",
];

export function CharacterStep({
  classPresetId,
  goalBias,
  onClassPresetChange,
  onGoalBiasChange,
}: CharacterStepProps) {
  return (
    <section className="space-y-4" data-testid="onboarding-step-character">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step 1 of 6</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">Character</h2>
        <p className="mt-1 text-sm text-slate-400">Choose your starting archetype and focus.</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
          Class Preset
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {classPresetOptions.map((preset) => {
            const selected = classPresetId === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => onClassPresetChange(preset.value)}
                className={`rounded-md border px-3 py-3 text-left transition ${
                  selected
                    ? "border-violet-500 bg-violet-900/20 text-violet-100"
                    : "border-slate-800 bg-slate-900/40 text-slate-200 hover:border-slate-700"
                }`}
                data-testid={`onboarding-class-preset-${preset.value}`}
              >
                <span className="font-semibold">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
          Goal Bias
        </p>
        <select
          className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
          value={goalBias}
          onChange={(event) => onGoalBiasChange(event.target.value as GoalBias)}
          data-testid="onboarding-goal-bias"
        >
          {goalBiasOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
