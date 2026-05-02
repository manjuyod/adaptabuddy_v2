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

  return <OnboardingWizard programs={programs} fetchError={error} />;
}

