import Link from "next/link";
import type { Route } from "next";

type Metric = {
  label: string;
  value: string;
  detail: string;
};

type Workflow = {
  title: string;
  detail: string;
};

type HealthFeaturePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: Metric[];
  workflows: Workflow[];
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  error?: string | null;
};

export function HealthFeaturePage({
  eyebrow,
  title,
  description,
  metrics,
  workflows,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  error,
}: HealthFeaturePageProps) {
  return (
    <div className="space-y-6">
      <header className="border-b border-slate-800 pb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">{eyebrow}</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
            <Link
              href={primaryHref as Route}
              className="rounded-md bg-emerald-500 px-4 py-2 text-center text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link
                href={secondaryHref as Route}
                className="rounded-md border border-slate-700 bg-slate-900/70 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-slate-500"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {error ? (
        <div
          className="rounded-lg border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-100"
          role="status"
        >
          Health API data is temporarily unavailable. Showing fallback values.
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3" aria-label={`${title} summary`}>
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-slate-800 bg-surface/80 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">{metric.value}</p>
            <p className="mt-1 text-sm text-slate-400">{metric.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]" aria-label={`${title} workflow`}>
        <div className="rounded-lg border border-slate-800 bg-surface/80 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Today</h2>
          <div className="mt-4 grid gap-3">
            {workflows.map((item) => (
              <div key={item.title} className="border-l-2 border-emerald-400/70 pl-3">
                <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                <p className="mt-1 text-sm text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-cyan-800/70 bg-cyan-950/20 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Progress layer</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-100">Health events create progress</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Logs from this screen emit backend-owned health events. Progress points, levels,
            achievements, and Unity projections are derived from those events, so the same state can
            power the health app, mobile app, and RPG client without duplicating progression rules.
          </p>
        </div>
      </section>
    </div>
  );
}
