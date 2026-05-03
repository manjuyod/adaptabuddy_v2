import { redirect } from "next/navigation";
import { createSupabaseServerComponentClient } from "@/lib/supabase/next";
import { getProgramCatalog } from "@/modules/programs/service";
import { OnboardingWizard } from "@/modules/onboarding/components/OnboardingWizard";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { programs, error } = await getProgramCatalog(supabase);
  const { data: muscleGroups, error: muscleError } = await supabase
    .from("muscle_groups")
    .select("id, slug, name")
    .order("name", { ascending: true });

  return (
    <OnboardingWizard
      programs={programs}
      muscleGroups={
        (muscleGroups ?? [])
          .map((group) => ({
            id: String(group.id),
            slug: String(group.slug),
            name: String(group.name),
          }))
          .filter(
            (group): group is { id: string; slug: string; name: string } =>
              group.slug.length > 0 && group.name.length > 0
          )
      }
      fetchError={error}
      muscleFetchError={muscleError ? "Unable to load injury options." : null}
    />
  );
}

