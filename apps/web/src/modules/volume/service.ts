import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { logServerEvent } from "@/lib/observability/logger";
import { allocateVolume, type VolumeBudgetInput } from "@adaptabuddy/core";
import type { VolumeAllocateRequest, VolumeAllocateResponse } from "./contracts";
import type { UserStats } from "@adaptabuddy/contracts";
import { buildFatigueState, getDefaultUserStats } from "@/lib/db-transformers";

// -----------------------------------------------------------------------------
// Volume Allocate Handler
// -----------------------------------------------------------------------------

export async function handleVolumeAllocate(
  userId: string,
  input: VolumeAllocateRequest
): Promise<VolumeAllocateResponse> {
  const supabase = await createSupabaseServerActionClient();

  try {
    // 1. Load user stats
    const { data: user } = await supabase
      .from("users")
      .select("stats_json")
      .eq("id", userId)
      .single();

    const userStats: UserStats = (user?.stats_json as UserStats) ?? getDefaultUserStats();

    // 2. Extract fatigue state from user stats
    const fatigueState = buildFatigueState(userStats);

    // 3. Prepare input for the volume engine
    const volumeInput: VolumeBudgetInput = {
      totalSets: input.totalSets,
      musclePriorities: input.musclePriorities,
      trainingAge: input.trainingAge,
      fatigueState,
    };

    // 4. Call the volume allocation engine
    const allocation = allocateVolume(volumeInput);

    return {
      status: "success",
      allocation,
    };
  } catch (error) {
    logServerEvent({
      route: "/api/v0/volume/allocate",
      action: "handleVolumeAllocate",
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
