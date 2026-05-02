"use client";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Offline Mode</p>
      <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">You are offline</h1>
      <p className="max-w-prose text-sm leading-relaxed text-slate-300 sm:text-base">
        AdaptaBuddy could not reach the network. Reconnect to keep generating sessions and syncing
        workout logs.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg border border-sky-400/70 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
      >
        Retry connection
      </button>
    </main>
  );
}
