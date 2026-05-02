import { describe, expect, it } from "vitest";
import { applyStatsUpdate, processCompletion } from "../src/engine/completion";
import { DEFAULT_OPT_INS } from "@adaptabuddy/contracts";
import { ids, muscleMappings } from "./fixtures";

describe("completion engine", () => {
  it("processes a completed session into deterministic stat updates", () => {
    const timestamp = "2026-01-02T10:00:00.000Z";

    const session = {
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
        {
          slotId: ids.slotB,
          exerciseId: ids.exerciseB,
          sets: [{ setIndex: 0, weight: 50, reps: 8, rir: null }],
        },
      ],
    };

    const currentStats = {
      activeProgram: {
        programId: ids.program,
        startedAt: "2026-01-01T10:00:00.000Z",
        currentDayIndex: 1,
        currentMicrocycle: 1,
        daysPerWeek: 3,
      },
      fatigue: {
        chest: { current: 10, lastUpdated: timestamp },
        triceps: { current: 5, lastUpdated: timestamp },
      },
      mastery: {},
      capacities: {},
      progression: {
        totalWorkouts: 4,
        weeklyVolume: 1000,
        lastWorkoutAt: "2026-01-01T10:00:00.000Z",
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
      { session, muscleMappings },
      currentStats
    );

    expect(update.fatigueUpdates.chest.current).toBeCloseTo(23.5, 5);
    expect(update.fatigueUpdates.triceps.current).toBeCloseTo(5.8, 1);
    expect(update.masteryUpdates[ids.exerciseA].setsDelta).toBe(2);
    expect(update.masteryUpdates[ids.exerciseB].setsDelta).toBe(1);
    expect(update.capacityUpdates[ids.exerciseA].lastWeight).toBe(100);
    expect(update.capacityUpdates[ids.exerciseB].lastReps).toBe(8);
    expect(update.progressionUpdate.volumeDelta).toBe(1400);
    expect(update.dayIndexAdvance).toBe(2);
  });

  it("applies stats updates to user stats", () => {
    const timestamp = "2026-01-02T10:00:00.000Z";

    const currentStats = {
      activeProgram: {
        programId: ids.program,
        startedAt: "2026-01-01T10:00:00.000Z",
        currentDayIndex: 1,
        currentMicrocycle: 1,
        daysPerWeek: 3,
      },
      fatigue: {
        chest: { current: 10, lastUpdated: timestamp },
      },
      mastery: {},
      capacities: {},
      progression: {
        totalWorkouts: 4,
        weeklyVolume: 1000,
        lastWorkoutAt: "2026-01-01T10:00:00.000Z",
      },
      preferences: {
        fatigueLevel: "moderate",
        equipment: [],
        injuries: [],
        acknowledgedRisks: [],
        optIns: { ...DEFAULT_OPT_INS },
      },
    };

    const update = {
      fatigueUpdates: {
        chest: { current: 20, lastUpdated: timestamp },
      },
      masteryUpdates: {
        [ids.exerciseA]: { scoreDelta: 2, setsDelta: 2, lastUpdated: timestamp },
      },
      capacityUpdates: {
        [ids.exerciseA]: {
          estimated1RM: 110,
          lastWeight: 100,
          lastReps: 5,
          confidence: 0.2,
          lastPerformed: timestamp,
        },
      },
      progressionUpdate: {
        workoutsDelta: 1,
        volumeDelta: 500,
        lastWorkoutAt: timestamp,
      },
      dayIndexAdvance: 2,
    };

    const next = applyStatsUpdate(currentStats, update);

    expect(next.fatigue.chest.current).toBe(20);
    expect(next.mastery[ids.exerciseA].totalSets).toBe(2);
    expect(next.capacities[ids.exerciseA].estimated1RM).toBe(110);
    expect(next.progression.totalWorkouts).toBe(5);
    expect(next.progression.weeklyVolume).toBe(1500);
    expect(next.activeProgram?.currentDayIndex).toBe(2);
  });
});
