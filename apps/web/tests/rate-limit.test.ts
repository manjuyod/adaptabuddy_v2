import { beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "../src/lib/security/rateLimit";
import { createSupabaseAdminClient } from "../src/lib/supabase/admin";

vi.mock("../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const mockedCreateAdminClient = vi.mocked(createSupabaseAdminClient);

describe("distributed rateLimit", () => {
  beforeEach(() => {
    mockedCreateAdminClient.mockReset();
  });

  it("uses postgres rpc when available", async () => {
    const resetAt = "2026-02-14T00:00:10.000Z";
    const rpc = vi.fn().mockResolvedValue({
      data: [{ success: true, remaining: 2, reset_at: resetAt }],
      error: null,
    });

    mockedCreateAdminClient.mockReturnValue({ rpc } as never);

    const result = await rateLimit("key-postgres", 3, 60_000);

    expect(result.source).toBe("postgres");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetAt).toBe(Date.parse(resetAt));
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "key-postgres",
      p_limit: 3,
      p_window_ms: 60_000,
    });
  });

  it("respects postgres denial payload", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ success: false, remaining: 0, reset_at: "2026-02-14T00:00:10.000Z" }],
      error: null,
    });

    mockedCreateAdminClient.mockReturnValue({ rpc } as never);

    const result = await rateLimit("key-deny", 1, 60_000);

    expect(result.source).toBe("postgres");
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("falls back to in-memory limiter when admin client is unavailable", async () => {
    mockedCreateAdminClient.mockReturnValue(null);

    const key = `memory-${Date.now()}`;
    const first = await rateLimit(key, 2, 60_000);
    const second = await rateLimit(key, 2, 60_000);
    const third = await rateLimit(key, 2, 60_000);

    expect(first.source).toBe("memory");
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(third.success).toBe(false);
  });

  it("falls back to in-memory limiter when rpc throws", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "boom" },
    });

    mockedCreateAdminClient.mockReturnValue({ rpc } as never);

    const key = `fallback-${Date.now()}`;
    const first = await rateLimit(key, 1, 60_000);
    const second = await rateLimit(key, 1, 60_000);

    expect(first.source).toBe("memory");
    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
  });
});
