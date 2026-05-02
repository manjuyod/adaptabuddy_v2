import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-slate-800 bg-surface/85 p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-100">Route not found</h1>
        <p className="mt-3 text-sm text-slate-400">
          This page does not exist or has moved. Return to the dashboard to continue training.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex rounded-lg border border-emerald-700/70 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400"
          >
            Go to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
