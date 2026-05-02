import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { createSupabaseServerComponentClient } from "@/lib/supabase/next";

export default async function AuthIndexPage() {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user: userFromAuth }
  } = await supabase.auth.getUser();
  const user =
    userFromAuth ??
    (
      await supabase.auth.getSession()
    ).data.session?.user;

  redirect(user ? ROUTES.start : ROUTES.auth.login);
}
