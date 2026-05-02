import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import type { UserStats } from "@adaptabuddy/contracts";
import { getDefaultUserStats } from "@/lib/db-transformers";
import { createSupabaseServerComponentClient } from "@/lib/supabase/next";
import { getProgramById, getUserActiveCycleView } from "@/modules/programs/service";
import { getDeterministicAnalyticsReadModel } from "@/modules/reporting/service";
import {
  formatMuscleLabel,
  getDashboardCycleSummary,
  getDashboardRecentWorkouts,
  getFatigueSummary,
  getProgressionTimelineSeries,
  getWeeklyVolumeSummary,
} from "@/modules/dashboard/summary";
import { ProgressionTimelineChart } from "@/modules/dashboard/components/ProgressionTimelineChart";

const fatigueBarClassBySeverity = {
  low: "bg-emerald-400",
  moderate: "bg-amber-400",
  high: "bg-red-400",
} as const;

const formatWorkoutDate = (dateValue: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateValue));

export default async function DashboardPage() {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ activeCycleView }, { data: userRow }, analytics] = await Promise.all([
    getUserActiveCycleView(supabase, user.id),
    supabase.from("users").select("stats_json").eq("id", user.id).single(),
    getDeterministicAnalyticsReadModel(supabase, user.id, { recentSessionLimit: 10 }),
  ]);

  const stats = (userRow?.stats_json as UserStats) ?? getDefaultUserStats();

  let activeProgramName = "No active program";
  if (activeCycleView) {
    const programId = Number(activeCycleView.programId);
    if (Number.isFinite(programId)) {
      const { program } = await getProgramById(supabase, programId);
      if (program) {
        activeProgramName = program.name;
      }
    }
  }

  const fatigueSummary = getFatigueSummary(analytics, stats, 20);
  const progressionTimeline = getProgressionTimelineSeries(analytics, stats);
  const weeklyVolumeSummary = getWeeklyVolumeSummary(analytics, stats);
  const recentWorkouts = getDashboardRecentWorkouts(analytics, stats, 10);
  const cycleSummary = getDashboardCycleSummary(analytics);
  const maxWeeklyVolume = weeklyVolumeSummary[0]?.sets ?? 0;
  const fallbackWeeklyVolume =
    analytics === null ? Math.round(stats.progression.weeklyVolume).toLocaleString() : null;
  const currentDay =
    activeCycleView?.currentDayIndex !== null && activeCycleView?.currentDayIndex !== undefined
      ? activeCycleView.currentDayIndex + 1
      : null;
  const totalDays = activeCycleView?.daysPerWeek ?? 0;
  const dayProgressPct =
    currentDay && totalDays > 0
      ? Math.round((Math.min(currentDay, totalDays) / totalDays) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-surface/80 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Training Overview</h1>
        <p className="text-sm text-slate-400">Signed in as {user.email ?? "unknown user"}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Active Program</p>
          <p className="mt-2 text-xl font-semibold text-slate-100">{activeProgramName}</p>
          {activeCycleView?.status === "active" && currentDay !== null ? (
            <>
              <p className="mt-2 text-sm text-slate-400">
                Day {currentDay} of {totalDays} this week
              </p>
              {cycleSummary ? (
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-200">
                      Cycle {cycleSummary.completedSessions} / {cycleSummary.totalSessions}
                    </span>
                    <span className="text-emerald-300">
                      {cycleSummary.completionPercentage}% complete
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {cycleSummary.remainingSessions} sessions remaining
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <span>Level {cycleSummary.level} · {cycleSummary.xp} XP</span>
                    <span>Streak {cycleSummary.streak} · Missed {cycleSummary.missedCount}</span>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-emerald-400"
                  style={{
                    width: `${cycleSummary?.completionPercentage ?? dayProgressPct}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.15em] text-slate-500">
                Microcycle {activeCycleView.currentMicrocycle}
              </p>
            </>
          ) : activeCycleView?.status === "completed" ? (
            <p className="mt-2 text-sm text-slate-400">
              This normalized cycle is complete. Start a new cycle before generating another
              workout.
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Activate a program from the programs page to start session generation.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Quick Actions</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Link
              href="/workout"
              className="rounded-lg border border-emerald-700/60 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400"
            >
              Start Workout
            </Link>
            <Link
              href="/programs"
              className="rounded-lg border border-amber-700/60 bg-amber-500/10 p-3 text-sm font-semibold text-amber-100 transition hover:border-amber-400"
            >
              Programs
            </Link>
            <Link
              href="/settings"
              className="rounded-lg border border-slate-700 bg-slate-800/70 p-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
            >
              Settings
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Fatigue Overview</p>
          {fatigueSummary.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No fatigue data yet. Complete a workout to populate muscle fatigue.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {fatigueSummary.map((entry) => (
                <div key={entry.muscle}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{formatMuscleLabel(entry.muscle)}</span>
                    <span className="text-slate-400">{entry.current.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-800">
                    <div
                      className={`h-2 rounded-full ${fatigueBarClassBySeverity[entry.severity]}`}
                      style={{ width: `${Math.round(entry.current)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg xl:col-span-2">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">1RM Progression</p>
          <ProgressionTimelineChart series={progressionTimeline} />
        </div>

        <div className="rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Weekly Volume by Muscle</p>
          {weeklyVolumeSummary.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Detailed per-muscle volume is not available yet.
              {fallbackWeeklyVolume ? ` Total weekly volume: ${fallbackWeeklyVolume}.` : null}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {weeklyVolumeSummary.map((entry) => (
                <div key={entry.muscle}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{formatMuscleLabel(entry.muscle)}</span>
                    <span className="text-slate-400">{entry.sets.toFixed(1)} sets</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-cyan-400"
                      style={{
                        width: `${Math.round((entry.sets / Math.max(maxWeeklyVolume, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-surface/80 p-5 shadow-lg xl:col-span-2">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Workout History</p>
          <div className="mt-3 grid gap-2">
            {recentWorkouts.length === 0 ? (
              <p className="text-sm text-slate-500">No completed workouts yet.</p>
            ) : (
              recentWorkouts.map((workout) => (
                workout.workoutId ? (
                  <Link
                    key={workout.workoutId}
                    href={`/history/${workout.workoutId}` as Route}
                    className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 transition hover:border-slate-600"
                  >
                    <p className="text-sm font-semibold text-slate-200">{workout.dayName}</p>
                    <p className="text-xs text-slate-500">{formatWorkoutDate(workout.completedAt)}</p>
                    {workout.volume !== null ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Total volume: {Math.round(workout.volume).toLocaleString()}
                      </p>
                    ) : null}
                  </Link>
                ) : (
                  <div
                    key={`${workout.completedAt}-${workout.dayName}`}
                    className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-200">{workout.dayName}</p>
                    <p className="text-xs text-slate-500">{formatWorkoutDate(workout.completedAt)}</p>
                    {workout.volume !== null ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Total volume: {Math.round(workout.volume).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                )
              ))
            )}
          </div>
          <div className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-500">
            {cycleSummary ? (
              <>
                Completed sessions: {cycleSummary.completedSessions} · Remaining sessions:{" "}
                {cycleSummary.remainingSessions}
              </>
            ) : (
              <>
                Total workouts: {stats.progression.totalWorkouts} · Weekly volume:{" "}
                {Math.round(stats.progression.weeklyVolume).toLocaleString()}
              </>
            )}
          </div>
          <div className="mt-3">
            <Link
              href={"/history" as Route}
              className="text-xs text-emerald-300 transition hover:text-emerald-200"
            >
              View full workout history
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

