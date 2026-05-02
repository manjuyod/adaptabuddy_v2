import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { getFirstSearchParamValue, resolveSafeRedirectTo } from "@/lib/auth/redirectTo";

type LegacySignupSearchParams = {
  redirectTo?: string | string[];
  redirectedFrom?: string | string[];
};

export default async function LegacySignupPage({
  searchParams
}: {
  searchParams?: Promise<LegacySignupSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectTo =
    resolveSafeRedirectTo(getFirstSearchParamValue(resolvedSearchParams?.redirectTo)) ??
    resolveSafeRedirectTo(getFirstSearchParamValue(resolvedSearchParams?.redirectedFrom));

  const targetSearchParams = new URLSearchParams({ tab: "signup" });
  if (redirectTo) {
    targetSearchParams.set("redirectTo", redirectTo);
  }

  redirect(`${ROUTES.auth.login}?${targetSearchParams.toString()}`);
}
