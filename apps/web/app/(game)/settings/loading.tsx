export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="settings-loading-skeleton">
      <div className="h-28 rounded-xl border border-slate-800 bg-slate-900/60" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-64 rounded-xl border border-slate-800 bg-slate-900/60" />
        <div className="h-64 rounded-xl border border-slate-800 bg-slate-900/60" />
      </div>
      <div className="h-32 rounded-xl border border-slate-800 bg-slate-900/60" />
    </div>
  );
}
