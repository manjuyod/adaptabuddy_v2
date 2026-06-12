import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { serverEnv } from "../env";
import { applySupabaseResponseHeaders } from "./server";

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
  const authHeaders = new Headers();
  const supabase = createServerClient(serverEnv.SUPABASE_URL, serverEnv.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (setCookies, headers) => {
        for (const { name, value, options } of setCookies) {
          if (value === "") {
            res.cookies.delete({ name, ...normalizeCookieOptions(options) });
          } else {
            res.cookies.set({ name, value, ...normalizeCookieOptions(options) });
          }
        }

        applySupabaseResponseHeaders(res.headers, headers);
        applySupabaseResponseHeaders(authHeaders, headers);
      }
    }
  });
  return { supabase, res, authHeaders };
};
