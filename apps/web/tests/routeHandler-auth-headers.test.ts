import { describe, expect, it, vi } from "vitest";

const cacheControl = "private, no-cache, no-store, must-revalidate, max-age=0";

const routeContext = vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

  return {
    userId: "user-1",
    ip: "127.0.0.1",
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set() {},
    delete() {},
  }),
  headers: async () => ({
    get(name: string) {
      if (name.toLowerCase() === "x-forwarded-for") return routeContext.ip;
      if (name.toLowerCase() === "x-request-id") return "request-1";
      return null;
    },
  }),
}));

vi.mock("../src/lib/security/rateLimit", () => ({
  rateLimit: () => ({ success: true }),
}));

vi.mock("../src/lib/supabase/server", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/supabase/server")>(
    "../src/lib/supabase/server"
  );

  return {
    ...actual,
    getClient: (
      cookieStore: {
        setAll?: (
          cookies: { name: string; value: string; options: Record<string, unknown> }[],
          headers: Record<string, string>
        ) => void;
      }
    ) => {
      cookieStore.setAll?.(
        [{ name: "sb-token", value: "abc", options: { path: "/" } }],
        {
          "Cache-Control": cacheControl,
          Expires: "0",
          Pragma: "no-cache",
        }
      );

      return {
        auth: {
          getUser: async () => ({
            data: { user: { id: routeContext.userId } },
            error: null,
          }),
        },
      };
    },
  };
});

describe("runAuthedRoute auth headers", () => {
  it("preserves Supabase no-cache headers on API responses", async () => {
    const { runAuthedRoute } = await import("../src/lib/api/routeHandler");

    const response = await runAuthedRoute(
      new Request("http://localhost/api/test", { method: "POST" }),
      {
        route: "/api/test",
        action: "test",
        rateLimit: {
          keyPrefix: "test",
          limit: 1,
          windowMs: 60_000,
        },
        parseInput: () => ({ success: true, data: {} }),
        execute: () => ({ status: "success" }),
        extraHeaders: { "X-Route": "ok" },
      },
      undefined
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(cacheControl);
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("X-Route")).toBe("ok");
  });
});
