import type {
  DeviationAnalysis,
  DeviationDetail,
  DeviationDirection,
  DeviationPlannedSession,
  DeviationActualSession,
  DeviationType,
  ImpactProjection,
  RebalancedPlan,
  RemainingPlanSession,
  WarningSeverity,
} from "@adaptabuddy/contracts";

const HOURS_PER_DAY = 24;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round = (value: number, precision = 2) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const normalizeId = (value: string | number) => String(value);

const classifySeverity = (magnitude: number): WarningSeverity => {
  if (magnitude >= 1.5) return "danger";
  if (magnitude >= 0.75) return "warning";
  if (magnitude >= 0.3) return "caution";
  return "info";
};

const pickDirection = (counts: Partial<Record<DeviationDirection, number>>) => {
  const entries = Object.entries(counts) as Array<[DeviationDirection, number]>;
  if (entries.length === 0) return undefined;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
};

const buildMessage = (
  type: DeviationType,
  magnitude: number,
  direction: DeviationDirection | undefined
) => {
  if (type === "volume") {
    return direction === "decrease"
      ? `Observed lower volume than planned (${round(magnitude * 100, 0)}% deviation).`
      : `Observed higher volume than planned (${round(magnitude * 100, 0)}% deviation).`;
  }
  if (type === "intensity") {
    return direction === "decrease"
      ? `Observed lower training intensity (${round(magnitude * 100, 0)}% deviation).`
      : `Observed higher training intensity (${round(magnitude * 100, 0)}% deviation).`;
  }
  if (type === "exercise_substitution") {
    return "Observed exercise substitutions that may change local fatigue distribution.";
  }
  return direction === "increase"
    ? `Session was completed earlier than planned (${round(magnitude * HOURS_PER_DAY, 1)}h shift).`
    : `Session was completed later than planned (${round(magnitude * HOURS_PER_DAY, 1)}h shift).`;
};

export function analyzeDeviation(
  planned: DeviationPlannedSession,
  actual: DeviationActualSession
): DeviationAnalysis {
  const details: DeviationDetail[] = [];
  const actualExercises = actual.exercises ?? [];

  for (const plannedExercise of planned.exercises) {
    const plannedId = normalizeId(plannedExercise.exerciseId);
    const matchingActual =
      actualExercises.find((exercise) => normalizeId(exercise.exerciseId) === plannedId) ??
      actualExercises.find(
        (exercise) =>
          exercise.substituteForExerciseId !== undefined &&
          normalizeId(exercise.substituteForExerciseId) === plannedId
      );

    const completedSets = matchingActual?.completedSets ?? 0;
    const plannedSets = plannedExercise.plannedSets;

    if (plannedSets > 0) {
      const volumeMagnitude = Math.abs(completedSets - plannedSets) / plannedSets;
      if (volumeMagnitude >= 0.2) {
        const volumeDirection: DeviationDirection =
          completedSets >= plannedSets ? "increase" : "decrease";
        details.push({
          type: "volume",
          magnitude: round(volumeMagnitude),
          affectedMuscles: Object.keys(plannedExercise.muscleTargets),
          severity: classifySeverity(volumeMagnitude),
          message: "",
          direction: volumeDirection,
        });
      }
    } else if (completedSets > 0) {
      details.push({
        type: "volume",
        magnitude: round(completedSets / 3),
        affectedMuscles: Object.keys(plannedExercise.muscleTargets),
        severity: classifySeverity(completedSets / 3),
        message: "",
        direction: "increase",
      });
    }

    if (
      plannedExercise.plannedLoad !== undefined &&
      plannedExercise.plannedLoad !== null &&
      plannedExercise.plannedLoad > 0 &&
      matchingActual?.avgLoad !== undefined &&
      matchingActual.avgLoad !== null
    ) {
      const intensityMagnitude = Math.abs(
        (matchingActual.avgLoad - plannedExercise.plannedLoad) / plannedExercise.plannedLoad
      );

      if (intensityMagnitude >= 0.1) {
        const intensityDirection: DeviationDirection =
          matchingActual.avgLoad >= plannedExercise.plannedLoad ? "increase" : "decrease";
        details.push({
          type: "intensity",
          magnitude: round(intensityMagnitude),
          affectedMuscles: Object.keys(plannedExercise.muscleTargets),
          severity: classifySeverity(intensityMagnitude),
          message: "",
          direction: intensityDirection,
        });
      }
    }

    if (matchingActual && normalizeId(matchingActual.exerciseId) !== plannedId) {
      details.push({
        type: "exercise_substitution",
        magnitude: 1,
        affectedMuscles: Object.keys(plannedExercise.muscleTargets),
        severity: "caution",
        message: "",
        direction: "swap",
      });
    }
  }

  if (planned.scheduledAt && actual.completedAt) {
    const plannedAt = new Date(planned.scheduledAt).getTime();
    const completedAt = new Date(actual.completedAt).getTime();
    const hoursDiff = (completedAt - plannedAt) / (1000 * 60 * 60);
    const absHoursDiff = Math.abs(hoursDiff);
    if (absHoursDiff >= 6) {
      const timingMagnitude = absHoursDiff / HOURS_PER_DAY;
      details.push({
        type: "timing",
        magnitude: round(timingMagnitude),
        affectedMuscles: [],
        severity: classifySeverity(timingMagnitude),
        message: "",
        direction: hoursDiff < 0 ? "increase" : "decrease",
      });
    }
  }

  const aggregate = new Map<
    DeviationType,
    {
      magnitude: number;
      muscles: Set<string>;
      directions: Partial<Record<DeviationDirection, number>>;
    }
  >();

  for (const detail of details) {
    const entry = aggregate.get(detail.type) ?? {
      magnitude: 0,
      muscles: new Set<string>(),
      directions: {},
    };
    entry.magnitude += detail.magnitude;
    for (const muscle of detail.affectedMuscles) {
      entry.muscles.add(muscle);
    }
    if (detail.direction) {
      entry.directions[detail.direction] = (entry.directions[detail.direction] ?? 0) + 1;
    }
    aggregate.set(detail.type, entry);
  }

  const deviations: DeviationDetail[] = [];
  for (const type of [
    "volume",
    "intensity",
    "exercise_substitution",
    "timing",
  ] as DeviationType[]) {
    const entry = aggregate.get(type);
    if (!entry) {
      continue;
    }

    const magnitude = round(entry.magnitude);
    const direction = pickDirection(entry.directions);
    const deviation: DeviationDetail = {
      type,
      magnitude,
      affectedMuscles: Array.from(entry.muscles).sort(),
      severity: classifySeverity(magnitude),
      message: buildMessage(type, magnitude, direction),
    };

    if (direction !== undefined) {
      deviation.direction = direction;
    }

    deviations.push(deviation);
  }

  const totalMagnitude = round(
    deviations.reduce((sum, deviation) => sum + deviation.magnitude, 0)
  );
  const primary = [...deviations].sort((a, b) => b.magnitude - a.magnitude)[0];
  const primaryType = primary?.type ?? null;

  if (deviations.length === 0) {
    return {
      deviations: [],
      totalMagnitude: 0,
      primaryType: null,
      summary: "No meaningful deviation detected between planned and actual session.",
    };
  }

  return {
    deviations,
    totalMagnitude,
    primaryType,
    summary: `Detected ${deviations.length} deviation type(s); primary change: ${primaryType}.`,
  };
}

export function rebalancePlan(
  original: RemainingPlanSession[],
  deviations: DeviationAnalysis,
  fatigue: Record<string, number>
): RebalancedPlan {
  const notes: string[] = [];
  const muscleMultipliers: Record<string, number> = {};
  const allMuscles = new Set<string>();

  for (const session of original) {
    for (const muscle of Object.keys(session.targetVolumeSets)) {
      allMuscles.add(muscle);
    }
  }

  for (const muscle of allMuscles) {
    muscleMultipliers[muscle] = 1;
  }

  let intensityDelta = 0;

  for (const deviation of deviations.deviations) {
    if (deviation.type === "volume") {
      const change = clamp(deviation.magnitude * 0.2, 0.05, 0.35);
      const muscles = deviation.affectedMuscles.length > 0
        ? deviation.affectedMuscles
        : Array.from(allMuscles);

      for (const muscle of muscles) {
        if (muscleMultipliers[muscle] === undefined) {
          muscleMultipliers[muscle] = 1;
        }
        const delta = deviation.direction === "decrease"
          ? 1 + Math.min(0.15, change / 2)
          : 1 - change;
        muscleMultipliers[muscle] = clamp(muscleMultipliers[muscle] * delta, 0.5, 1.3);
      }

      notes.push(
        deviation.direction === "decrease"
          ? "Rebalanced with mild volume increases to recover missed work."
          : "Rebalanced with reduced future volume to absorb recent overreach."
      );
      continue;
    }

    if (deviation.type === "intensity") {
      const change = Math.min(0.2, deviation.magnitude * 0.08);
      intensityDelta += deviation.direction === "decrease" ? change / 2 : -change;
      notes.push(
        deviation.direction === "decrease"
          ? "Slight intensity increase applied to maintain progression expectations."
          : "Slight intensity decrease applied to protect recovery."
      );
      continue;
    }

    if (deviation.type === "exercise_substitution") {
      for (const muscle of deviation.affectedMuscles) {
        if (muscleMultipliers[muscle] === undefined) {
          muscleMultipliers[muscle] = 1;
        }
        muscleMultipliers[muscle] = clamp(muscleMultipliers[muscle] * 0.95, 0.5, 1.3);
      }
      notes.push("Applied conservative volume trim for substituted movement patterns.");
      continue;
    }

    if (deviation.type === "timing") {
      const change = Math.min(0.15, deviation.magnitude * 0.1);
      intensityDelta += deviation.direction === "increase" ? -change : change / 2;
      notes.push(
        deviation.direction === "increase"
          ? "Reduced intensity due to compressed recovery window."
          : "Minor intensity recovery applied after delayed session timing."
      );
    }
  }

  for (const [muscle, value] of Object.entries(fatigue)) {
    if (muscleMultipliers[muscle] === undefined) {
      continue;
    }
    if (value >= 75) {
      muscleMultipliers[muscle] = clamp(muscleMultipliers[muscle] * 0.8, 0.5, 1.3);
      notes.push(`Additional volume reduction for ${muscle} due to high fatigue (${round(value, 0)}).`);
    } else if (value >= 60) {
      muscleMultipliers[muscle] = clamp(muscleMultipliers[muscle] * 0.9, 0.5, 1.3);
      notes.push(`Minor volume reduction for ${muscle} due to elevated fatigue (${round(value, 0)}).`);
    }
  }

  const sessions = original.map((session) => {
    const adjustedVolumeSets: Record<string, number> = {};
    const rationale: string[] = [];

    for (const [muscle, target] of Object.entries(session.targetVolumeSets)) {
      const multiplier = muscleMultipliers[muscle] ?? 1;
      const adjusted = round(Math.max(0, target * multiplier), 1);
      adjustedVolumeSets[muscle] = adjusted;
      if (Math.abs(adjusted - target) >= 0.3) {
        rationale.push(
          `${muscle}: ${round(target, 1)} -> ${adjusted} sets (${round(multiplier * 100, 0)}% scale)`
        );
      }
    }

    const adjustedIntensityMultiplier = clamp(
      round((session.intensityMultiplier ?? 1) + intensityDelta),
      0.5,
      1.5
    );
    if (Math.abs(adjustedIntensityMultiplier - (session.intensityMultiplier ?? 1)) >= 0.01) {
      rationale.push(
        `Intensity multiplier: ${round(session.intensityMultiplier ?? 1)} -> ${adjustedIntensityMultiplier}`
      );
    }
    if (rationale.length === 0) {
      rationale.push("No significant adjustments required.");
    }

    return {
      sessionId: session.sessionId,
      adjustedVolumeSets,
      adjustedIntensityMultiplier,
      rationale,
    };
  });

  return {
    sessions,
    notes: Array.from(new Set(notes)),
  };
}

export function projectImpact(
  deviation: DeviationAnalysis,
  remainingPlan: RemainingPlanSession[]
): ImpactProjection {
  const projectedFatigueDelta: Record<string, number> = {};
  const notes: string[] = [];
  const remainingLoadFactor = clamp(1 + remainingPlan.length * 0.08, 1, 1.6);

  const addDelta = (muscle: string, delta: number) => {
    projectedFatigueDelta[muscle] = round((projectedFatigueDelta[muscle] ?? 0) + delta, 1);
  };

  for (const detail of deviation.deviations) {
    const muscles = detail.affectedMuscles.length > 0 ? detail.affectedMuscles : ["systemic"];
    const base = detail.magnitude * 8 * remainingLoadFactor;

    if (detail.type === "volume") {
      const directionMultiplier = detail.direction === "decrease" ? -1 : 1;
      const perMuscle = (base * directionMultiplier) / muscles.length;
      for (const muscle of muscles) addDelta(muscle, perMuscle);
      continue;
    }

    if (detail.type === "intensity") {
      const directionMultiplier = detail.direction === "decrease" ? -0.6 : 1;
      const perMuscle = (base * directionMultiplier) / muscles.length;
      for (const muscle of muscles) addDelta(muscle, perMuscle);
      continue;
    }

    if (detail.type === "exercise_substitution") {
      const perMuscle = (base * 0.35) / muscles.length;
      for (const muscle of muscles) addDelta(muscle, perMuscle);
      notes.push("Substitution variance may temporarily reduce progression confidence.");
      continue;
    }

    const directionMultiplier = detail.direction === "increase" ? 1 : -0.4;
    addDelta("systemic", base * directionMultiplier);
    if (detail.direction === "increase") {
      notes.push("Compressed session timing increases short-term recovery demand.");
    }
  }

  const positiveLoad = Object.values(projectedFatigueDelta).reduce(
    (sum, value) => sum + (value > 0 ? value : 0),
    0
  );
  const netLoad = Object.values(projectedFatigueDelta).reduce((sum, value) => sum + value, 0);
  const hasDanger = deviation.deviations.some((detail) => detail.severity === "danger");

  const projectedPerformanceImpact =
    hasDanger || positiveLoad >= 18
      ? "negative"
      : netLoad <= -6
        ? "positive"
        : "neutral";

  const recoveryHoursEstimate = Math.max(12, Math.round(24 + positiveLoad * 1.5));

  if (projectedPerformanceImpact === "negative" && notes.length === 0) {
    notes.push("Recovery risk is elevated unless upcoming sessions are downscaled.");
  } else if (projectedPerformanceImpact === "positive") {
    notes.push("Current deviation profile should be recoverable with minimal downside.");
  }

  return {
    projectedFatigueDelta,
    projectedPerformanceImpact,
    recoveryHoursEstimate,
    notes,
  };
}
