import { describe, expect, it } from "vitest";
import {
  CompletedSessionSchema,
  FilledSlotSchema,
  GeneratedSessionSchema,
  LoadRecommendationSchema,
  ScoredExerciseSchema,
  SlotContextSchema,
  StatsUpdateSchema,
  DEFAULT_OPT_INS,
} from "@adaptabuddy/contracts";
import { scoreExerciseForSlot } from "../src/engine/exerciseScorer";
import { fillSlot } from "../src/engine/slotFiller";
import { generateSession } from "../src/engine/sessionGenerator";
import { processCompletion } from "../src/engine/completion";
import { recommendLoad } from "../src/engine/progression";
import { createRng } from "../src/engine/rng";
import { baseContext, chestSlot, exercises, ids, muscleMappings, programDay } from "./fixtures";

describe("contracts smoke", () => {
  it("validates slot context and scoring outputs", () => {
    SlotContextSchema.parse(baseContext);

    const scored = scoreExerciseForSlot(
      exercises[0],
      muscleMappings,
      chestSlot,
      baseContext
    );
    ScoredExerciseSchema.parse(scored);
  });

  it("validates filled slot and generated session outputs", () => {
    const filled = fillSlot({
      slot: chestSlot,
      exercises,
      muscleMappings,
      context: baseContext,
      rng: createRng(42),
    });

    expect(filled).not.toBeNull();
    FilledSlotSchema.parse(filled);

    const session = generateSession({
      programDay,
      exercises,
      muscleMappings,
      fatigue: baseContext.fatigue,
      equipment: baseContext.equipment,
      injuries: baseContext.injuries,
      fatigueLevel: baseContext.fatigueLevel,
      seed: "seed-1",
    });

    GeneratedSessionSchema.parse(session);
  });

  it("validates completion and progression outputs", () => {
    const timestamp = "2026-01-02T10:00:00.000Z";

    const completedSession = {
      programDayId: ids.programDay,
      seed: "seed-1",
      startedAt: "2026-01-02T09:30:00.000Z",
      completedAt: timestamp,
      overallRpe: null,
      exercises: [
        {
          slotId: ids.slotA,
          exerciseId: ids.exerciseA,
          sets: [
            { setIndex: 0, weight: 100, reps: 5, rir: null },
            { setIndex: 1, weight: 100, reps: 5, rir: null },
          ],
        },
      ],
    };

    CompletedSessionSchema.parse(completedSession);

    const currentStats = {
      activeProgram: null,
      fatigue: {
        chest: { current: 10, lastUpdated: timestamp },
      },
      mastery: {},
      capacities: {},
      progression: {
        totalWorkouts: 0,
        weeklyVolume: 0,
        lastWorkoutAt: null,
      },
      preferences: {
        fatigueLevel: "moderate",
        equipment: [],
        injuries: [],
        acknowledgedRisks: [],
        optIns: { ...DEFAULT_OPT_INS },
      },
    };

    const update = processCompletion(
      { session: completedSession, muscleMappings },
      currentStats
    );
    StatsUpdateSchema.parse(update);

    const recommendation = recommendLoad(
      ids.exerciseA,
      { estimated1RM: 110, lastWeight: 80, lastReps: 5, confidence: 0.5, lastPerformed: null },
      6,
      8
    );
    LoadRecommendationSchema.parse(recommendation);
  });
});
