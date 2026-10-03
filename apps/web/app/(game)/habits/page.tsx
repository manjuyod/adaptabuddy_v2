import { fetchBackendApiResult } from "@/lib/api/backend-client";
import { HealthFeaturePage } from "@/modules/health/components/HealthFeaturePage";

export const dynamic = "force-dynamic";

type HabitView = {
  id: string;
  name: string;
  cadence: string;
  completions: number;
};

type ProgressionState = {
  streak: number;
};

export default async function HabitsPage() {
  const [habitsResult, progressionResult] = await Promise.all([
    fetchBackendApiResult<HabitView[]>("/habits"),
    fetchBackendApiResult<ProgressionState>("/progression/state"),
  ]);
  const habits = habitsResult.data ?? [];
  const completions = habits.reduce((total, habit) => total + habit.completions, 0);

  return (
    <HealthFeaturePage
      eyebrow="Habits"
      title="Habit Check-ins"
      description="Track recurring health behaviors such as sleep routine, hydration, mobility, recovery, and consistency habits."
      primaryHref="/habits"
      primaryLabel="Check In"
      secondaryHref="/goals"
      secondaryLabel="Review Goals"
      error={habitsResult.error ?? progressionResult.error}
      metrics={[
        { label: "Active", value: `${habits.length}`, detail: "Habits configured" },
        { label: "Done", value: `${completions}`, detail: "Total completed check-ins" },
        {
          label: "Streak",
          value: `${progressionResult.data?.streak ?? 0}`,
          detail: "Derived by backend events",
        },
      ]}
      workflows={[
        { title: "Create habit", detail: "Define a cadence and keep it separate from workout programming." },
        {
          title: "Daily check-in",
          detail: habits[0]
            ? `${habits[0].name} is tracked on a ${habits[0].cadence} cadence.`
            : "Each completion emits HabitCompleted for progression and charts.",
        },
        { title: "Recovery habits", detail: "Use habits to represent sleep, mobility, steps, hydration, or recovery days." },
      ]}
    />
  );
}
