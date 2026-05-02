import { redirect } from "next/navigation";
import { createSupabaseServerComponentClient } from "@/lib/supabase/next";
import { getProgramCatalog, getUserActiveCycleView } from "@/modules/programs/service";
import { ProgramsClient } from "./programs-client";

export default async function ProgramsPage() {
  const supabase = await createSupabaseServerComponentClient();

  // Check authentication
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch available programs and user's active program in parallel
  const [programsResult, activeProgramResult] = await Promise.all([
    getProgramCatalog(supabase),
    getUserActiveCycleView(supabase, user.id)
  ]);

  return (
    <ProgramsClient
      programs={programsResult.programs}
      activeCycleView={activeProgramResult.activeCycleView}
      fetchError={programsResult.error ?? activeProgramResult.error}
    />
  );
}

