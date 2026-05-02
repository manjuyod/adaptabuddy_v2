import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import type { OptInUpdateRequest, OptInUpdateResponse } from "./contracts";
import type { UserStats } from "@adaptabuddy/contracts";
import { getDefaultUserStats } from "@/lib/db-transformers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logServerEvent } from "@/lib/observability/logger";

// -----------------------------------------------------------------------------
// Opt-In Update Handler
// -----------------------------------------------------------------------------

export async function handleOptInUpdate(
  userId: string,
  input: OptInUpdateRequest
): Promise<OptInUpdateResponse> {
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
    const currentAcknowledged = currentStats.preferences.acknowledgedRisks ?? [];
    const mergedAcknowledged = input.acknowledgedRisks
      ? Array.from(new Set([...currentAcknowledged, ...input.acknowledgedRisks]))
      : currentAcknowledged;

    const nextOptIns =
      input.optIns ?? currentStats.preferences.optIns ?? getDefaultUserStats().preferences.optIns;

    const updatedStats: UserStats = {
      ...currentStats,
      preferences: {
        ...currentStats.preferences,
        optIns: nextOptIns,
        acknowledgedRisks: mergedAcknowledged,
      },
    };

    const writeClient = createSupabaseAdminClient() ?? supabase;
    const { error: updateError } = await writeClient
      .from("users")
      .update({ stats_json: updatedStats })
      .eq("id", userId);

    if (updateError) {
      return {
        status: "error",
        errors: ["Failed to update opt-ins"],
      };
    }

    return {
      status: "success",
      optIns: updatedStats.preferences.optIns,
      acknowledgedRisks: updatedStats.preferences.acknowledgedRisks,
    };
  } catch (error) {
    logServerEvent({
      route: "/api/v0/optins/update",
      action: "handleOptInUpdate",
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
