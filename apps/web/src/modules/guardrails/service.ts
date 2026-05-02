import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import type { GuardrailRequest, GuardrailResponse } from "./contracts";
import type { UserStats } from "@adaptabuddy/contracts";
import { evaluateRequest, type GuardrailContext } from "@adaptabuddy/core";
import { buildFatigueState, getDefaultUserStats } from "@/lib/db-transformers";
import { DEFAULT_OPT_INS } from "@adaptabuddy/contracts";
import { logServerEvent } from "@/lib/observability/logger";

// -----------------------------------------------------------------------------
// Guardrail Evaluation Handler
// -----------------------------------------------------------------------------

export async function handleGuardrailEvaluate(
  userId: string,
  input: GuardrailRequest
): Promise<GuardrailResponse> {
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

    const context: GuardrailContext = {
      fatigueState: buildFatigueState(userStats),
      optIns: userStats.preferences.optIns ?? { ...DEFAULT_OPT_INS },
      injuries: userStats.preferences.injuries ?? [],
    };

    const evaluation = evaluateRequest(input, context);

    return {
      status: "success",
      evaluation,
    };
  } catch (error) {
    logServerEvent({
      route: "/api/v0/guardrails/evaluate",
      action: "handleGuardrailEvaluate",
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
