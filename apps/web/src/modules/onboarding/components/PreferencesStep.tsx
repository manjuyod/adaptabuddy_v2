import type { FatigueLevel, UnitSystem } from "../contracts";

type PreferencesStepProps = {
  fatigueLevel: FatigueLevel;
  unitSystem: UnitSystem;
  onFatigueChange: (next: FatigueLevel) => void;
  onUnitChange: (next: UnitSystem) => void;
};

const fatigueOptions: Array<{
  value: FatigueLevel;
  label: string;
  description: string;
}> = [
  { value: "light", label: "Light", description: "Recovery-first and lower stress." },
  { value: "moderate", label: "Moderate", description: "Balanced default profile." },
  { value: "hard", label: "Hard", description: "Higher stimulus and fatigue load." },
  { value: "brutal", label: "Brutal", description: "Maximum intensity bias." },
];

export function PreferencesStep({
  fatigueLevel,
  unitSystem,
  onFatigueChange,
  onUnitChange,
}: PreferencesStepProps) {
  return (
    <section className="space-y-6" data-testid="onboarding-step-preferences">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step 2 of 4</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">Training Preferences</h2>
        <p className="mt-1 text-sm text-slate-400">
          Set your default fatigue profile and display units.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
          Fatigue Level
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {fatigueOptions.map((option) => {
            const selected = fatigueLevel === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onFatigueChange(option.value)}
                className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                  selected
                    ? "border-amber-500 bg-amber-900/20 text-amber-100"
                    : "border-slate-800 bg-slate-900/40 text-slate-200 hover:border-slate-700"
                }`}
                data-testid={`onboarding-fatigue-${option.value}`}
              >
                <span className="block font-semibold">{option.label}</span>
                <span className="text-xs text-slate-400">{option.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">Units</p>
        <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
          {(["kg", "lbs"] as const).map((value) => {
            const selected = unitSystem === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onUnitChange(value)}
                className={`rounded-md border px-3 py-2 text-sm font-semibold uppercase transition ${
                  selected
                    ? "border-emerald-500 bg-emerald-900/20 text-emerald-100"
                    : "border-slate-700 bg-slate-900/40 text-slate-200 hover:border-slate-500"
                }`}
                data-testid={`onboarding-unit-${value}`}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
