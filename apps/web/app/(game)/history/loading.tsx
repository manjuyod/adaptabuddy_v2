export default function HistoryLoading() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="history-loading-skeleton">
      <div className="h-28 rounded-xl border border-slate-800 bg-slate-900/60" />
      <div className="h-16 rounded-xl border border-slate-800 bg-slate-900/60" />
      <div className="space-y-3">
        <div className="h-24 rounded-xl border border-slate-800 bg-slate-900/60" />
        <div className="h-24 rounded-xl border border-slate-800 bg-slate-900/60" />
        <div className="h-24 rounded-xl border border-slate-800 bg-slate-900/60" />
      </div>
    </div>
  );
}
