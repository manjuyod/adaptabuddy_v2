import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { serverEnv } from "../env";

const normalizeCookieOptions = (options: CookieOptions) => {
  const normalized: Record<string, string | number | boolean | Date> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value == null) continue;
    normalized[key] = value as string | number | boolean | Date;
  }
  return normalized;
};

export const createSupabaseMiddlewareClient = (req: NextRequest) => {
  const res = NextResponse.next();
  const supabase = createServerClient(serverEnv.SUPABASE_URL, serverEnv.SUPABASE_ANON_KEY, {
    cookies: {
      get: (name: string) => req.cookies.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) =>
        res.cookies.set({ name, value, ...normalizeCookieOptions(options) }),
      remove: (name: string, options: CookieOptions) =>
        res.cookies.delete({ name, ...normalizeCookieOptions(options) })
    }
  });
  return { supabase, res };
};
