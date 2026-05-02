export default function ProgramsLoading() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="programs-loading-skeleton">
      <div className="h-28 rounded-xl border border-slate-800 bg-slate-900/60" />
      <div className="space-y-4">
        <div className="h-40 rounded-xl border border-slate-800 bg-slate-900/60" />
        <div className="h-40 rounded-xl border border-slate-800 bg-slate-900/60" />
        <div className="h-40 rounded-xl border border-slate-800 bg-slate-900/60" />
      </div>
    </div>
  );
}
