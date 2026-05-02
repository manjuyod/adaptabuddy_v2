import type {
  DeterministicAnalyticsReadModel,
  UserStats,
} from "@adaptabuddy/contracts";

type RecordValue = Record<string, unknown>;

type ExpectedActiveProgramState = {
  programId: string;
  currentDayIndex: number;
  currentMicrocycle: number;
};

type DriftRecord = {
  scope: "active-cycle" | "dashboard";
  field: "activeProgram" | "recentSessions" | "fatigueSummary" | "weeklyVolume";
  path: string;
  reason: string;
  normalizedValue: unknown;
  statsJsonValue: unknown;
};

export type StatsJsonCompatibilityDriftResult = {
  compatible: boolean;
  drifts: DriftRecord[];
};

type DriftDetectorInput = {
  normalizedActiveProgram: ExpectedActiveProgramState | null;
  deterministicAnalytics: DeterministicAnalyticsReadModel | null;
  statsJson: UserStats;
  options?: {
    recentSessionLimit?: number;
    numericTolerance?: number;
  };
};

type RecentSessionComparable = {
  completedAt: string;
  dayName: string;
  volume: number | null;
};

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null;

const asNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
};

const numbersEqual = (left: number, right: number, tolerance: number) =>
  Math.abs(left - right) <= tolerance;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const asDateString = (value: unknown): string | null =>
  typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;

const toNumberRecord = (value: unknown): Record<string, number> => {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    const parsed = asNumber(entry);
    if (parsed === null || parsed < 0) {
      continue;
    }
    result[key] = parsed;
  }
  return result;
};

const mergeNumberRecords = (records: Array<Record<string, number>>): Record<string, number> => {
  const merged: Record<string, number> = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      merged[key] = (merged[key] ?? 0) + value;
    }
  }
  return merged;
};

const compareActiveCycle = (
  drifts: DriftRecord[],
  normalized: ExpectedActiveProgramState,
  statsJson: UserStats
) => {
  const actualActiveProgram = statsJson.activeProgram;

  if (!actualActiveProgram) {
    drifts.push({
      scope: "active-cycle",
      field: "activeProgram",
      path: "activeProgram",
      reason: "normalized active cycle present but stats_json activeProgram is missing",
      normalizedValue: normalized,
      statsJsonValue: null,
    });
    return;
  }

  if (actualActiveProgram.programId !== normalized.programId) {
    drifts.push({
      scope: "active-cycle",
      field: "activeProgram",
      path: "activeProgram.programId",
      reason: "active program id mismatch",
      normalizedValue: normalized.programId,
      statsJsonValue: actualActiveProgram.programId,
    });
  }

  if ((actualActiveProgram.currentDayIndex ?? -1) !== normalized.currentDayIndex) {
    drifts.push({
      scope: "active-cycle",
      field: "activeProgram",
      path: "activeProgram.currentDayIndex",
      reason: "active program day cursor mismatch",
      normalizedValue: normalized.currentDayIndex,
      statsJsonValue: actualActiveProgram.currentDayIndex,
    });
  }

  if (actualActiveProgram.currentMicrocycle !== normalized.currentMicrocycle) {
    drifts.push({
      scope: "active-cycle",
      field: "activeProgram",
      path: "activeProgram.currentMicrocycle",
      reason: "active program microcycle cursor mismatch",
      normalizedValue: normalized.currentMicrocycle,
      statsJsonValue: actualActiveProgram.currentMicrocycle,
    });
  }
};

const projectRecentWorkoutsFromStats = (
  statsJson: UserStats,
  limit: number
): RecentSessionComparable[] => {
  const progression = isRecord(statsJson.progression)
    ? (statsJson.progression as RecordValue)
    : {};
  const rawRecentWorkouts = Array.isArray(progression.recentWorkouts)
    ? progression.recentWorkouts
    : [];

  const normalized = rawRecentWorkouts
    .flatMap((entry) => {
      if (!isRecord(entry)) {
        return [];
      }

      const completedAt =
        asDateString(entry.completedAt) ??
        asDateString(entry.timestamp) ??
        asDateString(entry.date);
      if (!completedAt) {
        return [];
      }

      const dayName =
        asString(entry.dayName) ??
        asString(entry.programDay) ??
        asString(entry.day) ??
        "Workout Session";
      const volume = asNumber(entry.volume) ?? null;

      return [{ completedAt, dayName, volume }];
    })
    .sort((left, right) => {
      return new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime();
    })
    .slice(0, limit);

  if (normalized.length > 0 || !statsJson.progression.lastWorkoutAt) {
    return normalized;
  }

  return [
    {
      completedAt: statsJson.progression.lastWorkoutAt,
      dayName: "Latest Session",
      volume: asNumber(statsJson.progression.weeklyVolume),
    },
  ];
};

const compareRecentSessions = (
  drifts: DriftRecord[],
  analytics: DeterministicAnalyticsReadModel,
  statsJson: UserStats,
  options: { recentSessionLimit: number }
) => {
  const expected = analytics.recentSessions
    .slice(0, options.recentSessionLimit)
    .map((session) => ({
      completedAt: session.completedAt,
      dayName: session.dayName,
      volume: asNumber(session.totalVolume) ?? null,
    }));

  const actual = projectRecentWorkoutsFromStats(statsJson, options.recentSessionLimit);

  if (actual.length !== expected.length) {
    drifts.push({
      scope: "dashboard",
      field: "recentSessions",
      path: "recentSessions.length",
      reason:
        "recent sessions drift: normalized dashboard payload and stats_json use different number of recent workouts",
      normalizedValue: expected.length,
      statsJsonValue: actual.length,
    });
    return;
  }

  const mismatchedEntries: Array<{ index: number; expected: RecentSessionComparable; actual: RecentSessionComparable }> =
    [];
  for (let index = 0; index < expected.length; index++) {
    const expectedEntry = expected[index];
    const actualEntry = actual[index];
    if (!actualEntry) {
      mismatchedEntries.push({ index, expected: expectedEntry, actual: { completedAt: "", dayName: "", volume: null } });
      continue;
    }

    if (
      expectedEntry.completedAt !== actualEntry.completedAt ||
      expectedEntry.dayName !== actualEntry.dayName ||
      expectedEntry.volume !== actualEntry.volume
    ) {
      mismatchedEntries.push({ index, expected: expectedEntry, actual: actualEntry });
    }
  }

  if (mismatchedEntries.length > 0) {
    drifts.push({
      scope: "dashboard",
      field: "recentSessions",
      path: "recentSessions",
      reason: "recent sessions drift: normalized analytics and stats_json summaries disagree",
      normalizedValue: expected,
      statsJsonValue: mismatchedEntries,
    });
  }
};

const compareFatigueSummary = (
  drifts: DriftRecord[],
  analytics: DeterministicAnalyticsReadModel,
  statsJson: UserStats,
  numericTolerance: number
) => {
  const expected = new Map(
    analytics.fatigueSummary.items.map((entry) => [entry.muscle, entry.current])
  );
  const actual = new Map<string, number>();

  for (const [muscle, fatigueState] of Object.entries(statsJson.fatigue)) {
    const current = asNumber(fatigueState.current);
    if (current === null || current < 0) {
      continue;
    }
    actual.set(muscle, current);
  }

  const mismatches = new Map<string, { expected: number; actual: number | null }>();
  for (const [muscle, expectedCurrent] of expected.entries()) {
    const actualCurrent = actual.get(muscle);
    if (actualCurrent === undefined || !numbersEqual(expectedCurrent, actualCurrent, numericTolerance)) {
      mismatches.set(muscle, {
        expected: expectedCurrent,
        actual: actualCurrent ?? null,
      });
    }
  }

  for (const muscle of actual.keys()) {
    if (!expected.has(muscle)) {
      mismatches.set(muscle, { expected: 0, actual: actual.get(muscle) ?? null });
    }
  }

  if (mismatches.size === 0) {
    return;
  }

  const normalized = [...expected.entries()].map(([muscle, current]) => ({
    muscle,
    current,
  }));
  const actualEntries = [...actual.entries()].map(([muscle, current]) => ({
    muscle,
    current,
  }));

  drifts.push({
    scope: "dashboard",
    field: "fatigueSummary",
    path: "fatigueSummary.items",
    reason: "fatigue summary drift between normalized analytics and stats_json",
    normalizedValue: normalized,
    statsJsonValue: actualEntries,
  });
};

const projectWeeklyVolumeFromAnalytics = (
  analytics: DeterministicAnalyticsReadModel
): Record<string, number> =>
  Object.fromEntries(analytics.weeklyVolume.items.map((item) => [item.muscle, item.sets]));

const projectWeeklyVolumeFromStats = (statsJson: UserStats): Record<string, number> => {
  const progression = isRecord(statsJson.progression)
    ? (statsJson.progression as RecordValue)
    : {};
  const rawRecentWorkouts = Array.isArray(progression.recentWorkouts)
    ? progression.recentWorkouts
    : [];

  const mergedFromRecent = rawRecentWorkouts
    .filter((entry): entry is RecordValue => isRecord(entry))
    .flatMap((entry) => [
      toNumberRecord(entry.weeklySetsByMuscle),
      toNumberRecord(entry.setsByMuscle),
      toNumberRecord(entry.weeklyVolumeByMuscle),
      toNumberRecord(entry.volumeByMuscle),
      toNumberRecord(entry.muscleSets),
      toNumberRecord(entry.muscleVolume),
    ]);

  return mergeNumberRecords([
    toNumberRecord(progression.weeklySetsByMuscle),
    toNumberRecord(progression.weeklyVolumeByMuscle),
    toNumberRecord(progression.weeklySets),
    toNumberRecord(progression.weeklyVolume),
    ...mergedFromRecent,
  ]);
};

const compareWeeklyVolume = (
  drifts: DriftRecord[],
  analytics: DeterministicAnalyticsReadModel,
  statsJson: UserStats,
  numericTolerance: number
) => {
  const expected = projectWeeklyVolumeFromAnalytics(analytics);
  const actual = projectWeeklyVolumeFromStats(statsJson);
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);

  const mismatches: Array<{
    muscle: string;
    expected: number;
    actual: number;
  }> = [];

  for (const key of [...keys].sort((left, right) => left.localeCompare(right))) {
    const expectedValue = expected[key] ?? null;
    const actualValue = actual[key] ?? null;
    if (
      expectedValue === null ||
      actualValue === null ||
      !numbersEqual(expectedValue, actualValue, numericTolerance)
    ) {
      mismatches.push({
        muscle: key,
        expected: expectedValue ?? 0,
        actual: actualValue ?? 0,
      });
    }
  }

  if (mismatches.length === 0) {
    return;
  }

  drifts.push({
    scope: "dashboard",
    field: "weeklyVolume",
    path: "weeklyVolume.items",
    reason: "weekly volume summary drift between normalized analytics and stats_json",
    normalizedValue: expected,
    statsJsonValue: actual,
  });
};

export const detectStatsJsonCompatibilityDrift = ({
  normalizedActiveProgram,
  deterministicAnalytics,
  statsJson,
  options,
}: DriftDetectorInput): StatsJsonCompatibilityDriftResult => {
  const recentSessionLimit = Math.max(options?.recentSessionLimit ?? 8, 1);
  const numericTolerance = options?.numericTolerance ?? 0.0001;
  const drifts: DriftRecord[] = [];

  if (normalizedActiveProgram) {
    compareActiveCycle(drifts, normalizedActiveProgram, statsJson);
  }

  if (!deterministicAnalytics) {
    return {
      compatible: drifts.length === 0,
      drifts,
    };
  }

  if (!normalizedActiveProgram) {
    drifts.push({
      scope: "active-cycle",
      field: "activeProgram",
      path: "activeProgram",
      reason:
        "deterministic analytics are available but no normalized active cycle summary was provided",
      normalizedValue: null,
      statsJsonValue: statsJson.activeProgram,
    });
  }

  compareRecentSessions(drifts, deterministicAnalytics, statsJson, {
    recentSessionLimit,
  });
  compareFatigueSummary(drifts, deterministicAnalytics, statsJson, numericTolerance);
  compareWeeklyVolume(drifts, deterministicAnalytics, statsJson, numericTolerance);

  return {
    compatible: drifts.length === 0,
    drifts,
  };
};
