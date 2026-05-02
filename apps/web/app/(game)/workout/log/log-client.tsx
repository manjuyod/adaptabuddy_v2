"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CompleteSessionResponse,
  ExerciseLog,
  FilledSlot,
  GeneratedSession,
  LoadRecommendation,
  SetLog,
} from "@adaptabuddy/contracts";

type StoredSession = {
  session: GeneratedSession;
  loadRecommendations: LoadRecommendation[];
  programName: string;
  dayName: string;
};

type SetInput = {
  weight: string;
  reps: string;
  rir: string;
  completed: boolean;
};

type ExerciseState = {
  slotId: string;
  exerciseId: string;
  exerciseName: string;
  slot: FilledSlot;
  loadRec?: LoadRecommendation;
  sets: SetInput[];
  completionHistory: number[];
};

type RestSource = {
  exerciseName: string;
  setNumber: number;
};

type ToastState = {
  kind: "success" | "error";
  message: string;
};

const REST_OPTIONS = [90, 120, 180] as const;

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

const formatRestTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

export function LogClient() {
  const router = useRouter();
  const [sessionData, setSessionData] = useState<StoredSession | null>(null);
  const [exercises, setExercises] = useState<ExerciseState[]>([]);
  const [startedAt] = useState<string>(new Date().toISOString());
  const [overallRpe, setOverallRpe] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);
  const [restDuration, setRestDuration] = useState<number>(REST_OPTIONS[0]);
  const [restSource, setRestSource] = useState<RestSource | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const retryActionRef = useRef<(() => Promise<unknown>) | null>(null);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOffline(typeof navigator !== "undefined" && !navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (restSecondsRemaining <= 0) return;
    const timeout = window.setTimeout(() => {
      setRestSecondsRemaining((previous) => Math.max(0, previous - 1));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [restSecondsRemaining]);

  useEffect(() => {
    const stored = sessionStorage.getItem("workoutSession");
    if (!stored) {
      router.push("/workout");
      return;
    }

    try {
      const data = JSON.parse(stored) as StoredSession;
      setSessionData(data);
      setRestDuration(
        REST_OPTIONS.includes(data.session.slots[0]?.restSeconds as 90 | 120 | 180)
          ? data.session.slots[0].restSeconds
          : REST_OPTIONS[0]
      );

      const initialExercises: ExerciseState[] = data.session.slots.map((slot) => {
        const loadRec = data.loadRecommendations.find((r) => r.exerciseId === slot.exerciseId);
        const numSets = Math.ceil((slot.setsMin + slot.setsMax) / 2);

        return {
          slotId: slot.slotId,
          exerciseId: slot.exerciseId,
          exerciseName: slot.exerciseName,
          slot,
          loadRec,
          completionHistory: [],
          sets: Array.from({ length: numSets }, () => ({
            weight: loadRec?.recommendedWeight?.toFixed(1) ?? "",
            reps: loadRec?.recommendedReps?.toString() ?? slot.repsMin.toString(),
            rir: loadRec?.targetRir?.toString() ?? "2",
            completed: false,
          })),
        };
      });

      setExercises(initialExercises);
    } catch {
      router.push("/workout");
    }
  }, [router]);

  const setActionError = (message: string, retryAction?: () => Promise<unknown>) => {
    setError(message);
    retryActionRef.current = retryAction ?? null;
    setToast({ kind: "error", message });
  };

  const clearError = () => {
    setError(null);
    retryActionRef.current = null;
  };

  const updateExerciseAt = (exerciseIndex: number, updater: (exercise: ExerciseState) => ExerciseState) => {
    setExercises((previous) =>
      previous.map((exercise, index) => (index === exerciseIndex ? updater(exercise) : exercise))
    );
  };

  const handleSetChange = (
    exerciseIndex: number,
    setIndex: number,
    field: keyof Omit<SetInput, "completed">,
    value: string
  ) => {
    updateExerciseAt(exerciseIndex, (exercise) => {
      const updatedSets = exercise.sets.map((set, index) => {
        if (index !== setIndex) return set;
        return { ...set, [field]: value };
      });

      return {
        ...exercise,
        sets: updatedSets,
      };
    });
  };

  const handleAddSet = (exerciseIndex: number) => {
    updateExerciseAt(exerciseIndex, (exercise) => {
      const lastSet = exercise.sets[exercise.sets.length - 1] ?? {
        weight: "",
        reps: "",
        rir: "2",
        completed: false,
      };
      return {
        ...exercise,
        sets: [...exercise.sets, { ...lastSet, completed: false }],
      };
    });
  };

  const handleRemoveSet = (exerciseIndex: number, setIndex: number) => {
    updateExerciseAt(exerciseIndex, (exercise) => {
      if (exercise.sets.length <= 1) return exercise;

      const filteredSets = exercise.sets.filter((_, index) => index !== setIndex);
      const adjustedHistory = exercise.completionHistory
        .filter((completedIndex) => completedIndex !== setIndex)
        .map((completedIndex) => (completedIndex > setIndex ? completedIndex - 1 : completedIndex));

      return {
        ...exercise,
        sets: filteredSets,
        completionHistory: adjustedHistory,
      };
    });
  };

  const startRestTimer = (exerciseName: string, setNumber: number) => {
    setRestSource({ exerciseName, setNumber });
    setRestSecondsRemaining(restDuration);
  };

  const handleCompleteSet = (exerciseIndex: number, setIndex: number) => {
    const exercise = exercises[exerciseIndex];
    const targetSet = exercise?.sets[setIndex];
    const sourceSet = setIndex + 1;

    if (!exercise || !targetSet || targetSet.completed) {
      return;
    }

    if (targetSet.weight.trim() === "" || targetSet.reps.trim() === "") {
      setActionError("Enter weight and reps before marking a set complete.");
      return;
    }

    updateExerciseAt(exerciseIndex, (exercise) => {
      const targetSet = exercise.sets[setIndex];
      if (!targetSet || targetSet.completed) return exercise;

      const updatedSets = exercise.sets.map((set, index) =>
        index === setIndex ? { ...set, completed: true } : set
      );

      return {
        ...exercise,
        sets: updatedSets,
        completionHistory: [...exercise.completionHistory, setIndex],
      };
    });

    startRestTimer(exercise.exerciseName, sourceSet);
    setToast({ kind: "success", message: `Set ${sourceSet} complete. Rest timer started.` });
    clearError();
  };

  const handleUndoLastCompletedSet = (exerciseIndex: number) => {
    updateExerciseAt(exerciseIndex, (exercise) => {
      const lastCompletedSetIndex =
        exercise.completionHistory[exercise.completionHistory.length - 1];
      if (lastCompletedSetIndex === undefined) return exercise;

      const updatedSets = exercise.sets.map((set, index) =>
        index === lastCompletedSetIndex ? { ...set, completed: false } : set
      );

      return {
        ...exercise,
        sets: updatedSets,
        completionHistory: exercise.completionHistory.slice(0, -1),
      };
    });

    setToast({ kind: "success", message: "Last completed set undone." });
  };

  const handleRetry = async () => {
    if (!retryActionRef.current) return;
    await retryActionRef.current();
  };

  const handleComplete = async () => {
    if (!sessionData) return;
    if (isOffline) {
      setActionError("You are offline. Reconnect before submitting workout.", handleComplete);
      return;
    }

    const completedSetCount = exercises.reduce(
      (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
      0
    );
    if (completedSetCount === 0) {
      setActionError("Mark at least one set complete before finishing the session.");
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      const exerciseLogs: ExerciseLog[] = exercises.map((exercise) => ({
        slotId: exercise.slotId,
        exerciseId: exercise.exerciseId,
        sets: exercise.sets
          .map((set, index): SetLog | null => {
            if (!set.completed) return null;
            return {
              setIndex: index,
              weight: parseFloat(set.weight) || 0,
              reps: parseInt(set.reps, 10) || 0,
              rir: set.rir !== "" ? parseInt(set.rir, 10) : null,
            };
          })
          .filter((set): set is SetLog => set !== null),
      }));

      const response = await fetch("/api/v0/sessions/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          programDayId: sessionData.session.programDayId,
          seed: sessionData.session.seed,
          startedAt,
          completedAt: new Date().toISOString(),
          exercises: exerciseLogs,
          overallRpe: overallRpe !== "" ? parseFloat(overallRpe) : null,
          notes: notes || undefined,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as CompleteSessionResponse;
      if (!response.ok || result.status === "error") {
        throw new Error(result.errors?.join(", ") ?? "Failed to complete workout");
      }

      sessionStorage.removeItem("workoutSession");
      setIsCompleted(true);
      setCompletionMessage(result.message ?? "Workout completed successfully!");
      setToast({ kind: "success", message: "Workout saved successfully." });
    } catch (err) {
      setActionError(
        toErrorMessage(err, "An unexpected error occurred"),
        handleComplete
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCompletedSets = useMemo(
    () =>
      exercises.reduce(
        (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
        0
      ),
    [exercises]
  );

  const totalVolume = useMemo(
    () =>
      exercises.reduce((volume, exercise) => {
        const exerciseVolume = exercise.sets.reduce((sum, set) => {
          if (!set.completed) return sum;
          const weight = parseFloat(set.weight);
          const reps = parseInt(set.reps, 10);
          if (!Number.isFinite(weight) || !Number.isFinite(reps)) return sum;
          return sum + weight * reps;
        }, 0);
        return volume + exerciseVolume;
      }, 0),
    [exercises]
  );

  const durationMinutes = Math.max(
    1,
    Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)
  );

  if (!sessionData) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
          <p className="text-center text-slate-400">Loading workout session...</p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    const fatigueEntries = Object.entries(sessionData.session.projectedFatigueCost);

    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-slate-950/90 px-4 py-10">
        <div className="mx-auto w-full max-w-2xl rounded-xl border border-emerald-800 bg-emerald-900/20 p-8 shadow-xl">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-800">
              <svg
                className="h-8 w-8 text-emerald-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-emerald-100">Workout Complete!</h2>
            <p className="mt-2 text-emerald-300">{completionMessage}</p>
          </div>

          <div className="mt-6 rounded-lg border border-emerald-700 bg-emerald-800/30 p-4">
            <p className="text-xs uppercase tracking-wider text-emerald-300">Session Summary</p>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-emerald-300">Exercises</p>
                <p className="text-lg font-semibold text-emerald-50">{exercises.length}</p>
              </div>
              <div>
                <p className="text-emerald-300">Completed Sets</p>
                <p className="text-lg font-semibold text-emerald-50">{totalCompletedSets}</p>
              </div>
              <div>
                <p className="text-emerald-300">Total Volume</p>
                <p className="text-lg font-semibold text-emerald-50">{totalVolume.toFixed(0)} kg</p>
              </div>
              <div>
                <p className="text-emerald-300">Duration</p>
                <p className="text-lg font-semibold text-emerald-50">{durationMinutes} min</p>
              </div>
            </div>
            {overallRpe ? (
              <p className="mt-3 text-sm text-emerald-200">Reported RPE: {overallRpe}</p>
            ) : null}
          </div>

          {fatigueEntries.length > 0 ? (
            <div className="mt-4 rounded-lg border border-emerald-700 bg-emerald-800/20 p-4">
              <p className="text-xs uppercase tracking-wider text-emerald-300">Projected Fatigue Impact</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {fatigueEntries.map(([muscle, value]) => (
                  <span
                    key={muscle}
                    className="rounded-full bg-emerald-800/60 px-3 py-1 text-xs text-emerald-100"
                  >
                    {muscle}: +{value.toFixed(0)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              href="/dashboard"
              className="flex min-h-12 items-center justify-center rounded-md bg-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-600"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/workout"
              className="flex min-h-12 items-center justify-center rounded-md bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
            >
              Start Another Workout
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-500">Logging</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">{sessionData.programName}</h1>
        <p className="text-sm text-slate-400">{sessionData.dayName}</p>
        <p className="mt-1 text-xs text-slate-500">
          Completed sets: {totalCompletedSets} | Volume: {totalVolume.toFixed(0)} kg
        </p>
      </div>

      {isOffline ? (
        <div className="rounded-lg border border-amber-700 bg-amber-900/25 p-4 text-sm text-amber-200">
          You are offline. Set logging works locally, but completion sync requires connection.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-red-300">{error}</p>
          {retryActionRef.current ? (
            <button
              type="button"
              onClick={handleRetry}
              className="mt-3 inline-flex min-h-11 items-center rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Rest Timer</p>
            <p className="text-2xl font-semibold text-slate-100">{formatRestTime(restSecondsRemaining)}</p>
            <p className="text-xs text-slate-500">
              {restSecondsRemaining > 0 && restSource
                ? `${restSource.exerciseName} · Set ${restSource.setNumber}`
                : "Starts automatically when a set is marked complete"}
            </p>
          </div>
          {restSecondsRemaining > 0 ? (
            <button
              type="button"
              onClick={() => setRestSecondsRemaining(0)}
              className="inline-flex min-h-11 items-center rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              Skip Rest
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {REST_OPTIONS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              onClick={() => setRestDuration(seconds)}
              className={`inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-semibold transition ${
                restDuration === seconds
                  ? "bg-indigo-500 text-white"
                  : "border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {seconds}s
            </button>
          ))}
        </div>
      </div>

      {exercises.map((exercise, exerciseIndex) => {
        const completedCount = exercise.sets.filter((set) => set.completed).length;
        const hasUndo = exercise.completionHistory.length > 0;

        return (
          <div
            key={exercise.slotId}
            className="w-full rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-slate-300">
                    {exerciseIndex + 1}
                  </span>
                  <h3 className="truncate text-lg font-semibold text-slate-100">
                    {exercise.exerciseName}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Target: {exercise.slot.setsMin}-{exercise.slot.setsMax} sets x{" "}
                  {exercise.slot.repsMin}-{exercise.slot.repsMax} reps
                </p>
                {exercise.loadRec?.recommendedWeight !== undefined &&
                exercise.loadRec.recommendedWeight !== null ? (
                  <p className="mt-1 text-xs text-indigo-300">
                    Recommended: {exercise.loadRec.recommendedWeight.toFixed(1)} kg,{" "}
                    {exercise.loadRec.recommendedReps} reps, RIR {exercise.loadRec.targetRir}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-slate-400">
                  Completed: {completedCount}/{exercise.sets.length}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleAddSet(exerciseIndex)}
                  className="inline-flex min-h-11 items-center rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
                >
                  + Add Set
                </button>
                <button
                  type="button"
                  onClick={() => handleUndoLastCompletedSet(exerciseIndex)}
                  disabled={!hasUndo}
                  className="inline-flex min-h-11 items-center rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Undo Last
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {exercise.sets.map((set, setIndex) => (
                <div
                  key={setIndex}
                  className={`rounded-lg border p-3 ${
                    set.completed
                      ? "border-emerald-700/70 bg-emerald-900/20"
                      : "border-slate-700 bg-slate-900/30"
                  }`}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_1fr_1fr_auto_auto] sm:items-center">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-sm text-slate-300">
                      {setIndex + 1}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      value={set.weight}
                      onChange={(event) =>
                        handleSetChange(exerciseIndex, setIndex, "weight", event.target.value)
                      }
                      placeholder="Weight (kg)"
                      disabled={set.completed}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-right text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={set.reps}
                      onChange={(event) =>
                        handleSetChange(exerciseIndex, setIndex, "reps", event.target.value)
                      }
                      placeholder="Reps"
                      disabled={set.completed}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-right text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="10"
                      value={set.rir}
                      onChange={(event) =>
                        handleSetChange(exerciseIndex, setIndex, "rir", event.target.value)
                      }
                      placeholder="RIR"
                      disabled={set.completed}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-right text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => handleCompleteSet(exerciseIndex, setIndex)}
                      disabled={set.completed}
                      className={`inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition ${
                        set.completed
                          ? "cursor-default bg-emerald-700 text-emerald-100"
                          : "bg-indigo-500 text-white hover:bg-indigo-400"
                      }`}
                    >
                      {set.completed ? "Done" : "Mark Done"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSet(exerciseIndex, setIndex)}
                      disabled={exercise.sets.length <= 1}
                      className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:bg-red-900/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Remove set"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-100">Session Notes</h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rpe" className="block text-sm text-slate-400">
              Overall RPE (1-10)
            </label>
            <input
              id="rpe"
              type="number"
              inputMode="decimal"
              min="1"
              max="10"
              step="0.5"
              value={overallRpe}
              onChange={(event) => setOverallRpe(event.target.value)}
              placeholder="7.5"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="notes" className="block text-sm text-slate-400">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="How did the workout feel? Any adjustments needed?"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="hidden justify-center md:flex">
        <button
          type="button"
          onClick={handleComplete}
          disabled={isSubmitting}
          className="inline-flex min-h-12 items-center rounded-md bg-emerald-600 px-8 py-3 text-base font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {isSubmitting ? "Saving..." : "Complete Workout"}
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
        <div className="mx-auto max-w-5xl px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleComplete}
            disabled={isSubmitting}
            className="flex min-h-12 w-full items-center justify-center rounded-md bg-emerald-600 px-8 py-3 text-base font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {isSubmitting ? "Saving..." : "Complete Workout"}
          </button>
        </div>
      </div>

      <div className="pt-4">
        <Link href="/workout" className="text-sm text-slate-400 transition hover:text-slate-200">
          Back to Workout
        </Link>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-4">
          <div
            className={`pointer-events-auto w-full max-w-md rounded-md border px-4 py-3 text-sm shadow-lg ${
              toast.kind === "error"
                ? "border-red-700 bg-red-950/90 text-red-100"
                : "border-emerald-700 bg-emerald-950/90 text-emerald-100"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}
