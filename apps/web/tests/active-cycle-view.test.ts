import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase } from "./helpers/mockSupabase";
import { getUserActiveCycleView } from "../src/modules/programs/service";

describe("getUserActiveCycleView", () => {
  it("prefers normalized active cycle state over conflicting stats_json activeProgram data", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const supabase = createMockSupabase({
      users: [
        {
          id: userId,
          stats_json: {
            activeProgram: {
              programId: "9999",
              startedAt: "2026-02-01T00:00:00.000Z",
              currentDayIndex: 2,
              currentMicrocycle: 4,
              daysPerWeek: 5,
            },
          },
        },
      ],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          profile_id: 10,
          primary_program_id: 2001,
          class_preset_id: "classless",
          resolved_class_archetype: "hybrid",
          current_session_index: 3,
          is_active: true,
          created_at: "2026-03-01T00:00:00.000Z",
        },
      ],
      engine_cycle_profiles: [
        {
          id: 10,
          user_id: userId,
          available_days_per_week: 3,
        },
      ],
      engine_cycle_sessions: [
        {
          id: 21,
          plan_id: 1,
          user_id: userId,
          session_index: 3,
          program_day_id: 3004,
          program_day_name: "Normalized Day 4",
          planned_day_of_week: 0,
          microcycle_index: 1,
        },
      ],
    });

    const result = await getUserActiveCycleView(
      supabase as unknown as SupabaseClient,
      userId
    );

    expect(result.error).toBeUndefined();
    expect(result.activeCycleView).toEqual({
      source: "normalized",
      status: "active",
      programId: "2001",
      startedAt: "2026-03-01T00:00:00.000Z",
      daysPerWeek: 3,
      currentDayIndex: 0,
      currentMicrocycle: 2,
      programDayId: "3004",
      programDayName: "Normalized Day 4",
      classPresetId: "classless",
      resolvedClassArchetype: "hybrid",
    });
  });

  it("returns a completed normalized view when the active plan has reached terminal cursor state", async () => {
    const userId = "22222222-2222-2222-2222-222222222222";
    const supabase = createMockSupabase({
      users: [
        {
          id: userId,
          stats_json: {
            activeProgram: {
              programId: "9999",
              startedAt: "2026-02-01T00:00:00.000Z",
              currentDayIndex: 1,
              currentMicrocycle: 3,
              daysPerWeek: 4,
            },
          },
        },
      ],
      engine_cycle_plans: [
        {
          id: 2,
          user_id: userId,
          profile_id: 11,
          primary_program_id: 2002,
          class_preset_id: "powa",
          resolved_class_archetype: "strength",
          current_session_index: 9,
          is_active: true,
          created_at: "2026-03-10T00:00:00.000Z",
        },
      ],
      engine_cycle_profiles: [
        {
          id: 11,
          user_id: userId,
          available_days_per_week: 4,
        },
      ],
      engine_cycle_sessions: [],
    });

    const result = await getUserActiveCycleView(
      supabase as unknown as SupabaseClient,
      userId
    );

    expect(result.error).toBeUndefined();
    expect(result.activeCycleView).toEqual({
      source: "normalized",
      status: "completed",
      programId: "2002",
      startedAt: "2026-03-10T00:00:00.000Z",
      daysPerWeek: 4,
      currentDayIndex: null,
      currentMicrocycle: null,
      programDayId: null,
      programDayName: null,
      classPresetId: "powa",
      resolvedClassArchetype: "strength",
    });
  });

  it("surfaces null when a normalized active plan contains a historical legacy token", async () => {
    const userId = "44444444-4444-4444-4444-444444444444";
    const supabase = createMockSupabase({
      users: [
        {
          id: userId,
          stats_json: {
            activeProgram: {
              programId: "9999",
              startedAt: "2026-02-01T00:00:00.000Z",
              currentDayIndex: 2,
              currentMicrocycle: 4,
              daysPerWeek: 5,
            },
          },
        },
      ],
      engine_cycle_plans: [
        {
          id: 4,
          user_id: userId,
          profile_id: 12,
          class_preset_id: "classless",
          primary_program_id: 2004,
          resolved_class_archetype: "legacy",
          current_session_index: 0,
          is_active: true,
          created_at: "2026-03-12T00:00:00.000Z",
        },
      ],
      engine_cycle_profiles: [
        {
          id: 12,
          user_id: userId,
          available_days_per_week: 3,
        },
      ],
      engine_cycle_sessions: [
        {
          id: 31,
          plan_id: 4,
          user_id: userId,
          session_index: 0,
          program_day_id: 3010,
          program_day_name: "Legacy Normalized Day",
          planned_day_of_week: 1,
          microcycle_index: 0,
        },
      ],
    });

    const result = await getUserActiveCycleView(
      supabase as unknown as SupabaseClient,
      userId
    );

    expect(result.error).toBeUndefined();
    expect(result.activeCycleView).toEqual({
      source: "normalized",
      status: "active",
      programId: "2004",
      startedAt: "2026-03-12T00:00:00.000Z",
      daysPerWeek: 3,
      currentDayIndex: 1,
      currentMicrocycle: 1,
      programDayId: "3010",
      programDayName: "Legacy Normalized Day",
      classPresetId: "classless",
      resolvedClassArchetype: null,
    });
  });

  it("falls back to legacy activeProgram only when no normalized active plan exists", async () => {
    const userId = "33333333-3333-3333-3333-333333333333";
    const supabase = createMockSupabase({
      users: [
        {
          id: userId,
          stats_json: {
            activeProgram: {
              programId: "2003",
              startedAt: "2026-02-01T00:00:00.000Z",
              currentDayIndex: 1,
              currentMicrocycle: 2,
              daysPerWeek: 4,
            },
          },
        },
      ],
      engine_cycle_plans: [],
      engine_cycle_profiles: [],
      engine_cycle_sessions: [],
      program_days: [
        {
          id: 3007,
          program_id: 2003,
          day_index: 1,
          name: "Legacy Day 2",
        },
      ],
    });

    const result = await getUserActiveCycleView(
      supabase as unknown as SupabaseClient,
      userId
    );

    expect(result.error).toBeUndefined();
    expect(result.activeCycleView).toEqual({
      source: "legacy",
      status: "active",
      programId: "2003",
      startedAt: "2026-02-01T00:00:00.000Z",
      daysPerWeek: 4,
      currentDayIndex: 1,
      currentMicrocycle: 2,
      programDayId: "3007",
      programDayName: "Legacy Day 2",
      classPresetId: null,
      resolvedClassArchetype: null,
    });
  });
});
