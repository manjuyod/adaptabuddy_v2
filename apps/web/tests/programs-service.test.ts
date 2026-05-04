import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProgramCatalog } from "@/modules/programs/service";

type QueryResult = {
  data: unknown[];
  error: null;
};

const createCatalogSupabase = () => {
  const programs: QueryResult = {
    data: [
      {
        id: 9,
        slug: "100_push_ups_challenge_3_group_6_week",
        name: "100 Push-Ups Challenge (3-Group / 6-Week)",
        description: "Adaptive challenge fixture",
        default_days_per_week: 3,
        min_days_per_week: 3,
        max_days_per_week: 3,
        is_active: true,
        metadata: {
          adaptive_template_family: "challenge_progression",
          source_template_json: {
            challenge: "100_pushups",
            exercise: { slug: "push_up", canonical_name: "Push-Up" },
            frequency_per_week: 3,
            groups: { group_1: { weeks: [] } },
            initial_test_groups: [{ group: "group_1", min: 0, max: 10 }],
          },
        },
      },
      {
        id: 10,
        slug: "broken_slotless_static",
        name: "Broken Slotless Static",
        description: "Invalid static fixture",
        default_days_per_week: 1,
        min_days_per_week: 1,
        max_days_per_week: 1,
        is_active: true,
        metadata: {},
      },
      {
        id: 1,
        slug: "dup_powerlifting",
        name: "DUP Powerlifting",
        description: "Complete training template",
        default_days_per_week: 3,
        min_days_per_week: 3,
        max_days_per_week: 4,
        is_active: true,
      },
    ],
    error: null,
  };

  const days: QueryResult = {
    data: [
      {
        id: 9001,
        program_id: 9,
        day_index: 0,
        name: "100 Push-Ups Challenge (3-Group / 6-Week)",
        theme_tags: [],
      },
      {
        id: 10001,
        program_id: 10,
        day_index: 0,
        name: "Broken Static Day",
        theme_tags: [],
      },
      {
        id: 1001,
        program_id: 1,
        day_index: 0,
        name: "Day 1",
        theme_tags: [],
      },
    ],
    error: null,
  };

  const slots: QueryResult = {
    data: [
      {
        id: 5001,
        program_day_id: 1001,
        slot_index: 0,
        slot_type: "main",
        lock_type: "flex",
        locked_exercise_id: null,
        movement_pattern: "squat",
        equipment_allowed: [],
        tags_required: [],
        tags_blocked: [],
        sets_min: 3,
        sets_max: 5,
        reps_min: 3,
        reps_max: 5,
        rir_min: 1,
        rir_max: 3,
        muscle_targets: { quads: 1 },
        prescription: {},
        is_optional: false,
      },
    ],
    error: null,
  };

  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: async () => programs,
        }),
        in: () => ({
          order: async () => (table === "program_days" ? days : slots),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
};

describe("getProgramCatalog", () => {
  it("includes valid adaptive programs and excludes invalid slotless static programs", async () => {
    const result = await getProgramCatalog(createCatalogSupabase());

    expect(result.error).toBeUndefined();
    expect(result.programs.map((program) => program.id)).toEqual([9, 1]);
    expect(result.programs[0]).toMatchObject({
      id: 9,
      templateKind: "challenge_progression",
      adaptiveSummary: "Adaptive challenge progression for Push-Up",
      challengeExerciseSlug: "push_up",
      challengeExerciseLabel: "Push-Up",
      days: [],
    });
    expect(result.programs[0]).not.toHaveProperty("metadata");
    expect(result.programs[1]?.days[0]?.slots).toHaveLength(1);
  });
});
