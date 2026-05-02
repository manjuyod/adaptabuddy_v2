import { redirect } from "next/navigation";
import { createSupabaseServerComponentClient } from "@/lib/supabase/next";
import { getProgramById, getUserActiveCycleView } from "@/modules/programs/service";
import { WorkoutClient } from "./workout-client";
import type { UserStats } from "@adaptabuddy/contracts";
import type { ActiveCycleView } from "@/modules/programs/contracts";

type ProgramDayInfo = {
  id: string;
  name: string;
  dayIndex: number;
};

type ProgramInfo = {
  name: string;
  daysPerWeek: number;
};

export type WorkoutPageData = {
  program: ProgramInfo;
  activeCycleView: ActiveCycleView;
  currentDay: ProgramDayInfo;
  userStats: UserStats;
};

export default async function WorkoutPage() {
  const supabase = await createSupabaseServerComponentClient();

  // Check authentication
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's active program
  const { activeCycleView, error: activeCycleError } = await getUserActiveCycleView(
    supabase,
    user.id
  );

  // If no active program, redirect to programs page
  if (!activeCycleView || activeCycleError) {
    redirect("/programs?message=no-active-program");
  }

  if (
    activeCycleView.status !== "active" ||
    activeCycleView.programDayId === null ||
    activeCycleView.currentDayIndex === null ||
    activeCycleView.currentMicrocycle === null
  ) {
    redirect("/programs?message=cycle-completed");
  }

  // Get program details
  const { program, error: programError } = await getProgramById(
    supabase,
    Number(activeCycleView.programId)
  );

  if (!program || programError) {
    redirect("/programs?message=program-not-found");
  }

  // Resolve the current program day from the normalized active cycle session.
  const { data: programDay, error: dayError } = await supabase
    .from("program_days")
    .select("id, name, day_index")
    .eq("id", Number(activeCycleView.programDayId))
    .single();

  if (dayError || !programDay) {
    redirect("/programs?message=cycle-completed");
  }

  // Current day found
  const currentDay: ProgramDayInfo = {
    id: String(programDay.id),
    name: programDay.name,
    dayIndex: programDay.day_index
  };

  // Get user stats
  const { data: userData } = await supabase
    .from("users")
    .select("stats_json")
    .eq("id", user.id)
    .single();

  const userStats = (userData?.stats_json as UserStats) ?? null;

  return (
    <WorkoutClient
      program={{ name: program.name, daysPerWeek: activeCycleView.daysPerWeek }}
      activeCycleView={activeCycleView}
      currentDay={currentDay}
      userStats={userStats}
    />
  );
}

