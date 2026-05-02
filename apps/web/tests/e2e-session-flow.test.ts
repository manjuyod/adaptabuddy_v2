import { describe, expect, it, vi } from "vitest";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import {
  getRecentWorkoutHistory,
  handleCompleteSession,
  handleGenerateSession,
} from "../src/modules/sessions/service";
import { createMockSupabase } from "./helpers/mockSupabase";

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock("../src/lib/supabase/next", () => ({
  createSupabaseServerActionClient: async () => mockSupabase,
}));

describe("e2e session flow", () => {
  it("generates then completes a session and updates stats_json", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const programId = 2001;
    const programDayId = 3001;
    const slotId = 4001;
    const exerciseId = 5001;

    const initialStats: UserStats = {
      activeProgram: {
        programId: String(programId),
        startedAt: "2026-02-01T00:00:00.000Z",
        currentDayIndex: 0,
        currentMicrocycle: 1,
        daysPerWeek: 3,
      },
      fatigue: {},
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

    const store = {
      users: [
        {
          id: userId,
          stats_json: initialStats,
        },
      ],
      program_days: [
        {
          id: programDayId,
          program_id: programId,
          name: "Day 1",
          day_index: 0,
          program_slots: [
            {
              id: slotId,
              program_day_id: programDayId,
              slot_index: 0,
              slot_type: "main",
              lock_type: "hard",
              locked_exercise_id: exerciseId,
              muscle_targets: { chest: 1 },
              sets_min: 2,
              sets_max: 2,
              reps_min: 5,
              reps_max: 5,
              rest_seconds: 120,
              tags: [],
            },
          ],
        },
      ],
      exercises: [
        {
          id: exerciseId,
          slug: "bench-press",
          name: "Bench Press",
          movement_pattern: "push",
          equipment: ["barbell"],
          tags: ["compound"],
          contraindications: [],
          is_bodyweight: false,
        },
      ],
      exercise_muscle_map: [
        {
          exercise_id: exerciseId,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
      ],
      workout_logs: [],
      set_logs: [],
    };

    const idempotencyKey = "session-complete-duplicate-key-1";
    mockSupabase = createMockSupabase(store, {
      mutationGuards: {
        insert: ({ table, payload, store: mutableStore }) => {
          if (table !== "workout_logs" || !payload || Array.isArray(payload)) {
            return null;
          }

          const duplicate = (mutableStore.workout_logs ?? []).find(
            (row) =>
              row.user_id === payload.user_id &&
              row.idempotency_key === payload.idempotency_key
          );
          if (duplicate) {
            return {
              code: "23505",
              message: "duplicate key value violates unique constraint",
            };
          }

          return null;
        },
      },
    });

    const generateResult = await handleGenerateSession(userId, {
      programDayId,
      seed: "seed-123",
    });

    expect(generateResult.status).toBe("success");
    expect(generateResult.session?.slots.length).toBe(1);
    expect(generateResult.session?.slots[0].exerciseId).toBe(String(exerciseId));

    const completedAt = "2026-02-04T12:00:00.000Z";
    const completeResult = await handleCompleteSession(userId, {
      programDayId: String(programDayId),
      seed: "seed-123",
      startedAt: "2026-02-04T11:00:00.000Z",
      completedAt,
      overallRpe: 7,
      exercises: [
        {
          slotId: String(slotId),
          exerciseId: String(exerciseId),
          sets: [
            { setIndex: 0, weight: 100, reps: 5, rir: 2 },
            { setIndex: 1, weight: 100, reps: 5, rir: 2 },
          ],
        },
      ],
      notes: "solid session",
    }, { idempotencyKey });

    expect(completeResult.status).toBe("success");
    expect(store.workout_logs).toHaveLength(1);
    expect(store.set_logs).toHaveLength(2);

    const updatedStats = store.users[0].stats_json as UserStats;

    expect(updatedStats.progression.totalWorkouts).toBe(1);
    expect(updatedStats.mastery[String(exerciseId)].totalSets).toBe(2);
    expect(updatedStats.capacities[String(exerciseId)].estimated1RM).toBeGreaterThan(0);
    expect(updatedStats.activeProgram?.currentDayIndex).toBe(1);

    const duplicateCompleteResult = await handleCompleteSession(
      userId,
      {
        programDayId: String(programDayId),
        seed: "seed-123",
        startedAt: "2026-02-04T11:00:00.000Z",
        completedAt,
        overallRpe: 7,
        exercises: [
          {
            slotId: String(slotId),
            exerciseId: String(exerciseId),
            sets: [
              { setIndex: 0, weight: 100, reps: 5, rir: 2 },
              { setIndex: 1, weight: 100, reps: 5, rir: 2 },
            ],
          },
        ],
        notes: "solid session",
      },
      { idempotencyKey }
    );

    expect(duplicateCompleteResult.status).toBe("success");
    expect(store.workout_logs).toHaveLength(1);
    expect(store.set_logs).toHaveLength(2);
    const duplicatedStats = store.users[0].stats_json as UserStats;
    expect(duplicatedStats.progression.totalWorkouts).toBe(1);
    expect(duplicatedStats.mastery[String(exerciseId)].totalSets).toBe(2);
    expect(duplicatedStats.activeProgram?.currentDayIndex).toBe(1);

    const historyResult = await getRecentWorkoutHistory(
      mockSupabase as unknown as Parameters<typeof getRecentWorkoutHistory>[0],
      userId,
      5
    );
    expect(historyResult.error).toBeUndefined();
    expect(historyResult.workouts).toHaveLength(1);
    expect(historyResult.workouts[0]?.dayName).toBe("Day 1");
    expect(historyResult.workouts[0]?.sets).toHaveLength(2);
  });
});
