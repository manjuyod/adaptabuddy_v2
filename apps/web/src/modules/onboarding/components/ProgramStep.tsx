import type { ProgramCatalogItem } from "@/modules/programs/contracts";

type ProgramBlendStepProps = {
  programs: ProgramCatalogItem[];
  programSelections: Array<{ programId: number; weight: number }>;
  challengeBaselines?: Record<string, number | undefined>;
  strengthBaselines?: Record<StrengthLiftSlug, number | undefined>;
  showStrengthBaselines?: boolean;
  onWeightChange: (programId: number, percent: number) => void;
  onChallengeBaselineChange?: (
    exerciseSlug: string,
    maxReps: number | undefined,
  ) => void;
  onStrengthBaselineChange?: (
    liftSlug: StrengthLiftSlug,
    estimatedOneRepMax: number | undefined,
  ) => void;
  error: string | null;
};

const clampPercent = (value: number) => {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
};

const formatMuscleLabel = (slug: string) =>
  slug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatLiftLabel = (slug: string) =>
  slug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const strengthLiftSlugs = [
  "squat",
  "deadlift",
  "bench_press",
  "overhead_press",
] as const;

type StrengthLiftSlug = (typeof strengthLiftSlugs)[number];

const emptyStrengthBaselines: Record<StrengthLiftSlug, number | undefined> = {
  squat: undefined,
  deadlift: undefined,
  bench_press: undefined,
  overhead_press: undefined,
};

const challengeExercise = (program: ProgramCatalogItem) => {
  if ((program.templateKind ?? "slot_based") !== "challenge_progression") {
    return null;
  }

  const slug = program.challengeExerciseSlug ?? "";
  if (!slug) {
    return null;
  }

  return {
    slug,
    label: program.challengeExerciseLabel ?? slug,
  };
};

export function ProgramBlendStep({
  programs,
  programSelections,
  challengeBaselines = {},
  strengthBaselines = emptyStrengthBaselines,
  showStrengthBaselines = false,
  onWeightChange,
  onChallengeBaselineChange,
  onStrengthBaselineChange,
  error,
}: ProgramBlendStepProps) {
  const selectionsByProgram = new Map(
    programSelections.map((selection) => [selection.programId, selection]),
  );
  const totalPercent = programSelections.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );

  return (
    <section className="space-y-4" data-testid="onboarding-step-program-blend">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Step 5 of 6
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-100">
          Program Blend
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Assign percentage weights to each program. Weights can be 0% if not
          used.
        </p>
      </div>

      <p className="text-sm text-slate-400">
        Total blend: {totalPercent.toFixed(0)}%
      </p>

      {showStrengthBaselines ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-base font-semibold text-slate-100">
            Strength Lift Baselines
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Enter the four baseline lifts used for strength and powerlifting
            programs.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {strengthLiftSlugs.map((slug) => (
              <label key={slug} className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-slate-400">
                  {formatLiftLabel(slug)}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={strengthBaselines[slug] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    onStrengthBaselineChange?.(
                      slug,
                      value === ""
                        ? undefined
                        : Math.max(0, Math.floor(Number(value))),
                    );
                  }}
                  placeholder={`${formatLiftLabel(slug)} baseline`}
                  className="w-full rounded border border-slate-800 bg-slate-900/40 px-2 py-2 text-sm"
                  data-testid={`onboarding-strength-baseline-${slug}`}
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {programs.length === 0 ? (
        <p className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-400">
          No programs are available right now.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {programs.map((program) => {
            const selection = selectionsByProgram.get(program.id);
            const weight = selection?.weight ?? 0;
            const challenge = challengeExercise(program);
            return (
              <div
                key={program.id}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-100">
                    {program.name}
                  </h3>
                  <span className="text-sm font-semibold text-slate-200">
                    {weight.toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">
                  {program.default_days_per_week} days per week
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {program.adaptiveSummary ??
                    `Focus: ${
                      program.muscleCoverage
                        .slice(0, 3)
                        .map((entry) => formatMuscleLabel(entry.muscle))
                        .join(", ") || "General"
                    }`}
                </p>
                {challenge && weight > 0 ? (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-slate-400">
                      Baseline Max Reps
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={challengeBaselines[challenge.slug] ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        onChallengeBaselineChange?.(
                          challenge.slug,
                          value === ""
                            ? undefined
                            : Math.max(0, Math.floor(Number(value))),
                        );
                      }}
                      placeholder={`${challenge.label} max reps`}
                      className="w-full rounded border border-slate-800 bg-slate-900/40 px-2 py-2 text-sm"
                      data-testid={`onboarding-challenge-baseline-${challenge.slug}`}
                    />
                  </label>
                ) : null}
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-slate-400">
                    Blend Weight (%)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={weight}
                    onChange={(event) =>
                      onWeightChange(
                        program.id,
                        clampPercent(Number(event.target.value)),
                      )
                    }
                    className="mt-2 w-full"
                    data-testid={`onboarding-program-weight-${program.id}`}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weight}
                    onChange={(event) =>
                      onWeightChange(
                        program.id,
                        clampPercent(Number(event.target.value)),
                      )
                    }
                    className="mt-2 w-full rounded border border-slate-800 bg-slate-900/40 px-2 py-2 text-sm"
                    data-testid={`onboarding-program-input-${program.id}`}
                  />
                </label>
              </div>
            );
          })}
        </div>
      )}

      {error ? (
        <p
          className="text-sm text-red-400"
          data-testid="onboarding-program-error"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
