import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClient } from "../../../src/lib/supabase/server";
import type { CookieOptions } from "@supabase/ssr";
import { resolveSafeCallbackRedirect } from "@/lib/auth/callbackRedirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectUrl = resolveSafeCallbackRedirect(url.searchParams.get("next"), request.url);

  if (code) {
    const cookieStore = await cookies();
    const supabase = getClient({
      get: (name: string) => cookieStore.get(name),
      set: (name: string, value: string, options: CookieOptions) =>
        cookieStore.set({ name, value, ...options }),
      delete: (name: string, options: CookieOptions) => cookieStore.delete({ name, ...options })
    });
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(redirectUrl);
}
