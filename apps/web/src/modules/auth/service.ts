import { cookies } from "next/headers";
import { logServerEvent } from "@/lib/observability/logger";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";

const isSupabaseAuthCookie = (name: string) =>
  name.startsWith("sb-") && (name.includes("-auth-token") || name.includes("-code-verifier"));

const clearSupabaseAuthCookies = async () => {
  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) {
    if (!isSupabaseAuthCookie(name)) continue;
    cookieStore.delete(name);
  }
};

export async function logoutUserSession() {
  const supabase = await createSupabaseServerActionClient();
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    logServerEvent({
      route: "/settings",
      action: "logoutUserSession.signOut",
      severity: "warn",
      reason: "dependency_error",
      error
    });
  } finally {
    await clearSupabaseAuthCookies();
  }
}
