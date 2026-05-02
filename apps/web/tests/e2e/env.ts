import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

type RawEnvSource = Record<string, string | undefined>;
export const SUPABASE_PROJECT_REF = "vezfyhbrrpokheqipepa";

export const PLAYWRIGHT_PROJECT_NAMES = {
  desktop: "chromium-desktop",
  mobile: "chromium-mobile",
} as const;

export type PlaywrightProjectName =
  (typeof PLAYWRIGHT_PROJECT_NAMES)[keyof typeof PLAYWRIGHT_PROJECT_NAMES];

export const isChromiumDesktopProject = (name: string): name is PlaywrightProjectName =>
  name === PLAYWRIGHT_PROJECT_NAMES.desktop;
export const isChromiumMobileProject = (name: string): name is PlaywrightProjectName =>
  name === PLAYWRIGHT_PROJECT_NAMES.mobile;

const normalizeEnvValue = (value: string | undefined) => {
  if (!value) return undefined;

  let trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return undefined;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  return trimmed || undefined;
};

const isTruthyFlag = (value: string | undefined) => {
  const normalized = normalizeEnvValue(value)?.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const parseEnvLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const normalizedLine = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length)
    : trimmed;
  const separator = normalizedLine.indexOf("=");
  if (separator === -1) return null;

  const key = normalizedLine.slice(0, separator).trim();
  if (!key) return null;

  const value = normalizeEnvValue(normalizedLine.slice(separator + 1)) ?? "";
  return { key, value };
};

const loadEnvFileIfPresent = (filePath: string) => {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;

    const existing = process.env[parsed.key];
    if (
      existing !== undefined &&
      existing !== "" &&
      existing !== "null" &&
      existing !== "undefined"
    ) {
      continue;
    }

    process.env[parsed.key] = parsed.value;
  }
};

export const loadRepoRootDotenv = () => {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(thisDir, "..", "..", "..", "..");
  loadEnvFileIfPresent(path.join(repoRoot, ".env.local"));
  loadEnvFileIfPresent(path.join(repoRoot, ".env"));
};

const getFirstDefinedWithConflictCheck = (
  source: RawEnvSource,
  keys: string[],
  label: string,
  normalizeForComparison: (value: string) => string = (value) => value,
) => {
  const values = keys
    .map((key) => {
      const value = normalizeEnvValue(source[key]);
      return {
        key,
        value,
        comparisonValue: value ? normalizeForComparison(value) : undefined,
      };
    })
    .filter(
      (entry): entry is { key: string; value: string; comparisonValue: string } =>
        Boolean(entry.value),
    )
    .map((entry) => entry);

  if (values.length === 0) {
    return undefined;
  }

  const firstValue = values[0].comparisonValue;
  const hasConflict = values.some((entry) => entry.comparisonValue !== firstValue);
  if (hasConflict) {
    throw new Error(
      `[playwright-e2e-env] Conflicting values detected for ${label}: ${values
        .map((entry) => entry.key)
        .join(", ")}`,
    );
  }

  return firstValue;
};

const normalizeUrlOrigin = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
};

const PlaywrightE2EEnvSchema = z.object({
  supabaseUrl: z.string().url(),
  anonKey: z.string().min(1),
  serviceRoleKey: z.string().min(1),
  testEmail: z.string().email(),
  testPassword: z.string().min(1),
  runPlaywrightE2E: z.boolean(),
});

export type PlaywrightE2EEnv = z.infer<typeof PlaywrightE2EEnvSchema>;

export const resolvePlaywrightE2EEnv = (
  source: RawEnvSource = process.env,
): PlaywrightE2EEnv => {
  const supabaseUrl = getFirstDefinedWithConflictCheck(source, [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
  ], "SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL", normalizeUrlOrigin);
  const anonKey = getFirstDefinedWithConflictCheck(source, [
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ], "SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = getFirstDefinedWithConflictCheck(source, [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_TARGET_SERVICE_ROLE_KEY",
  ], "SUPABASE_SERVICE_ROLE_KEY / SUPABASE_TARGET_SERVICE_ROLE_KEY");
  const testEmail = normalizeEnvValue(source.SUPABASE_TEST_EMAIL);
  const testPassword = normalizeEnvValue(source.SUPABASE_TEST_PASSWORD);
  const runPlaywrightE2E = isTruthyFlag(source.RUN_PLAYWRIGHT_E2E);

  if (!runPlaywrightE2E) {
    throw new Error(
      "[playwright-e2e-env] RUN_PLAYWRIGHT_E2E must be truthy to run live Playwright suites.",
    );
  }

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!serviceRoleKey)
    missing.push("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_TARGET_SERVICE_ROLE_KEY");
  if (!testEmail) missing.push("SUPABASE_TEST_EMAIL");
  if (!testPassword) missing.push("SUPABASE_TEST_PASSWORD");

  if (missing.length > 0) {
    throw new Error(
      `[playwright-e2e-env] Missing required environment variables:\n- ${missing.join("\n- ")}`,
    );
  }

  const parsed = PlaywrightE2EEnvSchema.safeParse({
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    testEmail,
    testPassword,
    runPlaywrightE2E,
  });

  if (!parsed.success) {
    const issueText = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n- ");
    throw new Error(`[playwright-e2e-env] Invalid environment variable values:\n- ${issueText}`);
  }

  const parsedSupabaseUrl = new URL(parsed.data.supabaseUrl);
  if (parsedSupabaseUrl.protocol !== "https:") {
    throw new Error("[playwright-e2e-env] SUPABASE_URL must use https.");
  }

  if (parsedSupabaseUrl.hostname !== `${SUPABASE_PROJECT_REF}.supabase.co`) {
    throw new Error(
      `[playwright-e2e-env] SUPABASE_URL must target the expected project '${SUPABASE_PROJECT_REF}'.`,
    );
  }

  return parsed.data;
};
