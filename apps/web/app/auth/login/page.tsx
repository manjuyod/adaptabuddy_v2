import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { getFirstSearchParamValue, resolveSafeRedirectTo } from "@/lib/auth/redirectTo";

type LegacyLoginSearchParams = {
  tab?: string | string[];
  redirectTo?: string | string[];
  redirectedFrom?: string | string[];
};

export default async function LegacyLoginPage({
  searchParams
}: {
  searchParams?: Promise<LegacyLoginSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const tab = getFirstSearchParamValue(resolvedSearchParams?.tab);
  const redirectTo =
    resolveSafeRedirectTo(getFirstSearchParamValue(resolvedSearchParams?.redirectTo)) ??
    resolveSafeRedirectTo(getFirstSearchParamValue(resolvedSearchParams?.redirectedFrom));

  const targetSearchParams = new URLSearchParams();
  if (tab === "signup") {
    targetSearchParams.set("tab", "signup");
  }
  if (redirectTo) {
    targetSearchParams.set("redirectTo", redirectTo);
  }

  const target = targetSearchParams.toString();
  redirect(target ? `${ROUTES.auth.login}?${target}` : ROUTES.auth.login);
}
