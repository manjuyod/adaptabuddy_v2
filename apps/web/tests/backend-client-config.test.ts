import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/next", () => ({
  createSupabaseServerComponentClient: async () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: "user-token" } } }) },
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Rust API connection configuration", () => {
  it.each([
    ["http://api:3000", "http://localhost:3000", "http://api:3000"],
    [undefined, "http://localhost:4000", "http://localhost:4000"],
    [undefined, undefined, "http://127.0.0.1:3000"],
  ])("routes server requests using private=%s and public=%s", async (privateUrl, publicUrl, expected) => {
    vi.stubEnv("API_BASE_URL", privateUrl);
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", publicUrl);
    const request = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", request);
    const { fetchBackendApi } = await import("../src/lib/api/backend-client");

    expect(await fetchBackendApi("/api/v0/me")).toEqual({ ok: true });
    expect(request).toHaveBeenCalledWith(`${expected}/api/v0/me`, expect.any(Object));
    const headers = request.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer user-token");
  });
});
