import type { ProgramCatalogItem } from "@/modules/programs/contracts";

type ProgramStepProps = {
  programs: ProgramCatalogItem[];
  selectedProgramId: number | null;
  onSelect: (programId: number) => void;
  error: string | null;
  fetchError?: string;
};

const formatMuscleLabel = (slug: string) =>
  slug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export function ProgramStep({
  programs,
  selectedProgramId,
  onSelect,
  error,
  fetchError,
}: ProgramStepProps) {
  return (
    <section className="space-y-4" data-testid="onboarding-step-program">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Step 3 of 4</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">Choose a Program</h2>
        <p className="mt-1 text-sm text-slate-400">
          Pick your starting plan. You can change it later from Programs.
        </p>
      </div>

      {fetchError ? (
        <p className="rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">
          {fetchError}
        </p>
      ) : null}

      {programs.length === 0 ? (
        <p className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-400">
          No programs are available right now.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {programs.map((program) => {
            const selected = selectedProgramId === program.id;
            return (
              <button
                key={program.id}
                type="button"
                onClick={() => onSelect(program.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  selected
                    ? "border-indigo-400 bg-indigo-900/20"
                    : "border-slate-800 bg-slate-900/40 hover:border-slate-600"
                }`}
                data-testid={`onboarding-program-${program.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-100">{program.name}</h3>
                  {selected ? (
                    <span className="rounded bg-indigo-500 px-2 py-0.5 text-xs font-semibold text-white">
                      Selected
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">
                  {program.default_days_per_week} days per week
                </p>
                {program.description ? (
                  <p className="mt-2 text-sm text-slate-400">{program.description}</p>
                ) : null}
                <p className="mt-3 text-xs text-slate-500">
                  Focus:{" "}
                  {program.muscleCoverage
                    .slice(0, 3)
                    .map((entry) => formatMuscleLabel(entry.muscle))
                    .join(", ") || "General strength"}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {error ? (
        <p className="text-sm text-red-400" data-testid="onboarding-program-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
