import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import { clientEnv } from "../env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

const getCookie = (name: string) => {
  if (typeof document === "undefined") return undefined;
  const entry = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  if (!entry) return undefined;
  return decodeURIComponent(entry.slice(name.length + 1));
};

const setCookie = (name: string, value: string, options: CookieOptions) => {
  if (typeof document === "undefined") return;
  const secure =
    options.secure ?? (typeof location !== "undefined" ? location.protocol === "https:" : false);
  const sameSite = options.sameSite ?? "lax";
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? "/"}`,
    options.maxAge !== undefined ? `Max-Age=${options.maxAge}` : "",
    `SameSite=${sameSite}`,
    secure ? "Secure" : ""
  ].filter(Boolean);
  document.cookie = attrs.join("; ");
};

export const getBrowserClient = () =>
  (browserClient ??= createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: getCookie,
        set: (name: string, value: string, options: CookieOptions) =>
          setCookie(name, value, { ...options, path: options.path ?? "/" }),
        remove: (name: string, options: CookieOptions) =>
          setCookie(name, "", { ...options, maxAge: 0, path: options.path ?? "/" })
      }
    }
  ));
