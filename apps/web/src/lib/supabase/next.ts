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
    get: (name: string) => cookieStore.get(name)
  });
};

export const createSupabaseServerActionClient = async () => {
  const cookieStore = await cookies();
  return getClient({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string, options: CookieOptions) =>
      cookieStore.set({ name, value, ...normalizeCookieOptions(options) }),
    delete: (name: string, options: CookieOptions) =>
      cookieStore.delete({ name, ...normalizeCookieOptions(options) })
  });
};
