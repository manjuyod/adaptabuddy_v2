import Link from "next/link";
import type { Route } from "next";
import type { HistoryWorkoutSummary } from "../contracts";

type HistoryListProps = {
  workouts: HistoryWorkoutSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  dateFrom?: string;
  dateTo?: string;
};

const formatWorkoutDate = (dateValue: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateValue));

const formatDuration = (durationSeconds: number | null) => {
  if (durationSeconds === null) return "N/A";
  const minutes = Math.round(durationSeconds / 60);
  return `${minutes} min`;
};

const formatVolume = (totalVolume: number | null) =>
  totalVolume === null ? "N/A" : Math.round(totalVolume).toLocaleString();

const buildPageHref = (page: number, pageSize: number, dateFrom?: string, dateTo?: string) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (dateFrom) searchParams.set("dateFrom", dateFrom);
  if (dateTo) searchParams.set("dateTo", dateTo);

  return `/history?${searchParams.toString()}` as Route;
};

export function HistoryList({
  workouts,
  page,
  pageSize,
  total,
  totalPages,
  dateFrom,
  dateTo,
}: HistoryListProps) {
  return (
    <div className="space-y-4">
      {workouts.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm text-slate-400">No workouts found for this filter.</p>
        </div>
      ) : (
        workouts.map((workout) => (
          <Link
            key={workout.id}
            href={`/history/${workout.id}` as Route}
            className="block rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition hover:border-slate-600"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-100">{workout.dayName}</p>
                <p className="text-xs text-slate-500">{workout.programName}</p>
                <p className="mt-1 text-xs text-slate-400">{formatWorkoutDate(workout.completedAt)}</p>
              </div>
              <div className="text-xs text-slate-400 sm:text-right">
                <p>Volume: {formatVolume(workout.totalVolume)}</p>
                <p>Sets: {workout.setCount}</p>
                <p>Duration: {formatDuration(workout.durationSeconds)}</p>
              </div>
            </div>
          </Link>
        ))
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3">
        <p className="text-xs text-slate-500">
          Page {page} of {Math.max(totalPages, 1)} · {total} total workouts
        </p>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={buildPageHref(page - 1, pageSize, dateFrom, dateTo)}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-md border border-slate-800 px-3 py-1 text-xs text-slate-600">
              Previous
            </span>
          )}
          {page < totalPages ? (
            <Link
              href={buildPageHref(page + 1, pageSize, dateFrom, dateTo)}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-md border border-slate-800 px-3 py-1 text-xs text-slate-600">
              Next
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
