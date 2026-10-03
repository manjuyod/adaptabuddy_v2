import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "./src/lib/supabase/middleware";
import { getAuthGuardRedirect } from "./src/lib/auth/guard";
import { applySupabaseResponseHeaders } from "./src/lib/supabase/server";
import { clientEnv } from "./src/lib/env";
import { createContentSecurityPolicy } from "./src/lib/security/content-security-policy";

const withAuthResponseState = (
  source: NextResponse,
  target: NextResponse,
  authHeaders: Headers
) => {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }

  applySupabaseResponseHeaders(target.headers, Object.fromEntries(authHeaders));

  return target;
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isDev = process.env.NODE_ENV === "development";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = createContentSecurityPolicy({
    nonce,
    supabaseUrl: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    isDevelopment: isDev,
  });
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { supabase, res, authHeaders } = createSupabaseMiddlewareClient(req);
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (isDev) {
    const cookieNames = req.cookies.getAll().map((cookie) => cookie.name);
    // eslint-disable-next-line no-console
    console.log("[auth-middleware] session check", {
      pathname,
      hasUser: Boolean(user),
      hasSession: Boolean(session?.user),
      cookieNames
    });
  }

  const redirectTarget = getAuthGuardRedirect({
    pathname,
    search: req.nextUrl.search,
    isAuthenticated: Boolean(user ?? session?.user)
  });

  if (!redirectTarget) {
    const response = withAuthResponseState(
      res,
      NextResponse.next({ request: { headers: requestHeaders }, headers: res.headers }),
      authHeaders
    );
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = redirectTarget.pathname;
  redirectUrl.search = "";

  if (redirectTarget.searchParams) {
    for (const [key, value] of Object.entries(redirectTarget.searchParams)) {
      redirectUrl.searchParams.set(key, value);
    }
  }

  const response = withAuthResponseState(res, NextResponse.redirect(redirectUrl), authHeaders);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|sw.js|.*\\..*).*)"]
};
