"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ProgressionTimelinePoint,
  ProgressionTimelineSeries,
} from "../summary";

type ProgressionTimelineChartProps = {
  series: ProgressionTimelineSeries[];
};

type ChartPoint = {
  x: number;
  y: number;
  date: string;
  estimated1RM: number;
};

const CHART_WIDTH = 640;
const CHART_HEIGHT = 240;
const CHART_PADDING = { top: 20, right: 20, bottom: 34, left: 44 };

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(value)
  );

const formatWeight = (value: number) => `${Math.round(value)} kg`;

const buildChartPoints = (points: ProgressionTimelinePoint[]): ChartPoint[] => {
  if (points.length === 0) {
    return [];
  }

  const sorted = [...points].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const min = Math.min(...sorted.map((point) => point.estimated1RM));
  const max = Math.max(...sorted.map((point) => point.estimated1RM));
  const range = max - min;
  const yPadding = range === 0 ? Math.max(5, max * 0.05) : range * 0.1;
  const yMin = Math.max(0, min - yPadding);
  const yMax = max + yPadding;

  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  return sorted.map((point, index) => {
    const x =
      sorted.length === 1
        ? CHART_PADDING.left + plotWidth / 2
        : CHART_PADDING.left + (index / (sorted.length - 1)) * plotWidth;
    const y =
      CHART_PADDING.top +
      ((yMax - point.estimated1RM) / Math.max(yMax - yMin, 1)) * plotHeight;

    return { x, y, date: point.date, estimated1RM: point.estimated1RM };
  });
};

export function ProgressionTimelineChart({
  series,
}: ProgressionTimelineChartProps) {
  const [selectedExerciseId, setSelectedExerciseId] = useState(
    series[0]?.exerciseId ?? ""
  );

  useEffect(() => {
    if (!series.some((entry) => entry.exerciseId === selectedExerciseId)) {
      setSelectedExerciseId(series[0]?.exerciseId ?? "");
    }
  }, [selectedExerciseId, series]);

  const selectedSeries =
    series.find((entry) => entry.exerciseId === selectedExerciseId) ?? series[0];

  const chartPoints = useMemo(
    () => buildChartPoints(selectedSeries?.points ?? []),
    [selectedSeries]
  );

  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const latestPoint =
    selectedSeries?.points[selectedSeries.points.length - 1] ?? null;
  const earliestPoint = selectedSeries?.points[0] ?? null;
  const delta =
    latestPoint && earliestPoint
      ? latestPoint.estimated1RM - earliestPoint.estimated1RM
      : 0;

  if (series.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-500">
        No progression history yet. Complete workouts to populate estimated 1RM data.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col text-xs text-slate-400">
          Tracked exercise
          <select
            className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            value={selectedSeries.exerciseId}
            onChange={(event) => setSelectedExerciseId(event.target.value)}
            aria-label="Tracked exercise"
          >
            {series.map((entry) => (
              <option key={entry.exerciseId} value={entry.exerciseId}>
                {entry.exerciseLabel}
              </option>
            ))}
          </select>
        </label>
        {latestPoint ? (
          <p className="text-xs text-slate-400">
            Latest 1RM:{" "}
            <span className="font-semibold text-slate-200">
              {formatWeight(latestPoint.estimated1RM)}
            </span>{" "}
            {selectedSeries.points.length > 1 ? (
              <span
                className={
                  delta >= 0 ? "text-emerald-300" : "text-amber-300"
                }
              >
                ({delta >= 0 ? "+" : ""}
                {Math.round(delta)} kg)
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-48 w-full"
          role="img"
          aria-label={`${selectedSeries.exerciseLabel} estimated 1RM over time`}
        >
          <line
            x1={CHART_PADDING.left}
            y1={CHART_HEIGHT - CHART_PADDING.bottom}
            x2={CHART_WIDTH - CHART_PADDING.right}
            y2={CHART_HEIGHT - CHART_PADDING.bottom}
            className="stroke-slate-700"
          />
          <line
            x1={CHART_PADDING.left}
            y1={CHART_PADDING.top}
            x2={CHART_PADDING.left}
            y2={CHART_HEIGHT - CHART_PADDING.bottom}
            className="stroke-slate-700"
          />
          {chartPoints.length > 1 ? (
            <path d={linePath} className="fill-none stroke-indigo-400 stroke-[3]" />
          ) : null}
          {chartPoints.map((point) => (
            <g key={`${point.date}-${point.estimated1RM}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                className="fill-indigo-300 stroke-slate-950 stroke-[2]"
              />
            </g>
          ))}
          {chartPoints.length > 0 ? (
            <>
              <text
                x={chartPoints[0].x}
                y={CHART_HEIGHT - 10}
                textAnchor="start"
                className="fill-slate-400 text-[11px]"
              >
                {formatDate(chartPoints[0].date)}
              </text>
              <text
                x={chartPoints[chartPoints.length - 1].x}
                y={CHART_HEIGHT - 10}
                textAnchor="end"
                className="fill-slate-400 text-[11px]"
              >
                {formatDate(chartPoints[chartPoints.length - 1].date)}
              </text>
            </>
          ) : null}
        </svg>
      </div>

      {selectedSeries.points.length === 1 ? (
        <p className="text-xs text-slate-500">
          Only the latest estimate is available. Timeline will populate as more sessions are logged.
        </p>
      ) : null}
    </div>
  );
}
