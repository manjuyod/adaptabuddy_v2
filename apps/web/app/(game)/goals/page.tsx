import { fetchBackendApiResult } from "@/lib/api/backend-client";
import { HealthFeaturePage } from "@/modules/health/components/HealthFeaturePage";

export const dynamic = "force-dynamic";

type GoalView = {
  id: string;
  title: string;
  target: string;
  completed: boolean;
};

export default async function GoalsPage() {
  const result = await fetchBackendApiResult<GoalView[]>("/goals");
  const goals = result.data ?? [];
  const completed = goals.filter((goal) => goal.completed).length;
  const open = goals.length - completed;

  return (
    <HealthFeaturePage
      eyebrow="Goals"
      title="Health Goals"
      description="Create and complete goals for nutrition, training, recovery, body metrics, and consistency. RPG quests become daily goals in the health app."
      primaryHref="/goals"
      primaryLabel="Create Goal"
      secondaryHref="/progress"
      secondaryLabel="View Progress"
      error={result.error}
      metrics={[
        { label: "Open", value: `${open}`, detail: "Goals in progress" },
        { label: "Completed", value: `${completed}`, detail: "Goal events emitted" },
        { label: "Reward", value: "Event", detail: "Derived by progression rules" },
      ]}
      workflows={[
        {
          title: "Goal setup",
          detail: goals[0]
            ? `${goals[0].title}: ${goals[0].target}`
            : "Capture the real-world target and completion criteria.",
        },
        { title: "Completion", detail: "GoalCompleted feeds the same event ledger as workouts and food logs." },
        { title: "Presentation", detail: "Unity can render completed goals as unlocks without owning the source data." },
      ]}
    />
  );
}
