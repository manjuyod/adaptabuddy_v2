import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { applySupabaseResponseHeaders, getClient } from "../../../src/lib/supabase/server";
import { resolveSafeCallbackRedirect } from "@/lib/auth/callbackRedirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectUrl = resolveSafeCallbackRedirect(url.searchParams.get("next"), request.url);
  const authHeaders: Record<string, string> = {};

  if (code) {
    const cookieStore = await cookies();
    const supabase = getClient({
      getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (allCookies, headers) => {
        for (const { name, value, options } of allCookies) {
          if (value === "") {
            cookieStore.delete({ name, ...options });
          } else {
            cookieStore.set({ name, value, ...options });
          }
        }

        Object.assign(authHeaders, headers);
      },
    });
    await supabase.auth.exchangeCodeForSession(code);
  }

  const response = NextResponse.redirect(redirectUrl);
  applySupabaseResponseHeaders(response.headers, authHeaders);

  return response;
}
