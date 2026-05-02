"use client";

import { useState } from "react";
import type { GenerateWorkoutResponse } from "../../../src/modules/workouts/contracts";
import { WorkoutRenderer } from "../../../src/modules/workouts/components/WorkoutRenderer";
import { DebugPanel } from "../../../src/modules/workouts/components/DebugPanel";

export const GenerateClient = () => {
  const [result, setResult] = useState<GenerateWorkoutResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v0/workouts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: ["strength"], constraints: { equipment: ["barbell", "bench", "rack"] } })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Request failed");
      }

      const data = (await response.json()) as GenerateWorkoutResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Generator</p>
            <h1 className="mt-2 text-xl font-semibold text-slate-100">Generate a Workout</h1>
            <p className="text-sm text-slate-400">
              Contract-first request → engine → validated response. No tokens touch localStorage.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {loading ? "Generating..." : "Generate Workout"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </div>

      {result?.workout ? (
        <div className="space-y-3">
          <WorkoutRenderer workout={result.workout} />
          <DebugPanel debug={result.debug} />
        </div>
      ) : null}
    </div>
  );
};
