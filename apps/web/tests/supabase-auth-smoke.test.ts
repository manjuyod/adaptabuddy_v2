import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { describe, expect, it } from "vitest";

const explicitRunSupabaseAuthSmoke = process.env.RUN_SUPABASE_AUTH_SMOKE;

const normalizeEnvValue = (value: string | undefined) => {
  if (!value) return undefined;
  let trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed || undefined;
};

const isTruthyFlag = (value: string | undefined) => {
  const normalized = normalizeEnvValue(value);
  if (!normalized) return false;
  return normalized === "1" || normalized.toLowerCase() === "true" || normalized.toLowerCase() === "yes";
};

const parseEnvLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq === -1) return null;
  const key = trimmed.slice(0, eq).trim();
  const value = normalizeEnvValue(trimmed.slice(eq + 1)) ?? "";
  if (!key) return null;
  return { key, value };
};

const applyEnvFileIfPresent = (filePath: string) => {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const entry = parseEnvLine(line);
    if (!entry) continue;
    const existing = process.env[entry.key];
    if (existing !== undefined && existing !== "" && existing !== "null" && existing !== "undefined") continue;
    process.env[entry.key] = entry.value;
  }
};

const loadRepoRootDotenv = () => {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(thisDir, "..", "..", "..");
  applyEnvFileIfPresent(path.join(repoRoot, ".env.local"));
  applyEnvFileIfPresent(path.join(repoRoot, ".env"));
};

loadRepoRootDotenv();

const shouldRun = isTruthyFlag(explicitRunSupabaseAuthSmoke);
const maybeIt = shouldRun ? it : it.skip;
if (!shouldRun) {
  // eslint-disable-next-line no-console
  console.warn("[supabase-auth-smoke] skipped: RUN_SUPABASE_AUTH_SMOKE is not set to 1/true/yes", {
    RUN_SUPABASE_AUTH_SMOKE: explicitRunSupabaseAuthSmoke ?? null
  });
}

const resolveSupabaseEnv = () => {
  const schema = z
    .object({
      serverUrl: z.string().url().optional(),
      serverAnonKey: z.string().min(1).optional(),
      clientUrl: z.string().url().optional(),
      clientAnonKey: z.string().min(1).optional()
    })
    .refine((value) => value.serverUrl || value.clientUrl, {
      message: "Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL"
    })
    .refine((value) => value.serverAnonKey || value.clientAnonKey, {
      message: "Missing SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    });

  const value = schema.parse({
    serverUrl: process.env.SUPABASE_URL,
    serverAnonKey: process.env.SUPABASE_ANON_KEY,
    clientUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    clientAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });

  if (value.serverUrl && value.clientUrl && value.serverUrl !== value.clientUrl) {
    throw new Error(
      "SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL do not match. Update your repo root .env to keep server + client aligned."
    );
  }

  if (value.serverAnonKey && value.clientAnonKey && value.serverAnonKey !== value.clientAnonKey) {
    throw new Error(
      "SUPABASE_ANON_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY do not match. Update your repo root .env to keep server + client aligned."
    );
  }

  return {
    url: value.serverUrl ?? value.clientUrl ?? "",
    anonKey: value.serverAnonKey ?? value.clientAnonKey ?? ""
  };
};

const resolveAuthCredentials = () => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  });

  const value = schema.safeParse({
    email: normalizeEnvValue(process.env.SUPABASE_TEST_EMAIL ?? process.env.TEST_AUTH_EMAIL),
    password: normalizeEnvValue(process.env.SUPABASE_TEST_PASSWORD ?? process.env.TEST_AUTH_PASSWORD)
  });

  if (!value.success) {
    throw new Error(
      [
        "Missing SUPABASE_TEST_EMAIL/TEST_AUTH_EMAIL or SUPABASE_TEST_PASSWORD/TEST_AUTH_PASSWORD.",
        "Set them in your shell before running RUN_SUPABASE_AUTH_SMOKE=1."
      ].join(" ")
    );
  }

  return value.data;
};

describe("supabase auth smoke", () => {
  maybeIt("signs in with a test user", async () => {
    const { url, anonKey } = resolveSupabaseEnv();
    const { email, password } = resolveAuthCredentials();

    const supabase = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(
        [
          `Supabase auth failed: ${error.message}`,
          "Ensure the test user exists and has a confirmed email."
        ].join("\n")
      );
    }

    expect(data.session).toBeTruthy();
    expect(data.user?.email).toBe(email);

    await supabase.auth.signOut();
  });
});
