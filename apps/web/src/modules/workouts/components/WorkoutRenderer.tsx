import type { GenerateWorkoutResponse } from "../contracts";

type Props = {
  workout: NonNullable<GenerateWorkoutResponse["workout"]>;
};

export const WorkoutRenderer = ({ workout }: Props) => {
  return (
    <div className="space-y-4">
      {workout.blocks.map((block) => (
        <div key={block.name} className="rounded-lg border border-slate-800 bg-surface/80 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm uppercase tracking-wide text-slate-400">Block</p>
            <p className="text-sm font-semibold text-slate-100">{block.name}</p>
          </div>
          <div className="space-y-3">
            {block.items.map((item) => (
              <div key={item.exercise_id} className="rounded-md bg-slate-900 px-3 py-2">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-100">
                  <span>{item.name}</span>
                  <span className="text-xs text-slate-400">{item.sets} x {item.reps}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {item.rir !== undefined ? <span>RIR {item.rir}</span> : null}
                  {item.rest_sec ? <span className="ml-3">Rest {item.rest_sec}s</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
