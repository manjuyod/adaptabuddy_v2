"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ActiveProgram,
  GeneratedSession,
  GuardrailEvaluation,
  GuardrailRequest,
  LoadRecommendation,
  PlanSessionExplanationReadModel,
  UserStats,
} from "@adaptabuddy/contracts";
import { getDefaultUserStats } from "@/lib/db-transformers";
import type { ActiveCycleView } from "@/modules/programs/contracts";

type ProgramDayInfo = {
  id: string;
  name: string;
  dayIndex: number;
};

type ProgramInfo = {
  name: string;
  daysPerWeek: number;
};

type WorkoutClientProps = {
  program: ProgramInfo;
  activeCycleView?: ActiveCycleView;
  activeProgram?: ActiveProgram;
  currentDay: ProgramDayInfo;
  userStats: UserStats | null;
};

type GenerateResponse = {
  status: "success" | "error";
  session?: GeneratedSession;
  loadRecommendations?: LoadRecommendation[];
  explanation?: PlanSessionExplanationReadModel;
  errors?: string[];
};

type ToastState = {
  kind: "success" | "error";
  message: string;
};

type GenerateRequestPayload = {
  programDayId: string;
  seed?: string;
  slotId?: string;
  excludeExerciseIds?: string[];
};

type GuardrailEvaluateResponse = {
  status: "success" | "error";
  evaluation?: GuardrailEvaluation;
  errors?: string[];
};

type OptInPersistResponse = {
  status: "success" | "error";
  errors?: string[];
};

const SWAP_SEED_PREFIX = "swap";

const formatModelLabel = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getScopeSummary = (explanation: PlanSessionExplanationReadModel) => {
  const scope = explanation.scope;
  if (!scope) return null;

  if (scope.wideningApplied && scope.survivingScopeBucket) {
    return `Scope widened to ${formatModelLabel(scope.survivingScopeBucket).toLowerCase()}`;
  }

  if (scope.resolvedFocus) {
    return `Focus resolved to ${formatModelLabel(scope.resolvedFocus).toLowerCase()}`;
  }

  return formatModelLabel(scope.outcome);
};

const getFilterSummary = (explanation: PlanSessionExplanationReadModel) => {
  const filter = explanation.filter;
  if (!filter) return null;

  const evaluatedCount = filter.evaluatedCandidateIds.length;
  const survivingCount = filter.survivingCandidateIds.length;
  if (evaluatedCount === 0) {
    return `${survivingCount} candidates survived filtering`;
  }

  return `${survivingCount} of ${evaluatedCount} candidates survived filtering`;
};

const getTieBreakSummary = (explanation: PlanSessionExplanationReadModel) => {
  const tieBreak = explanation.tieBreak;
  if (!tieBreak?.selectedCandidateId) return null;

  return `Selected ${tieBreak.selectedCandidateId} from ${tieBreak.eligibleCandidateIds.length} eligible candidates`;
};

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

const ensureOnline = (isOffline: boolean) => {
  if (isOffline) {
    throw new Error("You appear to be offline. Reconnect and retry.");
  }
};

export function WorkoutClient({
  program,
  activeCycleView,
  activeProgram,
  currentDay,
  userStats,
}: WorkoutClientProps) {
  const displayCycleView =
    activeCycleView ??
    (activeProgram
      ? {
          source: "legacy" as const,
          status: "active" as const,
          programId: activeProgram.programId,
          startedAt: activeProgram.startedAt,
          daysPerWeek: activeProgram.daysPerWeek,
          currentDayIndex: activeProgram.currentDayIndex,
          currentMicrocycle: activeProgram.currentMicrocycle,
          programDayId: currentDay.id,
          programDayName: currentDay.name,
          resolvedClassArchetype: null,
        }
      : null);
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [swappingSlotId, setSwappingSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<GeneratedSession | null>(null);
  const [loadRecommendations, setLoadRecommendations] = useState<LoadRecommendation[]>([]);
  const [sessionExplanation, setSessionExplanation] =
    useState<PlanSessionExplanationReadModel | null>(null);
  const stats = userStats ?? getDefaultUserStats();
  const [guardrailEvaluation, setGuardrailEvaluation] = useState<GuardrailEvaluation | null>(
    null
  );
  const [acknowledgedRisks, setAcknowledgedRisks] = useState<string[]>(
    stats.preferences.acknowledgedRisks ?? []
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isOffline, setIsOffline] = useState(false);
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
    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const buildGuardrailRequest = (): GuardrailRequest => {
    const request: GuardrailRequest = {
      action: "session_generate",
      trainingAge: "intermediate",
    };

    const systemicFatigue = stats.fatigue.systemic?.current;
    if (typeof systemicFatigue === "number") {
      request.systemicFatigue = systemicFatigue;
    }

    return request;
  };

  const postJson = async <TResponse,>(url: string, payload: unknown): Promise<TResponse> => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as {
      status?: "success" | "error";
      errors?: string[];
    };

    if (!response.ok || data.status === "error") {
      throw new Error(data.errors?.join(", ") ?? "Request failed");
    }

    return data as TResponse;
  };

  const setActionError = (message: string, retryAction?: () => Promise<unknown>) => {
    setError(message);
    retryActionRef.current = retryAction ?? null;
    setToast({ kind: "error", message });
  };

  const clearError = () => {
    setError(null);
    retryActionRef.current = null;
  };

  const fetchGuardrailEvaluation = async (): Promise<GuardrailEvaluation | null> => {
    try {
      const data = await postJson<GuardrailEvaluateResponse>(
        "/api/v0/guardrails/evaluate",
        buildGuardrailRequest()
      );
      return data.evaluation ?? null;
    } catch (err) {
      setActionError(
        toErrorMessage(err, "Guardrail evaluation failed"),
        fetchGuardrailEvaluation
      );
      return null;
    }
  };

  const requestGenerateSession = async (
    payload: Omit<GenerateRequestPayload, "programDayId">
  ): Promise<GenerateResponse> => {
    const data = await postJson<GenerateResponse>("/api/v0/sessions/generate", {
      programDayId: currentDay.id,
      ...payload,
    } satisfies GenerateRequestPayload);

    if (data.status === "error" || !data.session) {
      throw new Error(data.errors?.join(", ") ?? "Failed to generate workout");
    }

    return data;
  };

  const persistAcknowledgments = async () => {
    const data = await postJson<OptInPersistResponse>("/api/v0/optins/update", {
      acknowledgedRisks,
    });

    return data.status === "success";
  };

  const hydrateGeneratedSession = (data: GenerateResponse) => {
    if (!data.session) return;
    setSession(data.session);
    setLoadRecommendations(data.loadRecommendations ?? []);
    setSessionExplanation(data.explanation ?? null);
  };

  const performGenerateSession = async () => {
    ensureOnline(isOffline);
    const data = await requestGenerateSession({});
    hydrateGeneratedSession(data);
    setToast({ kind: "success", message: "Workout generated." });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    clearError();
    setGuardrailEvaluation(null);

    try {
      ensureOnline(isOffline);
      const evaluation = await fetchGuardrailEvaluation();
      if (evaluation && (evaluation.blockers.length > 0 || evaluation.warnings.length > 0)) {
        setGuardrailEvaluation(evaluation);
        return;
      }

      await performGenerateSession();
    } catch (err) {
      setActionError(
        toErrorMessage(err, "An unexpected error occurred"),
        handleGenerate
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProceedAfterAcknowledgment = async () => {
    if (!guardrailEvaluation) return;

    const requiredWarnings = guardrailEvaluation.warnings.filter(
      (warning) => warning.severity === "warning" || warning.severity === "danger"
    );
    const missingAck = requiredWarnings.some(
      (warning) => !acknowledgedRisks.includes(warning.id)
    );

    if (guardrailEvaluation.blockers.length > 0 || missingAck) {
      return;
    }

    setIsGenerating(true);
    clearError();

    try {
      ensureOnline(isOffline);
      const persisted = await persistAcknowledgments();
      if (!persisted) return;

      setGuardrailEvaluation(null);
      await performGenerateSession();
    } catch (err) {
      setActionError(
        toErrorMessage(err, "An unexpected error occurred"),
        handleProceedAfterAcknowledgment
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleAcknowledgment = (warningId: string) => {
    setAcknowledgedRisks((prev) => {
      if (prev.includes(warningId)) {
        return prev.filter((id) => id !== warningId);
      }
      return [...prev, warningId];
    });
  };

  const handleStartWorkout = () => {
    if (!session) return;

    sessionStorage.setItem(
      "workoutSession",
      JSON.stringify({
        session,
        loadRecommendations,
        programName: program.name,
        dayName: currentDay.name,
      })
    );

    router.push("/workout/log");
  };

  const handleSwapExercise = async (slotId: string, currentExerciseId: string) => {
    if (!session) return;
    setSwappingSlotId(slotId);
    clearError();

    try {
      ensureOnline(isOffline);
      const excludedIds = session.slots
        .filter((slot) => slot.slotId !== slotId)
        .map((slot) => slot.exerciseId);
      excludedIds.push(currentExerciseId);

      const response = await requestGenerateSession({
        slotId,
        excludeExerciseIds: Array.from(new Set(excludedIds)),
        seed: `${session.seed}:${SWAP_SEED_PREFIX}:${slotId}:${Date.now()}`,
      });

      const replacement = response.session?.slots[0];
      if (!replacement) {
        throw new Error("No alternative exercise available for this slot.");
      }

      const replacementLoadRecommendation = response.loadRecommendations?.[0];

      setSession((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          generatedAt: new Date().toISOString(),
          slots: previous.slots.map((slot) =>
            slot.slotId === slotId ? replacement : slot
          ),
          projectedFatigueCost: {
            ...previous.projectedFatigueCost,
            ...response.session?.projectedFatigueCost,
          },
        };
      });

      setLoadRecommendations((previous) => {
        const next = previous.filter(
          (recommendation) =>
            recommendation.exerciseId !== currentExerciseId &&
            recommendation.exerciseId !== replacement.exerciseId
        );
        if (replacementLoadRecommendation) {
          next.push(replacementLoadRecommendation);
        }
        return next;
      });
      setSessionExplanation(response.explanation ?? sessionExplanation);

      setToast({
        kind: "success",
        message: `Swapped to ${replacement.exerciseName}.`,
      });
    } catch (err) {
      setActionError(
        toErrorMessage(err, "Unable to swap exercise."),
        () => handleSwapExercise(slotId, currentExerciseId)
      );
    } finally {
      setSwappingSlotId(null);
    }
  };

  const handleRetry = async () => {
    if (!retryActionRef.current) return;
    await retryActionRef.current();
  };

  const getLoadRec = (exerciseId: string): LoadRecommendation | undefined =>
    loadRecommendations.find((rec) => rec.exerciseId === exerciseId);

  const guardrailWarnings = guardrailEvaluation?.warnings ?? [];
  const guardrailBlockers = guardrailEvaluation?.blockers ?? [];
  const requiredWarnings = guardrailWarnings.filter(
    (warning) => warning.severity === "warning" || warning.severity === "danger"
  );
  const hasUnacknowledged = requiredWarnings.some(
    (warning) => !acknowledgedRisks.includes(warning.id)
  );
  const canProceed =
    guardrailEvaluation && guardrailBlockers.length === 0 && !hasUnacknowledged;
  const severityStyles: Record<string, string> = {
    info: "border-slate-700 bg-slate-900/40 text-slate-300",
    caution: "border-amber-800/70 bg-amber-900/20 text-amber-200",
    warning: "border-orange-800/70 bg-orange-900/20 text-orange-200",
    danger: "border-red-800 bg-red-900/20 text-red-200",
  };

  const projectedFatigueEntries = useMemo(
    () => Object.entries(session?.projectedFatigueCost ?? {}),
    [session]
  );

  return (
    <div className="space-y-6 pb-28">
      <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Workout</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">{program.name}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-400">
          <span>
            Day {(displayCycleView?.currentDayIndex ?? 0) + 1} of {program.daysPerWeek}:{" "}
            <span className="text-slate-200">{currentDay.name}</span>
          </span>
          <span>
            Microcycle: <span className="text-slate-200">{displayCycleView?.currentMicrocycle}</span>
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Total workouts completed: {stats.progression.totalWorkouts}
        </p>
      </div>

      {isOffline ? (
        <div className="rounded-lg border border-amber-700 bg-amber-900/25 p-4 text-sm text-amber-200">
          You are offline. Session generation, swap, and completion sync require a connection.
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

      {guardrailEvaluation && !session ? (
        <div
          className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg"
          data-testid="guardrail-panel"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400">Guardrails</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">Review Warnings</h2>
          <p className="mt-1 text-sm text-slate-400">
            Some actions need explicit acknowledgment. Resolve blockers or confirm warnings to
            proceed.
          </p>

          {guardrailBlockers.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-red-300">Blocked</p>
              {guardrailBlockers.map((warning) => (
                <div
                  key={warning.id}
                  className={`rounded-lg border p-3 ${severityStyles[warning.severity] ?? severityStyles.info}`}
                >
                  <p className="text-sm font-semibold">{warning.title}</p>
                  <p className="mt-1 text-xs text-slate-300">{warning.description}</p>
                  <p className="mt-1 text-xs text-slate-400">Impact: {warning.impact}</p>
                  {warning.mitigation ? (
                    <p className="mt-1 text-xs text-slate-400">
                      Mitigation: {warning.mitigation}
                    </p>
                  ) : null}
                  {warning.requiredOptIn ? (
                    <p className="mt-1 text-xs text-amber-200">
                      Requires opt-in: {warning.requiredOptIn}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {guardrailWarnings.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Warnings</p>
              {guardrailWarnings.map((warning) => {
                const needsAck =
                  warning.severity === "warning" || warning.severity === "danger";
                const isChecked = acknowledgedRisks.includes(warning.id);

                return (
                  <div
                    key={warning.id}
                    className={`rounded-lg border p-3 ${severityStyles[warning.severity] ?? severityStyles.info}`}
                  >
                    <div className="flex items-start gap-3">
                      {needsAck ? (
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 text-amber-400 focus:ring-amber-400"
                          checked={isChecked}
                          onChange={() => toggleAcknowledgment(warning.id)}
                          data-testid={`guardrail-ack-${warning.id}`}
                        />
                      ) : null}
                      <div>
                        <p className="text-sm font-semibold">{warning.title}</p>
                        <p className="mt-1 text-xs text-slate-300">{warning.description}</p>
                        <p className="mt-1 text-xs text-slate-400">Impact: {warning.impact}</p>
                        {warning.mitigation ? (
                          <p className="mt-1 text-xs text-slate-400">
                            Mitigation: {warning.mitigation}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {canProceed ? (
              <button
                type="button"
                onClick={handleProceedAfterAcknowledgment}
                disabled={isGenerating}
                className="inline-flex min-h-11 items-center rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                data-testid="guardrail-proceed"
              >
                {isGenerating ? "Generating..." : "Acknowledge & Generate"}
              </button>
            ) : (
              <span className="text-sm text-slate-400">
                {guardrailBlockers.length > 0
                  ? "Resolve blockers before continuing."
                  : "Acknowledge required warnings to continue."}
              </span>
            )}
            {guardrailBlockers.length > 0 ? (
              <Link
                href="/settings"
                className="text-sm text-amber-200 transition hover:text-amber-100"
              >
                Review opt-ins
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {!session ? (
        <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
          {isGenerating ? (
            <WorkoutLoadingSkeleton />
          ) : (
            <div className="text-center">
              <p className="text-slate-400">
                Ready to generate your workout for today? The session adapts using your fatigue and
                exercise history.
              </p>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || guardrailEvaluation !== null}
                className="mt-4 inline-flex min-h-12 items-center rounded-md bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {guardrailEvaluation ? "Review Guardrails Above" : "Generate Workout"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Generated</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">
                  {session.programDayName}
                </h2>
                <p className="text-xs text-slate-500">
                  Seed: {session.seed} | Generated at:{" "}
                  {new Date(session.generatedAt).toLocaleTimeString()}
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartWorkout}
                className="hidden min-h-12 items-center rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 md:inline-flex"
              >
                Start Workout
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {sessionExplanation ? (
              <section className="rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Why this session
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {sessionExplanation.sessionRationale}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                    {formatModelLabel(sessionExplanation.recommendedMovementFamily)}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                  {getScopeSummary(sessionExplanation) ? (
                    <p>{getScopeSummary(sessionExplanation)}</p>
                  ) : null}
                  {getFilterSummary(sessionExplanation) ? (
                    <p>{getFilterSummary(sessionExplanation)}</p>
                  ) : null}
                  {getTieBreakSummary(sessionExplanation) ? (
                    <p>{getTieBreakSummary(sessionExplanation)}</p>
                  ) : null}
                </div>

                {sessionExplanation.progressionChanges.length > 0 ? (
                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    {sessionExplanation.progressionChanges.map((change) => (
                      <p key={`${change.exerciseId}-${change.action}-${change.trend}`}>
                        {change.exerciseId}: {formatModelLabel(change.action)} /{" "}
                        {formatModelLabel(change.trend)}
                      </p>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {session.slots.map((slot, index) => {
              const loadRec = getLoadRec(slot.exerciseId);
              const isSwapping = swappingSlotId === slot.slotId;

              return (
                <div
                  key={slot.slotId}
                  className="w-full rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-slate-300">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold text-slate-100">
                            {slot.exerciseName}
                          </h3>
                          <p className="text-xs uppercase tracking-wider text-slate-500">
                            {slot.slotType}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSwapExercise(slot.slotId, slot.exerciseId)}
                        disabled={isSwapping || isGenerating}
                        className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSwapping ? "Swapping..." : "Swap"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="rounded-lg bg-slate-900/40 p-3">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Sets</p>
                        <p className="text-lg font-medium text-slate-200">
                          {slot.setsMin === slot.setsMax
                            ? slot.setsMin
                            : `${slot.setsMin}-${slot.setsMax}`}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-900/40 p-3">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Reps</p>
                        <p className="text-lg font-medium text-slate-200">
                          {slot.repsMin === slot.repsMax
                            ? slot.repsMin
                            : `${slot.repsMin}-${slot.repsMax}`}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-900/40 p-3">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Rest</p>
                        <p className="text-lg font-medium text-slate-200">{slot.restSeconds}s</p>
                      </div>
                      <div className="rounded-lg bg-slate-900/40 p-3">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Score</p>
                        <p className="text-lg font-medium text-slate-200">
                          {slot.score.toFixed(1)}
                        </p>
                      </div>
                    </div>

                    {loadRec ? (
                      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                        <p className="text-xs uppercase tracking-wider text-indigo-400">
                          Recommended Load
                        </p>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm">
                          {loadRec.recommendedWeight !== null ? (
                            <span className="text-slate-200">
                              Weight:{" "}
                              <span className="font-semibold">
                                {loadRec.recommendedWeight.toFixed(1)} kg
                              </span>
                            </span>
                          ) : null}
                          <span className="text-slate-200">
                            Reps:{" "}
                            <span className="font-semibold">{loadRec.recommendedReps}</span>
                          </span>
                          <span className="text-slate-200">
                            Target RIR: <span className="font-semibold">{loadRec.targetRir}</span>
                          </span>
                          {loadRec.isProgression ? (
                            <span className="rounded bg-emerald-800 px-2 py-0.5 text-xs text-emerald-200">
                              Progression
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{loadRec.reasoning}</p>
                      </div>
                    ) : null}

                    <p className="text-sm text-slate-500">{slot.rationale}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {projectedFatigueEntries.length > 0 ? (
            <div className="rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Projected Fatigue Cost
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {projectedFatigueEntries.map(([muscle, cost]) => (
                  <span
                    key={muscle}
                    className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300"
                  >
                    {muscle}: <span className="font-medium text-amber-400">+{cost.toFixed(0)}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
            <div className="mx-auto max-w-5xl px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={handleStartWorkout}
                className="flex min-h-12 w-full items-center justify-center rounded-md bg-emerald-600 px-8 py-3 text-base font-semibold text-white transition hover:bg-emerald-500"
              >
                Start Workout
              </button>
            </div>
          </div>
        </>
      )}

      <div className="pt-4">
        <Link
          href="/dashboard"
          className="text-sm text-slate-400 transition hover:text-slate-200"
        >
          Back to Dashboard
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

function WorkoutLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-48 rounded bg-slate-700/60" />
      <div className="h-10 w-full rounded bg-slate-800/70" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 rounded-xl border border-slate-700 bg-slate-900/40" />
        <div className="h-28 rounded-xl border border-slate-700 bg-slate-900/40" />
      </div>
      <div className="h-32 rounded-xl border border-slate-700 bg-slate-900/40" />
    </div>
  );
}
