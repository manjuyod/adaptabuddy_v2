import type { HistoryWorkoutDetail } from "../contracts";

type HistoryDetailProps = {
  workout: HistoryWorkoutDetail;
};

const formatWorkoutDate = (dateValue: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateValue));

const formatWeight = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const formatVolume = (value: number | null) =>
  value === null ? "N/A" : Math.round(value).toLocaleString();

const formatDuration = (value: number | null) => {
  if (value === null) return "N/A";
  const minutes = Math.round(value / 60);
  return `${minutes} min`;
};

const formatExplanationLabel = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatOutcomeLabel = (value: string) => {
  const formatted = formatExplanationLabel(value);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1).toLowerCase();
};

export function HistoryDetail({ workout }: HistoryDetailProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Workout Summary</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">{workout.dayName}</h1>
        <p className="text-sm text-slate-400">{workout.programName}</p>
        <p className="mt-1 text-xs text-slate-500">{formatWorkoutDate(workout.completedAt)}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-300">
          <span>Volume: {formatVolume(workout.totalVolume)}</span>
          <span>Sets: {workout.setCount}</span>
          <span>Duration: {formatDuration(workout.durationSeconds)}</span>
        </div>
      </div>

      {workout.explanation ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Completion Explanation
          </p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>{formatOutcomeLabel(workout.explanation.sessionOutcomeClassification)}</p>
            <p>
              XP: {workout.explanation.xp.xpDelta} · Streak: {workout.explanation.xp.streakDelta}
            </p>
            <p>{formatExplanationLabel(workout.explanation.xp.reason)}</p>
            {workout.explanation.warnings.map((warning) => (
              <p key={warning}>{formatExplanationLabel(warning)}</p>
            ))}
            {workout.explanation.progressionChanges.map((change) => (
              <p key={change.exerciseId}>
                {change.exerciseId}: {formatExplanationLabel(change.action)} /{" "}
                {formatExplanationLabel(change.trend)}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {workout.reporting ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Active Cycle Reporting
          </p>
          <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <p>Adherence streak: {workout.reporting.adherence.adherenceStreak}</p>
            <p>Completed sessions: {workout.reporting.adherence.completedSessionCount}</p>
            <p>Missed sessions: {workout.reporting.adherence.missedSessionCount}</p>
            <p>
              Remaining sessions: {workout.reporting.cycleProgress.remainingSessions}
            </p>
          </div>
        </section>
      ) : null}

      {workout.replayReference ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Replay Reference</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>{workout.replayReference.seedUsed}</p>
            <p>{workout.replayReference.inputHash}</p>
            <p>{workout.replayReference.outputHash}</p>
          </div>
        </section>
      ) : null}

      {workout.exercises.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm text-slate-400">No set logs found for this workout.</p>
        </div>
      ) : (
        workout.exercises.map((exercise) => (
          <section
            key={exercise.exerciseId}
            className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40"
          >
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-100">{exercise.exerciseName}</h2>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-[0.15em] text-slate-500">
                <tr>
                  <th className="px-4 py-2">Set</th>
                  <th className="px-4 py-2">Weight</th>
                  <th className="px-4 py-2">Reps</th>
                  <th className="px-4 py-2">RIR</th>
                </tr>
              </thead>
              <tbody>
                {exercise.sets.map((set) => (
                  <tr key={`${exercise.exerciseId}-${set.setIndex}`} className="border-t border-slate-800">
                    <td className="px-4 py-2 text-slate-300">{set.setIndex}</td>
                    <td className="px-4 py-2 text-slate-300">{formatWeight(set.weight)}</td>
                    <td className="px-4 py-2 text-slate-300">{set.reps}</td>
                    <td className="px-4 py-2 text-slate-300">{set.rir ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}
