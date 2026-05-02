import { describe, expect, it } from "vitest";
import { buildChaosBlock } from "../src/engine/chaos";
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
    {
      dayIndex: 2,
      name: "Day A3",
      intensityTarget: "low",
      volumeMultiplier: 0.8,
      slots: [
        {
          slotType: "accessory",
          movementPattern: "legs",
          muscleTargets: { quads: 1 },
          setsMin: 2,
          setsMax: 3,
          repsMin: 10,
          repsMax: 15,
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
    {
      dayIndex: 1,
      name: "Day B2",
      intensityTarget: "moderate",
      volumeMultiplier: 1,
      slots: [
        {
          slotType: "main",
          movementPattern: "push",
          muscleTargets: { shoulders: 1 },
          setsMin: 3,
          setsMax: 4,
          repsMin: 8,
          repsMax: 10,
          tags: [],
        },
      ],
    },
  ],
  volumeDistribution: {},
};

const templateC: ProgramTemplate = {
  templateId: "template-c",
  name: "Template C",
  daysPerWeek: 1,
  weekPattern: [
    {
      dayIndex: 0,
      name: "Day C1",
      intensityTarget: "high",
      volumeMultiplier: 1.2,
      slots: [
        {
          slotType: "main",
          movementPattern: "pull",
          muscleTargets: { back: 1 },
          setsMin: 4,
          setsMax: 5,
          repsMin: 4,
          repsMax: 6,
          tags: ["compound"],
        },
      ],
    },
  ],
  volumeDistribution: {},
};

describe("chaos block engine", () => {
  describe("rotate mode", () => {
    it("cycles through templates in order", () => {
      const plan = buildChaosBlock({
        templates: [templateA, templateB, templateC],
        weeks: 1,
        daysPerWeek: 6,
        seed: "rotate-test",
        mode: "rotate",
        allowSameTemplateConsecutive: true,
      });

      expect(plan.sessions).toHaveLength(6);
      expect(plan.sessions[0].templateId).toBe("template-a");
      expect(plan.sessions[1].templateId).toBe("template-b");
      expect(plan.sessions[2].templateId).toBe("template-c");
      expect(plan.sessions[3].templateId).toBe("template-a");
      expect(plan.sessions[4].templateId).toBe("template-b");
      expect(plan.sessions[5].templateId).toBe("template-c");
    });

    it("wraps around templates across weeks", () => {
      const plan = buildChaosBlock({
        templates: [templateA, templateB],
        weeks: 2,
        daysPerWeek: 3,
        seed: "rotate-weeks",
        mode: "rotate",
      });

      expect(plan.sessions).toHaveLength(6);
      // Week 1: A, B, A
      expect(plan.sessions[0].templateId).toBe("template-a");
      expect(plan.sessions[1].templateId).toBe("template-b");
      expect(plan.sessions[2].templateId).toBe("template-a");
      // Week 2: B, A, B
      expect(plan.sessions[3].templateId).toBe("template-b");
      expect(plan.sessions[4].templateId).toBe("template-a");
      expect(plan.sessions[5].templateId).toBe("template-b");
    });

    it("includes week and day metadata in sessions", () => {
      const plan = buildChaosBlock({
        templates: [templateA],
        weeks: 2,
        daysPerWeek: 2,
        seed: "metadata-test",
        mode: "rotate",
      });

      expect(plan.sessions[0].weekNumber).toBe(1);
      expect(plan.sessions[0].dayIndex).toBe(0);
      expect(plan.sessions[1].weekNumber).toBe(1);
      expect(plan.sessions[1].dayIndex).toBe(1);
      expect(plan.sessions[2].weekNumber).toBe(2);
      expect(plan.sessions[2].dayIndex).toBe(0);
      expect(plan.sessions[3].weekNumber).toBe(2);
      expect(plan.sessions[3].dayIndex).toBe(1);
    });
  });

  describe("random mode", () => {
    it("produces deterministic results with same seed", () => {
      const plan1 = buildChaosBlock({
        templates: [templateA, templateB, templateC],
        weeks: 2,
        daysPerWeek: 4,
        seed: "deterministic-seed",
        mode: "random",
      });

      const plan2 = buildChaosBlock({
        templates: [templateA, templateB, templateC],
        weeks: 2,
        daysPerWeek: 4,
        seed: "deterministic-seed",
        mode: "random",
      });

      expect(plan1.sessions.map((s) => s.templateId)).toEqual(
        plan2.sessions.map((s) => s.templateId)
      );
    });

    it("produces different results with different seeds", () => {
      const plan1 = buildChaosBlock({
        templates: [templateA, templateB, templateC],
        weeks: 3,
        daysPerWeek: 5,
        seed: "seed-one",
        mode: "random",
      });

      const plan2 = buildChaosBlock({
        templates: [templateA, templateB, templateC],
        weeks: 3,
        daysPerWeek: 5,
        seed: "seed-two",
        mode: "random",
      });

      const ids1 = plan1.sessions.map((s) => s.templateId);
      const ids2 = plan2.sessions.map((s) => s.templateId);

      // With 3 templates and 15 sessions, probability of identical sequences is very low
      expect(ids1).not.toEqual(ids2);
    });

    it("defaults to random mode when mode is not specified", () => {
      const plan1 = buildChaosBlock({
        templates: [templateA, templateB],
        weeks: 1,
        daysPerWeek: 4,
        seed: "default-mode",
      });

      const plan2 = buildChaosBlock({
        templates: [templateA, templateB],
        weeks: 1,
        daysPerWeek: 4,
        seed: "default-mode",
        mode: "random",
      });

      expect(plan1.sessions.map((s) => s.templateId)).toEqual(
        plan2.sessions.map((s) => s.templateId)
      );
    });
  });

  describe("single template edge case", () => {
    it("uses the same template for all sessions", () => {
      const plan = buildChaosBlock({
        templates: [templateA],
        weeks: 2,
        daysPerWeek: 3,
        seed: "single-template",
        mode: "random",
      });

      expect(plan.sessions).toHaveLength(6);
      for (const session of plan.sessions) {
        expect(session.templateId).toBe("template-a");
        expect(session.templateName).toBe("Template A");
      }
    });

    it("cycles through template days correctly with single template", () => {
      const plan = buildChaosBlock({
        templates: [templateA],
        weeks: 1,
        daysPerWeek: 5,
        seed: "single-template-days",
        mode: "rotate",
      });

      // templateA has 3 days, so should cycle: 0, 1, 2, 0, 1
      expect(plan.sessions[0].sourceDayIndex).toBe(0);
      expect(plan.sessions[1].sourceDayIndex).toBe(1);
      expect(plan.sessions[2].sourceDayIndex).toBe(2);
      expect(plan.sessions[3].sourceDayIndex).toBe(0);
      expect(plan.sessions[4].sourceDayIndex).toBe(1);
    });
  });

  describe("allowSameTemplateConsecutive flag", () => {
    it("allows same template back-to-back when flag is true", () => {
      // With a seeded RNG, we can verify behavior
      const plan = buildChaosBlock({
        templates: [templateA, templateB],
        weeks: 1,
        daysPerWeek: 7,
        seed: "consecutive-allowed",
        mode: "random",
        allowSameTemplateConsecutive: true,
      });

      // Just verify plan is generated - consecutive templates are allowed
      expect(plan.sessions).toHaveLength(7);
    });

    it("prevents same template back-to-back when flag is false", () => {
      const plan = buildChaosBlock({
        templates: [templateA, templateB],
        weeks: 2,
        daysPerWeek: 5,
        seed: "no-consecutive",
        mode: "random",
        allowSameTemplateConsecutive: false,
      });

      for (let i = 1; i < plan.sessions.length; i++) {
        expect(plan.sessions[i].templateId).not.toBe(
          plan.sessions[i - 1].templateId
        );
      }
    });

    it("has no effect with single template (cannot avoid repetition)", () => {
      const plan = buildChaosBlock({
        templates: [templateA],
        weeks: 1,
        daysPerWeek: 4,
        seed: "single-no-consecutive",
        mode: "random",
        allowSameTemplateConsecutive: false,
      });

      // With only one template, all sessions must use it regardless of flag
      expect(plan.sessions).toHaveLength(4);
      for (const session of plan.sessions) {
        expect(session.templateId).toBe("template-a");
      }
    });

    it("defaults allowSameTemplateConsecutive to true", () => {
      const planWithDefault = buildChaosBlock({
        templates: [templateA, templateB],
        weeks: 1,
        daysPerWeek: 4,
        seed: "default-consecutive",
        mode: "random",
      });

      const planWithTrue = buildChaosBlock({
        templates: [templateA, templateB],
        weeks: 1,
        daysPerWeek: 4,
        seed: "default-consecutive",
        mode: "random",
        allowSameTemplateConsecutive: true,
      });

      expect(planWithDefault.sessions.map((s) => s.templateId)).toEqual(
        planWithTrue.sessions.map((s) => s.templateId)
      );
    });
  });

  describe("edge cases", () => {
    it("returns empty sessions array for empty templates", () => {
      const plan = buildChaosBlock({
        templates: [],
        weeks: 2,
        daysPerWeek: 4,
        seed: "empty-templates",
        mode: "random",
      });

      expect(plan.sessions).toHaveLength(0);
      expect(plan.weeks).toBe(2);
      expect(plan.daysPerWeek).toBe(4);
      expect(plan.seed).toBe("empty-templates");
    });

    it("clamps weeks to minimum of 1", () => {
      const plan = buildChaosBlock({
        templates: [templateA],
        weeks: 0,
        daysPerWeek: 3,
        seed: "zero-weeks",
        mode: "rotate",
      });

      expect(plan.weeks).toBe(1);
      expect(plan.sessions).toHaveLength(3);
    });

    it("clamps daysPerWeek to 1-7 range", () => {
      const planLow = buildChaosBlock({
        templates: [templateA],
        weeks: 1,
        daysPerWeek: 0,
        seed: "clamp-days-low",
        mode: "rotate",
      });

      const planHigh = buildChaosBlock({
        templates: [templateA],
        weeks: 1,
        daysPerWeek: 10,
        seed: "clamp-days-high",
        mode: "rotate",
      });

      expect(planLow.daysPerWeek).toBe(1);
      expect(planLow.sessions).toHaveLength(1);

      expect(planHigh.daysPerWeek).toBe(7);
      expect(planHigh.sessions).toHaveLength(7);
    });

    it("includes resolved session data from template", () => {
      const plan = buildChaosBlock({
        templates: [templateA],
        weeks: 1,
        daysPerWeek: 1,
        seed: "session-data",
        mode: "rotate",
      });

      const session = plan.sessions[0];
      expect(session.session).toBeDefined();
      expect(session.session.name).toBe("Day A1");
      expect(session.session.intensityTarget).toBe("moderate");
      expect(session.session.slots).toHaveLength(1);
    });
  });
});
