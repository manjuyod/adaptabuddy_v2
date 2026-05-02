import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveStartScreen } from "@/lib/start-screen";
import { ROUTES } from "@/lib/routes";
import { createSupabaseServerComponentClient } from "@/lib/supabase/next";
import { logServerEvent } from "@/lib/observability/logger";
import { toAuthedUser } from "@/modules/auth/session-user";
import { TitleMenuScreen } from "@/modules/title/components/title-menu-screen";

const PreferredStartScreenSchema = z.enum(["auto", "start", "continue"]);

const UserProfileRowSchema = z.object({
  has_save: z.boolean().catch(false),
  preferred_start_screen: PreferredStartScreenSchema.catch("auto")
});

export default async function StartPage() {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user: userFromAuth },
    error: userError
  } = await supabase.auth.getUser();
  const user =
    userFromAuth ??
    (
      await supabase.auth.getSession()
    ).data.session?.user;
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // eslint-disable-next-line no-console
    console.log("[start] auth snapshot", {
      hasUserFromAuth: Boolean(userFromAuth),
      hasSessionUser: Boolean(user),
      userError: userError?.message ?? null
    });
  }

  if (userError) {
    logServerEvent({
      route: "/start",
      action: "StartPage.auth.getUser",
      severity: "warn",
      reason: "dependency_error",
      details: { message: userError.message },
    });
  }

  if (!user) {
    redirect(ROUTES.auth.login);
  }

  const authedUser = toAuthedUser(user);
  if (!authedUser) {
    logServerEvent({
      route: "/start",
      action: "StartPage.toAuthedUser",
      severity: "warn",
      reason: "unauthorized",
    });
    redirect(ROUTES.auth.login);
  }

  const { data, error: profileError } = await supabase
    .from("users")
    .select("has_save, preferred_start_screen")
    .eq("id", authedUser.id)
    .maybeSingle();

  if (profileError) {
    logServerEvent({
      route: "/start",
      action: "StartPage.loadProfile",
      severity: "warn",
      reason: "dependency_error",
      userId: authedUser.id,
      details: { message: profileError.message },
    });
  }

  const parsedProfile = UserProfileRowSchema.safeParse(data ?? {});
  if (!parsedProfile.success) {
    logServerEvent({
      route: "/start",
      action: "StartPage.parseProfile",
      severity: "warn",
      reason: "validation_failed",
      userId: authedUser.id,
      details: { message: parsedProfile.error.message },
    });
  }

  const fallbackProfile = { has_save: false, preferred_start_screen: "auto" } as const;
  const profile = parsedProfile.success ? parsedProfile.data : fallbackProfile;
  const route = resolveStartScreen(profile.has_save, profile.preferred_start_screen);

  return <TitleMenuScreen variant={route} />;
}
