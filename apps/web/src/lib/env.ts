import { z } from "zod";
import { logServerEvent } from "@/lib/observability/logger";

const serverSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1)
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

const readEnvValue = (value: string | undefined) => {
  if (!value) return undefined;
  let trimmed = value.trim();
  if (!trimmed) return undefined;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return undefined;
  return trimmed;
};

const isDevServer = process.env.NODE_ENV === "development" && typeof window === "undefined";
if (isDevServer) {
  const rawServerUrl = process.env.SUPABASE_URL;
  const rawClientUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawServerKey = process.env.SUPABASE_ANON_KEY;
  const rawClientKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasSuspiciousUrl =
    rawServerUrl === "null" ||
    rawClientUrl === "null" ||
    rawServerUrl === "undefined" ||
    rawClientUrl === "undefined" ||
    rawServerUrl === "" ||
    rawClientUrl === "";
  const hasSuspiciousKey =
    rawServerKey === "null" ||
    rawClientKey === "null" ||
    rawServerKey === "undefined" ||
    rawClientKey === "undefined" ||
    rawServerKey === "" ||
    rawClientKey === "";

  if (hasSuspiciousUrl || hasSuspiciousKey) {
    logServerEvent({
      route: "env",
      action: "serverEnvValidation",
      severity: "warn",
      reason: "dependency_error",
      details: {
        SUPABASE_URL: rawServerUrl ?? null,
        NEXT_PUBLIC_SUPABASE_URL: rawClientUrl ?? null,
        SUPABASE_ANON_KEY: rawServerKey ? "[set]" : null,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: rawClientKey ? "[set]" : null,
      },
    });
  }
}

export const serverEnv = serverSchema.parse({
  SUPABASE_URL:
    readEnvValue(process.env.SUPABASE_URL) ?? readEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
  SUPABASE_ANON_KEY:
    readEnvValue(process.env.SUPABASE_ANON_KEY) ??
    readEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: readEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: readEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
});
