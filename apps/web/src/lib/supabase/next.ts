import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";
import { getClient } from "./server";

const normalizeCookieOptions = (options: CookieOptions) => {
  const normalized: Record<string, string | number | boolean | Date> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value == null) continue;
    normalized[key] = value as string | number | boolean | Date;
  }
  return normalized;
};

export const createSupabaseServerComponentClient = async () => {
  const cookieStore = await cookies();
  return getClient({
    getAll: () => cookieStore.getAll()
  });
};

export const createSupabaseServerActionClient = async () => {
  const cookieStore = await cookies();
  return getClient({
    getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (allCookies) => {
      for (const { name, value, options } of allCookies) {
        if (value === "") {
          cookieStore.delete({ name, ...normalizeCookieOptions(options) });
        } else {
          cookieStore.set({ name, value, ...normalizeCookieOptions(options) });
        }
      }
    }
  });
};
