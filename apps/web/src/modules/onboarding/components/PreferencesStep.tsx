import type { UnitSystem } from "../contracts";

type RecoveryStepProps = {
  fatiguePreference: "low" | "moderate" | "high";
  unitSystem: UnitSystem;
  onFatigueChange: (next: "low" | "moderate" | "high") => void;
  onUnitChange: (next: UnitSystem) => void;
  selectedInjuryMuscleGroupSlugs: string[];
  availableInjuries: Array<{ id: string; slug: string; name: string }>;
  onToggleInjury: (slug: string) => void;
  error: string | null;
};

const fatigueOptions = [
  { value: "low", label: "Low", description: "Recovery-first and lower stress." },
  { value: "moderate", label: "Moderate", description: "Balanced baseline profile." },
  { value: "high", label: "High", description: "Higher stimulus with more fatigue load." },
] as const;

export function RecoveryStep({
  fatiguePreference,
  unitSystem,
  onFatigueChange,
  onUnitChange,
  selectedInjuryMuscleGroupSlugs,
  availableInjuries,
  onToggleInjury,
  error,
}: RecoveryStepProps) {
  return (
    <section className="space-y-6" data-testid="onboarding-step-recovery">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step 3 of 6</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">Recovery</h2>
        <p className="mt-1 text-sm text-slate-400">
          Choose fatigue preference, units, and any injury restrictions.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
          Fatigue Preference
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {fatigueOptions.map((option) => {
            const selected = fatiguePreference === option.value;
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

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
          Injury Muscle Groups
        </p>
        <p className="text-xs text-slate-400">Select muscle groups to avoid in session planning.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {availableInjuries.map((group) => {
            const selected = selectedInjuryMuscleGroupSlugs.includes(group.slug);
            return (
              <button
                key={group.slug}
                type="button"
                onClick={() => onToggleInjury(group.slug)}
                className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                  selected
                    ? "border-amber-500 bg-amber-900/20 text-amber-100"
                    : "border-slate-800 bg-slate-900/40 text-slate-200 hover:border-slate-700"
                }`}
                data-testid={`onboarding-injury-${group.slug}`}
              >
                {group.name}
              </button>
            );
          })}
        </div>
        {availableInjuries.length === 0 ? (
          <p className="text-xs text-slate-500">
            No injury reference muscle groups available yet.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-400" data-testid="onboarding-recovery-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
