import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { serverEnv } from "../env";

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
  set?: (name: string, value: string, options: CookieOptions) => void;
  delete?: (name: string, options: CookieOptions) => void;
};

export const getClient = (cookieStore: CookieStore) =>
  createServerClient(serverEnv.SUPABASE_URL, serverEnv.SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set?.(name, value, options);
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.delete?.(name, options);
      }
    }
  });
