export default function WorkoutLoading() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="workout-loading-skeleton">
      <div className="h-32 rounded-xl border border-slate-800 bg-slate-900/60" />
      <div className="h-56 rounded-xl border border-slate-800 bg-slate-900/60" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-36 rounded-xl border border-slate-800 bg-slate-900/60" />
        <div className="h-36 rounded-xl border border-slate-800 bg-slate-900/60" />
      </div>
    </div>
  );
}
