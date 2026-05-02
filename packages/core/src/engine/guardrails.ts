import type {
  GuardrailEvaluation,
  GuardrailRequest,
  TrainingAge,
  UserOptIn,
  Warning,
  WarningSeverity,
} from "@adaptabuddy/contracts";
import { calculateMRV } from "./volume";

export type GuardrailContext = {
  fatigueState: Record<string, number>;
  optIns: UserOptIn;
  injuries: string[];
};

export type TradeoffAnalysis = {
  choice: string;
  alternatives: string[];
  tradeoffs: string[];
};

const HIGH_SYSTEMIC_FATIGUE = 80;
const MODERATE_SYSTEMIC_FATIGUE = 60;

const createWarning = (warning: Warning): Warning => warning;

const getTrainingAge = (request: GuardrailRequest): TrainingAge =>
  request.trainingAge ?? "intermediate";

export function classifyRisk(
  action: GuardrailRequest["action"],
  fatigueState: Record<string, number>,
  optIns: UserOptIn
): WarningSeverity {
  const systemicFatigue = fatigueState.systemic ?? 0;

  if (action === "injury_override") {
    return "danger";
  }

  if (systemicFatigue >= HIGH_SYSTEMIC_FATIGUE) {
    return "warning";
  }

  if (systemicFatigue >= MODERATE_SYSTEMIC_FATIGUE) {
    return "caution";
  }

  if (action === "volume_change" && !optIns.allowExtremeVolume) {
    return "caution";
  }

  return "info";
}

export function calculateTradeoffs(
  choice: string,
  alternatives: string[]
): TradeoffAnalysis {
  const tradeoffs = alternatives.map(
    (alternative) =>
      `Choosing ${choice} over ${alternative} may reduce recovery headroom or slow progression.`
  );

  return {
    choice,
    alternatives,
    tradeoffs,
  };
}

export function evaluateRequest(
  request: GuardrailRequest,
  context: GuardrailContext
): GuardrailEvaluation {
  const warnings: Warning[] = [];
  const blockers: Warning[] = [];
  const recommendations: string[] = [];

  const trainingAge = getTrainingAge(request);
  const fatigueState = context.fatigueState ?? {};
  const systemicFatigue =
    request.systemicFatigue ?? fatigueState.systemic ?? 0;

  const weeklyVolume = request.weeklyVolume ?? {};

  for (const [muscle, volume] of Object.entries(weeklyVolume)) {
    if (volume <= 0) continue;

    const mrv = calculateMRV(muscle, fatigueState, trainingAge);
    if (mrv <= 0) continue;

    const ratio = volume / mrv;

    if (ratio > 2) {
      if (!context.optIns.allowExtremeVolume) {
        blockers.push(
          createWarning({
            id: `volume-extreme-${muscle}`,
            severity: "danger",
            category: "volume",
            title: "Extreme volume request",
            description: `${muscle} volume exceeds 2x MRV (${volume.toFixed(1)} sets vs ${mrv.toFixed(
              1
            )}).`,
            impact: "High risk of overuse and stalled recovery.",
            mitigation: "Enable extreme volume opt-in or reduce volume to <= 2x MRV.",
            requiredOptIn: "allowExtremeVolume",
          })
        );
      } else {
        warnings.push(
          createWarning({
            id: `volume-extreme-${muscle}`,
            severity: "warning",
            category: "volume",
            title: "Extreme volume acknowledged",
            description: `${muscle} volume exceeds 2x MRV (${volume.toFixed(1)} sets vs ${mrv.toFixed(
              1
            )}).`,
            impact: "Recovery demand is very high.",
            mitigation: "Monitor soreness and reduce if fatigue spikes.",
            requiredOptIn: "allowExtremeVolume",
          })
        );
      }
    } else if (ratio >= 1.5) {
      warnings.push(
        createWarning({
          id: `volume-high-${muscle}`,
          severity: "caution",
          category: "volume",
          title: "High volume warning",
          description: `${muscle} volume is between 1.5x and 2x MRV (${volume.toFixed(1)} sets vs ${mrv.toFixed(
            1
          )}).`,
          impact: "Elevated recovery cost and potential fatigue buildup.",
          mitigation: "Consider scaling back or scheduling a deload.",
        })
      );
    }
  }

  const daysPerMuscle = request.daysPerMuscle ?? {};
  for (const [muscle, days] of Object.entries(daysPerMuscle)) {
    if (days < 7) continue;
    if (!context.optIns.specializationMode || !context.optIns.allowDailyTraining) {
      blockers.push(
        createWarning({
          id: `daily-training-${muscle}`,
          severity: "danger",
          category: "frequency",
          title: "Daily training requires opt-in",
          description: `${muscle} is scheduled for ${days} consecutive days.`,
          impact: "Risk of overuse without specialization safeguards.",
          mitigation: "Enable specialization mode and daily training opt-ins.",
          requiredOptIn: "specializationMode+allowDailyTraining",
        })
      );
    }
  }

  if (request.consecutiveTrainingDays && request.consecutiveTrainingDays >= 14) {
    if (!context.optIns.ignoreDeloadRecommendations) {
      blockers.push(
        createWarning({
          id: "no-rest-14-days",
          severity: "danger",
          category: "recovery",
          title: "Rest days required",
          description: `${request.consecutiveTrainingDays} consecutive training days without rest.`,
          impact: "High systemic fatigue and injury risk.",
          mitigation: "Schedule rest days or enable deload override opt-in.",
          requiredOptIn: "ignoreDeloadRecommendations",
        })
      );
    }
  }

  if (request.trainingThroughInjury && context.injuries.length > 0) {
    blockers.push(
      createWarning({
        id: "injury-override",
        severity: "danger",
        category: "injury",
        title: "Training through injury is blocked",
        description: `Reported injuries: ${context.injuries.join(", ")}.`,
        impact: "Risk of aggravating existing injuries.",
        mitigation: "Modify the plan or seek guidance before resuming.",
      })
    );
  }

  if (request.skippedDeloads && request.skippedDeloads >= 1) {
    warnings.push(
      createWarning({
        id: "skipped-deload",
        severity: "caution",
        category: "recovery",
        title: "Deload skipped",
        description: `${request.skippedDeloads} deload(s) skipped recently.`,
        impact: "Accumulated fatigue may reduce performance.",
        mitigation: "Plan a deload within the next microcycle.",
      })
    );
  }

  if (request.performanceDeclineWeeks && request.performanceDeclineWeeks >= 2) {
    warnings.push(
      createWarning({
        id: "performance-decline",
        severity: "warning",
        category: "performance",
        title: "Performance decline detected",
        description: `Performance has declined for ${request.performanceDeclineWeeks} weeks.`,
        impact: "Plateau risk and reduced adaptation.",
        mitigation: "Reduce volume or prioritize recovery.",
      })
    );
  }

  if (systemicFatigue >= HIGH_SYSTEMIC_FATIGUE) {
    warnings.push(
      createWarning({
        id: "high-systemic-fatigue",
        severity: "warning",
        category: "recovery",
        title: "High systemic fatigue",
        description: `Systemic fatigue is ${systemicFatigue.toFixed(0)} / 100.`,
        impact: "Higher injury and overtraining risk.",
        mitigation: "Reduce training stress or add recovery days.",
      })
    );
  }

  const baseSeverity = classifyRisk(request.action, fatigueState, context.optIns);
  if (baseSeverity !== "info") {
    recommendations.push(`Overall risk level: ${baseSeverity}.`);
  }

  if (request.choice && request.alternatives?.length) {
    const tradeoff = calculateTradeoffs(request.choice, request.alternatives);
    for (const line of tradeoff.tradeoffs) {
      recommendations.push(line);
    }
  }

  return {
    passed: blockers.length === 0,
    warnings,
    blockers,
    recommendations,
  };
}
