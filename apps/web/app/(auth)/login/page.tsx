import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { getFirstSearchParamValue, resolveSafeRedirectTo } from "@/lib/auth/redirectTo";
import { createSupabaseServerComponentClient } from "@/lib/supabase/next";
import { LoginScreen } from "@/modules/auth/components/login-screen";

type LoginPageSearchParams = {
  tab?: string | string[];
  redirectTo?: string | string[];
  redirectedFrom?: string | string[];
};

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<LoginPageSearchParams>;
}) {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user: userFromAuth }
  } = await supabase.auth.getUser();
  const user =
    userFromAuth ??
    (
      await supabase.auth.getSession()
    ).data.session?.user;

  if (user) {
    redirect(ROUTES.start);
  }

  const resolvedSearchParams = await searchParams;
  const tab = getFirstSearchParamValue(resolvedSearchParams?.tab);
  const redirectToRaw =
    getFirstSearchParamValue(resolvedSearchParams?.redirectTo) ??
    getFirstSearchParamValue(resolvedSearchParams?.redirectedFrom);

  return (
    <LoginScreen
      initialTab={tab === "signup" ? "signup" : "signin"}
      redirectTo={resolveSafeRedirectTo(redirectToRaw) ?? undefined}
    />
  );
}
