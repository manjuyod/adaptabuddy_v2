import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const cacheControl = "private, no-cache, no-store, must-revalidate, max-age=0";

vi.mock("../src/lib/supabase/middleware", () => ({
  createSupabaseMiddlewareClient: () => {
    const res = NextResponse.next();
    res.cookies.set({ name: "sb-token", value: "abc", path: "/" });

    return {
      res,
      authHeaders: new Headers({
        "Cache-Control": cacheControl,
        Expires: "0",
        Pragma: "no-cache",
      }),
      supabase: {
        auth: {
          getUser: async () => ({ data: { user: null } }),
          getSession: async () => ({ data: { session: null } }),
        },
      },
    };
  },
}));

vi.mock("../src/lib/auth/guard", () => ({
  getAuthGuardRedirect: () => ({
    pathname: "/login",
    searchParams: { next: "/dashboard" },
  }),
}));

const configureEnv = () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
};

describe("proxy auth header preservation", () => {
  it("copies Supabase auth cookies and cache headers onto redirects", async () => {
    configureEnv();
    const { proxy } = await import("../proxy");

    const response = await proxy(new NextRequest("http://localhost/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("Set-Cookie")).toContain("sb-token=abc");
    expect(response.headers.get("Cache-Control")).toBe(cacheControl);
    expect(response.headers.get("Pragma")).toBe("no-cache");
  });
});
