import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("parseWithSchema", () => {
  it("returns string arrays for schema validation failures", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { parseWithSchema } = await import("../src/lib/api/routeHandler");

    const result = parseWithSchema(
      { seed: 1 },
      z.object({
        planId: z.string().min(8)
      })
    );

    if (result.success) {
      expect(result.success).toBe(false);
      return;
    }

    expect(result.errors).toEqual(expect.arrayContaining([expect.any(String)]));
  });
});
