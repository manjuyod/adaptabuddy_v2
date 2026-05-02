import { describe, expect, it } from "vitest";
import { buildChaosBlock } from "../src/engine/chaos";
import { buildMicrocycle, resolveTemplate } from "../src/engine/template";
import type { ProgramTemplate } from "@adaptabuddy/contracts";

const templateA: ProgramTemplate = {
  templateId: "template-a",
  name: "Template A",
  daysPerWeek: 3,
  weekPattern: [
    {
      dayIndex: 0,
      name: "Day A1",
      intensityTarget: "moderate",
      volumeMultiplier: 1,
      slots: [
        {
          slotType: "main",
          movementPattern: "push",
          muscleTargets: { chest: 1 },
          setsMin: 3,
          setsMax: 4,
          repsMin: 6,
          repsMax: 8,
          tags: ["compound"],
        },
      ],
    },
    {
      dayIndex: 1,
      name: "Day A2",
      intensityTarget: "high",
      volumeMultiplier: 1.1,
      slots: [
        {
          slotType: "main",
          movementPattern: "pull",
          muscleTargets: { back: 1 },
          setsMin: 3,
          setsMax: 4,
          repsMin: 5,
          repsMax: 6,
          tags: [],
        },
      ],
    },
  ],
  volumeDistribution: {},
};

const templateB: ProgramTemplate = {
  templateId: "template-b",
  name: "Template B",
  daysPerWeek: 2,
  weekPattern: [
    {
      dayIndex: 0,
      name: "Day B1",
      intensityTarget: "low",
      volumeMultiplier: 0.9,
      slots: [
        {
          slotType: "accessory",
          movementPattern: "legs",
          muscleTargets: { quads: 1 },
          setsMin: 2,
          setsMax: 3,
          repsMin: 8,
          repsMax: 12,
          tags: [],
        },
      ],
    },
  ],
  volumeDistribution: {},
};

describe("program template engine", () => {
  it("resolves template day by index", () => {
    const session = resolveTemplate({
      template: templateA,
      weekNumber: 1,
      dayNumber: 2,
    });

    expect(session.name).toBe("Day A1");
    expect(session.intensityTarget).toBe("moderate");
  });

  it("builds microcycle from template", () => {
    const microcycle = buildMicrocycle(templateA, 1, 2);

    expect(microcycle.sessions.length).toBe(2);
    expect(microcycle.intensityTarget).toBe("high");
  });
});

describe("chaos block engine", () => {
  it("builds deterministic chaos block with rotation", () => {
    const plan = buildChaosBlock({
      templates: [templateA, templateB],
      weeks: 1,
      daysPerWeek: 2,
      seed: "chaos-seed",
      mode: "rotate",
      allowSameTemplateConsecutive: true,
    });

    expect(plan.sessions[0].templateId).toBe("template-a");
    expect(plan.sessions[1].templateId).toBe("template-b");
  });
});
