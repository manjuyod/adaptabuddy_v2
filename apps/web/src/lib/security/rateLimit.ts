import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logServerEvent } from "@/lib/observability/logger";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitRpcRow = {
  success?: unknown;
  remaining?: unknown;
  reset_at?: unknown;
};

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
  source: "postgres" | "memory";
};

const buckets = new Map<string, RateLimitBucket>();

const normalizeNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

const inMemoryRateLimit = (key: string, limit: number, windowMs: number): RateLimitResult => {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt, source: "memory" };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt, source: "memory" };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
    source: "memory",
  };
};

export const rateLimit = async (
  key: string,
  limit = 30,
  windowMs = 60_000
): Promise<RateLimitResult> => {
  const safeKey = key.trim().slice(0, 200) || "unknown";
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeWindowMs = Math.max(1, Math.floor(windowMs));

  const adminClient = createSupabaseAdminClient();
  if (!adminClient || typeof adminClient.rpc !== "function") {
    return inMemoryRateLimit(safeKey, safeLimit, safeWindowMs);
  }

  try {
    const { data, error } = await adminClient.rpc("consume_rate_limit", {
      p_key: safeKey,
      p_limit: safeLimit,
      p_window_ms: safeWindowMs,
    });

    if (error) {
      throw error;
    }

    const row = (Array.isArray(data) ? data[0] : data) as RateLimitRpcRow | null;
    if (!row) {
      throw new Error("consume_rate_limit returned no data");
    }

    const resetAtRaw = row.reset_at;
    const resetAt =
      resetAtRaw instanceof Date
        ? resetAtRaw.getTime()
        : typeof resetAtRaw === "string"
          ? Date.parse(resetAtRaw)
          : normalizeNumber(resetAtRaw, Date.now() + safeWindowMs);

    return {
      success: toBoolean(row.success, true),
      remaining: Math.max(0, Math.floor(normalizeNumber(row.remaining, safeLimit - 1))),
      resetAt: Number.isFinite(resetAt) ? resetAt : Date.now() + safeWindowMs,
      source: "postgres",
    };
  } catch (error) {
    logServerEvent({
      route: "/api/v0/*",
      action: "rateLimit",
      severity: "warn",
      reason: "dependency_error",
      statusCode: 0,
      details: { key: safeKey, source: "postgres" },
      error,
    });

    return inMemoryRateLimit(safeKey, safeLimit, safeWindowMs);
  }
};
