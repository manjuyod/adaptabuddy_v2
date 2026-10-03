import { fetchBackendApiResult } from "@/lib/api/backend-client";
import { HealthFeaturePage } from "@/modules/health/components/HealthFeaturePage";

export const dynamic = "force-dynamic";

type NutritionSummary = {
  caloriesLogged: number;
  proteinGrams: number;
  calorieTarget: number | null;
  proteinTargetGrams: number | null;
};

export default async function NutritionPage() {
  const result = await fetchBackendApiResult<NutritionSummary>("/nutrition/summary");
  const summary =
    result.data ??
    ({
      caloriesLogged: 0,
      proteinGrams: 0,
      calorieTarget: null,
      proteinTargetGrams: null,
    } satisfies NutritionSummary);
  const target = summary.calorieTarget ? `${summary.calorieTarget} kcal` : "Unset";

  return (
    <HealthFeaturePage
      eyebrow="Nutrition"
      title="Food Log & Calorie Targets"
      description="Track calories, protein, and daily food entries as normal health data. Food logs emit backend health events that can also support progress rewards."
      primaryHref="/nutrition"
      primaryLabel="Log Food"
      secondaryHref="/settings"
      secondaryLabel="Edit Targets"
      error={result.error}
      metrics={[
        { label: "Calories", value: `${summary.caloriesLogged}`, detail: "Logged today" },
        { label: "Protein", value: `${summary.proteinGrams}g`, detail: "Logged today" },
        { label: "Target", value: target, detail: "Daily calorie target" },
      ]}
      workflows={[
        { title: "Food logging", detail: "Capture food name, calories, protein, and logged time." },
        {
          title: "Macro targets",
          detail: summary.proteinTargetGrams
            ? `${summary.proteinTargetGrams}g protein target is active.`
            : "Use calorie and protein targets as health goals, not game stats.",
        },
        { title: "Progress event", detail: "FoodLogged can contribute a small motivational progress reward." },
      ]}
    />
  );
}
