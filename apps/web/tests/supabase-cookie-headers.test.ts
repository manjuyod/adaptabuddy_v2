import { describe, expect, it } from "vitest";

const configureEnv = () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
};

describe("Supabase auth response headers", () => {
  it("applies SSR cache headers to a response", async () => {
    configureEnv();
    const { applySupabaseResponseHeaders } = await import("../src/lib/supabase/server");
    const headers = new Headers();

    applySupabaseResponseHeaders(headers, {
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
    });

    expect(headers.get("Cache-Control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0"
    );
    expect(headers.get("Expires")).toBe("0");
    expect(headers.get("Pragma")).toBe("no-cache");
  });

  it("lets Supabase auth headers override route cache headers", async () => {
    configureEnv();
    const { mergeSupabaseResponseHeaders } = await import("../src/lib/supabase/server");

    const headers = mergeSupabaseResponseHeaders(
      { "Cache-Control": "no-store", "X-Route": "ok" },
      { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0" }
    );

    expect(headers).toMatchObject({
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      "X-Route": "ok",
    });
  });
});
