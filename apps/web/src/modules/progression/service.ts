import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { generateLoadRecommendations } from "@adaptabuddy/core";
import type { ProgressionRecommendRequest, ProgressionRecommendResponse } from "./contracts";
import type { UserStats } from "@adaptabuddy/contracts";
import { getDefaultUserStats } from "@/lib/db-transformers";
import { toStringId } from "@/lib/ids";
import { logServerEvent } from "@/lib/observability/logger";

// -----------------------------------------------------------------------------
// Progression Recommend Handler
// -----------------------------------------------------------------------------

export async function handleProgressionRecommend(
  userId: string,
  input: ProgressionRecommendRequest
): Promise<ProgressionRecommendResponse> {
  const supabase = await createSupabaseServerActionClient();

  try {
    // 1. Load user stats
    const { data: user } = await supabase
      .from("users")
      .select("stats_json")
      .eq("id", userId)
      .single();

    const userStats: UserStats = (user?.stats_json as UserStats) ?? getDefaultUserStats();

    // 2. Build input for load recommendation engine
    const exercisesForLoad = input.exerciseIds.map((exerciseId) => ({
      exerciseId: toStringId(exerciseId),
      repsMin: input.repsMin,
      repsMax: input.repsMax,
    }));

    const recommendations = generateLoadRecommendations(
      exercisesForLoad,
      userStats.capacities
    );

    return {
      status: "success",
      recommendations,
    };
  } catch (error) {
    logServerEvent({
      route: "/api/v0/progression/recommend",
      action: "handleProgressionRecommend",
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
