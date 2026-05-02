"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type {
  ActiveCycleView,
  ProgramCatalogItem,
  ActiveProgram,
} from "@/modules/programs/contracts";
import { activateProgramAction } from "@/modules/programs/actions";

type ProgramsClientProps = {
  programs: ProgramCatalogItem[];
  activeCycleView?: ActiveCycleView | null;
  activeProgram?: ActiveProgram | null;
  fetchError?: string;
};

export function ProgramsClient({
  programs,
  activeCycleView,
  activeProgram,
  fetchError
}: ProgramsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [expandedProgramId, setExpandedProgramId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localActiveCycleView, setLocalActiveCycleView] =
    useState<ActiveCycleView | null>(
      activeCycleView ??
        (activeProgram
          ? {
              source: "legacy",
              status: "active",
              programId: String(activeProgram.programId),
              startedAt: activeProgram.startedAt,
              daysPerWeek: activeProgram.daysPerWeek,
              currentDayIndex: activeProgram.currentDayIndex,
              currentMicrocycle: activeProgram.currentMicrocycle,
              programDayId: null,
              programDayName: null,
              classPresetId: null,
              resolvedClassArchetype: null,
            }
          : null)
    );

  const handleActivate = (programId: number, programName: string) => {
    if (localActiveCycleView?.source === "normalized") {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm("Switch to this program?")
    ) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setActivatingId(programId);

    startTransition(async () => {
      const result = await activateProgramAction(programId);

      if (result.success && result.activeProgram) {
        setLocalActiveCycleView({
          source: "legacy",
          status: "active",
          programId: String(result.activeProgram.programId),
          startedAt: result.activeProgram.startedAt,
          daysPerWeek: result.activeProgram.daysPerWeek,
          currentDayIndex: result.activeProgram.currentDayIndex,
          currentMicrocycle: result.activeProgram.currentMicrocycle,
          programDayId: null,
          programDayName: null,
          classPresetId: null,
          resolvedClassArchetype: null,
        });
        setSuccessMessage(`"${programName}" is now your active program!`);
      } else {
        setError(result.error ?? "Failed to activate program");
      }

      setActivatingId(null);
    });
  };

  const isActive = (programId: number): boolean => {
    if (!localActiveCycleView) return false;
    return localActiveCycleView.programId === programId.toString();
  };

  const normalizedCycleOwnsActivation = localActiveCycleView?.source === "normalized";

  const handleToggleDetails = (programId: number) => {
    setExpandedProgramId((current) => (current === programId ? null : programId));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Programs</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Programs Dashboard</h1>
        <p className="text-sm text-slate-400">
          Review weekly structure, slot targets, and muscle coverage before
          activating a plan.
        </p>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-red-400">{fetchError}</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-900/20 p-4">
          <p className="text-sm text-emerald-400">{successMessage}</p>
        </div>
      )}

      {normalizedCycleOwnsActivation && (
        <div className="rounded-lg border border-amber-800 bg-amber-900/20 p-4">
          <p className="text-sm text-amber-300">
            Normalized cycle state is authoritative. Manual legacy activation is disabled while
            this cycle remains active or completed.
          </p>
        </div>
      )}

      {programs.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
          <p className="text-center text-slate-400">No programs available.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              isExpanded={expandedProgramId === program.id}
              isActive={isActive(program.id)}
              activeCycleStatus={localActiveCycleView?.status ?? null}
              disableActivation={normalizedCycleOwnsActivation}
              isActivating={activatingId === program.id}
              isPending={isPending}
              onToggleDetails={handleToggleDetails}
              onActivate={handleActivate}
            />
          ))}
        </div>
      )}

      <div className="pt-4">
        <Link href="/dashboard" className="text-sm text-slate-400 transition hover:text-slate-200">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

type ProgramCardProps = {
  program: ProgramCatalogItem;
  isExpanded: boolean;
  isActive: boolean;
  activeCycleStatus: "active" | "completed" | null;
  disableActivation: boolean;
  isActivating: boolean;
  isPending: boolean;
  onToggleDetails: (programId: number) => void;
  onActivate: (programId: number, programName: string) => void;
};

function ProgramCard({
  program,
  isExpanded,
  isActive,
  activeCycleStatus,
  disableActivation,
  isActivating,
  isPending,
  onToggleDetails,
  onActivate
}: ProgramCardProps) {
  const topCoverage = program.muscleCoverage[0]?.score ?? 1;

  return (
    <div
      className={`rounded-xl border bg-surface/80 p-6 shadow-lg transition ${
        isActive ? "border-emerald-500/80 shadow-emerald-950/30" : "border-slate-800"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-100">{program.name}</h2>
            {isActive && (
              <span className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">
                {activeCycleStatus === "completed" ? "Completed" : "Active"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
            {program.default_days_per_week} days/week
            {program.min_days_per_week !== program.max_days_per_week && (
              <span className="ml-2 normal-case">
                ({program.min_days_per_week}-{program.max_days_per_week} range)
              </span>
            )}
          </p>
        </div>
      </div>

      {program.description && <p className="mt-3 text-sm text-slate-400">{program.description}</p>}

      <div className="mt-4 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Muscle Coverage</p>
        {program.muscleCoverage.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No muscle target metadata available.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {program.muscleCoverage.slice(0, 5).map((coverage) => {
              const barWidth = Math.max(
                8,
                Math.round((coverage.score / topCoverage) * 100)
              );

              return (
                <div key={coverage.muscle}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{formatMuscleLabel(coverage.muscle)}</span>
                    <span className="text-slate-500">{coverage.score.toFixed(1)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                    <div
                      className="h-1.5 rounded-full bg-amber-400/90"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => onToggleDetails(program.id)}
          className="rounded-md border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600"
        >
          {isExpanded ? "Hide Details" : "View Details"}
        </button>
        {isActive ? (
          <button
            type="button"
            disabled
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-400 cursor-not-allowed sm:ml-auto"
          >
            {activeCycleStatus === "completed" ? "Cycle Completed" : "Currently Active"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onActivate(program.id, program.name)}
            disabled={isPending || disableActivation}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:ml-auto"
          >
            {isActivating ? "Activating..." : "Activate Program"}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Day Structure</p>
          {program.days.length === 0 ? (
            <p className="text-sm text-slate-500">No day configuration found for this program.</p>
          ) : (
            <div className="space-y-3">
              {program.days.map((day) => (
                <div key={day.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-200">
                      Day {day.dayIndex + 1}: {day.name}
                    </p>
                    <p className="text-xs text-slate-500">{day.slots.length} slots</p>
                  </div>
                  <div className="mt-2 space-y-2">
                    {day.slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="rounded-md border border-slate-800/90 bg-slate-950/50 px-2 py-2 text-xs text-slate-300"
                      >
                        <p className="font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Slot {slot.slotIndex + 1} · {slot.slotType}
                        </p>
                        <p className="mt-1 text-slate-300">
                          {slot.setsMin}
                          {slot.setsMin !== slot.setsMax ? `-${slot.setsMax}` : ""} sets · {slot.repsMin}
                          {slot.repsMin !== slot.repsMax ? `-${slot.repsMax}` : ""} reps
                        </p>
                        <p className="mt-1 text-slate-400">
                          Targets: {renderMuscleTargets(slot.muscleTargets)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const formatMuscleLabel = (slug: string) =>
  slug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const renderMuscleTargets = (muscleTargets: Record<string, number>) => {
  const entries = Object.entries(muscleTargets);
  if (entries.length === 0) {
    return "General";
  }

  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([muscle]) => formatMuscleLabel(muscle))
    .join(", ");
};
