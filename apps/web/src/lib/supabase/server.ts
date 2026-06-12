import { type CookieOptions, createServerClient, type SetAllCookies } from "@supabase/ssr";
import { serverEnv } from "../env";

type CookieStore = {
  getAll: () => { name: string; value: string }[];
  set?: (name: string, value: string, options: CookieOptions) => void;
  delete?: (name: string, options: CookieOptions) => void;
  setAll?: SetAllCookies;
};

export const applySupabaseResponseHeaders = (
  responseHeaders: Headers,
  headers: Record<string, string>
) => {
  for (const [key, value] of Object.entries(headers)) {
    responseHeaders.set(key, value);
  }
};

export const mergeSupabaseResponseHeaders = (
  extraHeaders: Record<string, string> | undefined,
  supabaseHeaders: Record<string, string>
) => {
  const merged = { ...(extraHeaders ?? {}) };
  for (const [key, value] of Object.entries(supabaseHeaders)) {
    merged[key] = value;
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
};

export const getClient = (cookieStore: CookieStore) =>
  createServerClient(serverEnv.SUPABASE_URL, serverEnv.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(allCookies, headers) {
        if (!cookieStore.setAll) {
          return;
        }

        cookieStore.setAll(allCookies, headers);
      }
    }
  });
