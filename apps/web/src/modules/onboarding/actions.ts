"use server";

import { revalidatePath } from "next/cache";
import type { UserStats } from "@adaptabuddy/contracts";
import { getDefaultUserStats } from "@/lib/db-transformers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { getProgramById } from "@/modules/programs/service";
import {
  CompleteOnboardingInputSchema,
  type CompleteOnboardingInput,
  type CompleteOnboardingResult,
} from "./contracts";

const normalizeList = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0),
    ),
  );

export async function completeOnboarding(
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> {
  const parsed = CompleteOnboardingInputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Invalid onboarding input." };
  }

  const supabase = await createSupabaseServerActionClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", error: "Not authenticated." };
  }

  const { program, error: programError } = await getProgramById(
    supabase,
    parsed.data.programId,
  );
  if (programError || !program || !program.is_active) {
    return { status: "error", error: "Selected program is unavailable." };
  }

  const { data: userRow, error: userLoadError } = await supabase
    .from("users")
    .select("stats_json")
    .eq("id", user.id)
    .single();

  if (userLoadError) {
    return { status: "error", error: "Failed to load user profile." };
  }

  const defaults = getDefaultUserStats();
  const currentStats = (userRow?.stats_json as UserStats | null) ?? defaults;
  const currentPreferences = currentStats.preferences ?? defaults.preferences;
  const now = new Date().toISOString();
  const { data: activePlanRow, error: activePlanError } = await supabase
    .from("engine_cycle_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (activePlanError) {
    return { status: "error", error: "Failed to inspect normalized cycle state." };
  }

  const nextStats: UserStats = {
    ...currentStats,
    activeProgram: activePlanRow
      ? currentStats.activeProgram
      : {
          programId: program.id.toString(),
          startedAt: now,
          currentDayIndex: 0,
          currentMicrocycle: 1,
          daysPerWeek: program.default_days_per_week,
        },
    preferences: {
      ...defaults.preferences,
      ...currentPreferences,
      fatigueLevel: parsed.data.fatigueLevel,
      equipment: normalizeList(parsed.data.equipment),
      unitSystem: parsed.data.unitSystem,
    },
  };

  const writeClient = createSupabaseAdminClient() ?? supabase;
  const { error: updateError } = await writeClient
    .from("users")
    .update({
      has_save: true,
      stats_json: nextStats,
    })
    .eq("id", user.id);

  if (updateError) {
    return { status: "error", error: "Failed to save onboarding choices." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/start");
  revalidatePath("/title/start");
  revalidatePath("/title/continue");

  return { status: "success" };
}
