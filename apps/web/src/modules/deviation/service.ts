import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { analyzeDeviation, projectImpact, rebalancePlan } from "@adaptabuddy/core";
import type {
  DeviationAnalyzeRequest,
  DeviationAnalyzeResponse,
  UserStats,
} from "@adaptabuddy/contracts";
import { buildFatigueState, getDefaultUserStats } from "@/lib/db-transformers";
import { logServerEvent } from "@/lib/observability/logger";

// -----------------------------------------------------------------------------
// Deviation Analyze Handler
// -----------------------------------------------------------------------------

export async function handleDeviationAnalyze(
  userId: string,
  input: DeviationAnalyzeRequest
): Promise<DeviationAnalyzeResponse> {
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

    const userStats: UserStats = (user?.stats_json as UserStats) ?? getDefaultUserStats();
    const fatigueState = buildFatigueState(userStats);

    const analysis = analyzeDeviation(input.plannedSession, input.actualSession);
    const rebalancedPlan = rebalancePlan(input.remainingPlan, analysis, fatigueState);
    const projection = projectImpact(analysis, input.remainingPlan);

    return {
      status: "success",
      analysis,
      rebalancedPlan,
      projection,
    };
  } catch (error) {
    logServerEvent({
      route: "/api/v0/deviation/analyze",
      action: "handleDeviationAnalyze",
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
