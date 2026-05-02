import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import { handleInitializeCycle } from "../src/modules/cycles/service";
import { createMockSupabase } from "./helpers/mockSupabase";

let mockSupabase: ReturnType<typeof createMockSupabase>;
let mockAdminSupabase: ReturnType<typeof createMockSupabase> | null;

vi.mock("../src/lib/supabase/next", () => ({
  createSupabaseServerActionClient: async () => mockSupabase,
}));

vi.mock("../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => mockAdminSupabase,
}));

vi.mock("../src/lib/engine-runner", () => ({
  runEngineInput: vi.fn(),
}));

import { runEngineInput } from "../src/lib/engine-runner";

const mockedRunEngineInput = vi.mocked(runEngineInput);
const firstEngineInput = () =>
  mockedRunEngineInput.mock.calls[0]?.[0] as {
    request: {
      selectedPrograms: Array<{
        days: Array<{
          slots: Array<{
            slotType: string;
            repsMin: number;
            repsMax: number;
            tagsRequired: string[];
          }>;
        }>;
      }>;
    };
  };

const richerGamificationState = {
  xp: 140,
  level: 3,
  adherenceStreak: 6,
  completedSessionCount: 12,
  missedSessionCount: 0,
  lastAdherenceOutcomeClassification: "complete_clean",
  lastAwardedAt: "2026-02-10T10:00:00.000Z",
} as const;

const createStats = (): UserStats => ({
  activeProgram: null,
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
});

const classRows = [
  {
    id: "classless",
    display_name: "Classless",
    description: "Neutral baseline",
    sort_order: 1,
    is_selectable: true,
    status: "active",
    base_archetype: "hybrid",
  },
  {
    id: "bb",
    display_name: "BB",
    description: "Accessory-biased split",
    sort_order: 2,
    is_selectable: true,
    status: "active",
    base_archetype: "hybrid",
  },
  {
    id: "powa",
    display_name: "POWA",
    description: "Compound-biased split",
    sort_order: 3,
    is_selectable: true,
    status: "active",
    base_archetype: "strength",
  },
  {
    id: "ninja",
    display_name: "Ninja",
    description: "Bodyweight-only split",
    sort_order: 4,
    is_selectable: true,
    status: "active",
    base_archetype: "hybrid",
  },
  {
    id: "monk",
    display_name: "Monk",
    description: "Future explosive split",
    sort_order: 5,
    is_selectable: false,
    status: "planned",
    base_archetype: "hybrid",
  },
];

const createStore = () => ({
  users: [{ id: "user-1", stats_json: createStats() }],
  classes: [...classRows],
  programs: [{ id: 2001, slug: "strength", name: "Strength Builder", is_active: true }],
  program_days: [{ id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" }],
  program_slots: [
    {
      id: 4001,
      program_day_id: 3001,
      slot_index: 0,
      slot_type: "main",
      movement_pattern: "push",
      sets_min: 4,
      sets_max: 5,
      reps_min: 6,
      reps_max: 8,
      muscle_targets: { chest: 1 },
      tags_required: ["compound"],
    },
    {
      id: 4002,
      program_day_id: 3001,
      slot_index: 1,
      slot_type: "main",
      movement_pattern: "pull",
      sets_min: 4,
      sets_max: 5,
      reps_min: 6,
      reps_max: 8,
      muscle_targets: { back: 1 },
      tags_required: ["compound"],
    },
    {
      id: 4003,
      program_day_id: 3001,
      slot_index: 2,
      slot_type: "accessory",
      movement_pattern: "push",
      sets_min: 3,
      sets_max: 4,
      reps_min: 10,
      reps_max: 12,
      muscle_targets: { triceps: 1 },
      tags_required: ["hypertrophy"],
    },
  ],
  exercises: [
    {
      id: 5001,
      slug: "bench-press",
      name: "Bench Press",
      movement_pattern: "push",
      equipment: ["barbell", "bench"],
      tags: ["compound"],
      contraindications: [],
      is_bodyweight: false,
    },
    {
      id: 5002,
      slug: "push-up",
      name: "Push-Up",
      movement_pattern: "push",
      equipment: [],
      tags: ["bodyweight", "compound"],
      contraindications: [],
      is_bodyweight: true,
    },
  ],
  exercise_muscle_map: [] as Array<Record<string, unknown>>,
  muscle_groups: [{ id: 1, slug: "shoulders", name: "Shoulders" }],
  engine_cycle_profiles: [] as Array<Record<string, unknown>>,
  engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
  engine_cycle_plans: [] as Array<Record<string, unknown>>,
  engine_cycle_sessions: [] as Array<Record<string, unknown>>,
  engine_gamification_states: [] as Array<Record<string, unknown>>,
});

const createEngineResponse = (resolvedClassArchetype: "strength" | "hybrid") => ({
  schemaVersion: "engine.v1",
  operation: "initialize_cycle",
  result: {
    resolvedClassArchetype,
    primaryProgramId: "2001",
    programBlend: [{ programId: "2001", weight: 1, role: "primary" }],
    macrocycle: {
      totalWeeks: 8,
      mesocycleCount: 2,
      currentMesocycleIndex: 0,
      currentMicrocycleIndex: 0,
      currentSessionIndex: 0,
      sessions: [
        {
          sessionId: "plan-1-w1-d1",
          programId: "2001",
          programDayId: "3001",
          programDayName: "Strength Day 1",
          macroWeek: 1,
          mesocycleIndex: 0,
          microcycleIndex: 0,
          sessionIndex: 0,
          plannedDayOfWeek: 0,
          classArchetype: resolvedClassArchetype,
          slotPayload: [],
        },
      ],
    },
    initialGamificationState: {
      ...richerGamificationState,
    },
  },
});

describe("initialize cycle class presets", () => {
  beforeEach(() => {
    const store = createStore();
    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockReset();
  });

  it("persists classless preset ids and maps them to the transitional hybrid archetype", async () => {
    const store = createStore();
    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockResolvedValue(createEngineResponse("hybrid"));

    const result = await handleInitializeCycle("user-1", {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result.status).toBe("success");
    expect(store.engine_cycle_profiles[0]?.class_preset_id).toBe("classless");
    expect(store.engine_cycle_plans[0]?.class_preset_id).toBe("classless");
    expect(mockedRunEngineInput).toHaveBeenCalledWith(
      expect.objectContaining({
        stateSnapshot: expect.objectContaining({
          athleteProfile: expect.objectContaining({
            classArchetype: "hybrid",
          }),
        }),
        request: expect.objectContaining({
          profile: expect.objectContaining({
            classChoice: "hybrid",
          }),
        }),
      })
    );
  });

  it("caps bb payloads to one main slot while preserving accessory work", async () => {
    mockedRunEngineInput.mockResolvedValue(createEngineResponse("hybrid"));

    const result = await handleInitializeCycle("user-1", {
      classPresetId: "bb",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result.status).toBe("success");
    expect(mockedRunEngineInput).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          selectedPrograms: [
            expect.objectContaining({
              days: [
                expect.objectContaining({
                  slots: [
                    expect.objectContaining({ slotType: "main" }),
                    expect.objectContaining({ slotType: "accessory" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      })
    );
    const shapedSlots = firstEngineInput().request.selectedPrograms[0].days[0].slots;
    expect(shapedSlots.filter((slot: { slotType: string }) => slot.slotType === "main")).toHaveLength(1);
  });

  it("lowers powa rep ranges only on compound main slots", async () => {
    mockedRunEngineInput.mockResolvedValue(createEngineResponse("strength"));

    const result = await handleInitializeCycle("user-1", {
      classPresetId: "powa",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result.status).toBe("success");
    const shapedSlots = firstEngineInput().request.selectedPrograms[0].days[0].slots;
    expect(shapedSlots[0]).toMatchObject({ slotType: "main" });
    expect(shapedSlots[0].repsMin).toBeLessThan(6);
    expect(shapedSlots[0].repsMax).toBeLessThan(8);
    expect(shapedSlots[2]).toMatchObject({ slotType: "accessory", repsMin: 10, repsMax: 12 });
  });

  it("rejects ninja plans that cannot be satisfied by bodyweight exercises", async () => {
    const store = createStore();
    store.exercises = store.exercises.filter((exercise) => exercise.is_bodyweight === false);
    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleInitializeCycle("user-1", {
      classPresetId: "ninja",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Selected program templates are incompatible with the ninja class preset"],
    });
    expect(mockedRunEngineInput).not.toHaveBeenCalled();
  });

  it("injects bodyweight requirements and reference exercises for ninja", async () => {
    mockedRunEngineInput.mockResolvedValue(createEngineResponse("hybrid"));

    const result = await handleInitializeCycle("user-1", {
      classPresetId: "ninja",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result.status).toBe("success");
    expect(mockedRunEngineInput).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceSnapshot: expect.objectContaining({
          exercises: expect.arrayContaining([
            expect.objectContaining({
              id: "5002",
              tags: expect.arrayContaining(["bodyweight"]),
            }),
          ]),
        }),
      })
    );
    const shapedSlots = firstEngineInput().request.selectedPrograms[0].days[0].slots;
    expect(shapedSlots[0].tagsRequired).toContain("bodyweight");
  });

  it("sanitizes nested exercise equipment arrays before invoking the engine", async () => {
    const store = createStore();
    store.exercises[0].equipment = [["dumbbell", "barbell", "machine"]] as unknown as string[];
    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockResolvedValue(createEngineResponse("hybrid"));

    const result = await handleInitializeCycle("user-1", {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: [],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result.status).toBe("success");
    expect(mockedRunEngineInput).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceSnapshot: expect.objectContaining({
          exercises: expect.arrayContaining([
            expect.objectContaining({
              id: "5001",
              equipment: ["dumbbell", "barbell", "machine"],
            }),
          ]),
        }),
      })
    );
  });
});
