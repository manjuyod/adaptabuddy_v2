import { fetchBackendApiResult } from "@/lib/api/backend-client";
import { HealthFeaturePage } from "@/modules/health/components/HealthFeaturePage";

export const dynamic = "force-dynamic";

type BodyMetricView = {
  metric: string;
  value: number;
  unit: string;
  measuredAt: string;
};

function formatDate(value: string | undefined) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function BodyMetricsPage() {
  const result = await fetchBackendApiResult<BodyMetricView[]>("/body-metrics");
  const metrics = result.data ?? [];
  const latestWeight =
    metrics.find((entry) => entry.metric.toLowerCase().includes("weight")) ?? metrics[0];
  const previousSameMetric = latestWeight
    ? metrics.find(
        (entry) =>
          entry.metric === latestWeight.metric && entry.measuredAt !== latestWeight.measuredAt,
      )
    : undefined;
  const trend =
    latestWeight && previousSameMetric
      ? `${latestWeight.value - previousSameMetric.value > 0 ? "+" : ""}${(
          latestWeight.value - previousSameMetric.value
        ).toFixed(1)} ${latestWeight.unit}`
      : "--";

  return (
    <HealthFeaturePage
      eyebrow="Body metrics"
      title="Body Metrics"
      description="Track measurements such as body weight, waist, resting heart rate, and other user-owned health metrics."
      primaryHref="/body-metrics"
      primaryLabel="Add Metric"
      secondaryHref="/progress"
      secondaryLabel="Charts"
      error={result.error}
      metrics={[
        {
          label: "Latest",
          value: latestWeight ? `${latestWeight.value} ${latestWeight.unit}` : "--",
          detail: latestWeight?.metric ?? "No entry yet",
        },
        { label: "Trend", value: trend, detail: "Compared with prior matching metric" },
        { label: "Updated", value: formatDate(latestWeight?.measuredAt), detail: "Last measurement" },
      ]}
      workflows={[
        { title: "Metric entry", detail: "Save metric name, value, unit, and measurement time." },
        {
          title: "Trend review",
          detail: `${metrics.length} backend-owned metric entries are available for charts.`,
        },
        { title: "Progress event", detail: "BodyMetricUpdated can support adherence rewards without changing health data." },
      ]}
    />
  );
}
