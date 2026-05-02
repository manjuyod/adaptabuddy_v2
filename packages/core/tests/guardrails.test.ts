import { describe, expect, it } from "vitest";
import type { GuardrailRequest } from "@adaptabuddy/contracts";
import { DEFAULT_OPT_INS } from "@adaptabuddy/contracts";
import { evaluateRequest, type GuardrailContext } from "../src/engine/guardrails";

const baseContext: GuardrailContext = {
  fatigueState: { chest: 0 },
  optIns: { ...DEFAULT_OPT_INS },
  injuries: [],
};

describe("guardrails engine", () => {
  it("blocks extreme volume without opt-in", () => {
    const request: GuardrailRequest = {
      action: "volume_change",
      weeklyVolume: { chest: 40 },
      trainingAge: "intermediate",
    };

    const evaluation = evaluateRequest(request, baseContext);

    expect(evaluation.passed).toBe(false);
    expect(evaluation.blockers.length).toBeGreaterThan(0);
    expect(evaluation.blockers[0].requiredOptIn).toBe("allowExtremeVolume");
  });

  it("allows extreme volume with opt-in", () => {
    const request: GuardrailRequest = {
      action: "volume_change",
      weeklyVolume: { chest: 40 },
      trainingAge: "intermediate",
    };

    const evaluation = evaluateRequest(request, {
      ...baseContext,
      optIns: { ...DEFAULT_OPT_INS, allowExtremeVolume: true },
    });

    expect(evaluation.blockers.length).toBe(0);
    expect(evaluation.warnings.length).toBeGreaterThan(0);
  });

  it("requires specialization and daily training opt-ins", () => {
    const request: GuardrailRequest = {
      action: "frequency_change",
      daysPerMuscle: { chest: 7 },
      trainingAge: "intermediate",
    };

    const evaluation = evaluateRequest(request, baseContext);
    expect(evaluation.blockers.length).toBeGreaterThan(0);

    const cleared = evaluateRequest(request, {
      ...baseContext,
      optIns: {
        ...DEFAULT_OPT_INS,
        specializationMode: true,
        allowDailyTraining: true,
      },
    });

    expect(cleared.blockers.length).toBe(0);
  });

  it("blocks injury overrides and warns on high systemic fatigue", () => {
    const request: GuardrailRequest = {
      action: "injury_override",
      trainingThroughInjury: true,
      systemicFatigue: 85,
      trainingAge: "intermediate",
    };

    const evaluation = evaluateRequest(request, {
      ...baseContext,
      injuries: ["knee"],
    });

    expect(evaluation.blockers.some((warning) => warning.id === "injury-override")).toBe(true);
    expect(
      evaluation.warnings.some((warning) => warning.id === "high-systemic-fatigue")
    ).toBe(true);
  });
});
