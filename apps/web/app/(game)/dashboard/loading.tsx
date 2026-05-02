export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="dashboard-loading-skeleton">
      <div className="h-28 rounded-xl border border-slate-800 bg-slate-900/60" />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-40 rounded-xl border border-slate-800 bg-slate-900/60" />
        <div className="h-40 rounded-xl border border-slate-800 bg-slate-900/60" />
        <div className="h-40 rounded-xl border border-slate-800 bg-slate-900/60" />
        <div className="h-56 rounded-xl border border-slate-800 bg-slate-900/60 xl:col-span-2" />
        <div className="h-56 rounded-xl border border-slate-800 bg-slate-900/60" />
      </div>
    </div>
  );
}
