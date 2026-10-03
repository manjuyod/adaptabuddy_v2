import Link from "next/link";
import type { Route } from "next";
import { fetchBackendApiResult } from "@/lib/api/backend-client";

export const dynamic = "force-dynamic";

type ProgressionState = {
  xp: number;
  level: number;
  streak: number;
};

type AchievementView = {
  id: string;
  title: string;
  unlocked: boolean;
};

const progressSources = [
  "WorkoutCompleted",
  "FoodLogged",
  "HabitCompleted",
  "BodyMetricUpdated",
  "GoalCreated",
  "GoalCompleted",
] as const;

export default async function ProgressPage() {
  const [progressionResult, achievementsResult] = await Promise.all([
    fetchBackendApiResult<ProgressionState>("/progression/state"),
    fetchBackendApiResult<AchievementView[]>("/achievements"),
  ]);
  const progression =
    progressionResult.data ??
    ({
      xp: 0,
      level: 1,
      streak: 0,
    } satisfies ProgressionState);
  const achievements = achievementsResult.data ?? [];
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked);

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-800 pb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Progress</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-100">Progress, Charts & Rewards</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Progress is a motivational layer over real health events. The backend owns progress
          points, levels, streaks, achievements, and the Unity player projection.
        </p>
      </header>

      {progressionResult.error || achievementsResult.error ? (
        <div
          className="rounded-lg border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-100"
          role="status"
        >
          Progress API data is temporarily unavailable. Showing fallback values.
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Level", value: `${progression.level}` },
          { label: "Points", value: `${progression.xp}` },
          { label: "Streak", value: `${progression.streak}` },
          { label: "Achievements", value: `${unlockedAchievements.length}/${achievements.length}` },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-800 bg-surface/80 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-800 bg-surface/80 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Event sources</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {progressSources.map((source) => (
              <span
                key={source}
                className="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"
              >
                {source}
              </span>
            ))}
          </div>
          {achievements.length ? (
            <div className="mt-5 border-t border-slate-800 pt-4">
              <h3 className="text-sm font-semibold text-slate-200">Achievements</h3>
              <div className="mt-3 grid gap-2">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-200">{achievement.title}</span>
                    <span className={achievement.unlocked ? "text-emerald-300" : "text-slate-500"}>
                      {achievement.unlocked ? "Unlocked" : "Locked"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-amber-800/70 bg-amber-950/20 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-amber-200">Unity projection</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">RPG client reads, never owns</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Unity should call <code className="text-amber-100">/clients/unity/player-state</code>
            and render character progress from that projection. Health state, event history, and
            progression rules remain in the Rust backend.
          </p>
          <Link
            href={"/settings" as Route}
            className="mt-4 inline-flex rounded-md border border-amber-700 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-400"
          >
            Account Settings
          </Link>
        </div>
      </section>
    </div>
  );
}
