"use client";

import { useState } from "react";
import type { GenerateWorkoutResponse } from "../contracts";

type Props = {
  debug: GenerateWorkoutResponse["debug"];
};

export const DebugPanel = ({ debug }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-slate-800 bg-surface/70 p-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-sm font-semibold text-slate-200"
      >
        <span>Debug</span>
        <span className="text-xs text-slate-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2 text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <span>Seed</span>
            <code className="rounded bg-slate-900 px-2 py-1 text-slate-200">{debug.seed}</code>
          </div>
          <div>
            <p className="mb-1 text-slate-400">Selected IDs</p>
            <div className="flex flex-wrap gap-2">
              {debug.selected_ids.map((id) => (
                <span key={id} className="rounded bg-slate-900 px-2 py-1 text-slate-200">
                  {id}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-slate-400">Rejected</p>
            <div className="space-y-1">
              {debug.rejected.map((entry) => (
                <div key={`${entry.id}-${entry.reason}`} className="rounded bg-slate-900 px-2 py-1">
                  <span className="font-semibold text-slate-200">{entry.id}</span>
                  <span className="ml-2 text-slate-400">{entry.reason}</span>
                </div>
              ))}
              {!debug.rejected.length ? <p className="text-slate-500">None</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
