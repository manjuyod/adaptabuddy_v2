"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import {
  ActivateProgramInputSchema,
  type ActivateProgramResult,
  type ActiveProgram
} from "./contracts";
import {
  getProgramById,
  getUserActiveCycleView,
  updateUserActiveProgram,
} from "./service";

/**
 * Server action to activate a program for the current user
 */
export async function activateProgramAction(
  programId: number
): Promise<ActivateProgramResult> {
  // Validate input
  const parsed = ActivateProgramInputSchema.safeParse({ programId });
  if (!parsed.success) {
    return { success: false, error: "Invalid program ID" };
  }

  const supabase = await createSupabaseServerActionClient();

  // Get current user
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  const { activeCycleView, error: activeCycleError } = await getUserActiveCycleView(
    supabase,
    user.id
  );

  if (activeCycleError) {
    return { success: false, error: activeCycleError };
  }

  if (activeCycleView?.source === "normalized") {
    return {
      success: false,
      error: "Cannot manually activate a legacy program while a normalized cycle is active",
    };
  }

  // Verify program exists and is active
  const { program, error: programError } = await getProgramById(
    supabase,
    parsed.data.programId
  );

  if (programError || !program) {
    return { success: false, error: programError ?? "Program not found" };
  }

  if (!program.is_active) {
    return { success: false, error: "Program is not available" };
  }

  // Create the active program object
  // Note: The ActiveProgramSchema expects programId as a UUID string,
  // but our database uses integer IDs. We convert to string for storage.
  const activeProgram: ActiveProgram = {
    programId: program.id.toString(),
    startedAt: new Date().toISOString(),
    currentDayIndex: 0,
    currentMicrocycle: 1,
    daysPerWeek: program.default_days_per_week
  };

  // Update user's stats_json
  const { success, error: updateError } = await updateUserActiveProgram(
    supabase,
    user.id,
    activeProgram
  );

  if (!success) {
    return { success: false, error: updateError ?? "Failed to activate program" };
  }

  // Revalidate the programs page and dashboard
  revalidatePath("/programs");
  revalidatePath("/dashboard");

  return { success: true, activeProgram };
}
