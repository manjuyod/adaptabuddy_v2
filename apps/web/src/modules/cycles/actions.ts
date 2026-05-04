"use server";

import { revalidatePath } from "next/cache";
import { InitializeCycleRequestSchema } from "@adaptabuddy/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { handleInitializeCycle } from "./service";

export async function startNextSeasonFromTransition(formData: FormData): Promise<void> {
  const transitionId = Number(formData.get("transitionId") ?? "");
  if (!Number.isFinite(transitionId) || transitionId <= 0) {
    return;
  }

  const supabase = await createSupabaseServerActionClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return;
  }

  const { data: activePlanRow, error: activePlanError } = await supabase
    .from("engine_cycle_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (activePlanError || !activePlanRow) {
    return;
  }

  const { data: transitionRow, error: transitionError } = await supabase
    .from("engine_cycle_transitions")
    .select("id, user_id, plan_id, next_cycle_request, status")
    .eq("id", transitionId)
    .eq("user_id", user.id)
    .eq("plan_id", activePlanRow.id)
    .eq("status", "recommended")
    .maybeSingle();

  if (transitionError || !transitionRow) {
    return;
  }

  const parsedRequest = InitializeCycleRequestSchema.safeParse(
    transitionRow.next_cycle_request
  );
  if (!parsedRequest.success) {
    return;
  }

  const writeClient = createSupabaseAdminClient();
  if (!writeClient) {
    return;
  }

  const { data: claimedTransition, error: claimError } = await writeClient
    .from("engine_cycle_transitions")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .eq("id", transitionId)
    .eq("user_id", user.id)
    .eq("plan_id", activePlanRow.id)
    .eq("status", "recommended")
    .select("id")
    .maybeSingle();

  if (claimError || !claimedTransition) {
    return;
  }

  const initializeResult = await handleInitializeCycle(user.id, parsedRequest.data);
  if (initializeResult.status === "error") {
    await writeClient
      .from("engine_cycle_transitions")
      .update({ status: "recommended", applied_at: null })
      .eq("id", transitionId)
      .eq("user_id", user.id)
      .eq("plan_id", activePlanRow.id)
      .eq("status", "applied");
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath("/workout");
  revalidatePath("/programs");

  return;
}
