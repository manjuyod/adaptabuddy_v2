import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import { createMockSupabase } from "./helpers/mockSupabase";

const routeContext = vi.hoisted(() => ({
  userId: "11111111-1111-1111-1111-111111111111" as string | null,
  authError: null as { message: string } | null,
  ip: "127.0.0.1",
}));

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get() {
      return undefined;
    },
    set() {},
    delete() {},
  }),
  headers: async () => ({
    get(name: string) {
      if (name.toLowerCase() === "x-forwarded-for") {
        return routeContext.ip;
      }
      return null;
    },
  }),
}));

vi.mock("../src/lib/security/rateLimit", () => ({
  rateLimit: async () => ({
    success: true,
    remaining: 999,
    resetAt: Date.now() + 60_000,
    source: "test",
  }),
}));

vi.mock("../src/lib/supabase/server", () => ({
  getClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: routeContext.userId ? { id: routeContext.userId } : null },
        error: routeContext.authError,
      }),
    },
  }),
}));

vi.mock("../src/lib/supabase/next", () => ({
  createSupabaseServerActionClient: async () => mockSupabase,
}));

vi.mock("../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => mockSupabase,
}));

import { POST as generateSession } from "../app/api/v0/sessions/generate/route";
import { POST as completeSession } from "../app/api/v0/sessions/complete/route";

const createRequest = (url: string, body: unknown, headers?: Record<string, string>) =>
  new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe("offline API end-to-end session flow", () => {
  beforeEach(() => {
    routeContext.userId = "11111111-1111-1111-1111-111111111111";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
  });

  it("runs generate -> complete -> next generate through the public routes", async () => {
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
              tags_required: [],
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
          muscle_groups: [{ slug: "chest" }],
        },
      ],
      workout_logs: [],
      set_logs: [],
    };

    mockSupabase = createMockSupabase(store);

    const generateResponse = await generateSession(
      createRequest("http://localhost/api/v0/sessions/generate", {
        programDayId,
        seed: "seed-123",
      })
    );
    expect(generateResponse.status).toBe(200);
    const generatedBody = await generateResponse.json();
    expect(generatedBody.status).toBe("success");
    expect(generatedBody.session.slots).toHaveLength(1);
    expect(generatedBody.session.slots[0].exerciseId).toBe(String(exerciseId));

    const completeResponse = await completeSession(
      createRequest(
        "http://localhost/api/v0/sessions/complete",
        {
          programDayId: String(programDayId),
          seed: "seed-123",
          startedAt: "2026-02-04T11:00:00.000Z",
          completedAt: "2026-02-04T12:00:00.000Z",
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
          notes: "offline-e2e-session",
        },
        { "idempotency-key": "offline-e2e-session-1" }
      )
    );
    expect(completeResponse.status).toBe(200);
    expect(await completeResponse.json()).toMatchObject({
      status: "success",
      message: "Session completed successfully",
    });

    const nextGenerateResponse = await generateSession(
      createRequest("http://localhost/api/v0/sessions/generate", {
        programDayId,
        seed: "seed-456",
      })
    );
    expect(nextGenerateResponse.status).toBe(200);
    const nextGeneratedBody = await nextGenerateResponse.json();
    expect(nextGeneratedBody.status).toBe("success");
    expect(nextGeneratedBody.session.slots).toHaveLength(1);

    const updatedStats = store.users[0].stats_json as UserStats;
    expect(updatedStats.progression.totalWorkouts).toBe(1);
    expect(updatedStats.progression.lastWorkoutAt).toBe("2026-02-04T12:00:00.000Z");
    expect(updatedStats.mastery[String(exerciseId)].totalSets).toBe(2);
    expect(updatedStats.capacities[String(exerciseId)].estimated1RM).toBeGreaterThan(0);
    expect(updatedStats.activeProgram?.currentDayIndex).toBe(1);

    expect(store.workout_logs).toHaveLength(1);
    expect(store.set_logs).toHaveLength(2);
  });
});
