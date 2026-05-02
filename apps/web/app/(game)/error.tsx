"use client";

import Link from "next/link";
import { useEffect } from "react";

type GameErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GameError({ error, reset }: GameErrorProps) {
  useEffect(() => {
    // Keep boundary logging explicit for server-side diagnostics.
    console.error("Game route error boundary triggered", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-10 sm:px-6 md:pb-10">
      <section className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300/80">Game Route Error</p>
        <h1 className="mt-2 text-2xl font-semibold text-amber-100">Unable to load this screen</h1>
        <p className="mt-2 text-sm text-amber-50/80">
          The requested route failed while rendering. Retry this view or return to the dashboard.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-amber-500/70 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30"
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          >
            Back to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
