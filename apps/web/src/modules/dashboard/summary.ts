import type { DeterministicAnalyticsReadModel, UserStats } from "@adaptabuddy/contracts";

export type FatigueSummaryItem = {
  muscle: string;
  current: number;
  severity: "low" | "moderate" | "high";
};

export type RecentWorkoutSummary = {
  completedAt: string;
  dayName: string;
  volume: number | null;
};

export type DashboardRecentWorkoutSummary = RecentWorkoutSummary & {
  workoutId: number | null;
};

export type DashboardCycleSummary = {
  completionPercentage: number;
  completedSessions: number;
  remainingSessions: number;
  totalSessions: number;
  currentSessionOrdinal: number | null;
  xp: number;
  level: number;
  streak: number;
  missedCount: number;
};

export type ProgressionTimelinePoint = {
  date: string;
  estimated1RM: number;
};

export type ProgressionTimelineSeries = {
  exerciseId: string;
  exerciseLabel: string;
  confidence: number | null;
  points: ProgressionTimelinePoint[];
};

export type WeeklyVolumeSummaryItem = {
  muscle: string;
  sets: number;
};

export const formatMuscleLabel = (slug: string) =>
  slug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatExerciseLabel = (exerciseId: string) => {
  if (/^\d+$/.test(exerciseId)) {
    return `Exercise ${exerciseId}`;
  }

  if (exerciseId.includes("-") && exerciseId.length >= 8) {
    return `Exercise ${exerciseId.slice(0, 8)}`;
  }

  return exerciseId
    .split(/[_-]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getFatigueSeverity = (
  value: number
): FatigueSummaryItem["severity"] => {
  if (value >= 70) return "high";
  if (value >= 40) return "moderate";
  return "low";
};

export const getFatigueSummary = (
  analyticsOrStats: DeterministicAnalyticsReadModel | UserStats | null,
  statsOrLimit?: UserStats | number,
  limit = 8
): FatigueSummaryItem[] => {
  const analytics = isDeterministicAnalyticsReadModel(analyticsOrStats)
    ? analyticsOrStats
    : null;
  const stats =
    analytics
      ? (statsOrLimit as UserStats)
      : isRecord(statsOrLimit) && "progression" in statsOrLimit
        ? (statsOrLimit as UserStats)
        : (analyticsOrStats as UserStats);
  const resolvedLimit = analytics
    ? typeof limit === "number"
      ? limit
      : 8
    : typeof statsOrLimit === "number"
      ? statsOrLimit
      : limit;

  if (analytics) {
    return analytics.fatigueSummary.items.slice(0, resolvedLimit);
  }

  if (!stats) {
    return [];
  }

  return Object.entries(stats.fatigue)
    .map(([muscle, value]) => ({
      muscle,
      current: value.current,
      severity: getFatigueSeverity(value.current),
    }))
    .sort((a, b) => b.current - a.current)
    .slice(0, resolvedLimit);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDeterministicAnalyticsReadModel = (
  value: unknown
): value is DeterministicAnalyticsReadModel =>
  isRecord(value) &&
  "cycleCompletion" in value &&
  "recentSessions" in value &&
  "fatigueSummary" in value &&
  "capacityTimeline" in value &&
  "weeklyVolume" in value;

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
};

const asDateString = (value: unknown): string | null => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return null;
  }
  return value;
};

const toNumberRecord = (
  value: unknown
): Record<string, number> => {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    const parsed = asFiniteNumber(entry);
    if (parsed === null || parsed < 0) {
      continue;
    }
    result[key] = parsed;
  }
  return result;
};

const getRecentWorkoutsFromProgression = (
  stats: UserStats
): RecentWorkoutSummary[] => {
  const progression = stats.progression as Record<string, unknown>;
  const rawRecent = progression.recentWorkouts;
  if (!Array.isArray(rawRecent)) {
    return [];
  }

  return rawRecent
    .flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const completedAt =
        asDateString(entry.completedAt) ??
        asDateString(entry.timestamp) ??
        asDateString(entry.date);
      if (!completedAt) {
        return [];
      }

      const dayName =
        (typeof entry.dayName === "string" && entry.dayName) ||
        (typeof entry.programDay === "string" && entry.programDay) ||
        (typeof entry.day === "string" && entry.day) ||
        "Workout Session";
      const volume =
        typeof entry.volume === "number" && Number.isFinite(entry.volume)
          ? entry.volume
          : null;

      return [{ completedAt, dayName, volume }];
    })
    .sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
};

export const getRecentWorkoutSummary = (
  stats: UserStats,
  limit = 5
): RecentWorkoutSummary[] => {
  const fromProgression = getRecentWorkoutsFromProgression(stats).slice(0, limit);
  if (fromProgression.length > 0) {
    return fromProgression;
  }

  if (!stats.progression.lastWorkoutAt) {
    return [];
  }

  return [
    {
      completedAt: stats.progression.lastWorkoutAt,
      dayName: "Latest Session",
      volume: stats.progression.weeklyVolume,
    },
  ];
};

export const getDashboardRecentWorkouts = (
  analytics: DeterministicAnalyticsReadModel | null,
  stats: UserStats,
  limit = 5
): DashboardRecentWorkoutSummary[] => {
  if (analytics) {
    return analytics.recentSessions.slice(0, limit).map((session) => ({
      workoutId: session.workoutLogId,
      completedAt: session.completedAt,
      dayName: session.dayName,
      volume: session.totalVolume,
    }));
  }

  return getRecentWorkoutSummary(stats, limit).map((workout) => ({
    ...workout,
    workoutId: null,
  }));
};

export const getDashboardCycleSummary = (
  analytics: DeterministicAnalyticsReadModel | null
): DashboardCycleSummary | null => {
  if (!analytics) {
    return null;
  }

  return {
    completionPercentage: analytics.cycleCompletion.completionPercentage,
    completedSessions: analytics.cycleCompletion.completedSessions,
    remainingSessions: analytics.cycleCompletion.remainingSessions,
    totalSessions: analytics.cycleCompletion.totalSessions,
    currentSessionOrdinal:
      analytics.cycleCompletion.completedSessions > 0
        ? analytics.cycleCompletion.completedSessions
        : analytics.cycleCompletion.nextSessionIndex !== null
          ? analytics.cycleCompletion.nextSessionIndex + 1
          : null,
    xp: analytics.adherence.xp,
    level: analytics.adherence.level,
    streak: analytics.adherence.streak,
    missedCount: analytics.adherence.missedCount,
  };
};

const parseTimelinePoint = (entry: unknown): ProgressionTimelinePoint | null => {
  if (!isRecord(entry)) {
    return null;
  }

  const date =
    asDateString(entry.date) ??
    asDateString(entry.lastPerformed) ??
    asDateString(entry.completedAt) ??
    asDateString(entry.timestamp);
  if (!date) {
    return null;
  }

  const estimated1RM =
    asFiniteNumber(entry.estimated1RM) ??
    asFiniteNumber(entry.e1RM) ??
    asFiniteNumber(entry.oneRm);
  if (estimated1RM === null || estimated1RM <= 0) {
    return null;
  }

  return { date, estimated1RM };
};

const parseTimelinePoints = (value: unknown): ProgressionTimelinePoint[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const parsed = parseTimelinePoint(entry);
    return parsed ? [parsed] : [];
  });
};

const dedupeAndSortTimelinePoints = (
  points: ProgressionTimelinePoint[]
): ProgressionTimelinePoint[] => {
  const byTimestamp = new Map<number, ProgressionTimelinePoint>();
  for (const point of points) {
    const timestamp = new Date(point.date).getTime();
    if (!Number.isFinite(timestamp)) {
      continue;
    }
    byTimestamp.set(timestamp, point);
  }

  return [...byTimestamp.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

export const getProgressionTimelineSeries = (
  analyticsOrStats: DeterministicAnalyticsReadModel | UserStats | null,
  statsOrLimit?: UserStats | number,
  limit = 8
): ProgressionTimelineSeries[] => {
  const analytics = isDeterministicAnalyticsReadModel(analyticsOrStats)
    ? analyticsOrStats
    : null;
  const stats =
    analytics
      ? (statsOrLimit as UserStats)
      : isRecord(statsOrLimit) && "progression" in statsOrLimit
        ? (statsOrLimit as UserStats)
        : (analyticsOrStats as UserStats);
  const resolvedLimit = analytics
    ? typeof limit === "number"
      ? limit
      : 8
    : typeof statsOrLimit === "number"
      ? statsOrLimit
      : limit;

  if (analytics) {
    return analytics.capacityTimeline.series.slice(0, resolvedLimit);
  }

  if (!stats) {
    return [];
  }

  const progressionRecord = stats.progression as Record<string, unknown>;

  const exerciseNameMap: Record<string, unknown> = {};
  const progressionExerciseNames = progressionRecord.exerciseNames;
  const resolvedExerciseNames =
    isRecord(progressionExerciseNames) ? progressionExerciseNames : exerciseNameMap;

  const historyByExerciseCandidates = [
    progressionRecord.capacityHistory,
    progressionRecord.exercise1RMHistory,
    progressionRecord.oneRmHistory,
  ];

  const historyByExercise = historyByExerciseCandidates.find((candidate) =>
    isRecord(candidate)
  ) as Record<string, unknown> | undefined;

  const series = Object.entries(stats.capacities)
    .flatMap(([exerciseId, capacity]) => {
      const capacityRecord = capacity as Record<string, unknown>;
      const confidence = asFiniteNumber(capacity.confidence);

      const inlineHistory = [
        capacityRecord.history,
        capacityRecord.timeline,
        capacityRecord.records,
        capacityRecord.estimated1RMHistory,
      ].flatMap(parseTimelinePoints);

      const mappedHistory = historyByExercise
        ? parseTimelinePoints(historyByExercise[exerciseId])
        : [];

      const latestPoint = parseTimelinePoint({
        date: capacity.lastPerformed,
        estimated1RM: capacity.estimated1RM,
      });

      const points = dedupeAndSortTimelinePoints(
        latestPoint ? [...inlineHistory, ...mappedHistory, latestPoint] : [...inlineHistory, ...mappedHistory]
      );

      if (points.length === 0) {
        return [];
      }

      const labelFromCapacity =
        typeof capacityRecord.exerciseName === "string"
          ? capacityRecord.exerciseName
          : null;
      const labelFromProgression =
        typeof resolvedExerciseNames[exerciseId] === "string"
          ? (resolvedExerciseNames[exerciseId] as string)
          : null;

      return [
        {
          exerciseId,
          exerciseLabel:
            labelFromCapacity ?? labelFromProgression ?? formatExerciseLabel(exerciseId),
          confidence: confidence === null ? null : confidence,
          points,
        },
      ];
    })
    .sort((a, b) => {
      const aLast = new Date(a.points[a.points.length - 1]?.date ?? 0).getTime();
      const bLast = new Date(b.points[b.points.length - 1]?.date ?? 0).getTime();
      return bLast - aLast;
    });

  return series.slice(0, resolvedLimit);
};

const mergeNumberRecords = (records: Array<Record<string, number>>) => {
  const merged: Record<string, number> = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      merged[key] = (merged[key] ?? 0) + value;
    }
  }
  return merged;
};

const getWorkoutLevelVolumeRecords = (stats: UserStats): Record<string, number>[] => {
  const progression = stats.progression as Record<string, unknown>;
  const rawRecent = progression.recentWorkouts;
  if (!Array.isArray(rawRecent)) {
    return [];
  }

  return rawRecent.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    return [
      toNumberRecord(entry.weeklySetsByMuscle),
      toNumberRecord(entry.setsByMuscle),
      toNumberRecord(entry.weeklyVolumeByMuscle),
      toNumberRecord(entry.volumeByMuscle),
      toNumberRecord(entry.muscleSets),
      toNumberRecord(entry.muscleVolume),
    ];
  });
};

export const getWeeklyVolumeSummary = (
  analyticsOrStats: DeterministicAnalyticsReadModel | UserStats | null,
  statsOrLimit?: UserStats | number,
  limit = 8
): WeeklyVolumeSummaryItem[] => {
  const analytics = isDeterministicAnalyticsReadModel(analyticsOrStats)
    ? analyticsOrStats
    : null;
  const stats =
    analytics
      ? (statsOrLimit as UserStats)
      : isRecord(statsOrLimit) && "progression" in statsOrLimit
        ? (statsOrLimit as UserStats)
        : (analyticsOrStats as UserStats);
  const resolvedLimit = analytics
    ? typeof limit === "number"
      ? limit
      : 8
    : typeof statsOrLimit === "number"
      ? statsOrLimit
      : limit;

  if (analytics) {
    return analytics.weeklyVolume.items.slice(0, resolvedLimit);
  }

  if (!stats) {
    return [];
  }

  const progression = stats.progression as Record<string, unknown>;

  const directRecords = [
    toNumberRecord(progression.weeklySetsByMuscle),
    toNumberRecord(progression.weeklyVolumeByMuscle),
    toNumberRecord(progression.weeklySets),
    toNumberRecord(progression.weeklyVolume),
  ];

  const merged = mergeNumberRecords([
    ...directRecords,
    ...getWorkoutLevelVolumeRecords(stats),
  ]);

  return Object.entries(merged)
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, resolvedLimit);
};
