import { randomUUID } from "crypto";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { buildChaosBlock } from "@adaptabuddy/core";
import type { ChaosPlanRequest, ChaosPlanResponse } from "./contracts";
import {
  toProgramTemplate,
  type TemplateProgramDayRow,
  type TemplateProgramRow,
  type TemplateProgramSlotRow,
} from "@/lib/db-transformers";
import { toLookupIds } from "@/lib/ids";
import { logServerEvent } from "@/lib/observability/logger";

type TemplateProgramDbRow = {
  id: string | number;
  name: string;
  default_days_per_week: number | null;
};

type TemplateProgramDayDbRow = {
  id: string | number;
  program_id: string | number;
  day_index: number;
  name: string;
};

type TemplateProgramSlotDbRow = {
  id: string | number;
  program_day_id: string | number;
  slot_index: number;
  slot_type:
    | "main"
    | "accessory"
    | "conditioning"
    | "warmup"
    | "cooldown"
    | null;
  muscle_targets: Record<string, number> | null;
  sets_min: number;
  sets_max: number;
  reps_min: number;
  reps_max: number;
  rir_min: number | null;
  rir_max: number | null;
  tags_required: string[] | null;
  movement_pattern: string | null;
};

// -----------------------------------------------------------------------------
// Chaos Plan Handler
// -----------------------------------------------------------------------------

export async function handleChaosPlan(
  _userId: string,
  input: ChaosPlanRequest
): Promise<ChaosPlanResponse> {
  const supabase = await createSupabaseServerActionClient();

  try {
    // 1. Load program templates
    const { data: programs, error: programError } = await supabase
      .from("programs")
      .select("id, name, default_days_per_week")
      .in("id", toLookupIds(input.templateIds));

    if (programError) {
      return {
        status: "error",
        errors: ["Failed to load program templates"],
      };
    }

    if (!programs || programs.length === 0) {
      return {
        status: "error",
        errors: ["No matching program templates found"],
      };
    }

    const programIds = programs.map((program) => program.id);

    // 2. Load program days
    const { data: days, error: daysError } = await supabase
      .from("program_days")
      .select("id, program_id, day_index, name")
      .in("program_id", programIds)
      .order("day_index", { ascending: true });

    if (daysError) {
      return {
        status: "error",
        errors: ["Failed to load program days"],
      };
    }

    if (!days || days.length === 0) {
      return {
        status: "error",
        errors: ["Program templates have no configured days"],
      };
    }

    const dayIds = days.map((day) => day.id);

    // 3. Load program slots
    const { data: slots, error: slotsError } = await supabase
      .from("program_slots")
      .select(
        `id, program_day_id, slot_index, slot_type, muscle_targets,
         sets_min, sets_max, reps_min, reps_max, rir_min, rir_max,
         tags_required, movement_pattern`
      )
      .in("program_day_id", dayIds)
      .order("slot_index", { ascending: true });

    if (slotsError) {
      return {
        status: "error",
        errors: ["Failed to load program slots"],
      };
    }

    // 4. Transform DB rows to ProgramTemplate
    const templates = programs
      .map((program) => {
        const programDays = (days as TemplateProgramDayDbRow[])
          .filter((day) => String(day.program_id) === String(program.id))
          .map((day) => ({
            id: day.id,
            program_id: day.program_id,
            day_index: day.day_index,
            name: day.name,
            intensity_target: "moderate" as const,
            volume_multiplier: 1,
          }));

        if (programDays.length === 0) {
          return null;
        }

        const programSlots = ((slots ?? []) as TemplateProgramSlotDbRow[])
          .filter((slot) =>
            programDays.some((day) => String(day.id) === String(slot.program_day_id))
          )
          .map((slot) => ({
            id: slot.id,
            program_day_id: slot.program_day_id,
            slot_index: slot.slot_index,
            slot_type: slot.slot_type,
            muscle_targets: slot.muscle_targets,
            sets_min: slot.sets_min,
            sets_max: slot.sets_max,
            reps_min: slot.reps_min,
            reps_max: slot.reps_max,
            rir_min: slot.rir_min,
            rir_max: slot.rir_max,
            tags: slot.tags_required ?? [],
            movement_pattern: slot.movement_pattern,
          }));

        const templateProgram: TemplateProgramRow = {
          id: program.id,
          name: program.name,
          days_per_week: (program as TemplateProgramDbRow).default_days_per_week ?? 1,
          volume_distribution: {},
        };

        return toProgramTemplate(
          templateProgram,
          programDays as TemplateProgramDayRow[],
          programSlots as TemplateProgramSlotRow[]
        );
      })
      .filter((template): template is NonNullable<typeof template> => Boolean(template));

    if (templates.length === 0) {
      return {
        status: "error",
        errors: ["No usable templates found for chaos planning"],
      };
    }

    // 5. Generate chaos block plan
    const seed = input.seed ?? randomUUID();
    const planDetail = buildChaosBlock({
      templates,
      weeks: input.weeks,
      daysPerWeek: input.daysPerWeek,
      seed,
      mode: input.mode,
    });

    const plan = {
      seed: planDetail.seed,
      weeks: planDetail.weeks,
      daysPerWeek: planDetail.daysPerWeek,
      sessions: planDetail.sessions.map((session) => ({
        weekNumber: session.weekNumber,
        dayIndex: session.dayIndex,
        templateId: session.templateId,
        templateName: session.templateName,
        sourceDayIndex: session.sourceDayIndex,
      })),
    };

    return {
      status: "success",
      plan,
    };
  } catch (error) {
    logServerEvent({
      route: "/api/v0/chaos/plan",
      action: "handleChaosPlan",
      severity: "error",
      reason: "unexpected_error",
      error,
    });
    return {
      status: "error",
      errors: ["An unexpected error occurred"],
    };
  }
}
