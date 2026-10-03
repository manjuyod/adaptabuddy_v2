import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("../src/lib/supabase/middleware", () => ({
  createSupabaseMiddlewareClient: () => {
    const res = NextResponse.next();
    res.cookies.set("sb-refreshed-session", "updated-token", { httpOnly: true, path: "/" });
    res.headers.set("X-Auth-Response", "preserved");
    res.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
    return {
      res,
      authHeaders: new Headers({
        "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
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

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_ANON_KEY", "public-test-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("page content security policy", () => {
  it("forwards a fresh nonce policy to Next rendering and the browser", async () => {
    const { proxy } = await import("../proxy");
    const request = new NextRequest("http://localhost/login", {
      headers: { "x-nonce": "attacker-supplied", "content-security-policy": "script-src *" },
    });
    const response = await proxy(request);
    const nonce = response.headers.get("x-middleware-request-x-nonce");
    const csp = response.headers.get("Content-Security-Policy");

    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect(nonce).not.toBe("attacker-supplied");
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    const scriptPolicy = csp?.split(";").find((part) => part.trim().startsWith("script-src "));
    expect(scriptPolicy).toContain("'strict-dynamic'");
    expect(scriptPolicy).not.toContain("'unsafe-inline'");
    expect(scriptPolicy).not.toContain("'unsafe-eval'");

    const nextResponse = await proxy(new NextRequest("http://localhost/login"));
    expect(nextResponse.headers.get("x-middleware-request-x-nonce")).not.toBe(nonce);
  });

  it("allows the configured local Supabase HTTP and WebSocket origins", async () => {
    const { proxy } = await import("../proxy");
    const response = await proxy(new NextRequest("http://localhost/login"));
    const csp = response.headers.get("Content-Security-Policy");

    expect(csp).toContain("connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321");
  });

  it("allows only the configured hosted Supabase origins", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    const { proxy } = await import("../proxy");
    const response = await proxy(new NextRequest("https://app.example.test/login"));
    const csp = response.headers.get("Content-Security-Policy");

    expect(csp).toContain("connect-src 'self' https://project.supabase.co wss://project.supabase.co");
    expect(csp).not.toContain("*.supabase.co");
  });

  it("preserves auth cookies, response headers and incoming request headers", async () => {
    const { proxy } = await import("../proxy");
    const response = await proxy(new NextRequest("http://localhost/login", {
      headers: { "x-request-id": "request-123" },
    }));

    expect(response.cookies.get("sb-refreshed-session")?.value).toBe("updated-token");
    expect(response.headers.get("Cache-Control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("X-Auth-Response")).toBe("preserved");
    expect(response.headers.get("x-middleware-request-x-request-id")).toBe("request-123");
  });

  it("retains the auth redirect and refreshed cookies with a nonce policy", async () => {
    const { proxy } = await import("../proxy");
    const response = await proxy(new NextRequest("http://localhost/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?");
    expect(response.cookies.get("sb-refreshed-session")?.value).toBe("updated-token");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Content-Security-Policy")).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  });
});
