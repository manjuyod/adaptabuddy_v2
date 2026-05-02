import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { resolveTemplate } from "@adaptabuddy/core";
import type { ResolveTemplateRequest, ResolveTemplateResponse } from "./contracts";
import {
  toProgramTemplate,
  type TemplateProgramDayRow,
  type TemplateProgramRow,
  type TemplateProgramSlotRow,
} from "@/lib/db-transformers";
import { toLookupId } from "@/lib/ids";
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
// Resolve Template Handler
// -----------------------------------------------------------------------------

export async function handleResolveTemplate(
  userId: string,
  input: ResolveTemplateRequest
): Promise<ResolveTemplateResponse> {
  const supabase = await createSupabaseServerActionClient();

  try {
    // 1. Load program by templateId
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id, name, default_days_per_week")
      .eq("id", toLookupId(input.templateId))
      .single();

    if (programError || !program) {
      return {
        status: "error",
        errors: ["Program template not found"],
      };
    }

    // 2. Load program days
    const { data: days, error: daysError } = await supabase
      .from("program_days")
      .select("id, program_id, day_index, name")
      .eq("program_id", toLookupId(input.templateId))
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
        errors: ["Program has no configured days"],
      };
    }

    // 3. Load program slots for all days
    const dayIds = days.map((d) => d.id);
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
    const templateProgram: TemplateProgramRow = {
      id: program.id,
      name: program.name,
      days_per_week: (program as TemplateProgramDbRow).default_days_per_week ?? 1,
      volume_distribution: {},
    };

    const templateDays: TemplateProgramDayRow[] = (days as TemplateProgramDayDbRow[]).map(
      (day) => ({
        id: day.id,
        program_id: day.program_id,
        day_index: day.day_index,
        name: day.name,
        intensity_target: "moderate",
        volume_multiplier: 1,
      })
    );

    const templateSlots: TemplateProgramSlotRow[] = ((slots ?? []) as TemplateProgramSlotDbRow[]).map(
      (slot) => ({
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
      })
    );

    const template = toProgramTemplate(templateProgram, templateDays, templateSlots);

    // 5. Call engine to resolve template for the given week/day
    const sessionRequirement = resolveTemplate({
      template,
      weekNumber: input.weekNumber ?? 1,
      dayNumber: input.dayNumber ?? 0,
    });

    return {
      status: "success",
      sessionRequirement,
    };
  } catch (error) {
    logServerEvent({
      route: "/api/v0/templates/resolve",
      action: "handleResolveTemplate",
      severity: "error",
      reason: "unexpected_error",
      userId,
      error,
    });
    return {
      status: "error",
      errors: ["An unexpected error occurred"],
    };
  }
}
