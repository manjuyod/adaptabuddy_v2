"use server";

import { revalidatePath } from "next/cache";
import type { InitializeCycleRequest, UserStats } from "@adaptabuddy/contracts";
import { getDefaultUserStats } from "@/lib/db-transformers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import {
  CompleteOnboardingInputSchema,
  type CompleteOnboardingInput,
  type CompleteOnboardingResult,
} from "./contracts";
import { handleInitializeCycle } from "../cycles/service";

const normalizeList = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0),
    ),
  );

const fatiguePreferenceToLevel = (
  value: InitializeCycleRequest["fatiguePreference"],
) => {
  if (value === "low") return "light";
  if (value === "high") return "hard";
  return "moderate";
};

const normalizeProgramWeights = (
  values: Array<{ programId: number; weight: number }>,
) => {
  const positiveWeights = values.filter((entry) => entry.weight > 0);
  const totalWeight = positiveWeights.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );

  if (totalWeight <= 0) {
    return [];
  }

  return positiveWeights.map((entry) => ({
    programId: entry.programId,
    weight: entry.weight / totalWeight,
  }));
};

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

  const normalizedPrograms = normalizeProgramWeights(
    parsed.data.selectedPrograms,
  );
  if (normalizedPrograms.length === 0) {
    return {
      status: "error",
      error: "Select at least one program with a positive weight.",
    };
  }

  const programAdaptationInputs = {
    challengeBaselines: parsed.data.challengeBaselines ?? {},
    ...(parsed.data.strengthBaselines
      ? { strengthBaselines: parsed.data.strengthBaselines }
      : {}),
  };

  const initializeCycleRequest: InitializeCycleRequest = {
    classPresetId: parsed.data.classPresetId,
    goalBias: parsed.data.goalBias,
    availableDaysPerWeek: parsed.data.availableDaysPerWeek,
    fatiguePreference: parsed.data.fatiguePreference,
    injuryMuscleGroupSlugs: normalizeList(parsed.data.injuryMuscleGroupSlugs),
    macrocycleWeeks: parsed.data.macrocycleWeeks,
    selectedPrograms: normalizedPrograms,
    ...(Object.keys(programAdaptationInputs.challengeBaselines).length > 0 ||
    programAdaptationInputs.strengthBaselines
      ? { programAdaptationInputs }
      : {}),
  };

  const initializeResult = await handleInitializeCycle(
    user.id,
    initializeCycleRequest,
  );
  if (initializeResult.status === "error") {
    return {
      status: "error",
      error: "Unable to complete onboarding. Please try again.",
    };
  }

  const { data: updatedUserRow, error: userLoadError } = await supabase
    .from("users")
    .select("stats_json")
    .eq("id", user.id)
    .single();

  if (userLoadError) {
    return { status: "error", error: "Failed to load onboarding profile." };
  }

  const defaults = getDefaultUserStats();
  const latestStats =
    (updatedUserRow?.stats_json as UserStats | null) ?? defaults;
  const latestPreferences = latestStats.preferences ?? defaults.preferences;
  const nextStats: UserStats = {
    ...latestStats,
    preferences: {
      ...defaults.preferences,
      ...latestPreferences,
      fatigueLevel: fatiguePreferenceToLevel(parsed.data.fatiguePreference),
      equipment: normalizeList(parsed.data.equipment),
      injuries: normalizeList(parsed.data.injuryMuscleGroupSlugs),
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
  revalidatePath("/workout");
  revalidatePath("/programs");
  revalidatePath("/start");
  revalidatePath("/title/start");
  revalidatePath("/title/continue");

  return { status: "success" };
}
