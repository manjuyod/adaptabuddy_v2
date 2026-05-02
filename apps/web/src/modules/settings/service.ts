import type {
  PreferencesUpdateRequest,
  PreferencesUpdateResponse,
  UserStats,
} from "@adaptabuddy/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDefaultUserStats } from "@/lib/db-transformers";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { logServerEvent } from "@/lib/observability/logger";

const normalizeList = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0)
    )
  );

export async function handlePreferencesUpdate(
  userId: string,
  input: PreferencesUpdateRequest
): Promise<PreferencesUpdateResponse> {
  const supabase = await createSupabaseServerActionClient();

  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("stats_json")
      .eq("id", userId)
      .single();

    if (userError) {
      return {
        status: "error",
        errors: ["Failed to load user data"],
      };
    }

    const currentStats: UserStats = (user?.stats_json as UserStats) ?? getDefaultUserStats();
    const defaults = getDefaultUserStats().preferences;
    const currentPreferences = currentStats.preferences ?? defaults;

    const updatedPreferences = {
      ...currentPreferences,
      fatigueLevel: input.fatigueLevel ?? currentPreferences.fatigueLevel,
      equipment: input.equipment
        ? normalizeList(input.equipment)
        : currentPreferences.equipment ?? defaults.equipment,
      injuries: input.injuries
        ? normalizeList(input.injuries)
        : currentPreferences.injuries ?? defaults.injuries,
      unitSystem:
        input.display?.unitSystem ??
        currentPreferences.unitSystem ??
        defaults.unitSystem,
      theme: input.display?.theme ?? currentPreferences.theme ?? defaults.theme,
    };

    const updatedStats: UserStats = {
      ...currentStats,
      preferences: updatedPreferences,
    };

    const writeClient = createSupabaseAdminClient() ?? supabase;
    const { error: updateError } = await writeClient
      .from("users")
      .update({ stats_json: updatedStats })
      .eq("id", userId);

    if (updateError) {
      return {
        status: "error",
        errors: ["Failed to update preferences"],
      };
    }

    return {
      status: "success",
      preferences: {
        fatigueLevel: updatedPreferences.fatigueLevel,
        equipment: updatedPreferences.equipment,
        injuries: updatedPreferences.injuries,
        unitSystem: updatedPreferences.unitSystem,
        theme: updatedPreferences.theme,
      },
    };
  } catch (error) {
    logServerEvent({
      route: "/api/v0/preferences/update",
      action: "handlePreferencesUpdate",
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
