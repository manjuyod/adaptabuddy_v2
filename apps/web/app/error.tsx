"use client";

import Link from "next/link";
import { useEffect } from "react";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    // Keep boundary logging explicit for server-side diagnostics.
    console.error("Root error boundary triggered", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-rose-900/70 bg-rose-950/30 p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-300/80">Unexpected Error</p>
        <h1 className="mt-3 text-3xl font-semibold text-rose-50">AdaptaBuddy hit a critical fault.</h1>
        <p className="mt-3 text-sm text-rose-100/80">
          Try loading the screen again. If this keeps happening, return to the dashboard and retry
          from there.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-rose-500 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30"
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          >
            Go to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
